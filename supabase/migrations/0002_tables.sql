create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  display_name text,
  phone text,
  email text,
  role public.app_role not null default 'resident',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_chat_id bigint not null,
  username text,
  first_name text,
  last_name text,
  language_code text,
  allows_notifications boolean not null default true,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (profile_id)
);

create table public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.kavlings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  block text,
  sort_order integer not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kavling_residents (
  id uuid primary key default gen_random_uuid(),
  kavling_id uuid not null references public.kavlings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  relation text not null default 'owner',
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kavling_id, profile_id)
);

create table public.fee_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  default_amount integer not null check (default_amount >= 0),
  is_recurring boolean not null default true,
  is_penalty boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kavling_fee_overrides (
  id uuid primary key default gen_random_uuid(),
  kavling_id uuid not null references public.kavlings(id) on delete cascade,
  fee_type_id uuid not null references public.fee_types(id) on delete cascade,
  amount integer not null check (amount >= 0),
  active_from date,
  active_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_until is null or active_from is null or active_until >= active_from),
  unique (kavling_id, fee_type_id, active_from)
);

create table public.penalty_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee_type_id uuid not null references public.fee_types(id),
  days_after_due integer not null check (days_after_due >= 0),
  fixed_amount integer not null default 0 check (fixed_amount >= 0),
  percent_amount numeric(5,2) not null default 0 check (percent_amount >= 0),
  max_amount integer check (max_amount is null or max_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  label text not null,
  due_date date not null,
  status public.billing_period_status not null default 'draft',
  opened_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references public.billing_periods(id) on delete cascade,
  kavling_id uuid not null references public.kavlings(id),
  invoice_number text not null unique,
  amount_due integer not null default 0 check (amount_due >= 0),
  amount_paid integer not null default 0 check (amount_paid >= 0),
  status public.invoice_status not null default 'unpaid',
  due_date date not null,
  paid_at timestamptz,
  waived_at timestamptz,
  waived_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_period_id, kavling_id)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  fee_type_id uuid not null references public.fee_types(id),
  description text not null,
  amount integer not null check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.invoice_penalties (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  penalty_rule_id uuid not null references public.penalty_rules(id),
  amount integer not null check (amount >= 0),
  applied_at timestamptz not null default now(),
  unique (invoice_id, penalty_rule_id)
);

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  amount_submitted integer not null check (amount_submitted > 0),
  bank_account_id uuid references public.bank_accounts(id),
  proof_path text,
  proof_mime_type text,
  proof_size_bytes integer check (proof_size_bytes is null or proof_size_bytes > 0),
  note text,
  status public.submission_status not null default 'submitted',
  rejection_reason text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejected_by uuid references public.profiles(id),
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_submission_id uuid references public.payment_submissions(id),
  amount integer not null check (amount > 0),
  method text not null,
  paid_at timestamptz not null default now(),
  verified_by uuid references public.profiles(id),
  external_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.payment_gateway_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null default 'midtrans',
  provider_order_id text not null unique,
  provider_transaction_id text,
  amount integer not null check (amount > 0),
  status public.gateway_status not null default 'created',
  payment_type text,
  qr_string text,
  qr_image_url text,
  raw_create_response jsonb,
  raw_last_notification jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  expired_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role public.app_role,
  action text not null,
  entity_table text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  channel public.notification_channel not null default 'telegram',
  title text not null,
  body_template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  channel public.notification_channel not null default 'telegram',
  template_code text,
  profile_id uuid references public.profiles(id),
  telegram_chat_id bigint,
  related_invoice_id uuid references public.invoices(id),
  related_submission_id uuid references public.payment_submissions(id),
  status public.notification_status not null default 'queued',
  message_text text not null,
  telegram_message_id bigint,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  report_type public.report_type not null,
  billing_period_id uuid references public.billing_periods(id),
  kavling_id uuid references public.kavlings(id),
  title text not null,
  file_path text,
  metadata jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now()
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  status public.import_status not null default 'draft',
  original_filename text,
  row_count integer not null default 0,
  valid_count integer not null default 0,
  invalid_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  preview_rows jsonb not null default '[]'::jsonb,
  applied_by uuid references public.profiles(id),
  applied_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_kavling_fee_override_no_overlap()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.kavling_fee_overrides existing_row
    where existing_row.kavling_id = new.kavling_id
      and existing_row.fee_type_id = new.fee_type_id
      and existing_row.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(
            coalesce(existing_row.active_from, '-infinity'::date),
            coalesce(existing_row.active_until, 'infinity'::date),
            '[]'
          ) && daterange(
            coalesce(new.active_from, '-infinity'::date),
            coalesce(new.active_until, 'infinity'::date),
            '[]'
          )
  ) then
    raise exception 'fee override date range overlaps with existing override';
  end if;

  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger bank_accounts_set_updated_at before update on public.bank_accounts for each row execute function public.set_updated_at();
create trigger kavlings_set_updated_at before update on public.kavlings for each row execute function public.set_updated_at();
create trigger fee_types_set_updated_at before update on public.fee_types for each row execute function public.set_updated_at();
create trigger kavling_fee_overrides_set_updated_at before update on public.kavling_fee_overrides for each row execute function public.set_updated_at();
create trigger penalty_rules_set_updated_at before update on public.penalty_rules for each row execute function public.set_updated_at();
create trigger billing_periods_set_updated_at before update on public.billing_periods for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger payment_submissions_set_updated_at before update on public.payment_submissions for each row execute function public.set_updated_at();
create trigger gateway_set_updated_at before update on public.payment_gateway_transactions for each row execute function public.set_updated_at();
create trigger notification_templates_set_updated_at before update on public.notification_templates for each row execute function public.set_updated_at();

create trigger kavling_fee_overrides_validate_overlap
before insert or update on public.kavling_fee_overrides
for each row
execute function public.validate_kavling_fee_override_no_overlap();
