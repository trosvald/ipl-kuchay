drop policy if exists "payment_submissions_insert_own_accessible_invoice" on public.payment_submissions;

create policy "payment_submissions_insert_own_accessible_invoice"
on public.payment_submissions for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'submitted'
  and amount_submitted > 0
  and proof_path is null
  and exists (
    select 1
    from public.invoices i
    join public.billing_periods bp on bp.id = i.billing_period_id
    where i.id = payment_submissions.invoice_id
      and public.can_access_invoice_history(i.id)
      and bp.status in ('open', 'closed', 'archived')
      and i.status in ('unpaid', 'overdue', 'rejected', 'partial')
  )
);
