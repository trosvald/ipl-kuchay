-- M08: Guard QRIS webhook status regressions after terminal reconciliation.

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
    insert into public.payments (
      invoice_id,
      amount,
      method,
      paid_at,
      external_reference,
      notes
    )
    values (
      gateway_row.invoice_id,
      gateway_row.amount,
      'qris',
      now(),
      gateway_row.provider_order_id,
      format(
        'midtrans status=%s status_code=%s tx=%s',
        coalesce(input_transaction_status, ''),
        coalesce(input_status_code, ''),
        coalesce(input_transaction_id, '')
      )
    )
    on conflict (external_reference) do nothing;
  end if;

  perform public.recalculate_invoice_status(gateway_row.invoice_id);

  return resolved_status;
end;
$$;
