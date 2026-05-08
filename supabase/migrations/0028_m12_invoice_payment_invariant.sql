-- M12: Invoice-level payment invariant across manual and QRIS settlement paths.
-- Enforces that manual verification and QRIS settlement share one locked server-side
-- settlement path and cannot over-collect beyond invoice.amount_due.

alter table public.invoices
  drop constraint if exists invoices_amount_paid_lte_amount_due;

alter table public.invoices
  add constraint invoices_amount_paid_lte_amount_due
  check (amount_paid <= amount_due);

create or replace function public.apply_invoice_payment(
  target_invoice_id uuid,
  target_amount integer,
  target_method text,
  target_paid_at timestamptz default now(),
  target_verified_by uuid default auth.uid(),
  target_payment_submission_id uuid default null,
  target_external_reference text default null,
  target_notes text default null,
  allow_noop_when_outstanding_zero boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  total_paid integer;
  outstanding integer;
  normalized_method text;
  normalized_external_reference text;
  existing_payment_id uuid;
  inserted_payment_id uuid;
begin
  if target_invoice_id is null then
    raise exception 'invoice_id is required';
  end if;

  if target_amount is null or target_amount <= 0 then
    raise exception 'payment amount must be a positive integer';
  end if;

  normalized_method := lower(coalesce(trim(target_method), ''));
  if length(normalized_method) = 0 then
    raise exception 'payment method is required';
  end if;

  normalized_external_reference := nullif(trim(coalesce(target_external_reference, '')), '');

  select *
  into invoice_row
  from public.invoices
  where id = target_invoice_id
  for update;

  if not found then
    raise exception 'invoice not found';
  end if;

  if invoice_row.status in ('waived', 'cancelled') then
    raise exception 'invoice is not payable';
  end if;

  if normalized_external_reference is not null then
    select id
    into existing_payment_id
    from public.payments
    where method = normalized_method
      and external_reference = normalized_external_reference
    limit 1;

    if existing_payment_id is not null then
      return existing_payment_id;
    end if;
  end if;

  select coalesce(sum(amount), 0)
  into total_paid
  from public.payments
  where invoice_id = target_invoice_id;

  outstanding := greatest(invoice_row.amount_due - total_paid, 0);

  if outstanding <= 0 then
    if allow_noop_when_outstanding_zero then
      return null;
    end if;
    raise exception 'invoice outstanding is already zero';
  end if;

  if target_amount > outstanding then
    raise exception 'payment exceeds outstanding invoice balance';
  end if;

  insert into public.payments (
    invoice_id,
    payment_submission_id,
    amount,
    method,
    paid_at,
    verified_by,
    external_reference,
    notes
  )
  values (
    target_invoice_id,
    target_payment_submission_id,
    target_amount,
    normalized_method,
    coalesce(target_paid_at, now()),
    target_verified_by,
    normalized_external_reference,
    target_notes
  )
  on conflict (method, external_reference)
  where external_reference is not null
  do nothing
  returning id into inserted_payment_id;

  if inserted_payment_id is null then
    if normalized_external_reference is not null then
      select id
      into inserted_payment_id
      from public.payments
      where method = normalized_method
        and external_reference = normalized_external_reference
      limit 1;
    end if;

    if inserted_payment_id is null then
      raise exception 'failed to create payment row';
    end if;
  end if;

  return inserted_payment_id;
end;
$$;

create or replace function public.create_payment_submission(
  target_invoice_id uuid,
  target_amount_submitted integer,
  target_bank_account_id uuid,
  target_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  bank_row public.bank_accounts%rowtype;
  total_paid integer;
  reserved_submissions integer;
  reserved_gateway integer;
  available_balance integer;
  created_submission_id uuid;
begin
  if not public.has_role(array[
    'resident'::public.app_role,
    'treasurer'::public.app_role,
    'admin'::public.app_role,
    'super_admin'::public.app_role
  ]) then
    raise exception 'not authorized';
  end if;

  if target_invoice_id is null then
    raise exception 'invoice_id is required';
  end if;

  if target_amount_submitted is null or target_amount_submitted <= 0 then
    raise exception 'amount_submitted must be a positive integer';
  end if;

  if target_bank_account_id is null then
    raise exception 'bank_account_id is required';
  end if;

  select *
  into bank_row
  from public.bank_accounts
  where id = target_bank_account_id;

  if not found or bank_row.is_active is not true then
    raise exception 'bank account not found or inactive';
  end if;

  select *
  into invoice_row
  from public.invoices
  where id = target_invoice_id
  for update;

  if not found then
    raise exception 'invoice not found';
  end if;

  if invoice_row.status not in ('unpaid', 'partial', 'overdue', 'pending_verification', 'rejected') then
    raise exception 'invoice is not eligible for manual submission';
  end if;

  if invoice_row.status in ('waived', 'cancelled') then
    raise exception 'invoice is not payable';
  end if;

  select coalesce(sum(amount), 0)
  into total_paid
  from public.payments
  where invoice_id = target_invoice_id;

  select coalesce(sum(amount_submitted), 0)
  into reserved_submissions
  from public.payment_submissions
  where invoice_id = target_invoice_id
    and status = 'submitted';

  select coalesce(sum(amount), 0)
  into reserved_gateway
  from public.payment_gateway_transactions
  where invoice_id = target_invoice_id
    and status in ('created', 'pending');

  available_balance := invoice_row.amount_due - total_paid - reserved_submissions - reserved_gateway;

  if available_balance <= 0 then
    raise exception 'invoice has no reservable balance';
  end if;

  if target_amount_submitted > available_balance then
    raise exception 'amount_submitted exceeds reservable invoice balance';
  end if;

  insert into public.payment_submissions (
    invoice_id,
    submitted_by,
    amount_submitted,
    bank_account_id,
    note,
    status
  )
  values (
    target_invoice_id,
    auth.uid(),
    target_amount_submitted,
    target_bank_account_id,
    target_note,
    'submitted'
  )
  returning id into created_submission_id;

  perform public.recalculate_invoice_status(target_invoice_id);

  return created_submission_id;
end;
$$;

create or replace function public.guard_submitted_payment_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  total_paid integer;
  reserved_submissions integer;
  reserved_gateway integer;
  available_balance integer;
begin
  if new.status <> 'submitted' then
    return new;
  end if;

  select *
  into invoice_row
  from public.invoices
  where id = new.invoice_id
  for update;

  if not found then
    raise exception 'invoice not found';
  end if;

  if invoice_row.status in ('waived', 'cancelled') then
    raise exception 'invoice is not payable';
  end if;

  select coalesce(sum(amount), 0)
  into total_paid
  from public.payments
  where invoice_id = new.invoice_id;

  select coalesce(sum(amount_submitted), 0)
  into reserved_submissions
  from public.payment_submissions
  where invoice_id = new.invoice_id
    and status = 'submitted'
    and (tg_op = 'INSERT' or id <> new.id);

  select coalesce(sum(amount), 0)
  into reserved_gateway
  from public.payment_gateway_transactions
  where invoice_id = new.invoice_id
    and status in ('created', 'pending');

  available_balance := invoice_row.amount_due - total_paid - reserved_submissions - reserved_gateway;

  if available_balance <= 0 then
    raise exception 'invoice has no reservable balance';
  end if;

  if new.amount_submitted > available_balance then
    raise exception 'amount_submitted exceeds reservable invoice balance';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_submissions_reservation_guard on public.payment_submissions;
create trigger payment_submissions_reservation_guard
before insert or update of invoice_id, amount_submitted, status
on public.payment_submissions
for each row
execute function public.guard_submitted_payment_reservation();

create or replace function public.guard_active_qris_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  total_paid integer;
  reserved_submissions integer;
  reserved_gateway integer;
  available_balance integer;
begin
  if new.status not in ('created', 'pending') then
    return new;
  end if;

  select *
  into invoice_row
  from public.invoices
  where id = new.invoice_id
  for update;

  if not found then
    raise exception 'invoice not found';
  end if;

  if invoice_row.status in ('waived', 'cancelled') then
    raise exception 'invoice is not payable';
  end if;

  select coalesce(sum(amount), 0)
  into total_paid
  from public.payments
  where invoice_id = new.invoice_id;

  select coalesce(sum(amount_submitted), 0)
  into reserved_submissions
  from public.payment_submissions
  where invoice_id = new.invoice_id
    and status = 'submitted';

  select coalesce(sum(amount), 0)
  into reserved_gateway
  from public.payment_gateway_transactions
  where invoice_id = new.invoice_id
    and status in ('created', 'pending')
    and (tg_op = 'INSERT' or id <> new.id);

  available_balance := invoice_row.amount_due - total_paid - reserved_submissions - reserved_gateway;

  if available_balance <= 0 then
    raise exception 'invoice has no reservable balance';
  end if;

  if new.amount > available_balance then
    raise exception 'qris amount exceeds reservable invoice balance';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_gateway_transactions_reservation_guard on public.payment_gateway_transactions;
create trigger payment_gateway_transactions_reservation_guard
before insert or update of invoice_id, amount, status
on public.payment_gateway_transactions
for each row
execute function public.guard_active_qris_reservation();

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
  if not public.has_finance_role() then
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
  where id = target_submission_id
  returning * into updated_submission_row;

  payment_id := public.apply_invoice_payment(
    target_invoice_id => submission_row.invoice_id,
    target_amount => submission_row.amount_submitted,
    target_method => 'manual_transfer',
    target_paid_at => now(),
    target_verified_by => auth.uid(),
    target_payment_submission_id => submission_row.id,
    target_external_reference => null,
    target_notes => admin_note,
    allow_noop_when_outstanding_zero => false
  );

  invoice_status := public.recalculate_invoice_status(submission_row.invoice_id);

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

create or replace function public.reconcile_midtrans_qris_notification(
  input_order_id text,
  input_transaction_id text,
  input_transaction_status text,
  input_status_code text,
  input_gross_amount text,
  input_payment_type text,
  input_raw_notification jsonb default '{}'::jsonb
)
returns public.gateway_status
language plpgsql
security definer
set search_path = public
as $$
declare
  gateway_row public.payment_gateway_transactions%rowtype;
  mapped_status public.gateway_status;
  resolved_status public.gateway_status;
  expected_gross numeric(12,2);
  received_gross numeric(12,2);
begin
  if input_order_id is null or length(trim(input_order_id)) = 0 then
    raise exception 'order_id is required';
  end if;

  select *
  into gateway_row
  from public.payment_gateway_transactions
  where provider_order_id = trim(input_order_id)
  for update;

  if not found then
    raise exception 'gateway transaction not found';
  end if;

  expected_gross := gateway_row.amount::numeric;
  begin
    received_gross := trim(coalesce(input_gross_amount, '0'))::numeric;
  exception
    when others then
      raise exception 'invalid gross_amount';
  end;

  if received_gross <> expected_gross then
    raise exception 'gross_amount mismatch';
  end if;

  mapped_status := public.map_midtrans_transaction_status(input_transaction_status);

  resolved_status := case
    when gateway_row.status = mapped_status then gateway_row.status
    when gateway_row.status = 'settlement' then gateway_row.status
    when gateway_row.status in ('expire', 'deny', 'cancel', 'failure', 'refund') then gateway_row.status
    when gateway_row.status = 'pending'
      and mapped_status in ('settlement', 'expire', 'deny', 'cancel', 'failure', 'refund') then mapped_status
    when gateway_row.status = 'created' and mapped_status <> 'unknown' then mapped_status
    when gateway_row.status = 'unknown' and mapped_status <> 'unknown' then mapped_status
    else gateway_row.status
  end;

  update public.payment_gateway_transactions
  set provider_transaction_id = coalesce(nullif(trim(input_transaction_id), ''), provider_transaction_id),
      status = resolved_status,
      payment_type = coalesce(nullif(trim(input_payment_type), ''), payment_type),
      raw_last_notification = coalesce(input_raw_notification, '{}'::jsonb),
      settled_at = case when resolved_status = 'settlement' then coalesce(settled_at, now()) else settled_at end,
      expired_at = case when resolved_status in ('expire', 'deny', 'cancel', 'failure') then coalesce(expired_at, now()) else expired_at end
  where id = gateway_row.id;

  if resolved_status = 'settlement' then
    perform public.apply_invoice_payment(
      target_invoice_id => gateway_row.invoice_id,
      target_amount => gateway_row.amount,
      target_method => 'qris',
      target_paid_at => now(),
      target_verified_by => null,
      target_payment_submission_id => null,
      target_external_reference => gateway_row.provider_order_id,
      target_notes => format(
        'midtrans status=%s status_code=%s tx=%s',
        coalesce(input_transaction_status, ''),
        coalesce(input_status_code, ''),
        coalesce(input_transaction_id, '')
      ),
      allow_noop_when_outstanding_zero => true
    );
  end if;

  perform public.recalculate_invoice_status(gateway_row.invoice_id);

  return resolved_status;
end;
$$;

revoke execute on function public.apply_invoice_payment(uuid, integer, text, timestamptz, uuid, uuid, text, text, boolean) from public;
revoke execute on function public.create_payment_submission(uuid, integer, uuid, text) from public;
grant execute on function public.create_payment_submission(uuid, integer, uuid, text) to authenticated;
