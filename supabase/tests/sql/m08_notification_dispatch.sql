do $$
declare
  v_super_admin uuid := '81000000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '81000000-0000-0000-0000-000000000002'::uuid;
  v_resident_a uuid := '81000000-0000-0000-0000-000000000004'::uuid;
  v_resident_b uuid := '81000000-0000-0000-0000-000000000005'::uuid;
  v_kavling_a uuid;
  v_kavling_b uuid;
  v_billing_period uuid;
  v_invoice_a uuid;
  v_invoice_b uuid;
  v_submission_a uuid;
  v_telegram_user_id_a bigint := 999000001;
  v_telegram_chat_id_a bigint := 888000001;
  v_telegram_user_id_b bigint := 999000002;
  v_telegram_chat_id_b bigint := 888000002;
  v_delivery_id uuid;
  v_count integer;
begin
  -- ============================================================
  -- Prerequisites: enums, tables, functions required
  -- ============================================================

  if to_regclass('public.notification_deliveries') is null then
    raise exception 'notification_deliveries table is required';
  end if;

  if to_regclass('public.notification_templates') is null then
    raise exception 'notification_templates table is required';
  end if;

  if to_regclass('public.notification_preferences') is null then
    raise exception 'notification_preferences table is required';
  end if;

  if to_regclass('public.telegram_accounts') is null then
    raise exception 'telegram_accounts table is required';
  end if;

  if not exists (
    select 1 from pg_type
    where typname = 'notification_status'
      and typnamespace = 'public'::regnamespace
  ) then
    raise exception 'enum notification_status is required';
  end if;

  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'get_linked_telegram_recipients'
  ) then
    raise exception 'public.get_linked_telegram_recipients(text) is required';
  end if;

  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'select_reminder_recipients'
  ) then
    raise exception 'public.select_reminder_recipients() is required';
  end if;

  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'log_notification_delivery'
  ) then
    raise exception 'public.log_notification_delivery(...) is required';
  end if;

  -- ============================================================
  -- Seed test data
  -- ============================================================

  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_super_admin, 'authenticated', 'authenticated', 'sa-m09-notif@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_admin, 'authenticated', 'authenticated', 'admin-m09-notif@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_a, 'authenticated', 'authenticated', 'resident-a-m09-notif@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_b, 'authenticated', 'authenticated', 'resident-b-m09-notif@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_super_admin, 'M09 Notif Super Admin', 'super_admin', true),
    (v_admin, 'M09 Notif Admin', 'admin', true),
    (v_resident_a, 'M09 Notif Resident A', 'resident', true),
    (v_resident_b, 'M09 Notif Resident B', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;

  -- Seed kavlings and billing period
  insert into public.kavlings (id, code, sort_order)
  values
    ('a9000000-0000-0000-0000-000000000001', 'Kav A', 1),
    ('a9000000-0000-0000-0000-000000000002', 'Kav B', 2)
  on conflict (code) do update set sort_order = excluded.sort_order;

  insert into public.billing_periods (id, year, month, label, due_date, status)
  values
    ('b9000000-0000-0000-0000-000000000001', 2026, 4, 'April 2026', '2026-04-15', 'open')
  on conflict (year, month) do update set label = excluded.label, status = excluded.status;

  select id into v_kavling_a from public.kavlings where code = 'Kav A';
  select id into v_kavling_b from public.kavlings where code = 'Kav B';
  select id into v_billing_period from public.billing_periods where year = 2026 and month = 4;

  insert into public.invoices (id, billing_period_id, kavling_id, invoice_number, amount_due, status, due_date)
  values
    ('c9000000-0000-0000-0000-000000000001', v_billing_period, v_kavling_a, 'INV-A-2026-04', 350000, 'unpaid', '2026-04-15'),
    ('c9000000-0000-0000-0000-000000000002', v_billing_period, v_kavling_b, 'INV-B-2026-04', 350000, 'unpaid', '2026-04-15')
  on conflict (billing_period_id, kavling_id) do update set status = excluded.status;

  select id into v_invoice_a from public.invoices where invoice_number = 'INV-A-2026-04';
  select id into v_invoice_b from public.invoices where invoice_number = 'INV-B-2026-04';

  insert into public.payment_submissions (id, invoice_id, submitted_by, amount_submitted, status)
  values
    ('d9000000-0000-0000-0000-000000000001', v_invoice_a, v_resident_a, 350000, 'submitted')
  on conflict do nothing;

  select id into v_submission_a from public.payment_submissions where invoice_id = v_invoice_a;

  -- Seed kavling-resident links (required for select_reminder_recipients)
  insert into public.kavling_residents (kavling_id, profile_id, relation, is_primary, active)
  values
    (v_kavling_a, v_resident_a, 'owner', true, true),
    (v_kavling_b, v_resident_b, 'owner', true, true)
  on conflict (kavling_id, profile_id) do nothing;

  -- ============================================================
  -- Test 1: Linked residents are eligible only when
  -- allows_notifications=true AND matching notification_preferences
  -- row exists with telegram_enabled=true per D-02 and D-20
  -- ============================================================

  -- Case 1a: resident_a links Telegram with allows_notifications=true
  -- but has NO notification_preferences row → NOT eligible
  insert into public.telegram_accounts (profile_id, telegram_user_id, telegram_chat_id, username, first_name, allows_notifications)
  values (v_resident_a, v_telegram_user_id_a, v_telegram_chat_id_a, 'user_a', 'FirstA', true)
  on conflict (profile_id) do update set telegram_user_id = excluded.telegram_user_id, telegram_chat_id = excluded.telegram_chat_id;

  -- get_linked_telegram_recipients should return 0 for resident_a (no pref row)
  select count(*) into v_count
  from public.get_linked_telegram_recipients('resident_payment_verified')
  where profile_id = v_resident_a;

  if v_count > 0 then
    raise exception 'Test 1 FAILED: resident_a with no notification_preferences row must not be eligible (D-02/D-20)';
  end if;

  -- Case 1b: resident_a has telegram_enabled=false → NOT eligible
  insert into public.notification_preferences (profile_id, category, in_app_enabled, telegram_enabled)
  values (v_resident_a, 'payment_status', true, false)
  on conflict (profile_id, category) do update set telegram_enabled = excluded.telegram_enabled;

  select count(*) into v_count
  from public.get_linked_telegram_recipients('resident_payment_verified')
  where profile_id = v_resident_a;

  if v_count > 0 then
    raise exception 'Test 1 FAILED: resident_a with telegram_enabled=false must not be eligible (D-02)';
  end if;

  -- Case 1c: resident_a has telegram_enabled=true → ELIGIBLE
  update public.notification_preferences
  set telegram_enabled = true
  where profile_id = v_resident_a and category = 'payment_status';

  -- Also enable billing_reminders for select_reminder_recipients test
  insert into public.notification_preferences (profile_id, category, in_app_enabled, telegram_enabled)
  values (v_resident_a, 'billing_reminders', true, true)
  on conflict (profile_id, category) do update set telegram_enabled = excluded.telegram_enabled;

  select count(*) into v_count
  from public.get_linked_telegram_recipients('resident_payment_verified')
  where profile_id = v_resident_a;

  if v_count = 0 then
    raise exception 'Test 1 FAILED: resident_a with telegram_enabled=true must be eligible (D-02/D-20)';
  end if;

  -- Case 1d: resident_b is linked but allows_notifications=false → NOT eligible
  insert into public.telegram_accounts (profile_id, telegram_user_id, telegram_chat_id, username, first_name, allows_notifications)
  values (v_resident_b, v_telegram_user_id_b, v_telegram_chat_id_b, 'user_b', 'FirstB', false)
  on conflict (profile_id) do update set allows_notifications = excluded.allows_notifications;

  insert into public.notification_preferences (profile_id, category, in_app_enabled, telegram_enabled)
  values (v_resident_b, 'payment_status', true, true)
  on conflict (profile_id, category) do update set telegram_enabled = excluded.telegram_enabled;

  select count(*) into v_count
  from public.get_linked_telegram_recipients('resident_payment_verified')
  where profile_id = v_resident_b;

  if v_count > 0 then
    raise exception 'Test 1 FAILED: resident_b with allows_notifications=false must not be eligible (D-02)';
  end if;

  -- ============================================================
  -- Test 2: Reminder dedupe allows at most one resident_payment_reminder
  -- delivery per invoice/profile/billing month per D-05
  -- ============================================================

  -- First reminder should be selected
  if not exists (
    select 1 from public.select_reminder_recipients()
    where profile_id = v_resident_a and related_invoice_id = v_invoice_a
  ) then
    raise exception 'Test 2 FAILED: first reminder for v_resident_a/v_invoice_a must be selected';
  end if;

  -- Log a delivery for this (invoice, profile, billing_period) so dedupe kicks in
  -- billing_period_month = 4 (April), billing_period_year = 2026
  insert into public.notification_deliveries (template_code, profile_id, telegram_chat_id, related_invoice_id, status, message_text, sent_at, billing_period_month, billing_period_year)
  values ('resident_payment_reminder', v_resident_a, v_telegram_chat_id_a, v_invoice_a, 'sent', 'Test reminder', now(), 4, 2026)
  returning id into v_delivery_id;

  -- Second call to select_reminder_recipients should NOT include the already-sent combo
  if exists (
    select 1 from public.select_reminder_recipients()
    where profile_id = v_resident_a and related_invoice_id = v_invoice_a
  ) then
    raise exception 'Test 2 FAILED: dedupe must suppress second reminder for same invoice/profile/billing_month (D-05)';
  end if;

  -- But a different invoice (v_invoice_b) for resident_b (linked to Kav B) should still be selected
  -- (resident_b hasn't had any reminders yet, so no dedupe exclusion applies)
  update public.telegram_accounts set allows_notifications = true where profile_id = v_resident_b;
  insert into public.notification_preferences (profile_id, category, in_app_enabled, telegram_enabled)
  values (v_resident_b, 'billing_reminders', true, true)
  on conflict (profile_id, category) do update set telegram_enabled = excluded.telegram_enabled;

  if not exists (
    select 1 from public.select_reminder_recipients()
    where profile_id = v_resident_b and related_invoice_id = v_invoice_b
  ) then
    raise exception 'Test 2 FAILED: reminder for resident_b/v_invoice_b must still be selected (no dedupe)';
  end if;

  -- ============================================================
  -- Test 3: Failed send attempts persist status='failed' with error_message,
  -- success persists status='sent' with telegram_message_id and sent_at
  -- per D-02 and D-03
  -- ============================================================

  -- Success log
  insert into public.notification_deliveries (template_code, profile_id, telegram_chat_id, related_invoice_id, status, message_text, telegram_message_id, sent_at)
  values ('resident_payment_verified', v_resident_a, v_telegram_chat_id_a, v_invoice_a, 'sent', 'Pembayaran terverifikasi', 1234567890, now())
  returning id into v_delivery_id;

  if not exists (
    select 1 from public.notification_deliveries
    where id = v_delivery_id and status = 'sent' and telegram_message_id = 1234567890 and sent_at is not null
  ) then
    raise exception 'Test 3 FAILED: successful delivery must have status=sent, telegram_message_id, and sent_at (D-02/D-03)';
  end if;

  -- Failed log
  insert into public.notification_deliveries (template_code, profile_id, telegram_chat_id, related_invoice_id, status, message_text, error_message)
  values ('resident_payment_verified', v_resident_a, v_telegram_chat_id_a, v_invoice_a, 'failed', 'Pembayaran terverifikasi', 'Telegram API error: chat not found')
  returning id into v_delivery_id;

  if not exists (
    select 1 from public.notification_deliveries
    where id = v_delivery_id and status = 'failed' and error_message is not null and sent_at is null
  ) then
    raise exception 'Test 3 FAILED: failed delivery must have status=failed, error_message, and null sent_at (D-03)';
  end if;

  -- ============================================================
  -- Schema integrity: indexes
  -- ============================================================

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'notification_deliveries'
      and indexname = 'idx_notification_deliveries_template_profile'
  ) then
    raise exception 'index idx_notification_deliveries_template_profile is required';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'notification_deliveries'
      and indexname = 'idx_notification_deliveries_dedupe'
  ) then
    raise exception 'index idx_notification_deliveries_dedupe is required for dedupe lookups';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'notification_deliveries'
      and indexname = 'idx_notification_deliveries_status'
  ) then
    raise exception 'index idx_notification_deliveries_status is required';
  end if;

end;
$$;