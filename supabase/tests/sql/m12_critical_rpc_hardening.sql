do $$
declare
  v_resident_a uuid := '92000000-0000-0000-0000-000000000001'::uuid;
  v_resident_b uuid := '92000000-0000-0000-0000-000000000002'::uuid;
  v_resident_late uuid := '92000000-0000-0000-0000-000000000003'::uuid;
  v_former_resident uuid := '92000000-0000-0000-0000-000000000004'::uuid;
  v_inactive_resident uuid := '92000000-0000-0000-0000-000000000005'::uuid;
  v_kavling_a uuid := '92100000-0000-0000-0000-000000000001'::uuid;
  v_kavling_b uuid := '92100000-0000-0000-0000-000000000002'::uuid;
  v_kavling_late uuid := '92100000-0000-0000-0000-000000000003'::uuid;
  v_kavling_former uuid := '92100000-0000-0000-0000-000000000004'::uuid;
  v_period_current uuid := '92200000-0000-0000-0000-000000000001'::uuid;
  v_period_before_start uuid := '92200000-0000-0000-0000-000000000002'::uuid;
  v_period_former uuid := '92200000-0000-0000-0000-000000000003'::uuid;
  v_invoice_a uuid := '92300000-0000-0000-0000-000000000001'::uuid;
  v_invoice_b uuid := '92300000-0000-0000-0000-000000000002'::uuid;
  v_invoice_before_start uuid := '92300000-0000-0000-0000-000000000003'::uuid;
  v_invoice_former uuid := '92300000-0000-0000-0000-000000000004'::uuid;
  v_bank_account uuid := '92400000-0000-0000-0000-000000000001'::uuid;
  v_qris_invoice uuid := '92300000-0000-0000-0000-000000000005'::uuid;
  v_qris_order_id text := 'ORDER-M12-RPC-HARDENING';
  v_submission_id uuid;
  v_plain_token text;
  v_service_plain_token text;
  v_token_hash text;
  v_deep_link text;
  v_consume_result jsonb;
  v_visible_count integer;
  v_payment_count integer;
  v_message text;
  v_state text;
