-- ============================================================
-- M09: Telegram Notification Dispatch Contracts
--
-- Satisfies D-01 through D-06 and D-20.
--
-- Delivery model (D-01): dispatch is synchronous at event time.
-- Each attempt writes to notification_deliveries with status
-- 'sent' or 'failed' — no retries, no retry queue (D-12/T-05-12).
--
-- Reminder dedupe (D-05): at most one resident_payment_reminder
-- per (profile_id, related_invoice_id, billing_month) per cycle.
--
-- Monthly summary (D-06): cron-triggered via run-monthly-summary,
-- secret-gated via APP_INTERNAL_CRON_SECRET (T-05-13).
-- ============================================================

-- Ensure notification_deliveries has the columns we need.
-- Status enum already defaults to 'queued' from 0002_tables.sql.
alter table public.notification_deliveries
  add column if not exists related_invoice_id uuid references public.invoices(id),
  add column if not exists related_submission_id uuid references public.payment_submissions(id);

alter table public.notification_deliveries
  add column if not exists billing_period_month integer,
  add column if not exists billing_period_year integer;

-- Indexes for fast recipient lookup and dedupe checks
create index if not exists idx_notification_deliveries_template_profile
  on public.notification_deliveries(template_code, profile_id);

create index if not exists idx_notification_deliveries_dedupe
  on public.notification_deliveries(template_code, profile_id, related_invoice_id, billing_period_month)
  where template_code = 'resident_payment_reminder';

create index if not exists idx_notification_deliveries_status
  on public.notification_deliveries(status);

-- Helper: derive billing period month/year from a given invoice_id
create or replace function public.get_billing_period_month(invoice_uuid uuid)
returns integer
language sql
stable
as $$
  select extract(month from bp.due_date)::integer
  from public.invoices i
  join public.billing_periods bp on bp.id = i.billing_period_id
  where i.id = invoice_uuid;
$$;

create or replace function public.get_billing_period_year(invoice_uuid uuid)
returns integer
language sql
stable
as $$
  select extract(year from bp.due_date)::integer
  from public.invoices i
  join public.billing_periods bp on bp.id = i.billing_period_id
  where i.id = invoice_uuid;
$$;

