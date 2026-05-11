do $$
declare
  v_submitter uuid := '8c120000-0000-0000-0000-000000000001'::uuid;
  v_co_resident uuid := '8c120000-0000-0000-0000-000000000002'::uuid;
  v_former_resident uuid := '8c120000-0000-0000-0000-000000000003'::uuid;
  v_treasurer uuid := '8c120000-0000-0000-0000-000000000004'::uuid;
  v_inactive_treasurer uuid := '8c120000-0000-0000-0000-000000000005'::uuid;
  v_kav uuid;
  v_period uuid;
  v_invoice uuid;
  v_submission uuid;
  v_policy_comment text;
begin
  if not exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'can_access_payment_proof_submission'
  ) then
    raise exception 'public.can_access_payment_proof_submission(uuid) is required';
  end if;

  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_submitter, 'authenticated', 'authenticated', 'proof-submitter@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_co_resident, 'authenticated', 'authenticated', 'proof-co-resident@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_former_resident, 'authenticated', 'authenticated', 'proof-former-resident@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_treasurer, 'authenticated', 'authenticated', 'proof-treasurer@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_inactive_treasurer, 'authenticated', 'authenticated', 'proof-inactive-treasurer@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_submitter, 'Proof Submitter', 'resident', true),
    (v_co_resident, 'Proof Co Resident', 'resident', true),
    (v_former_resident, 'Proof Former Resident', 'resident', true),
    (v_treasurer, 'Proof Treasurer', 'treasurer', true),
    (v_inactive_treasurer, 'Proof Inactive Treasurer', 'treasurer', false)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  insert into public.kavlings (code, block, sort_order, active)
  values ('M12-PROOF', 'M12', 1200, true)
  on conflict (code) do update
  set block = excluded.block,
      sort_order = excluded.sort_order,
      active = excluded.active
  returning id into v_kav;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2091, 12, 'Dec 2091', date '2091-12-15', 'open')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status
  returning id into v_period;

  insert into public.kavling_residents (
    kavling_id,
    profile_id,
    relation,
    relation_type,
    is_primary,
    active,
    started_at,
    ended_at
  ) values
    (v_kav, v_submitter, 'owner', 'owner', true, true, date '2091-01-01', null),
    (v_kav, v_co_resident, 'spouse', 'spouse', false, true, date '2091-01-01', null),
    (v_kav, v_former_resident, 'tenant', 'tenant', false, false, date '2091-01-01', date '2091-12-20')
  on conflict (kavling_id, profile_id) do update
  set relation = excluded.relation,
      relation_type = excluded.relation_type,
      is_primary = excluded.is_primary,
      active = excluded.active,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at;

  insert into public.invoices (
    billing_period_id,
    kavling_id,
    invoice_number,
    amount_due,
    amount_paid,
    due_date,
    status
  ) values (
    v_period,
    v_kav,
    'IPL-M12-PROOF',
    150000,
    0,
    date '2091-12-15',
    'unpaid'
  ) on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = excluded.amount_paid,
      due_date = excluded.due_date,
      status = excluded.status
  returning id into v_invoice;

  insert into public.payment_submissions (
    invoice_id,
    submitted_by,
    amount_submitted,
    proof_path,
    status
  ) values (
    v_invoice,
    v_submitter,
    150000,
    'payment-proofs/M12-PROOF/submission.png',
    'submitted'
  ) returning id into v_submission;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_submitter::text, true);

  if not public.can_access_payment_proof_submission(v_submission) then
    raise exception 'payment proof submitter must receive signed URL access';
  end if;

  perform set_config('request.jwt.claim.sub', v_co_resident::text, true);

  if public.can_access_payment_proof_submission(v_submission) then
    raise exception 'co-resident must not receive signed proof URL access';
  end if;

  perform set_config('request.jwt.claim.sub', v_former_resident::text, true);

  if not public.can_access_invoice_history(v_invoice) then
    raise exception 'test setup requires former resident to retain invoice-history access';
  end if;

  if public.can_access_payment_proof_submission(v_submission) then
    raise exception 'former resident with invoice history must not receive signed proof URL access';
  end if;

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);

  if not public.can_access_payment_proof_submission(v_submission) then
    raise exception 'active finance role must receive signed proof URL access';
  end if;

  perform set_config('request.jwt.claim.sub', v_inactive_treasurer::text, true);

  if public.can_access_payment_proof_submission(v_submission) then
    raise exception 'inactive finance role must not receive signed proof URL access';
  end if;

  select obj_description('public.can_access_payment_proof_submission(uuid)'::regprocedure, 'pg_proc')
  into v_policy_comment;

  if coalesce(v_policy_comment, '') not like '%Co-residents, former residents%' then
    raise exception 'payment proof visibility policy decision must be documented on the access function';
  end if;
end;
$$;
