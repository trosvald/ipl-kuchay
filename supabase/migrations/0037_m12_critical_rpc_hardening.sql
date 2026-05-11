-- M12: Critical RPC hardening for launch blockers.
-- Keeps browser access behind Edge Functions/RLS and restricts service-only
-- Telegram and QRIS contracts to the service role.

create or replace function public.gen_telegram_link_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bytes bytea;
begin
  v_bytes := gen_random_bytes(32);
  return 'link_' || translate(
    encode(v_bytes, 'base64'),
    '+/=',
    '-_'
  );
end;
$$;

create or replace function public.hash_telegram_link_token(plain_token text)
returns text
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
begin
  return encode(sha256(plain_token::bytea), 'hex');
end;
$$;

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
set search_path = public
as $$
declare
  normalized_bot_username text := trim(coalesce(p_bot_username, ''));
begin
  if p_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if normalized_bot_username = '' then
    raise exception 'bot_username is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.is_active = true
  ) then
    raise exception 'profile not found or inactive';
  end if;

  update public.telegram_link_tokens
  set consumed_at = now()
  where profile_id = p_profile_id
    and consumed_at is null;

  plain_token := public.gen_telegram_link_token();
  token_hash := public.hash_telegram_link_token(plain_token);

  insert into public.telegram_link_tokens (profile_id, token_hash, expires_at)
  values (p_profile_id, token_hash, now() + interval '15 minutes');

  deep_link := 'https://t.me/' || normalized_bot_username || '?start=' || plain_token;

  return next;
end;
$$;

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
set search_path = public
as $$
declare
  v_token_hash text;
  v_token_row record;
  v_error_message text;
begin
  if p_plain_token is null or p_telegram_user_id is null or p_telegram_chat_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  end if;

  v_token_hash := public.hash_telegram_link_token(p_plain_token);

  select id, profile_id, expires_at, consumed_at
  into v_token_row
  from public.telegram_link_tokens
  where token_hash = v_token_hash
  limit 1;

  if v_token_row.id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Token tidak valid atau sudah kadaluarsa.'
    );
  end if;

  if v_token_row.expires_at < now() then
    return jsonb_build_object(
      'success', false,
      'error', 'Token tidak valid atau sudah kadaluarsa.'
    );
  end if;

  if v_token_row.consumed_at is not null then
    return jsonb_build_object(
      'success', false,
      'error', 'Token tidak valid atau sudah kadaluarsa.'
    );
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_token_row.profile_id
      and p.is_active = true
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'Token tidak valid atau sudah kadaluarsa.'
    );
  end if;

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

  if exists (
    select 1 from public.telegram_accounts
    where profile_id = v_token_row.profile_id
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'Akun Telegram kamu sudah terhubung dengan IPL Jatiloka.'
    );
  end if;

  update public.telegram_link_tokens
  set consumed_at = now()
  where id = v_token_row.id;

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
    set telegram_user_id = excluded.telegram_user_id,
        telegram_chat_id = excluded.telegram_chat_id,
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        language_code = excluded.language_code,
        allows_notifications = true,
        linked_at = now(),
        last_seen_at = now();

  return jsonb_build_object(
    'success', true,
    'profile_id', v_token_row.profile_id
  );

exception
  when unique_violation then
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

create or replace function public.can_submit_payment_for_invoice(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invoices i
    join public.billing_periods bp on bp.id = i.billing_period_id
    join public.kavling_residents kr on kr.kavling_id = i.kavling_id
    join public.profiles p on p.id = kr.profile_id
    where i.id = target_invoice_id
      and bp.status in ('open', 'closed', 'archived')
      and i.status in ('unpaid', 'overdue', 'rejected', 'partial')
      and kr.profile_id = auth.uid()
      and kr.active = true
      and kr.started_at <= i.due_date
      and (kr.ended_at is null or i.due_date <= kr.ended_at)
      and p.is_active = true
  );
$$;

