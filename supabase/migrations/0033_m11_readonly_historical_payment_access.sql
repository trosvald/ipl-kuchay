create or replace function public.can_submit_payment_for_invoice(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invoices i
    join public.billing_periods bp on bp.id = i.billing_period_id
    join public.kavling_residents kr on kr.kavling_id = i.kavling_id
    where i.id = target_invoice_id
      and bp.status in ('open', 'closed', 'archived')
      and i.status in ('unpaid', 'overdue', 'rejected', 'partial')
      and kr.profile_id = auth.uid()
      and kr.active = true
  );
$$;

drop policy if exists "payment_submissions_insert_own_accessible_invoice" on public.payment_submissions;

create policy "payment_submissions_insert_own_accessible_invoice"
on public.payment_submissions for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'submitted'
  and amount_submitted > 0
  and proof_path is null
  and public.can_submit_payment_for_invoice(invoice_id)
);

create or replace function public.can_access_receipt_report(target_report_id uuid)
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
      from public.reports r
      where r.id = target_report_id
        and r.report_type = 'receipt'
        and case
          when (r.metadata->>'invoice_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.can_access_invoice_history((r.metadata->>'invoice_id')::uuid)
          else false
        end
    );
$$;

drop policy if exists "reports_select_own_receipt_or_admin" on public.reports;

create policy "reports_select_own_receipt_or_admin"
on public.reports for select
to authenticated
using (public.can_access_receipt_report(id));
