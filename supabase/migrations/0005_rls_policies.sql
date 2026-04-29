alter table public.profiles enable row level security;
alter table public.telegram_accounts enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.app_settings enable row level security;
alter table public.kavlings enable row level security;
alter table public.kavling_residents enable row level security;
alter table public.fee_types enable row level security;
alter table public.kavling_fee_overrides enable row level security;
alter table public.penalty_rules enable row level security;
alter table public.billing_periods enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_penalties enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_gateway_transactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.reports enable row level security;
alter table public.import_jobs enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin_like());

create policy "profiles_insert_admin_or_super_admin"
on public.profiles for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.has_role(array['admin'::public.app_role])
    and role <> 'super_admin'
  )
);

create policy "profiles_update_admin_or_super_admin"
on public.profiles for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.has_role(array['admin'::public.app_role])
    and role <> 'super_admin'
  )
)
with check (
  public.is_super_admin()
  or (
    public.has_role(array['admin'::public.app_role])
    and role <> 'super_admin'
  )
);

create policy "profiles_delete_super_admin_only"
on public.profiles for delete
to authenticated
using (public.is_super_admin());

create policy "telegram_accounts_select_own_or_admin"
on public.telegram_accounts for select
to authenticated
using (profile_id = auth.uid() or public.is_admin_like());

create policy "telegram_accounts_insert_own_or_super_admin"
on public.telegram_accounts for insert
to authenticated
with check (
  profile_id = auth.uid()
  or public.is_super_admin()
);

create policy "telegram_accounts_update_own_or_super_admin"
on public.telegram_accounts for update
to authenticated
using (
  profile_id = auth.uid()
  or public.is_super_admin()
)
with check (
  profile_id = auth.uid()
  or public.is_super_admin()
);

create policy "telegram_accounts_delete_super_admin_only"
on public.telegram_accounts for delete
to authenticated
using (public.is_super_admin());

create policy "telegram_link_tokens_select_own_or_admin"
on public.telegram_link_tokens for select
to authenticated
using (profile_id = auth.uid() or public.is_admin_like());

create policy "telegram_link_tokens_insert_own_or_admin"
on public.telegram_link_tokens for insert
to authenticated
with check (profile_id = auth.uid() or public.is_admin_like());

create policy "telegram_link_tokens_update_own_or_admin"
on public.telegram_link_tokens for update
to authenticated
using (profile_id = auth.uid() or public.is_admin_like())
with check (profile_id = auth.uid() or public.is_admin_like());

create policy "telegram_link_tokens_delete_own_or_admin"
on public.telegram_link_tokens for delete
to authenticated
using (profile_id = auth.uid() or public.is_admin_like());

create policy "bank_accounts_select_authenticated"
on public.bank_accounts for select
to authenticated
using (is_active = true or public.is_admin_like());

create policy "bank_accounts_admin_manage"
on public.bank_accounts for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "app_settings_admin_manage"
on public.app_settings for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "kavlings_select_authenticated"
on public.kavlings for select
to authenticated
using (active = true or public.is_admin_like());

create policy "kavlings_admin_manage"
on public.kavlings for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "kavling_residents_select_own_or_admin"
on public.kavling_residents for select
to authenticated
using (profile_id = auth.uid() or public.is_admin_like());

create policy "kavling_residents_admin_manage"
on public.kavling_residents for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "fee_types_select_active_or_admin"
on public.fee_types for select
to authenticated
using (active = true or public.is_admin_like());

create policy "fee_types_admin_manage"
on public.fee_types for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "kavling_fee_overrides_select_own_or_admin"
on public.kavling_fee_overrides for select
to authenticated
using (
  public.is_admin_like()
  or public.can_access_kavling(kavling_id)
);

create policy "kavling_fee_overrides_admin_manage"
on public.kavling_fee_overrides for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "penalty_rules_select_active_or_admin"
on public.penalty_rules for select
to authenticated
using (active = true or public.is_admin_like());

