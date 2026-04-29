alter table public.fee_types
add column if not exists billing_cycle text not null default 'monthly',
add column if not exists charge_month integer;

alter table public.fee_types
  drop constraint if exists fee_types_billing_cycle_check;

alter table public.fee_types
  add constraint fee_types_billing_cycle_check
  check (billing_cycle in ('monthly', 'yearly'));

alter table public.fee_types
  drop constraint if exists fee_types_charge_month_check;

alter table public.fee_types
  add constraint fee_types_charge_month_check
  check (charge_month is null or (charge_month between 1 and 12));

alter table public.fee_types
  drop constraint if exists fee_types_recurring_cycle_check;

alter table public.fee_types
  add constraint fee_types_recurring_cycle_check
  check (
    (is_recurring = false and billing_cycle = 'monthly' and charge_month is null)
    or (is_recurring = true and billing_cycle = 'monthly' and charge_month is null)
    or (is_recurring = true and billing_cycle = 'yearly' and charge_month between 1 and 12)
  );

update public.fee_types
set billing_cycle = 'monthly',
    charge_month = null
where billing_cycle is distinct from 'monthly'
   or charge_month is not null;

create or replace function public.generate_invoices_for_period(target_period_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.billing_periods%rowtype;
  created_count integer := 0;
  kavling_row record;
  fee_row record;
  new_invoice_id uuid;
  resolved_amount integer;
begin
  if not public.is_admin_like() then
    raise exception 'not authorized';
  end if;

  select * into period_row
  from public.billing_periods
  where id = target_period_id;

  if not found then
    raise exception 'billing period not found';
  end if;

  if period_row.status not in ('draft', 'open') then
    raise exception 'billing period must be draft/open';
  end if;

  for kavling_row in
    select *
    from public.kavlings
    where active = true
    order by sort_order, code
  loop
    new_invoice_id := null;

    insert into public.invoices (
      billing_period_id,
      kavling_id,
      invoice_number,
      amount_due,
      due_date,
      status
    )
    values (
      period_row.id,
      kavling_row.id,
      public.generate_invoice_number(period_row.year, period_row.month, kavling_row.code),
      0,
      period_row.due_date,
      'unpaid'
    )
    on conflict (billing_period_id, kavling_id) do nothing
    returning id into new_invoice_id;

    if new_invoice_id is not null then
      created_count := created_count + 1;

      for fee_row in
        select *
        from public.fee_types
        where active = true
          and is_recurring = true
          and is_penalty = false
          and (
            billing_cycle = 'monthly'
            or (billing_cycle = 'yearly' and charge_month = period_row.month)
          )
        order by sort_order, code
      loop
        select coalesce((
          select kfo.amount
          from public.kavling_fee_overrides kfo
          where kfo.kavling_id = kavling_row.id
            and kfo.fee_type_id = fee_row.id
            and (kfo.active_from is null or kfo.active_from <= make_date(period_row.year, period_row.month, 1))
            and (kfo.active_until is null or kfo.active_until >= make_date(period_row.year, period_row.month, 1))
          order by kfo.active_from desc nulls last
          limit 1
        ), fee_row.default_amount)
        into resolved_amount;

        insert into public.invoice_items (invoice_id, fee_type_id, description, amount, sort_order)
        values (new_invoice_id, fee_row.id, fee_row.name, resolved_amount, fee_row.sort_order);
      end loop;

      update public.invoices inv
      set amount_due = coalesce((
        select sum(ii.amount)
        from public.invoice_items ii
        where ii.invoice_id = new_invoice_id
      ), 0)
      where inv.id = new_invoice_id;
    end if;
  end loop;

  update public.billing_periods bp
  set status = 'open',
      opened_at = coalesce(bp.opened_at, now())
  where bp.id = target_period_id;

  return created_count;
end;
$$;
