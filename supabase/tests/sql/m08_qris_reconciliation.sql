do $$
declare
  v_resident uuid := '82000000-0000-0000-0000-000000000001'::uuid;
  v_treasurer uuid := '82000000-0000-0000-0000-000000000002'::uuid;
  v_kavling_settle uuid;
  v_kavling_expire uuid;
  v_kavling_invariant uuid;
  v_period uuid;
  v_invoice_settle uuid;
  v_invoice_expire uuid;
  v_invoice_invariant uuid;
  v_gateway_settle uuid;
  v_gateway_expire uuid;
  v_gateway_invariant uuid;
  v_submission_invariant_a uuid;
  v_submission_invariant_b uuid;
  v_status public.gateway_status;
  v_payment_count integer;
  v_invoice_status public.invoice_status;
  v_amount_paid integer;
  v_expected_message text;
  v_proof_path text;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_resident, 'authenticated', 'authenticated', 'resident-m08-qris@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_treasurer, 'authenticated', 'authenticated', 'treasurer-m08-qris@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_resident, 'M08 QRIS Resident', 'resident', true),
    (v_treasurer, 'M08 QRIS Treasurer', 'treasurer', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  select id into v_kavling_settle
  from public.kavlings
  order by sort_order, code
  limit 1;

  select id into v_kavling_expire
  from public.kavlings
  order by sort_order, code
  offset 1
  limit 1;

  select id into v_kavling_invariant
  from public.kavlings
  order by sort_order, code
  offset 2
  limit 1;

  if v_kavling_settle is null or v_kavling_expire is null or v_kavling_invariant is null then
    raise exception 'no kavling found in seed data';
  end if;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2027, 1, 'Jan 2027', current_date + interval '14 day', 'open')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status
  returning id into v_period;

  insert into public.invoices (billing_period_id, kavling_id, invoice_number, amount_due, amount_paid, due_date, status)
  values (v_period, v_kavling_settle, 'IPL-M08-QRIS-SETTLE', 350000, 0, current_date + interval '14 day', 'unpaid')
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid'
  returning id into v_invoice_settle;

  insert into public.invoices (billing_period_id, kavling_id, invoice_number, amount_due, amount_paid, due_date, status)
  values (v_period, v_kavling_expire, 'IPL-M08-QRIS-EXPIRE', 200000, 0, current_date + interval '14 day', 'unpaid')
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid'
  returning id into v_invoice_expire;

  insert into public.invoices (billing_period_id, kavling_id, invoice_number, amount_due, amount_paid, due_date, status)
  values (v_period, v_kavling_invariant, 'IPL-M08-INVARIANT', 150000, 0, current_date + interval '14 day', 'unpaid')
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid'
  returning id into v_invoice_invariant;

  delete from public.payments where invoice_id in (v_invoice_settle, v_invoice_expire);
  delete from public.payment_gateway_transactions where invoice_id in (v_invoice_settle, v_invoice_expire);
  delete from public.payments where invoice_id = v_invoice_invariant;
  delete from public.payment_submissions where invoice_id = v_invoice_invariant;
  delete from public.payment_gateway_transactions where invoice_id = v_invoice_invariant;

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
    v_invoice_settle,
    'midtrans',
    'ORDER-M08-SETTLE',
    null,
    350000,
    'pending',
    'qris',
    v_resident
  )
  returning id into v_gateway_settle;

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
    v_invoice_expire,
    'midtrans',
    'ORDER-M08-EXPIRE',
    null,
    200000,
    'pending',
    'qris',
    v_resident
  )
  returning id into v_gateway_expire;

  v_status := public.reconcile_midtrans_qris_notification(
    'ORDER-M08-SETTLE',
    'MIDTRANS-TRX-001',
    'settlement',
    '200',
    '350000.00',
    'qris',
    jsonb_build_object('order_id', 'ORDER-M08-SETTLE', 'transaction_status', 'settlement')
  );

  if v_status <> 'settlement' then
    raise exception 'settlement reconciliation must return settlement status, got %', v_status;
  end if;

  select count(*)
  into v_payment_count
  from public.payments
  where invoice_id = v_invoice_settle
    and external_reference = 'ORDER-M08-SETTLE';

  if v_payment_count <> 1 then
    raise exception 'first settlement must create exactly one payment, got %', v_payment_count;
  end if;

  v_status := public.reconcile_midtrans_qris_notification(
    'ORDER-M08-SETTLE',
    'MIDTRANS-TRX-001',
    'settlement',
    '200',
    '350000.00',
    'qris',
    jsonb_build_object('order_id', 'ORDER-M08-SETTLE', 'transaction_status', 'settlement', 'duplicate', true)
  );

  if v_status <> 'settlement' then
    raise exception 'duplicate settlement must remain settlement status, got %', v_status;
  end if;

  select count(*)
  into v_payment_count
  from public.payments
  where invoice_id = v_invoice_settle
    and external_reference = 'ORDER-M08-SETTLE';

  if v_payment_count <> 1 then
    raise exception 'duplicate settlement must not duplicate payment rows, got %', v_payment_count;
  end if;

  select status, amount_paid
  into v_invoice_status, v_amount_paid
  from public.invoices
  where id = v_invoice_settle;

  if v_invoice_status <> 'paid' then
    raise exception 'settled invoice must be marked paid; got %', v_invoice_status;
  end if;

  if v_amount_paid <> 350000 then
    raise exception 'settled invoice amount_paid must be 350000; got %', v_amount_paid;
  end if;

  v_status := public.reconcile_midtrans_qris_notification(
    'ORDER-M08-SETTLE',
    'MIDTRANS-TRX-001',
    'expire',
    '200',
    '350000.00',
    'qris',
    jsonb_build_object('order_id', 'ORDER-M08-SETTLE', 'transaction_status', 'expire', 'out_of_order', true)
  );

  if v_status <> 'settlement' then
    raise exception 'settled transaction must ignore regressive expire status, got %', v_status;
  end if;

  select count(*)
  into v_payment_count
  from public.payments
  where invoice_id = v_invoice_settle
    and external_reference = 'ORDER-M08-SETTLE';

  if v_payment_count <> 1 then
    raise exception 'regressive settle update must keep one payment row, got %', v_payment_count;
  end if;

  v_status := public.reconcile_midtrans_qris_notification(
    'ORDER-M08-EXPIRE',
    'MIDTRANS-TRX-EXPIRE',
    'expire',
    '200',
    '200000.00',
    'qris',
    jsonb_build_object('order_id', 'ORDER-M08-EXPIRE', 'transaction_status', 'expire')
  );

  if v_status <> 'expire' then
    raise exception 'expire reconciliation must return expire status, got %', v_status;
  end if;

  select count(*)
  into v_payment_count
  from public.payments
  where invoice_id = v_invoice_expire;

  if v_payment_count <> 0 then
    raise exception 'expire must not create payment rows, got %', v_payment_count;
  end if;

  select status, amount_paid
  into v_invoice_status, v_amount_paid
  from public.invoices
  where id = v_invoice_expire;

  if v_invoice_status <> 'unpaid' then
    raise exception 'expired invoice must stay unpaid; got %', v_invoice_status;
  end if;

  if v_amount_paid <> 0 then
    raise exception 'expired invoice amount_paid must remain 0; got %', v_amount_paid;
  end if;

  v_status := public.reconcile_midtrans_qris_notification(
    'ORDER-M08-EXPIRE',
    'MIDTRANS-TRX-EXPIRE',
    'settlement',
    '200',
    '200000.00',
    'qris',
    jsonb_build_object('order_id', 'ORDER-M08-EXPIRE', 'transaction_status', 'settlement', 'out_of_order', true)
  );

  if v_status <> 'expire' then
    raise exception 'expired transaction must ignore late settlement status, got %', v_status;
  end if;

  select count(*)
  into v_payment_count
  from public.payments
  where invoice_id = v_invoice_expire;

  if v_payment_count <> 0 then
    raise exception 'expired transaction must not create payment rows after regression, got %', v_payment_count;
  end if;

  -- Reservation guard: two pending manual submissions cannot reserve > amount_due.
  perform set_config('request.jwt.claim.sub', v_resident::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice_invariant, v_resident, 100000, 'submitted')
  returning id into v_submission_invariant_a;

  v_proof_path := format('proofs/%s/%s/%s.pdf', v_resident, v_invoice_invariant, v_submission_invariant_a);
  update public.payment_submissions
  set proof_path = v_proof_path,
      proof_mime_type = 'application/pdf',
      proof_size_bytes = 1024
  where id = v_submission_invariant_a;
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values (
    'payment-proofs',
    v_proof_path,
    v_resident,
    v_resident::text,
    jsonb_build_object('mimetype', 'application/pdf', 'size', 1024)
  );

  begin
    insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
    values (v_invoice_invariant, v_resident, 60000, 'submitted')
    returning id into v_submission_invariant_b;
    raise exception 'second submission must fail reservation guard';
  exception
    when others then
      get stacked diagnostics v_expected_message = message_text;
      if position('reservable' in lower(coalesce(v_expected_message, ''))) = 0 then
        raise exception 'unexpected manual reservation guard error: %', v_expected_message;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.verify_payment_submission(v_submission_invariant_a, 'verify invariant manual');

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
    v_invoice_invariant,
    'midtrans',
    'ORDER-M08-INVARIANT',
    null,
    50000,
    'pending',
    'qris',
    v_resident
  )
  returning id into v_gateway_invariant;

  v_status := public.reconcile_midtrans_qris_notification(
    'ORDER-M08-INVARIANT',
    'MIDTRANS-TRX-INVARIANT',
    'settlement',
    '200',
    '50000.00',
    'qris',
    jsonb_build_object('order_id', 'ORDER-M08-INVARIANT', 'transaction_status', 'settlement')
  );

  if v_status <> 'settlement' then
    raise exception 'manual-first then qris-settlement must still return settlement status, got %', v_status;
  end if;

  select count(*)
  into v_payment_count
  from public.payments
  where invoice_id = v_invoice_invariant;

  if v_payment_count <> 2 then
    raise exception 'manual-first + qris settlement must produce two payment rows, got %', v_payment_count;
  end if;

  select amount_paid
  into v_amount_paid
  from public.invoices
  where id = v_invoice_invariant;

  if v_amount_paid <> 150000 then
    raise exception 'manual-first + qris settlement must preserve amount_paid=150000, got %', v_amount_paid;
  end if;

  -- Settlement-first then manual path must be blocked.
  update public.invoices
  set amount_paid = 0,
      status = 'unpaid',
      paid_at = null
  where id = v_invoice_invariant;

  delete from public.payments where invoice_id = v_invoice_invariant;
  delete from public.payment_submissions where invoice_id = v_invoice_invariant;
  delete from public.payment_gateway_transactions where invoice_id = v_invoice_invariant;

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
    v_invoice_invariant,
    'midtrans',
    'ORDER-M08-INVARIANT-2',
    null,
    150000,
    'pending',
    'qris',
    v_resident
  );

  v_status := public.reconcile_midtrans_qris_notification(
    'ORDER-M08-INVARIANT-2',
    'MIDTRANS-TRX-INVARIANT-2',
    'settlement',
    '200',
    '150000.00',
    'qris',
    jsonb_build_object('order_id', 'ORDER-M08-INVARIANT-2', 'transaction_status', 'settlement')
  );

  if v_status <> 'settlement' then
    raise exception 'qris settlement must return settlement status, got %', v_status;
  end if;

  begin
    perform set_config('request.jwt.claim.sub', v_resident::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
    values (v_invoice_invariant, v_resident, 150000, 'submitted')
    returning id into v_submission_invariant_b;
    raise exception 'manual submission after full qris settlement must fail';
  exception
    when others then
      get stacked diagnostics v_expected_message = message_text;
      if position('reservable' in lower(coalesce(v_expected_message, ''))) = 0 then
        raise exception 'unexpected post-settlement manual submission error: %', v_expected_message;
      end if;
  end;

  select amount_paid
  into v_amount_paid
  from public.invoices
  where id = v_invoice_invariant;

  if v_amount_paid <> 150000 then
    raise exception 'invoice amount_paid must not exceed amount_due and stay 150000, got %', v_amount_paid;
  end if;

  if exists (
    select 1
    from public.invoices
    where id = v_invoice_invariant
      and amount_paid > amount_due
  ) then
    raise exception 'invoice invariant violated: amount_paid must be <= amount_due';
  end if;
end;
$$;
