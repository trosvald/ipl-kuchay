do $$
declare
  v_resident uuid := '82000000-0000-0000-0000-000000000001'::uuid;
  v_kavling_settle uuid;
  v_kavling_expire uuid;
  v_period uuid;
  v_invoice_settle uuid;
  v_invoice_expire uuid;
  v_gateway_settle uuid;
  v_gateway_expire uuid;
  v_status public.gateway_status;
  v_payment_count integer;
  v_invoice_status public.invoice_status;
  v_amount_paid integer;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_resident, 'authenticated', 'authenticated', 'resident-m08-qris@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values (v_resident, 'M08 QRIS Resident', 'resident', true)
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

  if v_kavling_settle is null or v_kavling_expire is null then
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

  delete from public.payments where invoice_id in (v_invoice_settle, v_invoice_expire);
  delete from public.payment_gateway_transactions where invoice_id in (v_invoice_settle, v_invoice_expire);

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
end;
$$;
