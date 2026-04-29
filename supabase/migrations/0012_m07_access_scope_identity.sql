create or replace function public.has_finance_role()
returns boolean
language sql
stable
as $$
  select public.has_role(array['treasurer'::public.app_role, 'admin'::public.app_role, 'super_admin'::public.app_role]);
$$;

create or replace function public.has_operator_role()
returns boolean
language sql
stable
as $$
  select public.has_role(array['admin'::public.app_role, 'super_admin'::public.app_role]);
$$;

create or replace function public.can_view_finance_audit_log(target_action text, target_entity_table text)
returns boolean
language sql
stable
as $$
  select
    public.has_operator_role()
    or (
      public.has_role(array['treasurer'::public.app_role])
      and target_entity_table in ('billing_periods', 'invoices', 'invoice_items', 'invoice_penalties', 'payment_submissions', 'payments', 'reports')
      and (
        target_action like 'billing.%'
        or target_action like 'invoice.%'
        or target_action like 'payment.%'
        or target_action like 'payment_submission.%'
        or target_action like 'report.%'
      )
    );
$$;

alter table public.kavling_residents
  add column if not exists relation_type text,
  add column if not exists relation_label text,
  add column if not exists started_at date,
  add column if not exists ended_at date;

update public.kavling_residents
set relation_type = case
  when relation in ('owner', 'spouse', 'child', 'parent', 'tenant', 'family_other', 'staff', 'other') then relation
  else 'other'
end
where relation_type is null;

update public.kavling_residents
set started_at = created_at::date
where started_at is null;

alter table public.kavling_residents
  alter column relation_type set default 'owner',
  alter column relation_type set not null,
  alter column started_at set default current_date,
  alter column started_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kavling_residents_relation_type_check'
      and conrelid = 'public.kavling_residents'::regclass
  ) then
    alter table public.kavling_residents
      add constraint kavling_residents_relation_type_check
      check (relation_type in ('owner', 'spouse', 'child', 'parent', 'tenant', 'family_other', 'staff', 'other'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'kavling_residents_relation_label_required_for_other'
      and conrelid = 'public.kavling_residents'::regclass
  ) then
    alter table public.kavling_residents
      add constraint kavling_residents_relation_label_required_for_other
      check (
        (relation_type <> 'other' and (relation_label is null or length(trim(relation_label)) = 0))
        or (relation_type = 'other' and relation_label is not null and length(trim(relation_label)) >= 2)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'kavling_residents_date_window_check'
      and conrelid = 'public.kavling_residents'::regclass
  ) then
    alter table public.kavling_residents
      add constraint kavling_residents_date_window_check
      check (ended_at is null or ended_at >= started_at);
  end if;
end;
$$;

create index if not exists idx_kavling_residents_profile_window
on public.kavling_residents(profile_id, kavling_id, started_at, ended_at);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  in_app_enabled boolean not null default true,
  telegram_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, category)
);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own_or_admin" on public.notification_preferences;
create policy "notification_preferences_select_own_or_admin"
on public.notification_preferences for select
to authenticated
using (profile_id = auth.uid() or public.has_operator_role());

drop policy if exists "notification_preferences_insert_own_or_admin" on public.notification_preferences;
create policy "notification_preferences_insert_own_or_admin"
on public.notification_preferences for insert
to authenticated
with check (profile_id = auth.uid() or public.has_operator_role());

drop policy if exists "notification_preferences_update_own_or_admin" on public.notification_preferences;
create policy "notification_preferences_update_own_or_admin"
on public.notification_preferences for update
to authenticated
using (profile_id = auth.uid() or public.has_operator_role())
with check (profile_id = auth.uid() or public.has_operator_role());

drop policy if exists "notification_preferences_delete_operator_only" on public.notification_preferences;
create policy "notification_preferences_delete_operator_only"
on public.notification_preferences for delete
to authenticated
using (public.has_operator_role());

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
      join public.kavling_residents kr
        on kr.kavling_id = i.kavling_id
      where i.id = target_invoice_id
        and kr.profile_id = auth.uid()
        and i.due_date >= kr.started_at
        and (kr.active = true or kr.ended_at is not null)
        and (kr.ended_at is null or i.due_date <= kr.ended_at)
    );
$$;

drop policy if exists "kavlings_admin_manage" on public.kavlings;
create policy "kavlings_admin_manage"
on public.kavlings for all
to authenticated
using (public.has_operator_role())
with check (public.has_operator_role());

drop policy if exists "kavling_residents_admin_manage" on public.kavling_residents;
create policy "kavling_residents_admin_manage"
on public.kavling_residents for all
to authenticated
using (public.has_operator_role())
with check (public.has_operator_role());

drop policy if exists "fee_types_admin_manage" on public.fee_types;
create policy "fee_types_admin_manage"
on public.fee_types for all
to authenticated
using (public.has_operator_role())
with check (public.has_operator_role());

