create index idx_profiles_role on public.profiles(role);
create index idx_telegram_accounts_profile_id on public.telegram_accounts(profile_id);
create index idx_kavlings_sort_order on public.kavlings(sort_order, code);
create index idx_kavling_residents_profile_id on public.kavling_residents(profile_id) where active = true;
create index idx_kavling_residents_kavling_id on public.kavling_residents(kavling_id) where active = true;
create index idx_billing_periods_year_month on public.billing_periods(year, month);
create index idx_invoices_period_status on public.invoices(billing_period_id, status);
create index idx_invoices_kavling_id on public.invoices(kavling_id);
create index idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
create index idx_invoice_penalties_invoice_id on public.invoice_penalties(invoice_id);
create index idx_payment_submissions_invoice_id on public.payment_submissions(invoice_id);
create index idx_payment_submissions_status on public.payment_submissions(status);
create index idx_payments_invoice_id on public.payments(invoice_id);
create index idx_gateway_invoice_id on public.payment_gateway_transactions(invoice_id);
create index idx_gateway_order_id on public.payment_gateway_transactions(provider_order_id);
create index idx_audit_logs_entity on public.audit_logs(entity_table, entity_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index idx_notification_deliveries_profile on public.notification_deliveries(profile_id, created_at desc);

create unique index idx_kavling_residents_one_primary_active
on public.kavling_residents(kavling_id)
where active = true and is_primary = true;

create unique index idx_kavling_fee_overrides_one_open_start
on public.kavling_fee_overrides(kavling_id, fee_type_id)
where active_from is null;

create unique index payments_unique_submission
on public.payments(payment_submission_id)
where payment_submission_id is not null;

create unique index payments_unique_external_reference
on public.payments(method, external_reference)
where external_reference is not null;
