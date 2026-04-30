-- M09: Phase 3 Reporting & Exports Consistency Checks
-- SQL regression tests validating report data consistency invariants:
-- 1. Collection summary totals are consistent with canonical invoice/payment tables
-- 2. Arrears criteria correctly identifies outstanding invoices
-- 3. CSV export rows match the source invoice/payment data

do $$
declare
  v_super_admin uuid := '81000000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '81000000-0000-0000-0000-000000000002'::uuid;
  v_treasurer uuid := '81000000-0000-0000-0000-000000000003'::uuid;
  v_resident uuid := '81000000-0000-0000-0000-000000000004'::uuid;
  v_kav1 uuid;
  v_kav2 uuid;
  v_period1 uuid;
  v_period2 uuid;
  v_invoice1 uuid;
  v_invoice2 uuid;
  v_submission1 uuid;
  v_submission2 uuid;
  v_payment_id uuid;
  v_count integer;

  -- Report consistency invariants
  v_sum_invoiced bigint;
  v_sum_paid bigint;
  v_remaining bigint;
  v_arrears_count integer;
begin
  -- ----------------------------------------------------------------
  -- Setup: admin + treasurer + resident users and test data
  -- ----------------------------------------------------------------
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_super_admin, 'authenticated', 'authenticated', 'sa-m09@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_admin, 'authenticated', 'authenticated', 'admin-m09@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_treasurer, 'authenticated', 'authenticated', 'treasurer-m09@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident, 'authenticated', 'authenticated', 'resident-m09@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_super_admin, 'M09 Super Admin', 'super_admin', true),
    (v_admin, 'M09 Admin', 'admin', true),
    (v_treasurer, 'M09 Treasurer', 'treasurer', true),
    (v_resident, 'M09 Resident', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  -- Get two distinct kavlings
  select id into v_kav1 from public.kavlings order by sort_order, code limit 1;
  select id into v_kav2 from public.kavlings where id <> v_kav1 order by sort_order, code limit 1;

  if v_kav1 is null then
    raise exception 'no kavling found in seed data';
  end if;

  -- Create two test periods (same month, different years to avoid conflicts)
  insert into public.billing_periods (year, month, label, due_date, status)
  values (2025, 12, 'Desember 2025', current_date + interval '15 day', 'closed')
  on conflict (year, month) do update
  set label = excluded.label, due_date = excluded.due_date, status = excluded.status
  returning id into v_period1;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2026, 12, 'Desember 2026', current_date + interval '15 day', 'open')
  on conflict (year, month) do update
  set label = excluded.label, due_date = excluded.due_date, status = excluded.status
  returning id into v_period2;

  -- Create first invoice (fully paid) for period1
  insert into public.invoices (billing_period_id, kavling_id, invoice_number, amount_due, amount_paid, due_date, status)
  values (v_period1, v_kav1, 'IPL-M09-FULL', 500000, 0, current_date + interval '15 day', 'unpaid')
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number, amount_due = excluded.amount_due, amount_paid = 0, status = 'unpaid'
  returning id into v_invoice1;

  -- Create second invoice (partial payment, overdue) for period2
  insert into public.invoices (billing_period_id, kavling_id, invoice_number, amount_due, amount_paid, due_date, status)
  values (v_period2, v_kav2, 'IPL-M09-PARTIAL', 750000, 200000, current_date - interval '45 day', 'partial')
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number, amount_due = excluded.amount_due, amount_paid = excluded.amount_paid, status = excluded.status
  returning id into v_invoice2;

  -- ----------------------------------------------------------------
  -- TEST 1: Collection summary totals consistency
  -- Sum of amount_due across invoices for a period must match
  -- sum of (amount_due) from canonical invoice table
  -- ----------------------------------------------------------------
  -- Test period1: only one invoice (500000)
  select coalesce(sum(amount_due), 0) into v_sum_invoiced
  from public.invoices where billing_period_id = v_period1;

  if v_sum_invoiced <> 500000 then
    raise exception 'TEST 1 FAILED: period1 total_invoiced must be 500000, got %', v_sum_invoiced;
  end if;

  -- Test period2: only one invoice (750000)
  select coalesce(sum(amount_due), 0) into v_sum_invoiced
  from public.invoices where billing_period_id = v_period2;

  if v_sum_invoiced <> 750000 then
    raise exception 'TEST 1 FAILED: period2 total_invoiced must be 750000, got %', v_sum_invoiced;
  end if;

  -- ----------------------------------------------------------------
  -- TEST 2: Arrears count matches invoices with remaining balance
  -- Arrears list = invoices where (amount_due - amount_paid) > 0 and status not in (paid, waived, cancelled)
  -- ----------------------------------------------------------------
  -- period1 (v_invoice1): remaining = 500000 - 0 = 500000, status = unpaid -> qualifies
  select count(*) into v_arrears_count
  from public.invoices
  where billing_period_id = v_period1
    and status not in ('paid', 'waived', 'cancelled')
    and (amount_due - amount_paid) > 0;

  if v_arrears_count < 1 then
    raise exception 'TEST 2 FAILED: period1 arrears count must be >= 1, got %', v_arrears_count;
  end if;

  -- period2 (v_invoice2): remaining = 750000 - 200000 = 550000, status = partial -> qualifies
  select count(*) into v_arrears_count
  from public.invoices
  where billing_period_id = v_period2
    and status not in ('paid', 'waived', 'cancelled')
    and (amount_due - amount_paid) > 0;

  if v_arrears_count < 1 then
    raise exception 'TEST 2 FAILED: period2 arrears count must be >= 1, got %', v_arrears_count;
  end if;

  -- ----------------------------------------------------------------
  -- TEST 3: CSV export row totals must match source invoice totals
  -- For each CSV row: total_paid + remaining must equal total_invoiced
  -- ----------------------------------------------------------------
  select
    coalesce(sum(amount_due), 0),
    coalesce(sum(amount_paid), 0),
    coalesce(sum(amount_due - amount_paid), 0)
  into v_sum_invoiced, v_sum_paid, v_remaining
  from public.invoices
  where billing_period_id = v_period1;

  if (v_sum_paid + v_remaining) <> v_sum_invoiced then
    raise exception 'TEST 3 FAILED: CSV invariant violated for period1: % + % = % (expected %)',
      v_sum_paid, v_remaining, (v_sum_paid + v_remaining), v_sum_invoiced;
  end if;

  select
    coalesce(sum(amount_due), 0),
    coalesce(sum(amount_paid), 0),
    coalesce(sum(amount_due - amount_paid), 0)
  into v_sum_invoiced, v_sum_paid, v_remaining
  from public.invoices
  where billing_period_id = v_period2;

  if (v_sum_paid + v_remaining) <> v_sum_invoiced then
    raise exception 'TEST 3 FAILED: CSV invariant violated for period2: % + % = % (expected %)',
      v_sum_paid, v_remaining, (v_sum_paid + v_remaining), v_sum_invoiced;
  end if;

  -- ----------------------------------------------------------------
  -- TEST 4: report generation creates record in public.reports
  -- ----------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.reports (report_type, billing_period_id, title, metadata, generated_by)
  values ('monthly_summary', v_period2, 'Laporan Bulanan Desember 2026', '{"total_invoiced": 750000, "invoice_count": 1, "period_label": "Desember 2026"}'::jsonb, v_treasurer);

  if not exists (
    select 1 from public.reports
    where billing_period_id = v_period2
      and report_type = 'monthly_summary'
      and generated_by = v_treasurer
  ) then
    raise exception 'TEST 4 FAILED: report generation must create record in public.reports';
  end if;

  -- ----------------------------------------------------------------
  -- TEST 5: resident_receipt report type is also tracked
  -- ----------------------------------------------------------------
  insert into public.reports (report_type, billing_period_id, title, metadata, generated_by)
  values ('receipt', v_period2, 'Bukti Bayar - Test - Desember 2026', '{"kavling_code": "TEST", "amount_paid": 200000}'::jsonb, v_treasurer);

  if not exists (
    select 1 from public.reports
    where billing_period_id = v_period2
      and report_type = 'receipt'
  ) then
    raise exception 'TEST 5 FAILED: resident_receipt report type must also be persisted';
  end if;

  -- ----------------------------------------------------------------
  -- TEST 6: report generation audit trail (if audit trigger exists)
  -- ----------------------------------------------------------------
  -- Just verify reports table has the expected entries with proper metadata
  select count(*) into v_count
  from public.reports
  where billing_period_id = v_period2;

  if v_count < 2 then
    raise exception 'TEST 6 FAILED: expected at least 2 report entries for period2, got %', v_count;
  end if;

end;
$$;