create policy "penalty_rules_admin_manage"
on public.penalty_rules for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "billing_periods_select_open_closed_or_admin"
on public.billing_periods for select
to authenticated
using (status in ('open', 'closed') or public.is_admin_like());

create policy "billing_periods_admin_manage"
on public.billing_periods for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "invoices_select_own_or_admin"
on public.invoices for select
to authenticated
using (public.can_access_kavling(kavling_id));

create policy "invoices_admin_manage"
on public.invoices for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "invoice_items_select_own_or_admin"
on public.invoice_items for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and public.can_access_kavling(i.kavling_id)
  )
);

create policy "invoice_items_admin_manage"
on public.invoice_items for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "invoice_penalties_select_own_or_admin"
on public.invoice_penalties for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_penalties.invoice_id
      and public.can_access_kavling(i.kavling_id)
  )
);

create policy "invoice_penalties_admin_manage"
on public.invoice_penalties for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "payment_submissions_select_own_or_admin"
on public.payment_submissions for select
to authenticated
using (
  submitted_by = auth.uid()
  or public.is_admin_like()
  or exists (
    select 1
    from public.invoices i
    where i.id = payment_submissions.invoice_id
      and public.can_access_kavling(i.kavling_id)
  )
);

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
      and public.can_access_kavling(i.kavling_id)
      and bp.status = 'open'
      and i.status in ('unpaid', 'overdue', 'rejected', 'partial')
  )
);

create policy "payment_submissions_admin_update"
on public.payment_submissions for update
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "payment_submissions_admin_delete"
on public.payment_submissions for delete
to authenticated
using (public.is_admin_like());

create policy "payments_select_own_or_admin"
on public.payments for select
to authenticated
using (
  public.is_admin_like()
  or exists (
    select 1
    from public.invoices i
    where i.id = payments.invoice_id
      and public.can_access_kavling(i.kavling_id)
  )
);

create policy "payments_super_admin_manage"
on public.payments for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "payment_gateway_transactions_select_own_or_admin"
on public.payment_gateway_transactions for select
to authenticated
using (
  public.is_admin_like()
  or exists (
    select 1
    from public.invoices i
    where i.id = payment_gateway_transactions.invoice_id
      and public.can_access_kavling(i.kavling_id)
  )
);

create policy "payment_gateway_transactions_admin_or_super_admin_manage"
on public.payment_gateway_transactions for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'super_admin'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'super_admin'::public.app_role]));

create policy "audit_logs_select_admin_like"
on public.audit_logs for select
to authenticated
using (public.is_admin_like());

create policy "audit_logs_super_admin_manage"
on public.audit_logs for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "notification_templates_select_authenticated"
on public.notification_templates for select
to authenticated
using (active = true or public.is_admin_like());

create policy "notification_templates_admin_manage"
on public.notification_templates for all
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

create policy "notification_deliveries_select_own_or_admin"
on public.notification_deliveries for select
to authenticated
using (profile_id = auth.uid() or public.is_admin_like());

create policy "notification_deliveries_super_admin_manage"
on public.notification_deliveries for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "reports_select_own_receipt_or_admin"
on public.reports for select
to authenticated
using (
  public.is_admin_like()
  or (
    report_type = 'receipt'
    and exists (
      select 1
      from public.kavling_residents kr
      where kr.kavling_id = reports.kavling_id
        and kr.profile_id = auth.uid()
        and kr.active = true
    )
  )
);

create policy "reports_admin_or_super_admin_manage"
on public.reports for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'super_admin'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'super_admin'::public.app_role]));

create policy "import_jobs_select_admin_like"
on public.import_jobs for select
to authenticated
using (public.is_admin_like());

create policy "import_jobs_admin_or_super_admin_manage"
on public.import_jobs for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'super_admin'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'super_admin'::public.app_role]));
