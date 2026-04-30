do $$
declare
  v_super_admin uuid := '81000000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '81000000-0000-0000-0000-000000000002'::uuid;
  v_treasurer uuid := '81000000-0000-0000-0000-000000000003'::uuid;
  v_resident uuid := '81000000-0000-0000-0000-000000000004'::uuid;
  v_kav uuid;
  v_period uuid;
  v_invoice uuid;
  v_submission_verify uuid;
  v_submission_reject uuid;
  v_payment_id uuid;
  v_invoice_status public.invoice_status;
  v_amount_paid integer;
  v_audit_count integer;
  v_before_data jsonb;
  v_after_data jsonb;
  v_audit_row public.audit_logs%rowtype;
begin
  -- ----------------------------------------------------------------
  -- Setup: admin + treasurer + resident users
  -- ----------------------------------------------------------------
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_super_admin, 'authenticated', 'authenticated', 'sa-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_admin, 'authenticated', 'authenticated', 'admin-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_treasurer, 'authenticated', 'authenticated', 'treasurer-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident, 'authenticated', 'authenticated', 'resident-m08@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_super_admin, 'M08 Super Admin', 'super_admin', true),
    (v_admin, 'M08 Admin', 'admin', true),
    (v_treasurer, 'M08 Treasurer', 'treasurer', true),
    (v_resident, 'M08 Resident', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  select id into v_kav
  from public.kavlings
  order by sort_order, code
  limit 1;

  if v_kav is null then
    raise exception 'no kavling found in seed data';
  end if;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2026, 11, 'Nov 2026', current_date + interval '15 day', 'open')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status
  returning id into v_period;

  insert into public.invoices (
    billing_period_id,
    kavling_id,
    invoice_number,
    amount_due,
    amount_paid,
    due_date,
    status
  )
  values (
    v_period,
    v_kav,
    'IPL-M08-TEST',
    500000,
    0,
    current_date + interval '15 day',
    'unpaid'
  )
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid'
  returning id into v_invoice;

  delete from public.payments where invoice_id = v_invoice;
  delete from public.payment_submissions where invoice_id = v_invoice;

  -- ----------------------------------------------------------------
  -- TEST 1: verify_payment_submission creates payment + updates invoice + audit
  -- ----------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_resident::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 500000, 'submitted')
  returning id into v_submission_verify;

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_payment_id := public.verify_payment_submission(v_submission_verify, 'full payment approved');
  if v_payment_id is null or v_payment_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'verify_payment_submission must return a valid payment id, got %', v_payment_id;
  end if;

  if not exists (
    select 1 from public.payments where id = v_payment_id and invoice_id = v_invoice
  ) then
    raise exception 'payment row must be created with correct invoice linkage';
  end if;

  if not exists (
    select 1 from public.payments where id = v_payment_id and amount = 500000
  ) then
    raise exception 'payment row must store submitted amount as 500000';
  end if;

  select status, amount_paid
  into v_invoice_status, v_amount_paid
  from public.invoices
  where id = v_invoice;

  if v_invoice_status <> 'paid' then
    raise exception 'invoice status must be paid after full verification; got %', v_invoice_status;
  end if;

  if v_amount_paid <> 500000 then
    raise exception 'invoice amount_paid must be 500000 after full verification; got %', v_amount_paid;
  end if;

  select count(*)
  into v_audit_count
  from public.audit_logs
  where action = 'payment_submission.verify'
    and entity_id = v_submission_verify::text;

  if v_audit_count < 1 then
    raise exception 'verify must append at least one audit log entry; got %', v_audit_count;
  end if;

  -- Audit payload must include before_data (submission snapshot)
  select before_data, after_data
  into v_before_data, v_after_data
  from public.audit_logs
  where action = 'payment_submission.verify'
    and entity_id = v_submission_verify::text
  order by created_at desc
  limit 1;

  if v_before_data is null then
    raise exception 'audit before_data must not be null for payment_submission.verify';
  end if;

  if v_after_data is null then
    raise exception 'audit after_data must not be null for payment_submission.verify';
  end if;

  -- after_data must include payment_id linkage
  if not (v_after_data->>'payment_id')::text is not null then
    raise exception 'audit after_data must include payment_id linkage';
  end if;

  -- after_data must include invoice_status
  if not (v_after_data->>'invoice_status')::text is not null then
    raise exception 'audit after_data must include invoice_status';
  end if;

  -- ----------------------------------------------------------------
  -- TEST 2: reject_payment_submission writes reason + recalculates + audit
  -- ----------------------------------------------------------------
  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 300000, 'submitted')
  returning id into v_submission_reject;

  perform public.reject_payment_submission(v_submission_reject, 'proof image unclear');

  if not exists (
    select 1 from public.payment_submissions
    where id = v_submission_reject
      and status = 'rejected'
      and rejection_reason = 'proof image unclear'
  ) then
    raise exception 'rejected submission must persist with rejection_reason = proof image unclear';
  end if;

  select status
  into v_invoice_status
  from public.invoices
  where id = v_invoice;

  if v_invoice_status <> 'paid' then
    raise exception 'rejecting extra submission on already-paid invoice must stay paid; got %', v_invoice_status;
  end if;

  select count(*)
  into v_audit_count
  from public.audit_logs
  where action = 'payment_submission.reject'
    and entity_id = v_submission_reject::text;

  if v_audit_count < 1 then
    raise exception 'reject must append at least one audit log entry; got %', v_audit_count;
  end if;

  select before_data, after_data
  into v_before_data, v_after_data
  from public.audit_logs
  where action = 'payment_submission.reject'
    and entity_id = v_submission_reject::text
  order by created_at desc
  limit 1;

  if v_before_data is null then
    raise exception 'audit before_data must not be null for payment_submission.reject';
  end if;

  if v_after_data is null then
    raise exception 'audit after_data must not be null for payment_submission.reject';
  end if;

  -- ----------------------------------------------------------------
  -- TEST 3: non-submitted submissions cannot be re-verified/re-rejected
  -- ----------------------------------------------------------------
  begin
    perform public.verify_payment_submission(v_submission_verify, 'must fail');
    raise exception 'verify on already-verified submission must fail';
  exception
    when others then
      if position('submission is not submitted' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.reject_payment_submission(v_submission_verify, 'must fail');
    raise exception 'reject on already-verified submission must fail';
  exception
    when others then
      if position('submission is not submitted' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.verify_payment_submission(v_submission_reject, 'must fail');
    raise exception 'verify on already-rejected submission must fail';
  exception
    when others then
      if position('submission is not submitted' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.reject_payment_submission(v_submission_reject, 'must fail');
    raise exception 'reject on already-rejected submission must fail';
  exception
    when others then
      if position('submission is not submitted' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- ----------------------------------------------------------------
  -- TEST 4: actor role scope — treasurer + admin allowed, others blocked
  -- ----------------------------------------------------------------
  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission_verify;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_payment_id := public.verify_payment_submission(v_submission_verify, 'admin verify');
  if v_payment_id is null then
    raise exception 'admin must be able to verify payment submission';
  end if;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission_verify;

  perform public.reject_payment_submission(v_submission_verify, 'admin reject');
  if not exists (
    select 1 from public.payment_submissions where id = v_submission_verify and status = 'rejected'
  ) then
    raise exception 'admin must be able to reject payment submission';
  end if;

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission_verify;

  v_payment_id := public.verify_payment_submission(v_submission_verify, 'treasurer verify');
  if v_payment_id is null then
    raise exception 'treasurer must be able to verify payment submission';
  end if;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission_verify;

  perform public.reject_payment_submission(v_submission_verify, 'treasurer reject');
  if not exists (
    select 1 from public.payment_submissions where id = v_submission_verify and status = 'rejected'
  ) then
    raise exception 'treasurer must be able to reject payment submission';
  end if;

  -- resident must not be able to verify or reject
  perform set_config('request.jwt.claim.sub', v_resident::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    perform public.verify_payment_submission(v_submission_verify, 'resident must not verify');
    raise exception 'resident must not be able to verify';
  exception
    when others then
      if position('not authorized' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.reject_payment_submission(v_submission_verify, 'resident must not reject');
    raise exception 'resident must not be able to reject';
  exception
    when others then
      if position('not authorized' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- ----------------------------------------------------------------
  -- TEST 5: duplicate transition rejection is deterministic
  -- Calling verify on verified, then reject on rejected, must both fail
  -- ----------------------------------------------------------------
  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 250000, 'submitted')
  returning id into v_submission_verify;

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_payment_id := public.verify_payment_submission(v_submission_verify, 'first verify');
  if v_payment_id is null then
    raise exception 'first verify must succeed';
  end if;

  begin
    perform public.verify_payment_submission(v_submission_verify, 'second verify');
    raise exception 'second verify must fail deterministically';
  exception
    when others then
      if position('submission is not submitted' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.reject_payment_submission(v_submission_verify, 'reject after verify');
    raise exception 'reject after verify must fail deterministically';
  exception
    when others then
      if position('submission is not submitted' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- ----------------------------------------------------------------
  -- TEST 6: recalculate_invoice_status is consistent after repeated calls
  -- ----------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.invoices (
    billing_period_id,
    kavling_id,
    invoice_number,
    amount_due,
    amount_paid,
    due_date,
    status
  )
  values (
    v_period,
    v_kav,
    'IPL-M08-RECALC',
    200000,
    0,
    current_date + interval '15 day',
    'unpaid'
  )
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid';

  select id into v_invoice
  from public.invoices
  where invoice_number = 'IPL-M08-RECALC';

  delete from public.payments where invoice_id = v_invoice;
  delete from public.payment_submissions where invoice_id = v_invoice;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission_verify;

  perform public.verify_payment_submission(v_submission_verify, 'partial');

  v_invoice_status := public.recalculate_invoice_status(v_invoice);
  if v_invoice_status <> 'partial' then
    raise exception 'first recalc after partial payment must be partial; got %', v_invoice_status;
  end if;

  v_invoice_status := public.recalculate_invoice_status(v_invoice);
  if v_invoice_status <> 'partial' then
    raise exception 'second recalc must be idempotent and return partial; got %', v_invoice_status;
  end if;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission_verify;

  perform public.verify_payment_submission(v_submission_verify, 'complete');

  v_invoice_status := public.recalculate_invoice_status(v_invoice);
  if v_invoice_status <> 'paid' then
    raise exception 'recalcs after full payment must be paid; got %', v_invoice_status;
  end if;

  v_invoice_status := public.recalculate_invoice_status(v_invoice);
  if v_invoice_status <> 'paid' then
    raise exception 'repeated recalc after full payment must stay paid; got %', v_invoice_status;
  end if;

end;
$$;
