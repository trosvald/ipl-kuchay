-- Dev seed: billing periods and penalty rules for UAT
-- Auth users, profiles, kavling mappings, invoices are created via scripts/seed-users.mjs

do $$
begin
  -- =====================================================================
  -- 1. Penalty rules
  -- =====================================================================
  insert into public.penalty_rules (name, fee_type_id, days_after_due, fixed_amount, active)
  select
    'Denda 7 hari setelah jatuh tempo',
    id,
    7,
    50000,
    true
  from public.fee_types
  where code = 'PENALTY'
    and not exists (select 1 from public.penalty_rules pr where pr.fee_type_id = (select id from public.fee_types where code = 'PENALTY'));

  -- =====================================================================
  -- 2. Billing periods
  -- =====================================================================
  insert into public.billing_periods (year, month, label, due_date, status)
  values (2026, 6, 'IPL Juni 2026', '2026-06-15', 'draft')
  on conflict (year, month) do nothing;

  insert into public.billing_periods (year, month, label, due_date, status, opened_at)
  values (2026, 1, 'IPL Januari 2026', '2026-01-15', 'open', now())
  on conflict (year, month) do nothing;

  insert into public.billing_periods (year, month, label, due_date, status, opened_at, closed_at)
  values (2025, 12, 'IPL Desember 2025', '2025-12-15', 'closed', now() - interval '5 months', now() - interval '4 months')
  on conflict (year, month) do nothing;

  insert into public.billing_periods (year, month, label, due_date, status, opened_at, closed_at)
  values (2025, 6, 'IPL Juni 2025', '2025-06-15', 'archived', now() - interval '11 months', now() - interval '10 months')
  on conflict (year, month) do nothing;
end;
$$;
