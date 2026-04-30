do $$
declare
  v_admin uuid := '21111111-1111-1111-1111-111111111111'::uuid;
  v_resident uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_period_draft uuid;
  v_period_open uuid;
  v_period_closed uuid;
  v_period_archived uuid;
  v_kavling_a uuid;
  v_kavling_b uuid;
  v_kavling_inactive uuid;
  v_fee_ipl uuid;
  v_fee_keamanan uuid;
  v_fee_penalty uuid;
  v_penalty_rule uuid;
  v_preview_row_count integer;
  v_preview_override_rows integer;
  v_preview_default_rows integer;
  v_created_first integer;
  v_created_second integer;
  v_invoice_count_before integer;
  v_invoice_count_after integer;
  v_resident_visible_draft integer;
  v_resident_visible_open integer;
  v_resident_visible_closed integer;
  v_resident_visible_archived integer;
  v_penalty_preview_count integer;
  v_penalty_apply_first integer;
  v_penalty_apply_second integer;
  v_penalty_rows integer;
  v_penalty_item_rows integer;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (v_admin, 'authenticated', 'authenticated', 'admin-m02@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_resident, 'authenticated', 'authenticated', 'resident-m02@example.com', now(), now(), '{}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, is_active)
  values
    (v_admin, 'M02 Admin', 'admin', true),
    (v_resident, 'M02 Resident', 'resident', true)
  on conflict (id) do update
  set role = excluded.role,
      is_active = excluded.is_active;

  insert into public.kavlings (id, code, block, sort_order, active)
  values
    ('30111111-1111-1111-1111-111111111111'::uuid, 'B-01', 'B', 1, true),
    ('30222222-2222-2222-2222-222222222222'::uuid, 'B-02', 'B', 2, true),
    ('30333333-3333-3333-3333-333333333333'::uuid, 'B-03', 'B', 3, false)
  on conflict (id) do update
  set code = excluded.code,
      block = excluded.block,
      sort_order = excluded.sort_order,
      active = excluded.active;

  v_kavling_a := '30111111-1111-1111-1111-111111111111'::uuid;
  v_kavling_b := '30222222-2222-2222-2222-222222222222'::uuid;
  v_kavling_inactive := '30333333-3333-3333-3333-333333333333'::uuid;

  insert into public.kavling_residents (kavling_id, profile_id, relation, is_primary, active)
  values (v_kavling_a, v_resident, 'owner', true, true)
  on conflict (kavling_id, profile_id) do update
  set is_primary = excluded.is_primary,
      active = excluded.active;

  insert into public.fee_types (id, code, name, default_amount, is_recurring, is_penalty, active, sort_order, billing_cycle, charge_month)
  values
    ('40111111-1111-1111-1111-111111111111'::uuid, 'IPL_BULANAN', 'IPL Bulanan', 100000, true, false, true, 1, 'monthly', null),
    ('40222222-2222-2222-2222-222222222222'::uuid, 'KEAMANAN', 'Keamanan', 50000, true, false, true, 2, 'monthly', null),
    ('40333333-3333-3333-3333-333333333333'::uuid, 'DENDA_TELAT', 'Denda Telat', 25000, true, true, true, 90, 'monthly', null)
  on conflict (id) do update
  set code = excluded.code,
      name = excluded.name,
      default_amount = excluded.default_amount,
      is_recurring = excluded.is_recurring,
      is_penalty = excluded.is_penalty,
      active = excluded.active,
      sort_order = excluded.sort_order,
      billing_cycle = excluded.billing_cycle,
      charge_month = excluded.charge_month;

  v_fee_ipl := '40111111-1111-1111-1111-111111111111'::uuid;
  v_fee_keamanan := '40222222-2222-2222-2222-222222222222'::uuid;
  v_fee_penalty := '40333333-3333-3333-3333-333333333333'::uuid;

  insert into public.kavling_fee_overrides (kavling_id, fee_type_id, amount, active_from, active_until, notes)
  values (v_kavling_a, v_fee_ipl, 120000, date '2026-07-01', date '2026-07-31', 'promo berakhir juli')
  on conflict (kavling_id, fee_type_id, active_from) do update
  set amount = excluded.amount,
      active_until = excluded.active_until,
      notes = excluded.notes;

  insert into public.penalty_rules (id, name, fee_type_id, days_after_due, fixed_amount, percent_amount, max_amount, active)
  values ('50111111-1111-1111-1111-111111111111'::uuid, 'Flat Denda Bulanan', v_fee_penalty, 0, 25000, 0, null, true)
  on conflict (id) do update
  set name = excluded.name,
      fee_type_id = excluded.fee_type_id,
      days_after_due = excluded.days_after_due,
      fixed_amount = excluded.fixed_amount,
      percent_amount = excluded.percent_amount,
      max_amount = excluded.max_amount,
      active = excluded.active;

  v_penalty_rule := '50111111-1111-1111-1111-111111111111'::uuid;

  insert into public.billing_periods (year, month, label, due_date, status)
  values
    (2026, 7, 'Juli 2026 Draft', date '2026-07-10', 'draft'),
    (2026, 8, 'Agustus 2026 Open', date '2026-08-10', 'open'),
    (2026, 9, 'September 2026 Closed', date '2026-09-10', 'closed'),
    (2026, 10, 'Oktober 2026 Archived', date '2026-10-10', 'archived')
  on conflict (year, month) do update
  set label = excluded.label,
      due_date = excluded.due_date,
      status = excluded.status;

  select id into v_period_draft from public.billing_periods where year = 2026 and month = 7;
  select id into v_period_open from public.billing_periods where year = 2026 and month = 8;
  select id into v_period_closed from public.billing_periods where year = 2026 and month = 9;
  select id into v_period_archived from public.billing_periods where year = 2026 and month = 10;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Test 1: Preview contract exposes resolved/default source and totals before insertion.
  select count(*)
  into v_preview_row_count
  from public.preview_invoices_for_period(v_period_draft);

  if v_preview_row_count <= 0 then
    raise exception 'preview_invoices_for_period returned no rows';
  end if;

  select count(*)
  into v_preview_override_rows
  from public.preview_invoices_for_period(v_period_draft) p
  where p.kavling_code = 'B-01'
    and p.fee_name = 'IPL Bulanan'
    and p.default_amount = 100000
    and p.resolved_amount = 120000
    and p.amount_source = 'override';

  if v_preview_override_rows <> 1 then
    raise exception 'preview override row assertion failed (expected 1 got %)', v_preview_override_rows;
  end if;

  select count(*)
  into v_preview_default_rows
  from public.preview_invoices_for_period(v_period_draft) p
  where p.kavling_code = 'B-02'
    and p.fee_name = 'IPL Bulanan'
    and p.default_amount = 100000
    and p.resolved_amount = 100000
    and p.amount_source = 'default';

  if v_preview_default_rows <> 1 then
    raise exception 'preview default row assertion failed (expected 1 got %)', v_preview_default_rows;
  end if;

  -- Test 2: generation is additive/idempotent and skips inactive kavlings.
  select count(*) into v_invoice_count_before from public.invoices where billing_period_id = v_period_draft;
  select public.generate_invoices_for_period(v_period_draft) into v_created_first;
  select count(*) into v_invoice_count_after from public.invoices where billing_period_id = v_period_draft;

  if v_created_first <> 2 then
    raise exception 'expected first generation to create 2 invoices for active kavlings, got %', v_created_first;
  end if;

  if (v_invoice_count_after - v_invoice_count_before) <> 2 then
    raise exception 'invoice count delta mismatch after first generation';
  end if;

  if exists (
    select 1
    from public.invoices i
    where i.billing_period_id = v_period_draft
      and i.kavling_id = v_kavling_inactive
  ) then
    raise exception 'inactive kavling should not receive an invoice';
  end if;

  select public.generate_invoices_for_period(v_period_draft) into v_created_second;
  if v_created_second <> 0 then
    raise exception 'second generation must be idempotent and create 0 invoices, got %', v_created_second;
  end if;

  -- Prepare open/closed/archived invoices for resident visibility checks.
  perform public.generate_invoices_for_period(v_period_open);
  perform public.generate_invoices_for_period(v_period_closed);
  perform public.generate_invoices_for_period(v_period_archived);

  -- Test 3: resident visibility by billing lifecycle.
  perform set_config('request.jwt.claim.sub', v_resident::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*)
  into v_resident_visible_draft
  from public.invoices i
  join public.billing_periods bp on bp.id = i.billing_period_id
  where i.kavling_id = v_kavling_a
    and bp.id = v_period_draft;

  select count(*)
  into v_resident_visible_open
  from public.invoices i
  join public.billing_periods bp on bp.id = i.billing_period_id
  where i.kavling_id = v_kavling_a
    and bp.id = v_period_open;

  select count(*)
  into v_resident_visible_closed
  from public.invoices i
  join public.billing_periods bp on bp.id = i.billing_period_id
  where i.kavling_id = v_kavling_a
    and bp.id = v_period_closed;

  select count(*)
  into v_resident_visible_archived
  from public.invoices i
  join public.billing_periods bp on bp.id = i.billing_period_id
  where i.kavling_id = v_kavling_a
    and bp.id = v_period_archived;

  if v_resident_visible_draft <> 0 then
    raise exception 'resident should not see draft period invoices';
  end if;

  if v_resident_visible_open <= 0 or v_resident_visible_closed <= 0 or v_resident_visible_archived <= 0 then
    raise exception 'resident must see open, closed, and archived period invoices';
  end if;

  -- Test 4: penalty preview/apply supports cycle idempotency.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.invoices
  set due_date = current_date - interval '90 day'
  where billing_period_id = v_period_open;

  select count(*)
  into v_penalty_preview_count
  from public.preview_penalties_for_period(v_period_open, '2026-07');

  if v_penalty_preview_count <= 0 then
    raise exception 'penalty preview should include overdue invoices for cycle 2026-07';
  end if;

  select public.apply_penalties_for_period(v_period_open, '2026-07') into v_penalty_apply_first;
  if v_penalty_apply_first <= 0 then
    raise exception 'first penalty apply should create penalty rows/items';
  end if;

  select public.apply_penalties_for_period(v_period_open, '2026-07') into v_penalty_apply_second;
  if v_penalty_apply_second <> 0 then
    raise exception 'second penalty apply for same cycle must be idempotent, got %', v_penalty_apply_second;
  end if;

  select count(*)
  into v_penalty_rows
  from public.invoice_penalties ip
  join public.invoices i on i.id = ip.invoice_id
  where i.billing_period_id = v_period_open
    and ip.penalty_rule_id = v_penalty_rule;

  if v_penalty_rows <= 0 then
    raise exception 'expected penalty rows after apply_penalties_for_period';
  end if;

  select count(*)
  into v_penalty_item_rows
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id
  where i.billing_period_id = v_period_open
    and ii.fee_type_id = v_fee_penalty
    and ii.description ilike '%2026-07%';

  if v_penalty_item_rows <> v_penalty_rows then
    raise exception 'each penalty row should create exactly one penalty invoice item for cycle 2026-07';
  end if;
end;
$$;