drop policy if exists "kavling_fee_overrides_admin_manage" on public.kavling_fee_overrides;
create policy "kavling_fee_overrides_admin_manage"
on public.kavling_fee_overrides for all
to authenticated
using (public.has_operator_role())
with check (public.has_operator_role());

drop policy if exists "penalty_rules_admin_manage" on public.penalty_rules;
create policy "penalty_rules_admin_manage"
on public.penalty_rules for all
to authenticated
using (public.has_operator_role())
with check (public.has_operator_role());

drop policy if exists "app_settings_admin_manage" on public.app_settings;
create policy "app_settings_admin_manage"
on public.app_settings for all
to authenticated
using (public.has_operator_role())
with check (public.has_operator_role());

drop policy if exists "import_jobs_select_admin_like" on public.import_jobs;
create policy "import_jobs_select_admin_like"
on public.import_jobs for select
to authenticated
using (public.has_operator_role());

drop policy if exists "import_jobs_admin_or_super_admin_manage" on public.import_jobs;
create policy "import_jobs_admin_or_super_admin_manage"
on public.import_jobs for all
to authenticated
using (public.has_operator_role())
with check (public.has_operator_role());

drop policy if exists "billing_periods_admin_manage" on public.billing_periods;
create policy "billing_periods_admin_manage"
on public.billing_periods for all
to authenticated
using (public.has_finance_role())
with check (public.has_finance_role());

drop policy if exists "invoices_select_own_or_admin" on public.invoices;
create policy "invoices_select_own_or_admin"
on public.invoices for select
to authenticated
using (public.can_access_invoice_history(id));

drop policy if exists "invoices_admin_manage" on public.invoices;
create policy "invoices_admin_manage"
on public.invoices for all
to authenticated
using (public.has_finance_role())
with check (public.has_finance_role());

drop policy if exists "invoice_items_select_own_or_admin" on public.invoice_items;
create policy "invoice_items_select_own_or_admin"
on public.invoice_items for select
to authenticated
using (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.can_access_invoice_history(i.id)));

drop policy if exists "invoice_items_admin_manage" on public.invoice_items;
create policy "invoice_items_admin_manage"
on public.invoice_items for all
to authenticated
using (public.has_finance_role())
with check (public.has_finance_role());

drop policy if exists "invoice_penalties_select_own_or_admin" on public.invoice_penalties;
create policy "invoice_penalties_select_own_or_admin"
on public.invoice_penalties for select
to authenticated
using (exists (select 1 from public.invoices i where i.id = invoice_penalties.invoice_id and public.can_access_invoice_history(i.id)));

drop policy if exists "invoice_penalties_admin_manage" on public.invoice_penalties;
create policy "invoice_penalties_admin_manage"
on public.invoice_penalties for all
to authenticated
using (public.has_finance_role())
with check (public.has_finance_role());

drop policy if exists "payment_submissions_admin_update" on public.payment_submissions;
create policy "payment_submissions_admin_update"
on public.payment_submissions for update
to authenticated
using (public.has_finance_role())
with check (public.has_finance_role());

drop policy if exists "payment_submissions_admin_delete" on public.payment_submissions;
create policy "payment_submissions_admin_delete"
on public.payment_submissions for delete
to authenticated
using (public.has_finance_role());

drop policy if exists "payment_submissions_select_own_or_admin" on public.payment_submissions;
create policy "payment_submissions_select_own_or_admin"
on public.payment_submissions for select
to authenticated
using (
  submitted_by = auth.uid()
  or public.has_finance_role()
  or exists (
    select 1
    from public.invoices i
    where i.id = payment_submissions.invoice_id
      and public.can_access_invoice_history(i.id)
  )
);

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
      and bp.status = 'open'
      and i.status in ('unpaid', 'overdue', 'rejected', 'partial')
  )
);

drop policy if exists "payments_select_own_or_admin" on public.payments;
create policy "payments_select_own_or_admin"
on public.payments for select
to authenticated
using (
  public.has_finance_role()
  or exists (
    select 1
    from public.invoices i
    where i.id = payments.invoice_id
      and public.can_access_invoice_history(i.id)
  )
);

drop policy if exists "audit_logs_select_admin_like" on public.audit_logs;
create policy "audit_logs_select_admin_like"
on public.audit_logs for select
to authenticated
using (public.can_view_finance_audit_log(action, entity_table));

drop policy if exists "bank_accounts_admin_manage" on public.bank_accounts;
create policy "bank_accounts_admin_manage"
on public.bank_accounts for all
to authenticated
using (public.has_operator_role())
with check (public.has_operator_role());

drop policy if exists "reports_select_own_receipt_or_admin" on public.reports;
create policy "reports_select_own_receipt_or_admin"
on public.reports for select
to authenticated
using (
  public.has_finance_role()
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