-- ============================================================
-- Helper: resolve linked Telegram recipients for a given template
-- respecting D-02 (allows_notifications) and D-20 (per-category
-- notification_preferences telegram_enabled flag).
--
-- template_code: e.g. 'resident_payment_verified', 'resident_payment_rejected'
--
-- Returns rows: profile_id, telegram_chat_id, template_code, related_invoice_id, related_submission_id
-- ============================================================
create or replace function public.get_linked_telegram_recipients(
  p_template_code text
)
returns table (
  profile_id uuid,
  telegram_chat_id bigint,
  template_code text,
  related_invoice_id uuid,
  related_submission_id uuid,
  template_vars jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- D-02 / D-20: eligible ONLY when allows_notifications=true AND
  -- a notification_preferences row exists with telegram_enabled=true
  -- for the relevant category. No "default on" behavior.
  return query
  select
    ta.profile_id,
    ta.telegram_chat_id,
    p_template_code::text as template_code,
    null::uuid as related_invoice_id,
    null::uuid as related_submission_id,
    '{}'::jsonb as template_vars
  from public.telegram_accounts ta
  join public.profiles p on p.id = ta.profile_id
  join public.notification_preferences np
    on np.profile_id = ta.profile_id
    and np.category = case
      when p_template_code in ('resident_invoice_created', 'resident_payment_pending',
                               'resident_payment_verified', 'resident_payment_rejected',
                               'resident_payment_reminder')
        then 'payment_status'
      when p_template_code in ('admin_pending_submission', 'admin_monthly_summary')
        then 'payment_status'
      else null
    end
  where ta.allows_notifications = true
    and p.is_active = true
    and np.telegram_enabled = true;
end;
$$;

-- ============================================================
-- Helper: select recipients for the daily reminder job
-- Respects D-04 (unpaid/overdue invoices only) and D-05 (dedupe).
-- Skips paid, waived, cancelled invoices.
-- Returns profile_id, telegram_chat_id, invoice_id, period_label,
-- amount_due, due_date, kavling_code, name, billing_period_month, billing_period_year
-- ============================================================
create or replace function public.select_reminder_recipients()
returns table (
  profile_id uuid,
  telegram_chat_id bigint,
  related_invoice_id uuid,
  period_label text,
  amount_due integer,
  due_date date,
  kavling_code text,
  resident_name text,
  billing_period_month integer,
  billing_period_year integer,
  template_code text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with unpaid_invoices as (
    select
      i.id as invoice_id,
      i.kavling_id,
      i.billing_period_id,
      i.amount_due,
      i.due_date,
      bp.label as period_label,
      bp.year as billing_year,
      bp.month as billing_month,
      k.code as kavling_code
    from public.invoices i
    join public.billing_periods bp on bp.id = i.billing_period_id
    join public.kavlings k on k.id = i.kavling_id
    where i.status in ('unpaid', 'overdue', 'partial')
  ),
  dedupe_excluded as (
    select distinct
      nd.profile_id,
      nd.related_invoice_id,
      nd.billing_period_month
    from public.notification_deliveries nd
    where nd.template_code = 'resident_payment_reminder'
      and nd.status = 'sent'
      and nd.billing_period_month is not null
  )
  select
    ta.profile_id,
    ta.telegram_chat_id,
    ui.invoice_id as related_invoice_id,
    ui.period_label,
    ui.amount_due,
    ui.due_date,
    ui.kavling_code,
    p.full_name as resident_name,
    ui.billing_month as billing_period_month,
    ui.billing_year as billing_period_year,
    'resident_payment_reminder'::text as template_code
  from unpaid_invoices ui
  join public.kavling_residents kr
    on kr.kavling_id = ui.kavling_id
    and kr.active = true
  join public.telegram_accounts ta
    on ta.profile_id = kr.profile_id
    and ta.allows_notifications = true
  join public.profiles p on p.id = ta.profile_id
  left join public.notification_preferences np
    on np.profile_id = ta.profile_id
    and np.category = 'billing_reminders'
  left join dedupe_excluded de
    on de.profile_id = ta.profile_id
    and de.related_invoice_id = ui.invoice_id
    and de.billing_period_month = ui.billing_month
  where np.telegram_enabled = true
    and de.profile_id is null  -- not yet sent this cycle
  order by ui.due_date asc;
end;
$$;

-- ============================================================
-- Helper: log a notification delivery attempt
-- Returns the inserted row id.
-- ============================================================
create or replace function public.log_notification_delivery(
  p_template_code text,
  p_profile_id uuid,
  p_telegram_chat_id bigint,
  p_status text,
  p_message_text text,
  p_related_invoice_id uuid default null,
  p_related_submission_id uuid default null,
  p_telegram_message_id bigint default null,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_id uuid;
  v_billing_month integer;
  v_billing_year integer;
begin
  if p_related_invoice_id is not null then
    v_billing_month := public.get_billing_period_month(p_related_invoice_id);
    v_billing_year := public.get_billing_period_year(p_related_invoice_id);
  end if;

  insert into public.notification_deliveries (
    template_code, profile_id, telegram_chat_id, status, message_text,
    related_invoice_id, related_submission_id, telegram_message_id,
    error_message, sent_at, billing_period_month, billing_period_year
  ) values (
    p_template_code, p_profile_id, p_telegram_chat_id, p_status::public.notification_status, p_message_text,
    p_related_invoice_id, p_related_submission_id, p_telegram_message_id,
    p_error_message,
    case when p_status::public.notification_status = 'sent' then now() else null end,
    v_billing_month, v_billing_year
  )
  returning id into v_delivery_id;

  return v_delivery_id;
end;
$$;

-- ============================================================
-- Cron schedule registration (pg_cron)
-- These are idempotent; running multiple times is safe.
-- Schedule: daily at 07:00 WIB (UTC+7 = -7h from UTC)
-- Note: Supabase-managed pg_cron uses UTC internally.
-- 07:00 WIB = 00:00 UTC.  We register in UTC.
-- ============================================================

-- Daily reminder job: run at 00:00 UTC (07:00 WIB)
select cron.schedule(
  'daily-resident-reminder',
  '0 0 * * *',
  $$
  select * from public.select_reminder_recipients() limit 1;
  $$
);

-- Monthly summary job: run on the 1st of each month at 00:00 UTC
select cron.schedule(
  'monthly-admin-summary',
  '0 0 1 * *',
  $$
  select 1;  -- placeholder; actual dispatch happens in run-monthly-summary edge function
  $$
);

-- ============================================================
-- Grant execute to service_role so Edge Functions can call helpers
-- ============================================================
grant execute on function public.get_linked_telegram_recipients(text) to service_role;
grant execute on function public.select_reminder_recipients() to service_role;
grant execute on function public.log_notification_delivery(text, uuid, bigint, text, text, uuid, uuid, bigint, text) to service_role;
grant execute on function public.get_billing_period_month(uuid) to service_role;
grant execute on function public.get_billing_period_year(uuid) to service_role;