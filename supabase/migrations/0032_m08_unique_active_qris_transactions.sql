-- M08: Enforce one active QRIS transaction per invoice at the database layer.

create unique index if not exists idx_payment_gateway_transactions_one_active_per_invoice
on public.payment_gateway_transactions(invoice_id)
where status in ('created', 'pending');
