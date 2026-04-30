-- Fix: penalty preview RPC returned ft.default_amount (0) instead of pr.fixed_amount (actual penalty)
create or replace function public.preview_penalties_for_period(target_period_id uuid, cycle_key text)
returns table (
  invoice_id uuid,
  kavling_id uuid,
  kavling_code text,
  penalty_rule_id uuid,
  fee_type_id uuid,
  fee_name text,
  penalty_amount integer,
  penalty_cycle_key text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_finance_role() then
    raise exception 'not authorized';
  end if;

  if preview_penalties_for_period.cycle_key is null or length(trim(preview_penalties_for_period.cycle_key)) = 0 then
    raise exception 'cycle_key is required';
  end if;

  return query
  select
    i.id,
    i.kavling_id,
    k.code,
    pr.id,
    ft.id,
    ft.name,
    pr.fixed_amount,
    preview_penalties_for_period.cycle_key
  from public.invoices i
  join public.kavlings k on k.id = i.kavling_id
  join public.penalty_rules pr on pr.active = true
  join public.fee_types ft on ft.id = pr.fee_type_id and ft.active = true and ft.is_penalty = true
  where i.billing_period_id = target_period_id
    and i.status in ('unpaid', 'overdue', 'partial')
    and i.due_date < current_date
    and not exists (
      select 1
      from public.invoice_penalties ip
      where ip.invoice_id = i.id
        and ip.penalty_rule_id = pr.id
        and ip.cycle_key = preview_penalties_for_period.cycle_key
    )
  order by k.sort_order, k.code;
end;
$$;
