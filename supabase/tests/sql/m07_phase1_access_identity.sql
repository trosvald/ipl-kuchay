do $$
declare
  v_super_admin uuid := '81000000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '81000000-0000-0000-0000-000000000002'::uuid;
  v_treasurer uuid := '81000000-0000-0000-0000-000000000003'::uuid;
  v_resident_old uuid := '81000000-0000-0000-0000-000000000004'::uuid;
  v_resident_new uuid := '81000000-0000-0000-0000-000000000005'::uuid;
  v_kav uuid;
  v_period_old uuid;
  v_period_new uuid;
  v_invoice_old uuid;
  v_invoice_new uuid;
  v_blocked boolean;
begin
  if to_regclass('public.notification_preferences') is null then
    raise exception 'notification_preferences table is required';
  end if;

  if not exists (
    select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'has_finance_role'
  ) then
    raise exception 'public.has_finance_role() is required';
  end if;

  if not exists (
    select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'has_operator_role'
  ) then
    raise exception 'public.has_operator_role() is required';
  end if;

  if not exists (
    select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'can_view_finance_audit_log'
  ) then
    raise exception 'public.can_view_finance_audit_log(text,text) is required';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kavling_residents'
      and column_name = 'ended_at'
  ) then
    raise exception 'kavling_residents.ended_at is required';
  end if;

  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_super_admin, 'authenticated', 'authenticated', 'sa-m07@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_admin, 'authenticated', 'authenticated', 'admin-m07@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_treasurer, 'authenticated', 'authenticated', 'treasurer-m07@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_old, 'authenticated', 'authenticated', 'old-resident-m07@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident_new, 'authenticated', 'authenticated', 'new-resident-m07@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_super_admin, 'M07 Super Admin', 'super_admin', true),
    (v_admin, 'M07 Admin', 'admin', true),
    (v_treasurer, 'M07 Treasurer', 'treasurer', true),
    (v_resident_old, 'M07 Old Resident', 'resident', true),
    (v_resident_new, 'M07 New Resident', 'resident', true)
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
  values (2026, 9, 'Sep 2026', date '2026-09-15', 'open')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status
  returning id into v_period_old;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2026, 10, 'Oct 2026', date '2026-10-15', 'open')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status
  returning id into v_period_new;

  insert into public.kavling_residents (
    kavling_id,
    profile_id,
    relation,
    relation_type,
    relation_label,
    is_primary,
    active,
    started_at,
    ended_at
  ) values (
    v_kav,
    v_resident_old,
    'owner',
    'owner',
    null,
    true,
    false,
    date '2025-01-01',
    date '2026-09-30'
  ) on conflict (kavling_id, profile_id) do update
  set relation = excluded.relation,
      relation_type = excluded.relation_type,
      relation_label = excluded.relation_label,
      is_primary = excluded.is_primary,
      active = excluded.active,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at;

  begin
    insert into public.kavling_residents (
      kavling_id,
      profile_id,
      relation,
      relation_type,
      is_primary,
      active,
      started_at,
      ended_at
    ) values (
      v_kav,
      v_resident_new,
      'tenant',
      'tenant',
      true,
      true,
      date '2026-09-15',
      null
    );
    raise exception 'primary replacement must require explicit deactivation path';
  exception
    when others then
      if position('kavling_residents_one_active_primary' in lower(sqlerrm)) = 0
         and position('duplicate key value violates unique constraint' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;

  update public.kavling_residents
  set is_primary = false,
      ended_at = date '2026-09-14'
  where kavling_id = v_kav
    and profile_id = v_resident_old;

  insert into public.kavling_residents (
    kavling_id,
    profile_id,
    relation,
    relation_type,
    relation_label,
    is_primary,
    active,
    started_at,
    ended_at
  ) values (
    v_kav,
    v_resident_new,
    'tenant',
    'tenant',
    null,
    true,
    true,
    date '2026-09-15',
    null
  ) on conflict (kavling_id, profile_id) do update
  set relation = excluded.relation,
      relation_type = excluded.relation_type,
      relation_label = excluded.relation_label,
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
    v_period_old,
    v_kav,
    'IPL-M07-OLD',
    150000,
    0,
    date '2026-09-10',
    'unpaid'
  ) on conflict (billing_period_id, kavling_id) do update
  set due_date = excluded.due_date,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid',
      invoice_number = excluded.invoice_number
  returning id into v_invoice_old;

  insert into public.invoices (
    billing_period_id,
    kavling_id,
    invoice_number,
    amount_due,
    amount_paid,
    due_date,
    status
  ) values (
    v_period_new,
    v_kav,
    'IPL-M07-NEW',
    175000,
    0,
    date '2026-10-10',
    'unpaid'
  ) on conflict (billing_period_id, kavling_id) do update
  set due_date = excluded.due_date,
      amount_due = excluded.amount_due,
      amount_paid = 0,
      status = 'unpaid',
      invoice_number = excluded.invoice_number
  returning id into v_invoice_new;

  perform set_config('request.jwt.claim.sub', v_resident_old::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not exists (select 1 from public.invoices where id = v_invoice_old) then
    raise exception 'former resident must keep access to historical invoice in ended_at window';
  end if;

  if exists (select 1 from public.invoices where id = v_invoice_new) then
    raise exception 'former resident must not access future invoice outside ended_at window';
  end if;

  perform set_config('request.jwt.claim.sub', v_treasurer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not public.has_finance_role() then
    raise exception 'treasurer must satisfy has_finance_role()';
  end if;

  if public.has_operator_role() then
    raise exception 'treasurer must not satisfy has_operator_role()';
  end if;

  if not public.can_view_finance_audit_log('payment_submission.verify', 'payment_submissions') then
    raise exception 'treasurer should read finance audit slice';
  end if;

  v_blocked := false;
  begin
    update public.kavlings set notes = 'treasurer-blocked' where id = v_kav;
  exception
    when others then
      v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'treasurer must be blocked from kavlings update';
  end if;

  v_blocked := false;
  begin
    update public.profiles set display_name = 'treasurer-blocked' where id = v_resident_old;
  exception
    when others then
      v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'treasurer must be blocked from profiles update';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  update public.kavlings set notes = 'admin-allowed' where id = v_kav;

  perform set_config('request.jwt.claim.sub', v_super_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  update public.profiles set display_name = 'super-admin-allowed' where id = v_resident_old;

  perform set_config('request.jwt.claim.sub', v_resident_old::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.notification_preferences (profile_id, category, in_app_enabled, telegram_enabled)
  values (v_resident_old, 'billing_reminders', true, false)
  on conflict (profile_id, category) do update
  set in_app_enabled = excluded.in_app_enabled,
      telegram_enabled = excluded.telegram_enabled;

  update public.notification_preferences
  set in_app_enabled = false,
      telegram_enabled = true
  where profile_id = v_resident_old
    and category = 'billing_reminders';

  if not exists (
    select 1
    from public.notification_preferences
    where profile_id = v_resident_old
      and category = 'billing_reminders'
      and in_app_enabled = false
      and telegram_enabled = true
  ) then
    raise exception 'notification_preferences must persist independent in_app_enabled and telegram_enabled flags';
  end if;
end;
$$;
