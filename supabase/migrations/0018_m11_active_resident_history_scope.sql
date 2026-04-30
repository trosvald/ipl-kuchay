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
        and (kr.active = true or kr.ended_at is not null)
        and (kr.ended_at is null or i.due_date <= kr.ended_at)
    );
$$;
