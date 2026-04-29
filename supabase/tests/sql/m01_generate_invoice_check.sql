do $$
declare
  v_admin uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_period uuid;
  v_created integer;
  v_mismatch_count integer;
  v_item_count integer;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (v_admin, 'authenticated', 'authenticated', 'admin-m01@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values (v_admin, 'M01 Admin', 'admin', true)
  on conflict (id) do update
  set role = excluded.role,
      is_active = excluded.is_active;

  insert into public.billing_periods (year, month, label, due_date, status)
  values (2026, 7, 'July 2026', current_date + interval '10 day', 'draft')
  on conflict (year, month) do update
  set label = excluded.label,
      status = 'draft'
  returning id into v_period;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select public.generate_invoices_for_period(v_period) into v_created;

  if v_created <= 0 then
    raise exception 'generate_invoices_for_period created no invoices';
  end if;

  select count(*)
  into v_item_count
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id
  where i.billing_period_id = v_period;

  if v_item_count <= 0 then
    raise exception 'no invoice_items generated for period';
  end if;

  select count(*)
  into v_mismatch_count
  from public.invoices i
  where i.billing_period_id = v_period
    and i.amount_due <> coalesce((
      select sum(ii.amount)
      from public.invoice_items ii
      where ii.invoice_id = i.id
    ), 0);

  if v_mismatch_count > 0 then
    raise exception 'amount_due mismatch found in generated invoices';
  end if;
end;
$$;
