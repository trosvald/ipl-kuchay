alter table public.invoice_penalties
  add column if not exists cycle_key text;

update public.invoice_penalties
set cycle_key = coalesce(cycle_key, to_char(applied_at, 'YYYY-MM'))
where cycle_key is null;

alter table public.invoice_penalties
  alter column cycle_key set not null;

alter table public.invoice_penalties
  drop constraint if exists invoice_penalties_invoice_id_penalty_rule_id_key;

alter table public.invoice_penalties
  add constraint invoice_penalties_invoice_id_penalty_rule_id_cycle_key_key
  unique (invoice_id, penalty_rule_id, cycle_key);

create or replace function public.can_access_invoice_history(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_finance_role()
    or exists (
      select 1
      from public.invoices i
      join public.billing_periods bp on bp.id = i.billing_period_id
      join public.kavling_residents kr on kr.kavling_id = i.kavling_id
      where i.id = target_invoice_id
        and bp.status in ('open', 'closed', 'archived')
        and kr.profile_id = auth.uid()
        and i.due_date >= kr.started_at
        and (kr.active = true or kr.ended_at is not null)
        and (kr.ended_at is null or i.due_date <= kr.ended_at)
    );
$$;

drop policy if exists "billing_periods_select_open_closed_or_admin" on public.billing_periods;
create policy "billing_periods_select_open_closed_or_admin"
on public.billing_periods for select
to authenticated
using (status in ('open', 'closed', 'archived') or public.has_finance_role());

create or replace function public.preview_invoices_for_period(target_period_id uuid)
returns table (
  kavling_id uuid,
  kavling_code text,
  fee_type_id uuid,
  fee_code text,
  fee_name text,
  default_amount integer,
  resolved_amount integer,
  amount_source text,
  period_total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.billing_periods%rowtype;
begin
  if not public.has_finance_role() then
    raise exception 'not authorized';
  end if;

  select * into period_row
  from public.billing_periods
  where id = target_period_id;

  if not found then
    raise exception 'billing period not found';
  end if;

  return query
  with period_base as (
    select make_date(period_row.year, period_row.month, 1) as period_start
  )
  select
    k.id as kavling_id,
    k.code as kavling_code,
    ft.id as fee_type_id,
    ft.code as fee_code,
    ft.name as fee_name,
    ft.default_amount,
    coalesce(kfo.amount, ft.default_amount) as resolved_amount,
    case when kfo.id is null then 'default' else 'override' end as amount_source,
    sum(coalesce(kfo.amount, ft.default_amount)) over (partition by k.id) as period_total
  from public.kavlings k
  cross join period_base pb
  join public.fee_types ft
    on ft.active = true
   and ft.is_recurring = true
   and ft.is_penalty = false
   and (
     ft.billing_cycle = 'monthly'
     or (ft.billing_cycle = 'yearly' and ft.charge_month = period_row.month)
   )
  left join lateral (
    select kfo_pick.id, kfo_pick.amount
    from public.kavling_fee_overrides kfo_pick
    where kfo_pick.kavling_id = k.id
      and kfo_pick.fee_type_id = ft.id
      and (kfo_pick.active_from is null or kfo_pick.active_from <= pb.period_start)
      and (kfo_pick.active_until is null or kfo_pick.active_until >= pb.period_start)
    order by kfo_pick.active_from desc nulls last
    limit 1
  ) kfo on true
  where k.active = true
  order by k.sort_order, k.code, ft.sort_order, ft.code;
end;
$$;

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
  if not public.has_finance_role() then
    raise exception 'not authorized';
  end if;

  select * into period_row
  from public.billing_periods
  where id = target_period_id;

  if not found then
    raise exception 'billing period not found';
  end if;

  if period_row.status not in ('draft', 'open', 'closed', 'archived') then
    raise exception 'billing period must be valid status';
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

  return created_count;
end;
$$;

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
    ft.default_amount,
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

create or replace function public.apply_penalties_for_period(target_period_id uuid, cycle_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  penalty_row record;
  created_count integer := 0;
begin
  if not public.has_finance_role() then
    raise exception 'not authorized';
  end if;

  if apply_penalties_for_period.cycle_key is null or length(trim(apply_penalties_for_period.cycle_key)) = 0 then
    raise exception 'cycle_key is required';
  end if;

  for penalty_row in
    select *
    from public.preview_penalties_for_period(target_period_id, apply_penalties_for_period.cycle_key)
  loop
    insert into public.invoice_penalties (invoice_id, penalty_rule_id, amount, cycle_key)
    values (penalty_row.invoice_id, penalty_row.penalty_rule_id, penalty_row.penalty_amount, apply_penalties_for_period.cycle_key)
    on conflict on constraint invoice_penalties_invoice_id_penalty_rule_id_cycle_key_key do nothing;

    if found then
      insert into public.invoice_items (invoice_id, fee_type_id, description, amount, sort_order)
      values (
        penalty_row.invoice_id,
        penalty_row.fee_type_id,
        penalty_row.fee_name || ' (' || apply_penalties_for_period.cycle_key || ')',
        penalty_row.penalty_amount,
        999
      );

      update public.invoices
      set amount_due = amount_due + penalty_row.penalty_amount
      where id = penalty_row.invoice_id;

      created_count := created_count + 1;
    end if;
  end loop;

  return created_count;
end;
$$;