create or replace function public.create_payment_submission(
  target_invoice_id uuid,
  target_amount_submitted integer,
  target_bank_account_id uuid,
  target_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  bank_row public.bank_accounts%rowtype;
  total_paid integer;
  reserved_submissions integer;
  reserved_gateway integer;
  available_balance integer;
  created_submission_id uuid;
begin
  if not public.has_role(array[
    'resident'::public.app_role,
    'treasurer'::public.app_role,
    'admin'::public.app_role,
    'super_admin'::public.app_role
  ]) then
    raise exception 'not authorized';
  end if;

  if target_invoice_id is null then
    raise exception 'invoice_id is required';
  end if;

  if target_amount_submitted is null or target_amount_submitted <= 0 then
    raise exception 'amount_submitted must be a positive integer';
  end if;

  if target_bank_account_id is null then
    raise exception 'bank_account_id is required';
  end if;

  select *
  into bank_row
  from public.bank_accounts
  where id = target_bank_account_id;

  if not found or bank_row.is_active is not true then
    raise exception 'bank account not found or inactive';
  end if;

  select *
  into invoice_row
  from public.invoices
  where id = target_invoice_id
  for update;

  if not found then
    raise exception 'invoice not found';
  end if;

  if not public.can_submit_payment_for_invoice(target_invoice_id) then
    raise exception 'not authorized';
  end if;

  if invoice_row.status not in ('unpaid', 'partial', 'overdue', 'pending_verification', 'rejected') then
    raise exception 'invoice is not eligible for manual submission';
  end if;

  if invoice_row.status in ('waived', 'cancelled') then
    raise exception 'invoice is not payable';
  end if;

  select coalesce(sum(amount), 0)
  into total_paid
  from public.payments
  where invoice_id = target_invoice_id;

  select coalesce(sum(amount_submitted), 0)
  into reserved_submissions
  from public.payment_submissions
  where invoice_id = target_invoice_id
    and status = 'submitted';

  select coalesce(sum(amount), 0)
  into reserved_gateway
  from public.payment_gateway_transactions
  where invoice_id = target_invoice_id
    and status in ('created', 'pending');

  available_balance := invoice_row.amount_due - total_paid - reserved_submissions - reserved_gateway;

  if available_balance <= 0 then
    raise exception 'invoice has no reservable balance';
  end if;

  if target_amount_submitted > available_balance then
    raise exception 'amount_submitted exceeds reservable invoice balance';
  end if;

  insert into public.payment_submissions (
    invoice_id,
    submitted_by,
    amount_submitted,
    bank_account_id,
    note,
    status
  )
  values (
    target_invoice_id,
    auth.uid(),
    target_amount_submitted,
    target_bank_account_id,
    target_note,
    'submitted'
  )
  returning id into created_submission_id;

  perform public.recalculate_invoice_status(target_invoice_id);

  return created_submission_id;
end;
$$;

revoke all on function public.gen_telegram_link_token() from public, anon, authenticated;
revoke all on function public.hash_telegram_link_token(text) from public, anon, authenticated;

revoke all on function public.issue_telegram_link_token(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_telegram_link_token(uuid, text) to service_role;

revoke all on function public.consume_telegram_link_token(text, bigint, bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.consume_telegram_link_token(text, bigint, bigint, text, text, text, text) to service_role;

revoke all on function public.get_linked_telegram_recipients(text) from public, anon, authenticated;
grant execute on function public.get_linked_telegram_recipients(text) to service_role;

revoke all on function public.get_payment_event_telegram_recipients(text, uuid) from public, anon, authenticated;
grant execute on function public.get_payment_event_telegram_recipients(text, uuid) to service_role;

revoke all on function public.select_reminder_recipients() from public, anon, authenticated;
grant execute on function public.select_reminder_recipients() to service_role;

revoke all on function public.log_notification_delivery(text, uuid, bigint, text, text, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.log_notification_delivery(text, uuid, bigint, text, text, uuid, uuid, bigint, text) to service_role;

revoke all on function public.reconcile_midtrans_qris_notification(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_midtrans_qris_notification(text, text, text, text, text, text, jsonb) to service_role;

revoke execute on function public.create_payment_submission(uuid, integer, uuid, text) from public, anon;
grant execute on function public.create_payment_submission(uuid, integer, uuid, text) to authenticated;
