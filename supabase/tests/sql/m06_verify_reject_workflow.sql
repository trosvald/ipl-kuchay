do $$
declare
  v_admin uuid := '66666666-6666-6666-6666-666666666666'::uuid;
  v_resident uuid := '77777777-7777-7777-7777-777777777777'::uuid;
  v_period_verify uuid;
  v_period_reject uuid;
  v_kav uuid;
  v_invoice_verify uuid;
  v_invoice_reject uuid;
  v_submission_1 uuid;
  v_submission_2 uuid;
  v_submission_3 uuid;
  v_submission_4 uuid;
  v_payment_id uuid;
  v_invoice_status public.invoice_status;
  v_amount_paid integer;
  v_audit_count integer;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_admin, 'authenticated', 'authenticated', 'admin-m06@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident, 'authenticated', 'authenticated', 'resident-m06@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_admin, 'M06 Admin', 'admin', true),
    (v_resident, 'M06 Resident', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2026, 7, 'July 2026', current_date + interval '10 day', 'open')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status
  returning id into v_period_verify;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2026, 8, 'August 2026', current_date + interval '10 day', 'open')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status
  returning id into v_period_reject;

  select id into v_kav
  from public.kavlings
  order by sort_order, code
  limit 1;

  if v_kav is null then
    raise exception 'no kavling found in seed data';
  end if;

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
    v_period_verify,
    v_kav,
    'IPL-M06-VERIFY',
    300000,
    0,
    current_date + interval '10 day',
    'unpaid'
  )
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid'
  returning id into v_invoice_verify;

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
    v_period_reject,
    v_kav,
    'IPL-M06-REJECT',
    250000,
    0,
    current_date + interval '10 day',
    'unpaid'
  )
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid'
  returning id into v_invoice_reject;

  delete from public.payments where invoice_id in (v_invoice_verify, v_invoice_reject);
  delete from public.payment_submissions where invoice_id in (v_invoice_verify, v_invoice_reject);

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice_verify, v_resident, 100000, 'submitted')
  returning id into v_submission_1;

  v_payment_id := public.verify_payment_submission(v_submission_1, 'partial approval');
  if v_payment_id is null then
    raise exception 'verify_payment_submission returned null payment id';
  end if;

  select status, amount_paid
  into v_invoice_status, v_amount_paid
  from public.invoices
  where id = v_invoice_verify;

  if v_invoice_status <> 'partial' or v_amount_paid <> 100000 then
    raise exception 'expected partial / 100000 after first verification, got % / %', v_invoice_status, v_amount_paid;
  end if;

  begin
    perform public.verify_payment_submission(v_submission_1, 'duplicate approval');
    raise exception 'duplicate verify should fail';
  exception
    when others then
      if position('submission is not submitted' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice_verify, v_resident, 200000, 'submitted')
  returning id into v_submission_2;

  perform public.verify_payment_submission(v_submission_2, null);

  select status, amount_paid
  into v_invoice_status, v_amount_paid
  from public.invoices
  where id = v_invoice_verify;

  if v_invoice_status <> 'paid' or v_amount_paid <> 300000 then
    raise exception 'expected paid / 300000 after second verification, got % / %', v_invoice_status, v_amount_paid;
  end if;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice_verify, v_resident, 50000, 'submitted')
  returning id into v_submission_3;

  perform public.reject_payment_submission(v_submission_3, 'proof does not match transfer');

  select status
  into v_invoice_status
  from public.invoices
  where id = v_invoice_verify;

  if v_invoice_status <> 'paid' then
    raise exception 'rejecting extra submission must keep paid invoice paid; got %', v_invoice_status;
  end if;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice_reject, v_resident, 120000, 'submitted')
  returning id into v_submission_4;

  perform public.reject_payment_submission(v_submission_4, 'invalid proof');

  select status, amount_paid
  into v_invoice_status, v_amount_paid
  from public.invoices
  where id = v_invoice_reject;

  if v_invoice_status <> 'rejected' or v_amount_paid <> 0 then
    raise exception 'expected rejected / 0 for invoice without valid payments, got % / %', v_invoice_status, v_amount_paid;
  end if;

  select count(*)
  into v_audit_count
  from public.audit_logs
  where action in ('payment_submission.verify', 'payment_submission.reject')
    and entity_id in (
      v_submission_1::text,
      v_submission_2::text,
      v_submission_3::text,
      v_submission_4::text
    );

  if v_audit_count <> 4 then
    raise exception 'expected 4 verify/reject audit logs, got %', v_audit_count;
  end if;
end;
$$;
