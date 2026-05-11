do $$
declare
  v_resident uuid := '87000000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '87000000-0000-0000-0000-000000000002'::uuid;
  v_config jsonb;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_resident, 'authenticated', 'authenticated', 'resident-m08-qris-flag@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_admin, 'authenticated', 'authenticated', 'admin-m08-qris-flag@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_resident, 'M08 QRIS Flag Resident', 'resident', true),
    (v_admin, 'M08 QRIS Flag Admin', 'admin', true)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active;

  delete from public.app_settings where key = 'payment_gateway';

  perform set_config('request.jwt.claim.sub', v_resident::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select public.get_resident_payment_gateway_config() into v_config;
  if v_config <> jsonb_build_object('qris_enabled', false) then
    raise exception 'resident-safe QRIS config must default to disabled, got %', v_config;
  end if;

  insert into public.app_settings (key, value, description, updated_by)
  values (
    'payment_gateway',
    jsonb_build_object('enabled', true, 'provider_secret', 'must-not-leak'),
    'Test QRIS flag',
    v_admin
  );

  select public.get_resident_payment_gateway_config() into v_config;
  if v_config <> jsonb_build_object('qris_enabled', true) then
    raise exception 'resident-safe QRIS config must expose only enabled state, got %', v_config;
  end if;

  if v_config ? 'provider_secret' then
    raise exception 'resident-safe QRIS config must not expose raw app_settings values';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname <> 'app_settings_admin_manage'
  ) then
    raise exception 'app_settings must not gain broad resident-readable policies';
  end if;
end;
$$;
