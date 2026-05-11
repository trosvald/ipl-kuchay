do $$
declare
  v_admin uuid := '98000000-0000-4000-8000-000000000001'::uuid;
  v_treasurer uuid := '98000000-0000-4000-8000-000000000002'::uuid;
  v_former_resident uuid := '98000000-0000-4000-8000-000000000003'::uuid;
  v_current_resident uuid := '98000000-0000-4000-8000-000000000004'::uuid;
  v_kavling uuid;
  v_old_period uuid;
  v_new_period uuid;
  v_old_invoice uuid;
  v_new_invoice uuid;
  v_old_submission uuid;
  v_finance_submission uuid;
  v_old_payment uuid;
  v_old_report uuid;
  v_visible_count integer;
  v_status public.submission_status;
  v_invoice_status public.invoice_status;
  v_amount_paid integer;
  v_payment_id uuid;
  v_audit_count integer;
  v_billing_period uuid;
  v_announcement uuid;
  v_event uuid;
  v_proof_path text;
  v_daily_command text;
  v_monthly_command text;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_admin, 'authenticated', 'authenticated', 'admin-high@example.test', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_treasurer, 'authenticated', 'authenticated', 'treasurer-high@example.test', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_former_resident, 'authenticated', 'authenticated', 'former-high@example.test', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_current_resident, 'authenticated', 'authenticated', 'current-high@example.test', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_admin, 'High Admin', 'admin', true),
    (v_treasurer, 'High Treasurer', 'treasurer', true),
    (v_former_resident, 'Former Resident', 'resident', true),
    (v_current_resident, 'Current Resident', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  insert into public.kavlings (code, block, sort_order, active)
  values ('HIGH-01', 'H', 9801, true)
  on conflict (code) do update
  set block = excluded.block,
      active = excluded.active
  returning id into v_kavling;

  delete from public.kavling_residents where kavling_id = v_kavling;
  insert into public.kavling_residents (
    kavling_id,
    profile_id,
    relation,
    is_primary,
    active,
    started_at,
    ended_at
  )
  values
    (v_kavling, v_former_resident, 'owner', true, false, date '2026-01-01', date '2026-04-30'),
    (v_kavling, v_current_resident, 'owner', true, true, date '2026-05-01', null);

  insert into public.billing_periods (year, month, label, due_date, status)
  values
    (2026, 4, 'April 2026 High', date '2026-04-15', 'closed'),
    (2026, 5, 'Mei 2026 High', date '2026-05-15', 'open')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status;

  select id into v_old_period from public.billing_periods where year = 2026 and month = 4;
  select id into v_new_period from public.billing_periods where year = 2026 and month = 5;

  insert into public.invoices (
    billing_period_id,
    kavling_id,
    invoice_number,
    amount_due,
    amount_paid,
    due_date,
    status
  )
  values
    (v_old_period, v_kavling, 'HIGH-OLD-2026-04', 200000, 100000, date '2026-04-15', 'partial'),
    (v_new_period, v_kavling, 'HIGH-NEW-2026-05', 250000, 0, date '2026-05-15', 'unpaid')
  on conflict (billing_period_id, kavling_id) do update
  set invoice_number = excluded.invoice_number,
      amount_due = excluded.amount_due,
      amount_paid = excluded.amount_paid,
      due_date = excluded.due_date,
      status = excluded.status;

  select id into v_old_invoice from public.invoices where invoice_number = 'HIGH-OLD-2026-04';
  select id into v_new_invoice from public.invoices where invoice_number = 'HIGH-NEW-2026-05';

  delete from public.payments where invoice_id in (v_old_invoice, v_new_invoice);
  delete from public.payment_submissions where invoice_id in (v_old_invoice, v_new_invoice);
  delete from public.reports where metadata->>'invoice_id' in (v_old_invoice::text, v_new_invoice::text);

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_old_invoice, v_former_resident, 100000, 'verified')
  returning id into v_old_submission;

  insert into public.payments (invoice_id, payment_submission_id, amount, method, paid_at, verified_by)
  values (v_old_invoice, v_old_submission, 100000, 'manual_transfer', now(), v_admin)
  returning id into v_old_payment;

  insert into public.reports (report_type, title, metadata, generated_by)
  values (
    'receipt',
    'Old receipt',
    jsonb_build_object('invoice_id', v_old_invoice, 'payment_id', v_old_payment, 'kavling_id', v_kavling),
    v_admin
  )
  returning id into v_old_report;

  perform set_config('request.jwt.claim.sub', v_current_resident::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if public.can_access_invoice_history(v_old_invoice) then
    raise exception 'current resident must not read invoice before started_at';
  end if;

  if not public.can_access_invoice_history(v_new_invoice) then
    raise exception 'current resident must read invoice inside active occupancy window';
  end if;

  execute 'set local role authenticated';
  execute 'select count(*) from public.payment_submissions where id = $1'
    into v_visible_count
    using v_old_submission;
  execute 'reset role';

  if v_visible_count <> 0 then
    raise exception 'current resident must not read old occupant payment submissions';
  end if;

  execute 'set local role authenticated';
  execute 'select count(*) from public.payments where id = $1'
    into v_visible_count
    using v_old_payment;
  execute 'reset role';

  if v_visible_count <> 0 then
    raise exception 'current resident must not read old occupant payments';
  end if;

  execute 'set local role authenticated';
  execute 'select count(*) from public.reports where id = $1'
    into v_visible_count
    using v_old_report;
  execute 'reset role';

  if v_visible_count <> 0 then
    raise exception 'current resident must not read old occupant receipt reports';
  end if;

  if public.can_access_payment_proof_submission(v_old_submission) then
    raise exception 'current resident must not receive proof signed URLs for old occupant submissions';
  end if;

  perform set_config('request.jwt.claim.sub', v_former_resident::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not public.can_access_invoice_history(v_old_invoice) then
    raise exception 'former resident must retain access inside their ended_at window';
  end if;

  if public.can_access_invoice_history(v_new_invoice) then
    raise exception 'former resident must not read invoices after ended_at';
  end if;

  insert into public.payment_submissions (invoice_id, submitted_by, amount_submitted, status)
  values (v_new_invoice, v_current_resident, 120000, 'submitted')
  returning id into v_finance_submission;

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  execute 'set local role authenticated';
  execute 'update public.payment_submissions set status = ''verified'', verified_by = $1, verified_at = now() where id = $2'
    using v_treasurer, v_finance_submission;
  execute 'reset role';

  select status into v_status from public.payment_submissions where id = v_finance_submission;
  if v_status <> 'submitted' then
    raise exception 'direct payment_submissions update must not bypass verification RPC';
  end if;

  execute 'set local role authenticated';
  execute 'update public.invoices set amount_paid = 250000, status = ''paid'' where id = $1'
    using v_new_invoice;
  execute 'reset role';

  select status, amount_paid into v_invoice_status, v_amount_paid
  from public.invoices
  where id = v_new_invoice;

  if v_invoice_status <> 'unpaid' or v_amount_paid <> 0 then
    raise exception 'direct invoice tampering must be blocked, got % / %', v_invoice_status, v_amount_paid;
  end if;

  v_proof_path := format('proofs/%s/%s/%s.pdf', v_current_resident, v_new_invoice, v_finance_submission);
  update public.payment_submissions
  set proof_path = v_proof_path,
      proof_mime_type = 'application/pdf',
      proof_size_bytes = 2048
  where id = v_finance_submission;

  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values (
    'payment-proofs',
    v_proof_path,
    v_current_resident,
    v_current_resident::text,
    jsonb_build_object('mimetype', 'application/pdf', 'size', 2048)
  )
  on conflict (bucket_id, name) do update
  set owner_id = excluded.owner_id,
      metadata = excluded.metadata;

  v_payment_id := public.verify_payment_submission(v_finance_submission, 'approved through RPC');

  if v_payment_id is null then
    raise exception 'verification RPC must still succeed after direct table updates are denied';
  end if;

  select count(*) into v_audit_count
  from public.audit_logs
  where action = 'payment_submission.verify'
    and entity_id = v_finance_submission::text;

  if v_audit_count <> 1 then
    raise exception 'verification RPC must write exactly one audit row, got %', v_audit_count;
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  execute 'set local role authenticated';
  execute 'insert into public.billing_periods (year, month, label, due_date, status, created_by) values (2030, 1, ''Audit Jan 2030'', date ''2030-01-15'', ''draft'', $1) on conflict (year, month) do update set label = excluded.label returning id'
    into v_billing_period
    using v_admin;
  execute 'reset role';

  execute 'set local role authenticated';
  execute 'update public.billing_periods set status = ''open'', opened_at = now() where id = $1'
    using v_billing_period;
  execute 'reset role';

  insert into public.audit_logs (actor_id, actor_role, action, entity_table, entity_id)
  values (v_admin, 'admin', 'test.marker', 'test', 'high-findings');

  execute 'set local role authenticated';
  execute 'insert into public.app_settings (key, value, description, updated_by) values (''payment_gateway'', ''{"enabled": false}''::jsonb, ''test'', $1) on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by'
    using v_admin;
  execute 'reset role';

  execute 'set local role authenticated';
  execute 'insert into public.announcements (title, body, status, created_by) values (''Audit announcement'', ''Body'', ''published'', $1) returning id'
    into v_announcement
    using v_admin;
  execute 'reset role';

  execute 'set local role authenticated';
  execute 'update public.announcements set status = ''archived'', archived_at = now(), updated_by = $1 where id = $2'
    using v_admin, v_announcement;
  execute 'reset role';

  execute 'set local role authenticated';
  execute 'insert into public.events (title, description, location, starts_at, status, created_by) values (''Audit event'', ''Desc'', ''Balai'', now() + interval ''7 days'', ''scheduled'', $1) returning id'
    into v_event
    using v_admin;
  execute 'reset role';

  execute 'set local role authenticated';
  execute 'update public.events set status = ''cancelled'', cancellation_note = ''Hujan'', cancelled_at = now(), updated_by = $1 where id = $2'
    using v_admin, v_event;
  execute 'reset role';

  select count(*) into v_audit_count
  from public.audit_logs
  where actor_id = v_admin
    and action in (
      'billing_period.create',
      'billing_period.status_open',
      'app_setting.payment_gateway_update',
      'announcement.publish',
      'announcement.archive',
      'event.create',
      'event.cancel'
    );

  if v_audit_count < 7 then
    raise exception 'privileged mutation audit triggers must cover billing, settings, announcements, and events; got %', v_audit_count;
  end if;

  if to_regclass('cron.job') is not null then
    select command into v_daily_command
    from cron.job
    where jobname = 'daily-resident-reminder'
    order by jobid desc
    limit 1;

    select command into v_monthly_command
    from cron.job
    where jobname = 'monthly-admin-summary'
    order by jobid desc
    limit 1;

    if coalesce(v_daily_command, '') not like '%invoke_internal_edge_function(''run-scheduled-reminders'')%' then
      raise exception 'daily Telegram cron must invoke the scheduled reminder Edge Function, got %', v_daily_command;
    end if;

    if coalesce(v_monthly_command, '') not like '%invoke_internal_edge_function(''run-monthly-summary'')%' then
      raise exception 'monthly Telegram cron must invoke the monthly summary Edge Function, got %', v_monthly_command;
    end if;
  end if;
end;
$$;