begin
  -- Privilege checks for service-only Telegram linking helpers.
  if has_function_privilege('anon', 'public.issue_telegram_link_token(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.issue_telegram_link_token(uuid,text)', 'execute') then
    raise exception 'issue_telegram_link_token must not be executable by anon/authenticated callers';
  end if;

  if not has_function_privilege('service_role', 'public.issue_telegram_link_token(uuid,text)', 'execute') then
    raise exception 'service_role must execute issue_telegram_link_token through the Edge Function';
  end if;

  if has_function_privilege('anon', 'public.consume_telegram_link_token(text,bigint,bigint,text,text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.consume_telegram_link_token(text,bigint,bigint,text,text,text,text)', 'execute') then
    raise exception 'consume_telegram_link_token must not be executable by anon/authenticated callers';
  end if;

  if not has_function_privilege('service_role', 'public.consume_telegram_link_token(text,bigint,bigint,text,text,text,text)', 'execute') then
    raise exception 'service_role must execute consume_telegram_link_token from the Telegram webhook';
  end if;

  if has_function_privilege('anon', 'public.gen_telegram_link_token()', 'execute')
     or has_function_privilege('authenticated', 'public.gen_telegram_link_token()', 'execute')
     or has_function_privilege('anon', 'public.hash_telegram_link_token(text)', 'execute')
     or has_function_privilege('authenticated', 'public.hash_telegram_link_token(text)', 'execute') then
    raise exception 'Telegram token generator/hash helpers must not be executable by anon/authenticated callers';
  end if;

  -- Privilege checks for service-only Telegram recipient and delivery helpers.
  if has_function_privilege('anon', 'public.get_linked_telegram_recipients(text)', 'execute')
     or has_function_privilege('authenticated', 'public.get_linked_telegram_recipients(text)', 'execute')
     or has_function_privilege('anon', 'public.get_payment_event_telegram_recipients(text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.get_payment_event_telegram_recipients(text,uuid)', 'execute')
     or has_function_privilege('anon', 'public.select_reminder_recipients()', 'execute')
     or has_function_privilege('authenticated', 'public.select_reminder_recipients()', 'execute')
     or has_function_privilege('anon', 'public.log_notification_delivery(text,uuid,bigint,text,text,uuid,uuid,bigint,text)', 'execute')
     or has_function_privilege('authenticated', 'public.log_notification_delivery(text,uuid,bigint,text,text,uuid,uuid,bigint,text)', 'execute') then
    raise exception 'Telegram recipient/delivery RPCs must not be executable by anon/authenticated callers';
  end if;

  if not has_function_privilege('service_role', 'public.get_linked_telegram_recipients(text)', 'execute')
     or not has_function_privilege('service_role', 'public.get_payment_event_telegram_recipients(text,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.select_reminder_recipients()', 'execute')
     or not has_function_privilege('service_role', 'public.log_notification_delivery(text,uuid,bigint,text,text,uuid,uuid,bigint,text)', 'execute') then
    raise exception 'service_role must execute Telegram dispatch RPCs';
  end if;

  -- Privilege checks for QRIS reconciliation.
  if has_function_privilege('anon', 'public.reconcile_midtrans_qris_notification(text,text,text,text,text,text,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.reconcile_midtrans_qris_notification(text,text,text,text,text,text,jsonb)', 'execute') then
    raise exception 'QRIS reconciliation RPC must not be executable by anon/authenticated callers';
  end if;

  if not has_function_privilege('service_role', 'public.reconcile_midtrans_qris_notification(text,text,text,text,text,text,jsonb)', 'execute') then
    raise exception 'service_role must execute QRIS reconciliation from the signed webhook';
  end if;

  if has_function_privilege('anon', 'public.create_payment_submission(uuid,integer,uuid,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.create_payment_submission(uuid,integer,uuid,text)', 'execute') then
    raise exception 'create_payment_submission must be authenticated-only';
  end if;

  -- Seed users and billing data for behavioral authorization checks.
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_resident_a, 'authenticated', 'authenticated', 'resident-a-m12-hardening@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_b, 'authenticated', 'authenticated', 'resident-b-m12-hardening@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_late, 'authenticated', 'authenticated', 'resident-late-m12-hardening@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_former_resident, 'authenticated', 'authenticated', 'former-resident-m12-hardening@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_inactive_resident, 'authenticated', 'authenticated', 'inactive-resident-m12-hardening@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_resident_a, 'M12 Hardening Resident A', 'resident', true),
    (v_resident_b, 'M12 Hardening Resident B', 'resident', true),
    (v_resident_late, 'M12 Hardening Late Resident', 'resident', true),
    (v_former_resident, 'M12 Hardening Former Resident', 'resident', true),
    (v_inactive_resident, 'M12 Hardening Inactive Resident', 'resident', false)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  insert into public.kavlings (id, code, sort_order, active)
  values
    (v_kavling_a, 'M12-A', 1201, true),
    (v_kavling_b, 'M12-B', 1202, true),
    (v_kavling_late, 'M12-LATE', 1203, true),
    (v_kavling_former, 'M12-FORMER', 1204, true)
  on conflict (id) do update
  set code = excluded.code,
      sort_order = excluded.sort_order,
      active = excluded.active;

  insert into public.billing_periods (id, year, month, label, due_date, status)
  values
    (v_period_current, 2031, 1, 'Januari 2031', date '2031-01-15', 'open'),
    (v_period_before_start, 2031, 2, 'Februari 2031', date '2031-02-15', 'open'),
    (v_period_former, 2031, 3, 'Maret 2031', date '2031-03-15', 'closed')
  on conflict (id) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status;

  insert into public.invoices (id, billing_period_id, kavling_id, invoice_number, amount_due, amount_paid, due_date, status)
  values
    (v_invoice_a, v_period_current, v_kavling_a, 'IPL-M12-HARDENING-A', 150000, 0, date '2031-01-15', 'unpaid'),
    (v_invoice_b, v_period_current, v_kavling_b, 'IPL-M12-HARDENING-B', 150000, 0, date '2031-01-15', 'unpaid'),
    (v_invoice_before_start, v_period_before_start, v_kavling_late, 'IPL-M12-HARDENING-BEFORE-START', 150000, 0, date '2031-02-15', 'unpaid'),
    (v_invoice_former, v_period_former, v_kavling_former, 'IPL-M12-HARDENING-FORMER', 150000, 0, date '2031-03-15', 'unpaid'),
    (v_qris_invoice, v_period_current, v_kavling_late, 'IPL-M12-HARDENING-QRIS', 125000, 0, date '2031-01-15', 'unpaid')
  on conflict (id) do update
  set billing_period_id = excluded.billing_period_id,
      kavling_id = excluded.kavling_id,
      invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      due_date = excluded.due_date,
      status = excluded.status;

  delete from public.payments
  where invoice_id in (v_invoice_a, v_invoice_b, v_invoice_before_start, v_invoice_former, v_qris_invoice);

  delete from public.payment_submissions
  where invoice_id in (v_invoice_a, v_invoice_b, v_invoice_before_start, v_invoice_former, v_qris_invoice);

  delete from public.payment_gateway_transactions
  where invoice_id in (v_invoice_a, v_invoice_b, v_invoice_before_start, v_invoice_former, v_qris_invoice);

  insert into public.kavling_residents (
    kavling_id,
    profile_id,
    relation,
    relation_type,
    is_primary,
    active,
    started_at,
    ended_at
  )
  values
    (v_kavling_a, v_resident_a, 'owner', 'owner', true, true, date '2030-01-01', null),
    (v_kavling_b, v_resident_b, 'owner', 'owner', true, true, date '2030-01-01', null),
    (v_kavling_late, v_resident_late, 'owner', 'owner', true, true, date '2031-03-01', null),
    (v_kavling_former, v_former_resident, 'owner', 'owner', false, false, date '2030-01-01', date '2031-03-31')
  on conflict (kavling_id, profile_id) do update
  set relation = excluded.relation,
      relation_type = excluded.relation_type,
      is_primary = excluded.is_primary,
      active = excluded.active,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at;

  insert into public.bank_accounts (id, label, bank_name, account_number, account_holder, is_default, is_active)
  values (v_bank_account, 'M12 Hardening Bank', 'Bank Test', '1200120012', 'IPL Jatiloka', true, true)
  on conflict (id) do update
  set label = excluded.label,
      bank_name = excluded.bank_name,
      account_number = excluded.account_number,
      account_holder = excluded.account_holder,
      is_default = excluded.is_default,
      is_active = excluded.is_active;

  insert into public.telegram_accounts (
    profile_id,
    telegram_user_id,
    telegram_chat_id,
    username,
    first_name,
    allows_notifications
  )
  values (
    v_resident_a,
    912000001,
    812000001,
    'm12_resident_a',
    'ResidentA',
    true
  )
  on conflict (profile_id) do update
  set telegram_user_id = excluded.telegram_user_id,
      telegram_chat_id = excluded.telegram_chat_id,
      username = excluded.username,
      first_name = excluded.first_name,
      allows_notifications = excluded.allows_notifications;

  insert into public.notification_preferences (profile_id, category, in_app_enabled, telegram_enabled)
  values (v_resident_a, 'payment_status', true, true)
  on conflict (profile_id, category) do update
  set telegram_enabled = excluded.telegram_enabled;

  delete from public.telegram_accounts
  where profile_id in (v_resident_b, v_resident_late, v_inactive_resident);

  delete from public.telegram_link_tokens
  where profile_id in (v_resident_a, v_resident_b, v_resident_late, v_inactive_resident);

  -- Telegram token issuance must reject inactive profiles even through trusted execution.
  begin
    perform public.issue_telegram_link_token(v_inactive_resident, 'test_ipl_jatiloka_bot');
    raise exception 'Telegram token issuance unexpectedly succeeded';
  exception
    when others then
      get stacked diagnostics v_message = message_text;
      if position('inactive' in lower(coalesce(v_message, ''))) = 0 then
        raise exception 'unexpected inactive Telegram token error: %', v_message;
      end if;
  end;

  select plain_token, token_hash, deep_link
  into v_plain_token, v_token_hash, v_deep_link
  from public.issue_telegram_link_token(v_resident_b, 'test_ipl_jatiloka_bot');

  if v_plain_token is null or v_token_hash is null or v_deep_link not like 'https://t.me/test_ipl_jatiloka_bot?start=link_%' then
    raise exception 'trusted Telegram token issuance must still return token material and deep link';
  end if;

  v_consume_result := public.consume_telegram_link_token(
    v_plain_token,
    912000002,
    812000002,
    'm12_user_b',
    'ResidentB',
    null,
    'id'
  );

  if not (v_consume_result->>'success')::boolean then
    raise exception 'trusted Telegram webhook consume path must still succeed: %', v_consume_result;
  end if;

  execute 'set local role service_role';
  execute 'select plain_token from public.issue_telegram_link_token($1, $2)'
    into v_service_plain_token
    using v_resident_late, 'test_ipl_jatiloka_bot';
  execute 'reset role';

  if v_service_plain_token is null then
    raise exception 'service_role Telegram link Edge path must issue tokens';
  end if;

  execute 'set local role service_role';
  execute 'select public.consume_telegram_link_token($1, 912000003, 812000003, ''m12_user_late'', ''LateResident'', null, ''id'')'
    into v_consume_result
    using v_service_plain_token;
  execute 'reset role';

  if not (v_consume_result->>'success')::boolean then
    raise exception 'service_role Telegram webhook consume path must succeed: %', v_consume_result;
  end if;

  execute 'set local role service_role';
  execute 'select count(*) from public.get_linked_telegram_recipients($1)'
    into v_visible_count
    using 'resident_payment_reminder';
  execute 'reset role';

  if v_visible_count < 1 then
    raise exception 'service_role Telegram dispatch path must still resolve eligible recipients';
  end if;

  -- Resident A cannot reserve or submit against Resident B's invoice.
  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    execute 'set local role authenticated';
    execute 'select public.create_payment_submission($1, $2, $3, $4)'
      using v_invoice_b, 50000, v_bank_account, 'IDOR attempt';
    execute 'reset role';
    raise exception 'resident A must not create submission for resident B invoice';
  exception
    when others then
      v_state := sqlstate;
      get stacked diagnostics v_message = message_text;
      execute 'reset role';
      if v_state <> 'P0001' or position('not authorized' in lower(coalesce(v_message, ''))) = 0 then
        raise exception 'unexpected cross-resident submission error: state=% message=%', v_state, v_message;
      end if;
  end;

  if exists (
    select 1
    from public.payment_submissions
    where invoice_id = v_invoice_b
  ) then
    raise exception 'failed IDOR attempt must not create payment submission';
  end if;

  if exists (
    select 1
    from public.invoices
    where id = v_invoice_b
      and status <> 'unpaid'
  ) then
    raise exception 'failed IDOR attempt must not mutate invoice status';
  end if;

  execute 'set local role authenticated';
  execute 'select public.create_payment_submission($1, $2, $3, $4)'
    into v_submission_id
    using v_invoice_a, 50000, v_bank_account, 'Own invoice submission';
  execute 'reset role';

  if v_submission_id is null then
    raise exception 'active mapped resident must create submission for own eligible invoice';
  end if;

  if not exists (
    select 1
    from public.payment_submissions
    where id = v_submission_id
      and invoice_id = v_invoice_a
      and submitted_by = v_resident_a
      and amount_submitted = 50000
      and status = 'submitted'
  ) then
    raise exception 'own submission must be persisted with caller ownership';
  end if;

  if not exists (
    select 1
    from public.invoices
    where id = v_invoice_a
      and status = 'pending_verification'
  ) then
    raise exception 'own submission must recalculate invoice to pending_verification';
  end if;

  -- Active mappings cannot submit invoices before their started_at window.
  perform set_config('request.jwt.claim.sub', v_resident_late::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if public.can_submit_payment_for_invoice(v_invoice_before_start) then
    raise exception 'can_submit_payment_for_invoice must enforce started_at lower bound';
  end if;

  begin
    execute 'set local role authenticated';
    execute 'select public.create_payment_submission($1, $2, $3, $4)'
      using v_invoice_before_start, 50000, v_bank_account, 'before started_at';
    execute 'reset role';
    raise exception 'resident must not submit invoice before mapping started_at';
  exception
    when others then
      v_state := sqlstate;
      get stacked diagnostics v_message = message_text;
      execute 'reset role';
      if v_state <> 'P0001' or position('not authorized' in lower(coalesce(v_message, ''))) = 0 then
        raise exception 'unexpected before-start submission error: state=% message=%', v_state, v_message;
      end if;
  end;

  -- Historical read-only access must not allow former residents to submit.
  perform set_config('request.jwt.claim.sub', v_former_resident::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not public.can_access_invoice_history(v_invoice_former) then
    raise exception 'former resident fixture must retain historical read access';
  end if;

  if public.can_submit_payment_for_invoice(v_invoice_former) then
    raise exception 'former resident historical access must be read-only for submissions';
  end if;

  begin
    execute 'set local role authenticated';
    execute 'select public.create_payment_submission($1, $2, $3, $4)'
      using v_invoice_former, 50000, v_bank_account, 'former read-only attempt';
    execute 'reset role';
    raise exception 'former resident must not create submission for historical invoice';
  exception
    when others then
      v_state := sqlstate;
      get stacked diagnostics v_message = message_text;
      execute 'reset role';
      if v_state <> 'P0001' or position('not authorized' in lower(coalesce(v_message, ''))) = 0 then
        raise exception 'unexpected former-resident submission error: state=% message=%', v_state, v_message;
      end if;
  end;

  -- Direct QRIS reconciliation is denied to anon/authenticated and cannot mutate state.
  insert into public.payment_gateway_transactions (
    invoice_id,
    provider,
    provider_order_id,
    provider_transaction_id,
    amount,
    status,
    payment_type,
    created_by
  )
  values (
    v_qris_invoice,
    'midtrans',
    v_qris_order_id,
    null,
    125000,
    'pending',
    'qris',
    v_resident_a
  );

  perform set_config('request.jwt.claim.sub', v_resident_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not exists (
    select 1
    from public.payment_gateway_transactions
    where provider_order_id = v_qris_order_id
      and status = 'pending'
      and provider_transaction_id is null
      and raw_last_notification is null
  ) then
    raise exception 'denied direct QRIS reconciliation must not mutate gateway transaction';
  end if;

  select count(*)
  into v_payment_count
  from public.payments
  where invoice_id = v_qris_invoice;

  if v_payment_count <> 0 then
    raise exception 'denied direct QRIS reconciliation must not create payment rows';
  end if;

  execute 'set local role service_role';
  execute 'select public.reconcile_midtrans_qris_notification($1, $2, $3, $4, $5, $6, $7)'
    using v_qris_order_id, 'TRX-SERVICE', 'settlement', '200', '125000.00', 'qris', jsonb_build_object('via', 'service_role');
  execute 'reset role';

  if not exists (
    select 1
    from public.payment_gateway_transactions
    where provider_order_id = v_qris_order_id
      and status = 'settlement'
      and provider_transaction_id = 'TRX-SERVICE'
  ) then
    raise exception 'service_role QRIS reconciliation path must settle the transaction';
  end if;

  select count(*)
  into v_payment_count
  from public.payments
  where invoice_id = v_qris_invoice
    and external_reference = v_qris_order_id;

  if v_payment_count <> 1 then
    raise exception 'service_role QRIS reconciliation must create exactly one payment row, got %', v_payment_count;
  end if;
end;
$$;
