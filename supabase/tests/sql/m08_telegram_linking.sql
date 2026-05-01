do $$
declare
  v_super_admin uuid := '81000000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '81000000-0000-0000-0000-000000000002'::uuid;
  v_treasurer uuid := '81000000-0000-0000-0000-000000000003'::uuid;
  v_resident_a uuid := '81000000-0000-0000-0000-000000000004'::uuid;
  v_resident_b uuid := '81000000-0000-0000-0000-000000000005'::uuid;
  v_plain_token text;
  v_token_hash text;
  v_deep_link text;
  v_plain_token2 text;
  v_token_hash2 text;
  v_deep_link2 text;
  v_bot_username text := 'test_ipl_jatiloka_bot';
begin
  -- ============================================================
  -- Prerequisites: tables, functions, enums
  -- ============================================================

  if to_regclass('public.telegram_accounts') is null then
    raise exception 'telegram_accounts table is required';
  end if;

  if to_regclass('public.telegram_link_tokens') is null then
    raise exception 'telegram_link_tokens table is required';
  end if;

  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'issue_telegram_link_token'
  ) then
    raise exception 'public.issue_telegram_link_token() is required';
  end if;

  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'consume_telegram_link_token'
  ) then
    raise exception 'public.consume_telegram_link_token() is required';
  end if;

  if not exists (
    select 1 from pg_type
    where typname = 'notification_channel'
      and typnamespace = 'public'::regnamespace
  ) then
    raise exception 'enum notification_channel is required';
  end if;

  if not exists (
    select 1 from pg_type
    where typname = 'notification_status'
      and typnamespace = 'public'::regnamespace
  ) then
    raise exception 'enum notification_status is required';
  end if;

  -- Seed test users
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_super_admin, 'authenticated', 'authenticated', 'sa-m08-telegram@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_admin, 'authenticated', 'authenticated', 'admin-m08-telegram@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_treasurer, 'authenticated', 'authenticated', 'treasurer-m08-telegram@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_a, 'authenticated', 'authenticated', 'resident-a-m08-telegram@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_b, 'authenticated', 'authenticated', 'resident-b-m08-telegram@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_super_admin, 'M08 Telegram Super Admin', 'super_admin', true),
    (v_admin, 'M08 Telegram Admin', 'admin', true),
    (v_treasurer, 'M08 Telegram Treasurer', 'treasurer', true),
    (v_resident_a, 'M08 Telegram Resident A', 'resident', true),
    (v_resident_b, 'M08 Telegram Resident B', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  -- ============================================================
  -- T-05-01 / Test 1: Token issue stores only hash, sets expiry,
  -- and invalidates prior unconsumed tokens for the same profile
  -- ============================================================

  -- Issue first token for resident_a
  select plain_token, token_hash, deep_link
  into v_plain_token, v_token_hash, v_deep_link
  from public.issue_telegram_link_token(v_resident_a, v_bot_username);

  if v_plain_token is null or length(v_plain_token) < 32 then
    raise exception 'issue_telegram_link_token must return a plain_token of at least 32 characters';
  end if;

  if v_token_hash is null then
    raise exception 'issue_telegram_link_token must return a token_hash';
  end if;

  if v_deep_link is null or v_deep_link not like '%t.me/' || v_bot_username || '?start=link_%' then
    raise exception 'issue_telegram_link_token must return a deep_link with bot username and link_ prefix: %', coalesce(v_deep_link, 'null');
  end if;

  if v_plain_token !~ '^link_[a-zA-Z0-9_-]+$' then
    raise exception 'plain_token must have link_ prefix followed by base64url chars, got: %', v_plain_token;
  end if;

  -- Verify plain token is NOT stored (only hash)
  if exists (
    select 1 from public.telegram_link_tokens
    where profile_id = v_resident_a
      and token_hash = v_plain_token
  ) then
    raise exception 'CRITICAL: plain_token must not be stored — only its hash should be stored (T-05-01)';
  end if;

  -- Verify hash is stored
  if not exists (
    select 1 from public.telegram_link_tokens
    where profile_id = v_resident_a
      and token_hash = v_token_hash
      and expires_at > now()
      and consumed_at is null
  ) then
    raise exception 'issue_telegram_link_token must store hash with future expiry and null consumed_at';
  end if;

  -- Issue second token — prior unconsumed token must be invalidated (consumed_at set)
  begin
    select plain_token, token_hash, deep_link
    into v_plain_token2, v_token_hash2, v_deep_link2
    from public.issue_telegram_link_token(v_resident_a, v_bot_username);

    -- Prior token must be marked as consumed
    if not exists (
      select 1 from public.telegram_link_tokens
      where profile_id = v_resident_a
        and token_hash = v_token_hash
        and consumed_at is not null
    ) then
      raise exception 'issuing a new token must invalidate prior unconsumed token for the same profile (T-05-04)';
    end if;

    -- New token must have its own hash
    if v_token_hash2 = v_token_hash then
      raise exception 'new token_hash must differ from prior token_hash';
    end if;

    -- New token must have deep link format
    if v_deep_link2 not like '%t.me/' || v_bot_username || '?start=link_%' then
      raise exception 'second deep_link must have valid link_ format';
    end if;
  end;

  -- ============================================================
  -- T-05-02 / Test 2: Consuming a valid token links exactly one
  -- telegram_accounts row for the token-owning profile
  -- ============================================================

  declare
    v_telegram_user_id bigint := 999000001;
    v_telegram_chat_id bigint := 888000001;
    v_consume_result jsonb;
  begin
    -- Consume the latest token (v_plain_token2) for resident_a
    v_consume_result := public.consume_telegram_link_token(
      v_plain_token2,
      v_telegram_user_id,
      v_telegram_chat_id,
      'username_a',
      'FirstNameA',
      'LastNameA',
      'en'
    );

    if not (v_consume_result->>'success')::boolean then
      raise exception 'consume_telegram_link_token must succeed for valid token, got: %', v_consume_result;
    end if;

    -- Verify exactly ONE telegram_accounts row linked to resident_a
    if not exists (
      select 1 from public.telegram_accounts
      where profile_id = v_resident_a
        and telegram_user_id = v_telegram_user_id
    ) then
      raise exception 'consume must link exactly one telegram_accounts row for the token-owning profile';
    end if;

    -- Verify telegram_accounts row has correct metadata
    if not exists (
      select 1 from public.telegram_accounts
      where profile_id = v_resident_a
        and telegram_user_id = v_telegram_user_id
        and telegram_chat_id = v_telegram_chat_id
        and username = 'username_a'
        and first_name = 'FirstNameA'
        and last_name = 'LastNameA'
        and language_code = 'en'
    ) then
      raise exception 'consume must store correct Telegram identity metadata';
    end if;

    -- Verify consumed_at is set on the token
    if not exists (
      select 1 from public.telegram_link_tokens
      where token_hash = v_token_hash2
        and consumed_at is not null
    ) then
      raise exception 'consume must mark consumed_at on the token';
    end if;

    -- Verify telegram_user_id uniqueness enforced
    if exists (
      select 1 from public.telegram_accounts
      where telegram_user_id = v_telegram_user_id
        and profile_id != v_resident_a
    ) then
      raise exception 'telegram_user_id must be unique across profiles';
    end if;
  end;

  -- ============================================================
  -- T-05-04 / Test 3: Expired, replayed, or conflicting consume
  -- attempts fail without mutating another profile's link
  -- ============================================================

  declare
    v_plain_expired text;
    v_hash_expired text;
    v_telegram_user_id2 bigint := 999000002;
    v_telegram_chat_id2 bigint := 888000002;
    v_consume_expired jsonb;
    v_consume_replay jsonb;
    v_consume_conflict jsonb;
  begin
    -- Create a manually expired token for testing (inject past expiry)
    -- First issue a new token, then manually set its expires_at to the past
    select plain_token, token_hash
    into v_plain_expired, v_hash_expired
    from public.issue_telegram_link_token(v_resident_b, v_bot_username);

    -- Force-expire the token by updating expires_at directly
    update public.telegram_link_tokens
    set expires_at = now() - interval '1 hour'
    where token_hash = v_hash_expired;

    -- Attempting to consume an expired token must fail
    v_consume_expired := public.consume_telegram_link_token(
      v_plain_expired,
      v_telegram_user_id2,
      v_telegram_chat_id2,
      'username_b',
      'FirstNameB',
      'LastNameB',
      'id'
    );

    if (v_consume_expired->>'success')::boolean then
      raise exception 'consume must fail for expired token (T-05-04)';
    end if;

    -- Verify no telegram_accounts row was created for resident_b from the expired token
    if exists (
      select 1 from public.telegram_accounts
      where profile_id = v_resident_b
        and telegram_user_id = v_telegram_user_id2
    ) then
      raise exception 'expired token consume must not create a telegram_accounts row';
    end if;

    -- Replay test: try to consume the same valid token twice (resident_a's already-consumed token)
    -- Note: v_plain_token2 was already consumed above — consume it again
    v_consume_replay := public.consume_telegram_link_token(
      v_plain_token2,
      v_telegram_user_id2,
      v_telegram_chat_id2,
      'username_b',
      'FirstNameB',
      'LastNameB',
      'id'
    );

    if (v_consume_replay->>'success')::boolean then
      raise exception 'consume must fail for already-consumed token (replay attack, T-05-04)';
    end if;

    -- Verify telegram_user_id2 was NOT linked to resident_b via replay
    if exists (
      select 1 from public.telegram_accounts
      where profile_id = v_resident_b
        and telegram_user_id = v_telegram_user_id2
    ) then
      raise exception 'replay consume must not create cross-account binding';
    end if;

    -- Conflict test: try to link a different telegram_user_id to resident_a's already-linked account
    -- (resident_a already linked with telegram_user_id = 999000001)
    declare
      v_plain_conflict text;
      v_hash_conflict text;
      v_telegram_user_id_conflict bigint := 999000003;
    begin
      select plain_token, token_hash
      into v_plain_conflict, v_hash_conflict
      from public.issue_telegram_link_token(v_resident_a, v_bot_username);

      -- resident_a already has a linked Telegram account (999000001)
      -- Trying to consume a new token that would link a DIFFERENT telegram_user_id
      -- should surface the telegram_user_id uniqueness conflict (D-18)
      v_consume_conflict := public.consume_telegram_link_token(
        v_plain_conflict,
        v_telegram_user_id_conflict,
        888000003,
        'username_conflict',
        'ConflictFirst',
        'ConflictLast',
        'id'
      );

      -- The consume should fail because this profile_id already has a linked telegram_account
      -- (Each profile can only link one Telegram account — per table unique constraint on profile_id)
      if (v_consume_conflict->>'success')::boolean then
        raise exception 'consume must fail when profile_id already has a linked telegram_account (D-18)';
      end if;
    end;

    -- T-05-07 / Conflict: telegram_user_id uniqueness — try to link same telegram_user_id to resident_b
    declare
      v_plain_user_conflict text;
      v_hash_user_conflict text;
      v_telegram_user_id_reuse bigint := 999000001;  -- already linked to resident_a
    begin
      -- Issue token for resident_b
      select plain_token, token_hash
      into v_plain_user_conflict, v_hash_user_conflict
      from public.issue_telegram_link_token(v_resident_b, v_bot_username);

      -- Try to consume with telegram_user_id already linked to resident_a
      declare
        v_result jsonb;
      begin
        v_result := public.consume_telegram_link_token(
          v_plain_user_conflict,
          v_telegram_user_id_reuse,  -- already owned by resident_a
          888000004,
          'username_reuse',
          'ReuseFirst',
          'ReuseLast',
          'id'
        );

        -- Should fail with conflict error
        if (v_result->>'success')::boolean then
          raise exception 'consume must fail when telegram_user_id is already linked to another profile (T-05-07 / D-18)';
        end if;
      end;
    end;

  end;

  -- ============================================================
  -- T-05-03: Link event trail (issue/consume timestamps visible)
  -- ============================================================

  if not exists (
    select 1 from public.telegram_link_tokens
    where consumed_at is not null
      and created_at is not null
  ) then
    raise exception 'telegram_link_tokens must track created_at and consumed_at for audit trail (T-05-03)';
  end if;

  if not exists (
    select 1 from public.telegram_accounts
    where linked_at is not null
  ) then
    raise exception 'telegram_accounts must track linked_at for audit trail (T-05-03)';
  end if;

  -- ============================================================
  -- Schema integrity: indexes, triggers
  -- ============================================================

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'telegram_link_tokens'
      and indexname = 'idx_telegram_link_tokens_token_hash'
  ) then
    raise exception 'index idx_telegram_link_tokens_token_hash is required for fast token lookup';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'telegram_link_tokens'
      and indexname = 'idx_telegram_link_tokens_profile_id'
  ) then
    raise exception 'index idx_telegram_link_tokens_profile_id is required';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'telegram_accounts'
      and indexname = 'idx_telegram_accounts_telegram_user_id'
  ) then
    raise exception 'index idx_telegram_accounts_telegram_user_id is required for uniqueness lookup';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'telegram_accounts'
      and indexname = 'idx_telegram_accounts_profile_id'
  ) then
    raise exception 'index idx_telegram_accounts_profile_id is required';
  end if;

  -- Verify telegram_accounts has unique constraint on profile_id (one Telegram account per resident)
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.telegram_accounts'::regclass
      and contype = 'u'
      and conname = 'telegram_accounts_profile_id_key'
  ) then
    raise exception 'telegram_accounts must have unique constraint on profile_id';
  end if;

  -- Verify telegram_accounts has unique constraint on telegram_user_id (one Telegram account per Telegram account)
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.telegram_accounts'::regclass
      and contype = 'u'
      and conname = 'telegram_accounts_telegram_user_id_key'
  ) then
    raise exception 'telegram_accounts must have unique constraint on telegram_user_id (T-05-07)';
  end if;

  -- ============================================================
  -- RLS policies must be enabled
  -- ============================================================

  if not exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename = 'telegram_accounts'
      and rowsecurity = true
  ) then
    raise exception 'telegram_accounts must have RLS enabled';
  end if;

  if not exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename = 'telegram_link_tokens'
      and rowsecurity = true
  ) then
    raise exception 'telegram_link_tokens must have RLS enabled';
  end if;

end;
$$;
