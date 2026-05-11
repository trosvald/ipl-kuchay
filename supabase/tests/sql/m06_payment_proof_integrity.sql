do $$
declare
  v_admin uuid := '86000000-0000-0000-0000-000000000001'::uuid;
  v_resident uuid := '86000000-0000-0000-0000-000000000002'::uuid;
  v_kav uuid;
  v_period uuid;
  v_invoice uuid;
  v_submission uuid;
  v_proof_path text;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_admin, 'authenticated', 'authenticated', 'admin-m06-proof@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident, 'authenticated', 'authenticated', 'resident-m06-proof@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_admin, 'M06 Proof Admin', 'admin', true),
    (v_resident, 'M06 Proof Resident', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  select id into v_kav
  from public.kavlings
  order by sort_order, code
  limit 1;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2027, 1, 'January 2027', current_date + interval '10 day', 'open')
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
    'IPL-M06-PROOF',
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
  returning id into v_invoice;

  delete from public.payments where invoice_id = v_invoice;
  delete from public.payment_submissions where invoice_id = v_invoice;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission;

  begin
    perform public.verify_payment_submission(v_submission, 'must fail without proof');
    raise exception 'proofless verify should fail';
  exception
    when others then
      if position('verified proof object' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  delete from public.payment_submissions where id = v_submission;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission;

  v_proof_path := format('proofs/%s/%s/%s.pdf', v_resident, v_invoice, v_submission);

  update public.payment_submissions
  set proof_path = v_proof_path,
      proof_mime_type = 'application/pdf',
      proof_size_bytes = 1024
  where id = v_submission;

  begin
    perform public.verify_payment_submission(v_submission, 'must fail without storage object');
    raise exception 'missing proof object verify should fail';
  exception
    when others then
      if position('verified proof object' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  delete from public.payment_submissions where id = v_submission;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_invoice, v_resident, 100000, 'submitted')
  returning id into v_submission;

  v_proof_path := format('proofs/%s/%s/%s.pdf', v_resident, v_invoice, v_submission);

  update public.payment_submissions
  set proof_path = v_proof_path,
      proof_mime_type = 'application/pdf',
      proof_size_bytes = 1024
  where id = v_submission;

  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values (
    'payment-proofs',
    v_proof_path,
    v_resident,
    v_resident::text,
    jsonb_build_object('mimetype', 'image/png', 'size', 1024)
  );

  begin
    perform public.verify_payment_submission(v_submission, 'must fail with MIME mismatch');
    raise exception 'mismatched proof object verify should fail';
  exception
    when others then
      if position('verified proof object' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  update storage.objects
  set metadata = jsonb_build_object('mimetype', 'application/pdf', 'size', 2048)
  where bucket_id = 'payment-proofs'
    and name = v_proof_path;

  begin
    perform public.verify_payment_submission(v_submission, 'must fail with size mismatch');
    raise exception 'mismatched proof size verify should fail';
  exception
    when others then
      if position('verified proof object' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  update storage.objects
  set metadata = jsonb_build_object('mimetype', 'application/pdf', 'size', 1024)
  where bucket_id = 'payment-proofs'
    and name = v_proof_path;

  perform public.verify_payment_submission(v_submission, 'valid proof object');

  delete from public.payments where invoice_id = v_invoice;
  delete from public.payment_submissions where invoice_id = v_invoice;
end;
$$;
