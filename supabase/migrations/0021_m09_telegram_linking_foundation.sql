-- ============================================================
-- M09 / D-15 / D-18: Telegram Linking Foundation
-- One-time token issue/consume contract
-- ============================================================

-- Token byte length (32 bytes = 256 bits for SHA-256)
-- Using 32 bytes for the plain token (base64url encoded → ~43 chars after removing padding)
create or replace function public.gen_telegram_link_token()
returns text
language plpgsql
security definer
as $$
declare
  v_bytes bytea;
begin
  v_bytes := gen_random_bytes(32);
  -- base64url encoding: replace '+' with '-', '/' with '_', strip '=' padding
  return 'link_' || translate(
    encode(v_bytes, 'base64'),
    '+/=',
    '-_'
  );
end;
$$;

-- SHA-256 hash of the plain token (stored at rest, never exposed plain)
create or replace function public.hash_telegram_link_token(plain_token text)
returns text
language plpgsql
security definer
stable
as $$
begin
  return encode(sha256(plain_token::bytea), 'hex');
end;
$$;

-- ============================================================
-- issue_telegram_link_token
-- Authenticated entry point for residents to request a deep link.
-- Accepts bot_username to construct the t.me URL without leaking
-- the bot token into browser-accessible code.
-- ============================================================

create or replace function public.issue_telegram_link_token(
  p_profile_id uuid,
  p_bot_username text
)
returns table (
  plain_token text,
  token_hash text,
  deep_link text
)
language plpgsql
security definer
as $$
begin
  -- Validate inputs
  if p_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if p_bot_username is null or length(p_bot_username) = 0 then
    raise exception 'bot_username is required';
  end if;

  -- Invalidate any prior unconsumed tokens for this profile (T-05-04)
  -- This ensures a fresh start each time the resident requests a link
  update public.telegram_link_tokens
  set consumed_at = now()
  where profile_id = p_profile_id
    and consumed_at is null;

  -- Generate the one-time token (OUT params: plain_token, token_hash, deep_link)
  plain_token := public.gen_telegram_link_token();
  token_hash := public.hash_telegram_link_token(plain_token);

  -- Store only the hash, never the plain token (T-05-01)
  insert into public.telegram_link_tokens (profile_id, token_hash, expires_at)
  values (p_profile_id, token_hash, now() + interval '15 minutes');

  -- Construct deep link with the plain token
  deep_link := 'https://t.me/' || p_bot_username || '?start=' || plain_token;

  return next;
end;
$$;

-- ============================================================
-- consume_telegram_link_token
-- Called by the telegram-bot-webhook when a user visits
-- /start link_<token>.  Accepts hashed token input plus Telegram
-- identity metadata.  Enforces 15-minute single-use semantics.
-- Rejects caller-supplied profile override (T-05-02).
-- Surfaces telegram_user_id uniqueness conflict as D-18 message.
-- ============================================================

