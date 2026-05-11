do $$
declare
  v_admin uuid := '99000000-0000-4000-8000-000000000001'::uuid;
  v_resident uuid := '99000000-0000-4000-8000-000000000002'::uuid;
  v_billing_period uuid;
  v_count integer;
  v_direct_call_blocked boolean := false;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_admin, 'authenticated', 'authenticated', 'audit-admin@example.test', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident, 'authenticated', 'authenticated', 'audit-resident@example.test', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_admin, 'Audit Admin', 'admin', true),
    (v_resident, 'Audit Resident', 'resident', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  if has_function_privilege(
    'authenticated',
    'public.insert_privileged_audit_log(text,text,text,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'authenticated role must not execute insert_privileged_audit_log directly';
  end if;

  if has_function_privilege(
    'anon',
    'public.insert_privileged_audit_log(text,text,text,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'anon role must not execute insert_privileged_audit_log directly';
  end if;

  if has_function_privilege(
    'service_role',
    'public.insert_privileged_audit_log(text,text,text,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'service_role must not execute insert_privileged_audit_log directly';
  end if;

  begin
    perform set_config('request.jwt.claim.sub', v_resident::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.insert_privileged_audit_log(
      'forged.audit',
      'billing_periods',
      'fake-entity',
      null,
      jsonb_build_object('x', 1)
    );
  exception
    when raise_exception then
      if SQLERRM <> 'internal audit helper only' then
        raise;
      end if;
      v_direct_call_blocked := true;
  end;

  if not v_direct_call_blocked then
    raise exception 'direct audit helper call outside trigger context must be blocked';
  end if;

  select count(*) into v_count
  from public.audit_logs
  where action = 'forged.audit'
    and entity_table = 'billing_periods'
    and entity_id = 'fake-entity';

  if v_count <> 0 then
    raise exception 'direct audit helper call must not leave forged rows, got %', v_count;
  end if;

  delete from public.audit_logs
  where actor_id = v_admin
    and entity_table = 'billing_periods'
    and action in ('billing_period.create', 'billing_period.status_open');

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  execute 'set local role authenticated';
  execute 'insert into public.billing_periods (year, month, label, due_date, status, created_by) values (2031, 12, ''Audit Hardened Dec 2031'', date ''2031-12-15'', ''draft'', $1) returning id'
    into v_billing_period
    using v_admin;
  execute 'reset role';

  select count(*) into v_count
  from public.audit_logs
  where actor_id = v_admin
    and actor_role = 'admin'
    and action = 'billing_period.create'
    and entity_table = 'billing_periods'
    and entity_id = v_billing_period::text;

  if v_count <> 1 then
    raise exception 'trigger audit must still write billing_period.create, got %', v_count;
  end if;

  execute 'set local role authenticated';
  execute 'update public.billing_periods set status = ''open'', opened_at = now() where id = $1'
    using v_billing_period;
  execute 'reset role';

  select count(*) into v_count
  from public.audit_logs
  where actor_id = v_admin
    and actor_role = 'admin'
    and action = 'billing_period.status_open'
    and entity_table = 'billing_periods'
    and entity_id = v_billing_period::text;

  if v_count <> 1 then
    raise exception 'trigger audit must still write billing_period.status_open, got %', v_count;
  end if;
end;
$$;
