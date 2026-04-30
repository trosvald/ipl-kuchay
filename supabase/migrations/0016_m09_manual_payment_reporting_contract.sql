-- M08: Manual Payment Reporting Contract
-- Hardened RPC and audit contract for payment verification/rejection consistency.
-- Ensures deterministic, auditable invoice/payment state transitions.

create or replace function public.verify_payment_submission(target_submission_id uuid, admin_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.payment_submissions%rowtype;
  updated_submission_row public.payment_submissions%rowtype;
  payment_id uuid;
  invoice_status public.invoice_status;
begin
  -- Role guard: treasurer, admin, or super_admin only
  if not public.has_finance_role() then
    raise exception 'not authorized';
  end if;

  -- Fetch and lock the submission row for update
  select *
  into submission_row
  from public.payment_submissions
  where id = target_submission_id
  for update;

  if not found then
    raise exception 'submission not found';
  end if;

  -- Deterministic state guard: only submitted submissions can transition
  if submission_row.status <> 'submitted' then
    raise exception 'submission is not submitted';
  end if;

  -- Transition submission to verified
  update public.payment_submissions
  set status = 'verified',
      verified_by = auth.uid(),
      verified_at = now(),
      note = coalesce(note, '') || case when admin_note is not null then E'\nAdmin: ' || admin_note else '' end
  where id = target_submission_id
  returning * into updated_submission_row;

  -- Create payment row
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

  -- Recalculate invoice status
  invoice_status := public.recalculate_invoice_status(submission_row.invoice_id);

  -- Audit: record full before/after state with actor and entity linkage
  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    public.current_role(),
    'payment_submission.verify',
    'payment_submissions',
    submission_row.id::text,
    to_jsonb(submission_row),
    jsonb_build_object(
      'submission', to_jsonb(updated_submission_row),
      'payment_id', payment_id,
      'invoice_id', submission_row.invoice_id,
      'invoice_status', invoice_status,
      'admin_note', admin_note
    )
  );

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
  updated_submission_row public.payment_submissions%rowtype;
  invoice_status public.invoice_status;
begin
  -- Role guard: treasurer, admin, or super_admin only
  if not public.has_finance_role() then
    raise exception 'not authorized';
  end if;

  -- Rejection reason must be at least 3 non-whitespace characters
  if reason is null or length(trim(reason)) < 3 then
    raise exception 'rejection reason is required';
  end if;

  -- Fetch and lock the submission row for update
  select *
  into submission_row
  from public.payment_submissions
  where id = target_submission_id
  for update;

  if not found then
    raise exception 'submission not found';
  end if;

  -- Deterministic state guard: only submitted submissions can transition
  if submission_row.status <> 'submitted' then
    raise exception 'submission is not submitted';
  end if;

  -- Transition submission to rejected
  update public.payment_submissions
  set status = 'rejected',
      rejection_reason = reason,
      rejected_by = auth.uid(),
      rejected_at = now()
  where id = target_submission_id
  returning * into updated_submission_row;

  -- Recalculate invoice status
  invoice_status := public.recalculate_invoice_status(submission_row.invoice_id);

  -- Audit: record full before/after state with actor and entity linkage
  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    public.current_role(),
    'payment_submission.reject',
    'payment_submissions',
    submission_row.id::text,
    to_jsonb(submission_row),
    jsonb_build_object(
      'submission', to_jsonb(updated_submission_row),
      'invoice_id', submission_row.invoice_id,
      'invoice_status', invoice_status
    )
  );
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
  rejected_count integer;
  new_status public.invoice_status;
begin
  select *
  into invoice_row
  from public.invoices
  where id = target_invoice_id;

  if not found then
    raise exception 'invoice not found';
  end if;

  -- Waived/cancelled invoices keep their status — no recalculation needed
  if invoice_row.status in ('waived', 'cancelled') then
    return invoice_row.status;
  end if;

  -- Sum all verified payments for this invoice
  select coalesce(sum(amount), 0)
  into total_paid
  from public.payments
  where invoice_id = target_invoice_id;

  -- Count submitted (pending verification) submissions
  select count(*)
  into pending_count
  from public.payment_submissions
  where invoice_id = target_invoice_id
    and status = 'submitted';

  -- Count rejected submissions (relevant for status determination)
  select count(*)
  into rejected_count
  from public.payment_submissions
  where invoice_id = target_invoice_id
    and status = 'rejected';

  -- Deterministic status derivation
  if total_paid >= invoice_row.amount_due then
    new_status := 'paid';
  elsif total_paid > 0 then
    new_status := 'partial';
  elsif pending_count > 0 then
    new_status := 'pending_verification';
  elsif rejected_count > 0 then
    new_status := 'rejected';
  elsif invoice_row.due_date < current_date then
    new_status := 'overdue';
  else
    new_status := 'unpaid';
  end if;

  -- Update invoice with new status
  update public.invoices
  set status = new_status,
      amount_paid = total_paid,
      paid_at = case when new_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where id = target_invoice_id;

  return new_status;
end;
$$;
