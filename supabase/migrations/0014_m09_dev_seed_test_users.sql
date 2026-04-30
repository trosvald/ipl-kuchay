-- Dev seed: test users, billing periods, and invoices for UAT
-- Insert auth users directly with bcrypt-hashed passwords via pgcrypto

do $$
declare
  admin_id uuid := gen_random_uuid();
  treasurer_id uuid := gen_random_uuid();
  resident1_id uuid := gen_random_uuid();
  resident2_id uuid := gen_random_uuid();
  kav1_id uuid;
  kav2_id uuid;
  kav3_id uuid;
  period_open_id uuid;
  period_draft_id uuid;
  period_closed_id uuid;
  period_archived_id uuid;
  invoice_count integer;
begin
  -- =====================================================================
  -- 1. Auth users (passwords all = 'password123')
  -- =====================================================================

  insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role, email_confirmed_at, created_at, updated_at)
  values
    (admin_id, 'admin@jatiloka.test', crypt('password123', gen_salt('bf')), '{"provider":"email"}', '{"full_name":"Admin Test"}', 'authenticated', 'authenticated', now(), now(), now()),
    (treasurer_id, 'treasurer@jatiloka.test', crypt('password123', gen_salt('bf')), '{"provider":"email"}', '{"full_name":"Bendahara Test"}', 'authenticated', 'authenticated', now(), now(), now()),
    (resident1_id, 'resident1@jatiloka.test', crypt('password123', gen_salt('bf')), '{"provider":"email"}', '{"full_name":"Warga Satu"}', 'authenticated', 'authenticated', now(), now(), now()),
    (resident2_id, 'resident2@jatiloka.test', crypt('password123', gen_salt('bf')), '{"provider":"email"}', '{"full_name":"Warga Dua"}', 'authenticated', 'authenticated', now(), now(), now())
  on conflict (id) do nothing;

  -- =====================================================================
  -- 2. Profiles (trigger creates resident profiles; override roles for admin/treasurer)
  -- =====================================================================

  insert into public.profiles (id, full_name, display_name, email, role, is_active)
  values
    (admin_id, 'Admin Test', 'Admin', 'admin@jatiloka.test', 'super_admin', true),
    (treasurer_id, 'Bendahara Test', 'Bendahara', 'treasurer@jatiloka.test', 'treasurer', true),
    (resident1_id, 'Warga Satu', 'Warga Satu', 'resident1@jatiloka.test', 'resident', true),
    (resident2_id, 'Warga Dua', 'Warga Dua', 'resident2@jatiloka.test', 'resident', true)
  on conflict (id) do update
  set role = excluded.role, full_name = excluded.full_name, display_name = excluded.display_name;

  -- =====================================================================
  -- 4. Kavling-resident mappings (resident1 → Kav 2, resident2 → Kav 3B + Kav 5)
  -- NOTE: Kav 1 is reserved for m07_phase1_access_identity test
  -- =====================================================================

  select id into kav1_id from public.kavlings where code = 'Kav 2';
  select id into kav2_id from public.kavlings where code = 'Kav 3B';
  select id into kav3_id from public.kavlings where code = 'Kav 5';

  insert into public.kavling_residents (kavling_id, profile_id, relation, is_primary, active)
  values
    (kav1_id, resident1_id, 'Pemilik', true, true),
    (kav2_id, resident2_id, 'Pemilik', true, true),
    (kav3_id, resident2_id, 'Pemilik', true, true)
  on conflict (kavling_id, profile_id) do nothing;

  -- =====================================================================
  -- 5. Fee overrides (Kav 1 gets higher IPL, Kav 2 gets lower)
  -- =====================================================================

  insert into public.kavling_fee_overrides (kavling_id, fee_type_id, amount, active_from, notes)
  select
    kav1_id,
    id,
    400000,
    '2026-01-01',
    'Override dev: IPL Kav 1 naik 50rb'
  from public.fee_types
  where code = 'IPL'
  on conflict (kavling_id, fee_type_id, active_from) do nothing;

  insert into public.kavling_fee_overrides (kavling_id, fee_type_id, amount, active_from, notes)
  select
    kav2_id,
    id,
    300000,
    '2026-01-01',
    'Override dev: IPL Kav 2 turun 50rb'
  from public.fee_types
  where code = 'IPL'
  on conflict (kavling_id, fee_type_id, active_from) do nothing;

  -- =====================================================================
  -- 6. Penalty rules
  -- =====================================================================

  insert into public.penalty_rules (name, fee_type_id, days_after_due, fixed_amount, active)
  select
    'Denda 7 hari setelah jatuh tempo',
    id,
    7,
    50000,
    true
  from public.fee_types
  where code = 'PENALTY'
    and not exists (select 1 from public.penalty_rules pr where pr.fee_type_id = (select id from public.fee_types where code = 'PENALTY'));

  -- =====================================================================
  -- 7. Billing periods
  -- =====================================================================

  -- Draft period (should NOT appear for residents)
  insert into public.billing_periods (year, month, label, due_date, status, created_by)
  values (2026, 6, 'IPL Juni 2026', '2026-06-15', 'draft', admin_id)
  on conflict (year, month) do update set label = excluded.label, due_date = excluded.due_date
  returning id into period_draft_id;

  -- Open period January 2026 (should appear for residents)
  insert into public.billing_periods (year, month, label, due_date, status, opened_at, created_by)
  values (2026, 1, 'IPL Januari 2026', '2026-01-15', 'open', now(), admin_id)
  on conflict (year, month) do update set label = excluded.label, due_date = excluded.due_date, status = excluded.status, opened_at = excluded.opened_at
  returning id into period_open_id;

  -- Closed period
  insert into public.billing_periods (year, month, label, due_date, status, opened_at, closed_at, created_by)
  values (2025, 12, 'IPL Desember 2025', '2025-12-15', 'closed', now() - interval '5 months', now() - interval '4 months', admin_id)
  on conflict (year, month) do update set label = excluded.label, due_date = excluded.due_date, status = excluded.status, opened_at = excluded.opened_at, closed_at = excluded.closed_at
  returning id into period_closed_id;

  -- Archived period
  insert into public.billing_periods (year, month, label, due_date, status, opened_at, closed_at, created_by)
  values (2025, 6, 'IPL Juni 2025', '2025-06-15', 'archived', now() - interval '11 months', now() - interval '10 months', admin_id)
  on conflict (year, month) do update set label = excluded.label, due_date = excluded.due_date, status = excluded.status, opened_at = excluded.opened_at, closed_at = excluded.closed_at
  returning id into period_archived_id;

  -- =====================================================================
  -- 8. Generate invoices for periods (set auth context for RPC access)
  -- =====================================================================
  perform set_config('request.jwt.claim.sub', admin_id::text, false);

  invoice_count := public.generate_invoices_for_period(period_open_id);
  raise notice 'Generated % invoices for open period', invoice_count;

  -- =====================================================================
  -- 9. Generate invoices for closed period
  -- =====================================================================
  invoice_count := public.generate_invoices_for_period(period_closed_id);
  raise notice 'Generated % invoices for closed period', invoice_count;

  -- =====================================================================
  -- 10. Generate invoices for archived period
  -- =====================================================================
  invoice_count := public.generate_invoices_for_period(period_archived_id);
  raise notice 'Generated % invoices for archived period', invoice_count;

  -- =====================================================================
  -- 11. Mark some invoices as paid/overdue for realistic resident view
  -- =====================================================================
  update public.invoices
  set amount_paid = amount_due,
      status = 'paid',
      paid_at = now()
  where billing_period_id in (period_closed_id, period_archived_id)
    and kavling_id = kav1_id;

  -- Mark Kav 2 invoices as overdue for closed period
  update public.invoices
  set status = 'overdue'
  where billing_period_id = period_closed_id
    and kavling_id = kav2_id;

  -- Make one open period invoice have some partial payment scenario (Kav 3A)
  update public.invoices
  set amount_paid = amount_due / 2,
      status = 'partial'
  where billing_period_id = period_open_id
    and kavling_id = kav3_id;
end;
$$;