create or replace function public.consume_telegram_link_token(
  p_plain_token text,
  p_telegram_user_id bigint,
  p_telegram_chat_id bigint,
  p_username text,
  p_first_name text,
  p_last_name text,
  p_language_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_token_hash text;
  v_token_row record;
  v_success boolean := false;
  v_error_message text;
begin
  -- Validate inputs
  if p_plain_token is null or p_telegram_user_id is null or p_telegram_chat_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  end if;

  -- Hash the incoming plain token
  v_token_hash := public.hash_telegram_link_token(p_plain_token);

  -- Look up the token by hash (T-05-01: only hash stored at rest)
  select id, profile_id, expires_at, consumed_at
  into v_token_row
  from public.telegram_link_tokens
  where token_hash = v_token_hash
  limit 1;

  -- Token not found
  if v_token_row.id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Token tidak valid atau sudah kadaluarsa.'
    );
  end if;

  -- Token expired (T-05-04)
  if v_token_row.expires_at < now() then
    return jsonb_build_object(
      'success', false,
      'error', 'Token tidak valid atau sudah kadaluarsa.'
    );
  end if;

  -- Token already consumed — replay attack (T-05-04)
  if v_token_row.consumed_at is not null then
    return jsonb_build_object(
      'success', false,
      'error', 'Token tidak valid atau sudah kadaluarsa.'
    );
  end if;

  -- T-05-07 / D-18: telegram_user_id uniqueness conflict
  -- Reject if this telegram_user_id is already linked to a DIFFERENT profile
  if exists (
    select 1 from public.telegram_accounts
    where telegram_user_id = p_telegram_user_id
      and profile_id != v_token_row.profile_id
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'Akun Telegram @' || coalesce(p_username, 'nama pengguna') || ' sudah terhubung ke akun lain. Silakan gunakan akun Telegram yang berbeda atau hubungi pengurus.'
    );
  end if;

  -- T-05-02: Profile already has a linked Telegram account (one per resident)
  if exists (
    select 1 from public.telegram_accounts
    where profile_id = v_token_row.profile_id
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'Akun Telegram kamu sudah terhubung dengan IPL Jatiloka.'
    );
  end if;

  -- Mark token as consumed atomically before inserting account
  update public.telegram_link_tokens
  set consumed_at = now()
  where id = v_token_row.id;

  -- Upsert linked Telegram identity
  insert into public.telegram_accounts (
    profile_id,
    telegram_user_id,
    telegram_chat_id,
    username,
    first_name,
    last_name,
    language_code,
    allows_notifications,
    linked_at,
    last_seen_at
  )
  values (
    v_token_row.profile_id,
    p_telegram_user_id,
    p_telegram_chat_id,
    p_username,
    p_first_name,
    p_last_name,
    p_language_code,
    true,
    now(),
    now()
  )
  on conflict (profile_id) do update
    set telegram_user_id    = excluded.telegram_user_id,
        telegram_chat_id   = excluded.telegram_chat_id,
        username           = excluded.username,
        first_name         = excluded.first_name,
        last_name          = excluded.last_name,
        language_code      = excluded.language_code,
        allows_notifications = true,
        linked_at          = now(),
        last_seen_at       = now();

  v_success := true;

  return jsonb_build_object(
    'success', v_success,
    'profile_id', v_token_row.profile_id
  );

exception
  when unique_violation then
    -- D-18: telegram_user_id already linked to another profile (race condition)
    return jsonb_build_object(
      'success', false,
      'error', 'Akun Telegram @' || coalesce(p_username, 'nama pengguna') || ' sudah terhubung ke akun lain. Silakan gunakan akun Telegram yang berbeda atau hubungi pengurus.'
    );
  when others then
    get stacked diagnostics v_error_message = message_text;
    return jsonb_build_object(
      'success', false,
      'error', 'Terjadi kesalahan. Silakan coba lagi.'
    );
end;
$$;

-- ============================================================
-- Indexes for fast token lookup and uniqueness enforcement
-- ============================================================

create index if not exists idx_telegram_link_tokens_token_hash
  on public.telegram_link_tokens(token_hash);

create index if not exists idx_telegram_link_tokens_profile_id
  on public.telegram_link_tokens(profile_id);

create index if not exists idx_telegram_link_tokens_expires_at
  on public.telegram_link_tokens(expires_at);

create index if not exists idx_telegram_accounts_telegram_user_id
  on public.telegram_accounts(telegram_user_id);

create index if not exists idx_telegram_accounts_profile_id
  on public.telegram_accounts(profile_id);

-- ============================================================
-- Trigger: set updated_at on telegram_accounts
-- ============================================================

alter table public.telegram_accounts
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger telegram_accounts_set_updated_at
  before update on public.telegram_accounts
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- RLS is already enabled in 0005_rls_policies.sql
-- Policies are already defined in 0005_rls_policies.sql:
--   telegram_accounts_insert_own_or_super_admin
--   telegram_accounts_update_own_or_super_admin
--   telegram_link_tokens_insert_own_or_admin
--   telegram_link_tokens_update_own_or_admin
-- No additional RLS policies needed — the SQL contract functions
-- use security definer and handle all authorization internally.
-- ============================================================
