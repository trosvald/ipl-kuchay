create or replace function public.can_access_payment_proof_submission(target_submission_id uuid)
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
      from public.payment_submissions ps
      join public.invoices i on i.id = ps.invoice_id
      join public.kavling_residents kr on kr.kavling_id = i.kavling_id
      join public.profiles p on p.id = ps.submitted_by
      where ps.id = target_submission_id
        and ps.submitted_by = auth.uid()
        and p.id = auth.uid()
        and p.role = 'resident'
        and p.is_active = true
        and kr.profile_id = auth.uid()
        and kr.active = true
        and kr.ended_at is null
    );
$$;

comment on function public.can_access_payment_proof_submission(uuid)
is 'Payment proof signed URLs are visible only to the active resident who submitted the proof and to active finance roles. Co-residents, former residents, and broader invoice-history viewers must not receive signed proof URLs.';

revoke all on function public.can_access_payment_proof_submission(uuid) from public;
grant execute on function public.can_access_payment_proof_submission(uuid) to authenticated;
