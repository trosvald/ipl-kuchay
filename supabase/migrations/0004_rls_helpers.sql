create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true;
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = any(roles)
  );
$$;

create or replace function public.is_admin_like()
returns boolean
language sql
stable
as $$
  select public.has_role(array['treasurer'::public.app_role, 'admin'::public.app_role, 'super_admin'::public.app_role]);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.has_role(array['super_admin'::public.app_role]);
$$;

create or replace function public.can_access_kavling(target_kavling_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_like()
    or exists (
      select 1
      from public.kavling_residents kr
      where kr.kavling_id = target_kavling_id
        and kr.profile_id = auth.uid()
        and kr.active = true
    );
$$;

create or replace function public.generate_invoice_number(period_year integer, period_month integer, kavling_code text)
returns text
language sql
immutable
as $$
  select
    'IPL-'
    || period_year::text
    || '-'
    || lpad(period_month::text, 2, '0')
    || '-'
    || regexp_replace(upper(kavling_code), '[^A-Z0-9]+', '', 'g');
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

create or replace function public.recalculate_invoice_status(target_invoice_id uuid)
returns public.invoice_status
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  total_paid integer;
  pending_count integer;
  new_status public.invoice_status;
begin
  select *
  into invoice_row
  from public.invoices
  where id = target_invoice_id;

  if not found then
    raise exception 'invoice not found';
  end if;

  if invoice_row.status in ('waived', 'cancelled') then
    return invoice_row.status;
  end if;

  select coalesce(sum(amount), 0)
  into total_paid
  from public.payments
  where invoice_id = target_invoice_id;

  select count(*)
  into pending_count
  from public.payment_submissions
  where invoice_id = target_invoice_id
    and status = 'submitted';

  if total_paid >= invoice_row.amount_due then
    new_status := 'paid';
  elsif total_paid > 0 then
    new_status := 'partial';
  elsif pending_count > 0 then
    new_status := 'pending_verification';
  elsif invoice_row.due_date < current_date then
    new_status := 'overdue';
  else
    new_status := 'unpaid';
  end if;

  update public.invoices
  set status = new_status,
      amount_paid = total_paid,
      paid_at = case when new_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where id = target_invoice_id;

  return new_status;
end;
$$;

create or replace function public.verify_payment_submission(target_submission_id uuid, admin_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.payment_submissions%rowtype;
  payment_id uuid;
begin
  if not public.is_admin_like() then
    raise exception 'not authorized';
  end if;

  select *
  into submission_row
  from public.payment_submissions
  where id = target_submission_id
  for update;

  if not found then
    raise exception 'submission not found';
  end if;

  if submission_row.status <> 'submitted' then
    raise exception 'submission is not submitted';
  end if;

  update public.payment_submissions
  set status = 'verified',
      verified_by = auth.uid(),
      verified_at = now(),
      note = coalesce(note, '') || case when admin_note is not null then E'\nAdmin: ' || admin_note else '' end
  where id = target_submission_id;

  insert into public.payments (
    invoice_id,
    payment_submission_id,
    amount,
    method,
    paid_at,
    verified_by,
    notes
  )
  values (
    submission_row.invoice_id,
    submission_row.id,
    submission_row.amount_submitted,
    'manual_transfer',
    now(),
    auth.uid(),
    admin_note
  )
  returning id into payment_id;

  perform public.recalculate_invoice_status(submission_row.invoice_id);
  return payment_id;
end;
$$;

create or replace function public.reject_payment_submission(target_submission_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.payment_submissions%rowtype;
begin
  if not public.is_admin_like() then
    raise exception 'not authorized';
  end if;

  if reason is null or length(trim(reason)) < 3 then
    raise exception 'rejection reason is required';
  end if;

  select *
  into submission_row
  from public.payment_submissions
  where id = target_submission_id
  for update;

  if not found then
    raise exception 'submission not found';
  end if;

  if submission_row.status <> 'submitted' then
    raise exception 'submission is not submitted';
  end if;

  update public.payment_submissions
  set status = 'rejected',
      rejection_reason = reason,
      rejected_by = auth.uid(),
      rejected_at = now()
  where id = target_submission_id;

  perform public.recalculate_invoice_status(submission_row.invoice_id);
end;
$$;

create or replace function public.get_public_period_summary()
returns table (
  billing_period_id uuid,
  year integer,
  month integer,
  label text,
  due_date date,
  total_invoices integer,
  paid_count integer,
  unpaid_count integer,
  total_amount_due integer,
  total_amount_paid integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bp.id as billing_period_id,
    bp.year,
    bp.month,
    bp.label,
    bp.due_date,
    count(i.id)::integer as total_invoices,
    count(*) filter (where i.status = 'paid')::integer as paid_count,
    count(*) filter (where i.status in ('unpaid', 'overdue', 'pending_verification', 'partial', 'rejected'))::integer as unpaid_count,
    coalesce(sum(i.amount_due), 0)::integer as total_amount_due,
    coalesce(sum(i.amount_paid), 0)::integer as total_amount_paid
  from public.billing_periods bp
  left join public.invoices i on i.billing_period_id = bp.id
  where bp.status in ('open', 'closed')
  group by bp.id, bp.year, bp.month, bp.label, bp.due_date
  order by bp.year desc, bp.month desc;
$$;

create or replace function public.get_public_kavling_status(target_period_id uuid default null)
returns table (
  billing_period_id uuid,
  year integer,
  month integer,
  kavling_code text,
  public_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bp.id as billing_period_id,
    bp.year,
    bp.month,
    k.code as kavling_code,
    case when i.status = 'paid' then 'paid' else 'not_paid' end as public_status
  from public.billing_periods bp
  join public.invoices i on i.billing_period_id = bp.id
  join public.kavlings k on k.id = i.kavling_id
  where bp.status in ('open', 'closed')
    and k.active = true
    and (target_period_id is null or bp.id = target_period_id)
  order by bp.year desc, bp.month desc, k.sort_order, k.code;
$$;

revoke execute on function public.generate_invoices_for_period(uuid) from public;
revoke execute on function public.recalculate_invoice_status(uuid) from public;
revoke execute on function public.verify_payment_submission(uuid, text) from public;
revoke execute on function public.reject_payment_submission(uuid, text) from public;

grant execute on function public.generate_invoices_for_period(uuid) to authenticated;
grant execute on function public.recalculate_invoice_status(uuid) to authenticated;
grant execute on function public.verify_payment_submission(uuid, text) to authenticated;
grant execute on function public.reject_payment_submission(uuid, text) to authenticated;

revoke execute on function public.get_public_period_summary() from public;
revoke execute on function public.get_public_kavling_status(uuid) from public;
grant execute on function public.get_public_period_summary() to anon, authenticated;
grant execute on function public.get_public_kavling_status(uuid) to anon, authenticated;
