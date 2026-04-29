# IPL Jatiloka Residence — Telegram-first implementation plan for Codex CLI

> Drop this file into the repository root and ask Codex CLI to execute it milestone-by-milestone.  
> This is intentionally detailed. The coding agent should not invent schema, routes, status names, or security behavior.

---

## 0. Agent instruction block

You are the coding agent implementing this plan inside the existing `ipl-jatiloka` React/Vite/Supabase app.

Non-negotiable rules:

1. **Do not keep the old public CRUD security model.** The existing `payments` table and public read/insert/update/delete policies are demo-only and must be replaced.
2. **Do not expose payment proof files publicly.** Proof files must be stored in a private Supabase Storage bucket and served only through permission-checked signed URLs.
3. **Do not use WhatsApp anywhere.** No labels, templates, guide text, env vars, or code should mention WhatsApp. All messaging/reminder features must use Telegram.
4. **Do not treat client-side admin UI as security.** Authorization must be enforced through Supabase Auth, RLS, trusted Edge Functions, and server-side checks.
5. **Do not mark self-submitted proof as paid automatically.** Resident/manual proof submissions start as `pending_verification`. Only treasurer/admin verification can mark an invoice as paid.
6. **Do not place secrets in browser code.** Telegram bot token, webhook secret, Midtrans server key, Supabase service role key, and cron secrets must live only in Supabase Edge Function secrets or server-only env files.
7. **Use Indonesian labels in user-facing UI.** Internal code may use English names. UI copy should fit a neighborhood IPL app.
8. **Run tests after each milestone.** If a test fails, fix before moving on.
9. **Commit or checkpoint after each milestone** if the local workflow supports it.
10. **Prefer boring reliability over clever hacks.** This is a neighborhood finance app. Trust beats sparkle.

Implementation correction rules before any milestone:

1. **Do not copy sketch SQL blindly.** SQL snippets in this plan are authoritative for names and behavior, but implementation must remove ambiguity, qualify columns, and pass `supabase db reset` before continuing.
2. **Use one authorization path per privileged action.** Browser calls must use authenticated user JWTs and RLS/RPC role checks. Edge Functions that use `service_role` must first verify the caller JWT or webhook/cron secret, derive an explicit `actor_id`, and pass that actor into server-side logic. Do not rely on `auth.uid()` inside service-role RPC calls.
3. **Do not expose direct table mutation where a workflow has invariants.** Payment submission, verification, rejection, invoice generation, role changes, imports, penalties, and gateway reconciliation must go through RPCs or Edge Functions that validate the full transition and write audit logs.
4. **Public dashboard data must be deliberately published.** Do not assume anon can read security-invoker views over locked tables. Use a safe security-definer RPC/view or tightly scoped anon policies that expose only aggregate/public status fields.
5. **Resident profile self-update must be RPC-based.** Residents may update only allowed personal fields. They must never directly update `role`, `is_active`, or admin-controlled fields.

Implementation target:

- Keep the existing frontend stack direction: **React + Vite + Supabase**.
- Refactor to **TypeScript** for maintainability.
- Add **Supabase migrations**, **Supabase Edge Functions**, **private Storage**, **RLS**, **Telegram bot integration**, **reports**, **PWA**, **bulk import**, and **QRIS/payment gateway support**.
- Use **Midtrans QRIS** as the first payment gateway adapter because it supports dynamic QRIS and HTTP notifications. Keep the gateway code behind a feature flag so the app still works with manual bank transfer only.

---

## 1. Current project assessment

Current attached project files:

```text
index.html
package.json
vite.config.js
.env.example
supabase-setup.sql
PANDUAN-DEPLOY.md
src/App.jsx
src/main.jsx
```

Current `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

Known issues in current code:

- `src/App.jsx` hard-codes kavlings, months, years, admin PIN, bank account, and deadline text.
- `ADMIN_PIN = "1234"` is client-side only and must be removed.
- Resident submission immediately writes `status: "lunas"` and uses `upsert`, allowing accidental or malicious overwrite.
- `supabase-setup.sql` creates only one table: `payments`.
- `supabase-setup.sql` allows public select/insert/update/delete.
- Current storage guide creates public bucket `bukti-transfer` and allows public file CRUD.
- Dashboard exposes payment proof links to public users.
- No user identity, role, resident-to-kavling mapping, invoice generation, verification flow, audit log, reporting lifecycle, Telegram integration, import flow, or payment gateway reconciliation.

Treat the existing app as a UI prototype only. Rebuild the data and security model.

---

## 2. Target product scope

The final app must support all future features from the review, adapted to Telegram instead of WhatsApp.

Required feature set:

1. Secure resident/admin login.
2. Kavling and resident management.
3. Monthly invoice generation.
4. Multiple fee types:
   - IPL
   - Security
   - Cleaning
   - Sinking fund
   - Event contribution
   - Denda / penalty
   - Other configurable fees
5. Configurable amount per kavling and per fee type.
6. Manual bank transfer confirmation with private proof upload.
7. Treasurer/admin verification and rejection workflow.
8. Payment history per kavling.
9. Tunggakan / arrears dashboard.
10. Auto-generated monthly report.
11. CSV export.
12. PDF receipt and PDF monthly report.
13. Bulk import kavlings/residents/fee overrides from CSV.
14. Telegram bot integration:
    - Account linking.
    - Resident invoice/status commands.
    - Admin summary commands.
    - Reminder messages.
    - Payment verification notifications.
    - Monthly report notification.
15. No WhatsApp references anywhere.
16. PWA installability.
17. QRIS/payment gateway integration with Midtrans, behind a feature flag.
18. Audit trail for all sensitive actions.
19. Production deployment guide.
20. Test suite covering schema logic, UI, Edge Functions, Telegram payloads, and payment status transitions.

---

## 3. Recommended architecture

### 3.1 High-level components

```text
Browser / PWA
  ├── Public dashboard
  ├── Resident portal
  └── Admin/treasurer portal
        │
        ▼
Supabase Auth
Supabase Postgres + RLS
Supabase Storage private bucket
Supabase Edge Functions
  ├── telegram-webhook
  ├── telegram-send-notification
  ├── telegram-link-account
  ├── telegram-validate-miniapp
  ├── run-scheduled-reminders
  ├── run-monthly-report
  ├── get-proof-signed-url
  ├── create-qris-payment
  ├── midtrans-webhook
  ├── reconcile-payment-gateway
  ├── admin-invite-user
  └── generate-report-metadata
        │
        ├── Telegram Bot API
        └── Midtrans Core API / QRIS / webhooks
```

### 3.2 Stack decisions

Frontend:

- React 18 or newer supported by Vite.
- TypeScript.
- React Router for routes.
- TanStack Query for Supabase reads/mutations.
- Zod for validation.
- date-fns for date handling.
- jsPDF + jspdf-autotable for PDF receipts/reports.
- PapaParse for CSV import/export.
- qrcode.react or browser image rendering for QR display if Midtrans returns a raw QR string; if Midtrans returns QR image URL, display the URL directly.
- Vitest + Testing Library for unit/component tests.
- Playwright for E2E smoke tests.

Backend/serverless:

- Supabase Auth for identity.
- Supabase Postgres for business data.
- Supabase RLS for authorization.
- Supabase Storage private bucket for proof files and generated report files.
- Supabase Edge Functions for Telegram, Midtrans, cron-triggered jobs, server-only admin actions, and signed URLs.
- Supabase Cron or pg_cron + pg_net for scheduled jobs.

Do not add a Java backend for the first production version. It is valid long-term, but unnecessary for this scope. Supabase Edge Functions are enough and reduce moving parts.

---

## 4. Business vocabulary and canonical statuses

Use these canonical internal names. Do not invent alternatives.

### 4.1 Roles

```text
resident      Warga / resident. Can view own kavling and submit payment proof.
treasurer     Bendahara. Can verify/reject payments, export reports, see financial details.
admin         Pengurus. Can manage residents, kavlings, periods, fees, imports, reports.
super_admin   Technical/business owner. Can manage roles and global settings.
```

### 4.2 Billing period statuses

```text
draft     Period created but invoices not generated/opened.
open      Residents can pay.
closed    Period locked for normal edits.
archived  Historical only.
```

### 4.3 Invoice statuses

```text
unpaid                No valid payment submitted or verified.
pending_verification  Manual proof submitted; awaiting treasurer/admin check.
partial               Some amount verified but not fully paid.
paid                  Fully paid.
rejected              Latest manual submission rejected and no full payment exists.
waived                Admin waived invoice.
cancelled             Invoice cancelled due to mistake/replacement.
overdue               Derived status when unpaid/pending after due date. Store as status only when cron materializes it; otherwise compute in views.
```

### 4.4 Payment submission statuses

```text
submitted  Resident uploaded proof.
verified   Treasurer/admin accepted proof.
rejected   Treasurer/admin rejected proof.
cancelled  Submission cancelled by admin.
```

### 4.5 Payment gateway transaction statuses

```text
created
pending
settlement
capture
deny
cancel
expire
failure
refund
unknown
```

Map Midtrans `settlement` to successful paid. Map `capture` to successful paid only when `fraud_status` is missing or `accept`.

### 4.6 Notification statuses

```text
queued
sent
failed
skipped
```

---

## 5. Environment variables and secrets

### 5.1 Browser `.env.local`

Only public-safe values:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon-or-publishable-key>"
VITE_APP_NAME="IPL Jatiloka Residence"
VITE_PUBLIC_DASHBOARD_MODE="aggregate" # aggregate | kavling_status
VITE_ENABLE_MIDTRANS_QRIS="false"
VITE_TELEGRAM_BOT_USERNAME="<bot_username_without_at>"
```

Do not place bot token, service role key, Midtrans server key, or webhook secret here.

### 5.2 Supabase Edge Function secrets

Set with `supabase secrets set` or dashboard:

```bash
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
APP_BASE_URL="https://<deployed-app-domain>"
APP_INTERNAL_CRON_SECRET="<random-32-plus-char-secret>"
TELEGRAM_BOT_TOKEN="<bot-token-from-BotFather>"
TELEGRAM_WEBHOOK_SECRET="<random-32-plus-char-secret>"
TELEGRAM_ADMIN_CHAT_ID="<optional-admin-group-or-private-chat-id>"
MIDTRANS_ENV="sandbox" # sandbox | production
MIDTRANS_SERVER_KEY="<server-key>"
MIDTRANS_CLIENT_KEY="<client-key-if-needed>"
MIDTRANS_NOTIFICATION_URL="https://<project-ref>.supabase.co/functions/v1/midtrans-webhook"
```

### 5.3 Git ignore

Ensure these are ignored:

```text
.env
.env.local
.env.*.local
supabase/functions/.env
supabase/.branches
```

---

## 6. Repository structure target

Refactor the app to this structure:

```text
.
├── CODEx_MASTER_PLAN.md                  # this file
├── README.md
├── DEPLOYMENT.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── public/
│   ├── manifest.webmanifest
│   ├── icons/
│   └── robots.txt
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── app/
│   │   ├── router.tsx
│   │   ├── queryClient.ts
│   │   └── constants.ts
│   ├── components/
│   │   ├── layout/
│   │   ├── forms/
│   │   ├── feedback/
│   │   ├── tables/
│   │   └── charts/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── kavlings/
│   │   ├── billing/
│   │   ├── payments/
│   │   ├── reports/
│   │   ├── telegram/
│   │   ├── imports/
│   │   ├── settings/
│   │   └── audit/
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   ├── format.ts
│   │   ├── date.ts
│   │   ├── validation.ts
│   │   ├── csv.ts
│   │   ├── pdf.ts
│   │   └── errors.ts
│   ├── styles/
│   │   └── global.css
│   └── test/
│       ├── setup.ts
│       └── fixtures.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_extensions_and_types.sql
│   │   ├── 0002_tables.sql
│   │   ├── 0003_indexes.sql
│   │   ├── 0004_rls_helpers.sql
│   │   ├── 0005_rls_policies.sql
│   │   ├── 0006_storage.sql
│   │   ├── 0007_seed_initial_data.sql
│   │   └── 0008_cron_jobs.sql
│   └── functions/
│       ├── _shared/
│       │   ├── cors.ts
│       │   ├── env.ts
│       │   ├── supabase.ts
│       │   ├── auth.ts
│       │   ├── telegram.ts
│       │   ├── telegramMiniApp.ts
│       │   ├── midtrans.ts
│       │   ├── money.ts
│       │   └── responses.ts
│       ├── telegram-webhook/index.ts
│       ├── telegram-send-notification/index.ts
│       ├── telegram-link-account/index.ts
│       ├── telegram-validate-miniapp/index.ts
│       ├── run-scheduled-reminders/index.ts
│       ├── run-monthly-report/index.ts
│       ├── get-proof-signed-url/index.ts
│       ├── create-qris-payment/index.ts
│       ├── midtrans-webhook/index.ts
│       ├── reconcile-payment-gateway/index.ts
│       ├── admin-invite-user/index.ts
│       └── generate-report-metadata/index.ts
├── tests/
│   ├── e2e/
│   ├── edge-functions/
│   └── sql/
└── docs/
    ├── TELEGRAM_BOT_SETUP.md
    ├── MIDTRANS_QRIS_SETUP.md
    ├── SECURITY.md
    └── DATA_DICTIONARY.md
```

---

## 7. Package changes

Update dependencies. Exact versions can be latest compatible with Vite/React at implementation time, but the package set must include these libraries unless Codex finds a hard incompatibility.

```bash
npm install @supabase/supabase-js @tanstack/react-query react-router-dom zod date-fns papaparse jspdf jspdf-autotable qrcode.react clsx
npm install -D typescript @types/react @types/react-dom @types/papaparse vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event playwright eslint prettier
```

Required scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "functions:serve": "supabase functions serve --env-file supabase/functions/.env"
  }
}
```

---

## 8. Database design

### 8.1 Extensions and enums

Create `supabase/migrations/0001_extensions_and_types.sql`.

```sql
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "pg_net";
create extension if not exists "pg_cron";

create type app_role as enum ('resident', 'treasurer', 'admin', 'super_admin');
create type billing_period_status as enum ('draft', 'open', 'closed', 'archived');
create type invoice_status as enum ('unpaid', 'pending_verification', 'partial', 'paid', 'rejected', 'waived', 'cancelled', 'overdue');
create type submission_status as enum ('submitted', 'verified', 'rejected', 'cancelled');
create type gateway_status as enum ('created', 'pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'failure', 'refund', 'unknown');
create type notification_channel as enum ('telegram');
create type notification_status as enum ('queued', 'sent', 'failed', 'skipped');
create type report_type as enum ('monthly_summary', 'receipt', 'arrears', 'kavling_history');
create type import_status as enum ('draft', 'validated', 'applied', 'failed', 'cancelled');
```

### 8.2 Core tables

Create `supabase/migrations/0002_tables.sql`.

Use `bigint` for Telegram IDs. Do not use JavaScript `number` for Telegram IDs in frontend business logic because Telegram IDs may be large. Store and pass them as strings in TypeScript where needed.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  display_name text,
  phone text,
  email text,
  role app_role not null default 'resident',
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
  unique(profile_id)
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
  relation text not null default 'owner', -- owner, tenant, family, representative
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(kavling_id, profile_id)
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
  unique(kavling_id, fee_type_id, active_from)
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
  status billing_period_status not null default 'draft',
  opened_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(year, month)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references public.billing_periods(id) on delete cascade,
  kavling_id uuid not null references public.kavlings(id),
  invoice_number text not null unique,
  amount_due integer not null default 0 check (amount_due >= 0),
  amount_paid integer not null default 0 check (amount_paid >= 0),
  status invoice_status not null default 'unpaid',
  due_date date not null,
  paid_at timestamptz,
  waived_at timestamptz,
  waived_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(billing_period_id, kavling_id)
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
  unique(invoice_id, penalty_rule_id)
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
  status submission_status not null default 'submitted',
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
  method text not null, -- manual_transfer, midtrans_qris, adjustment, waiver
  paid_at timestamptz not null default now(),
  verified_by uuid references public.profiles(id),
  external_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create unique index payments_unique_submission
on public.payments(payment_submission_id)
where payment_submission_id is not null;

create unique index payments_unique_external_reference
on public.payments(method, external_reference)
where external_reference is not null;

create table public.payment_gateway_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null default 'midtrans',
  provider_order_id text not null unique,
  provider_transaction_id text,
  amount integer not null check (amount > 0),
  status gateway_status not null default 'created',
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
  actor_role app_role,
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
  channel notification_channel not null default 'telegram',
  title text not null,
  body_template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  channel notification_channel not null default 'telegram',
  template_code text,
  profile_id uuid references public.profiles(id),
  telegram_chat_id bigint,
  related_invoice_id uuid references public.invoices(id),
  related_submission_id uuid references public.payment_submissions(id),
  status notification_status not null default 'queued',
  message_text text not null,
  telegram_message_id bigint,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  report_type report_type not null,
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
  import_type text not null, -- kavlings, residents, fee_overrides, opening_balances
  status import_status not null default 'draft',
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
```

### 8.3 Indexes

Create `supabase/migrations/0003_indexes.sql`.

```sql
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
```

If overlapping fee override date ranges are allowed by the table shape, implementation must add either an exclusion constraint or an admin/RPC validation that rejects overlapping active ranges for the same `kavling_id` and `fee_type_id`.

### 8.4 Updated timestamp trigger

Add to `0002_tables.sql` or a separate migration.

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
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
```

---

## 9. Database business functions

Create `supabase/migrations/0004_rls_helpers.sql` and add these helper functions.

### 9.1 Auth helpers

```sql
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active = true;
$$;

create or replace function public.has_role(roles app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = any(roles)
  );
$$;

create or replace function public.is_admin_like()
returns boolean
language sql
stable
as $$
  select public.has_role(array['treasurer'::app_role, 'admin'::app_role, 'super_admin'::app_role]);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.has_role(array['super_admin'::app_role]);
$$;

create or replace function public.can_access_kavling(target_kavling_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_like()
     or exists (
       select 1
       from public.kavling_residents kr
       where kr.kavling_id = target_kavling_id
         and kr.profile_id = auth.uid()
         and kr.active = true
     );
$$;
```

### 9.2 Invoice number generator

```sql
create or replace function public.generate_invoice_number(period_year integer, period_month integer, kavling_code text)
returns text
language sql
immutable
as $$
  select 'IPL-' || period_year::text || '-' || lpad(period_month::text, 2, '0') || '-' || regexp_replace(upper(kavling_code), '[^A-Z0-9]+', '', 'g');
$$;
```

### 9.3 Generate monthly invoices

This function must be called by an authenticated admin-like user. If an Edge Function uses `service_role`, it must first verify the caller JWT, derive an explicit admin `actor_id`, and call a server-side variant that checks that actor. Do not call this RPC with a naked service-role client and expect `auth.uid()` to represent the admin.

```sql
create or replace function public.generate_invoices_for_period(target_period_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.billing_periods%rowtype;
  created_count integer := 0;
  kav record;
  fee record;
  new_invoice_id uuid;
  resolved_amount integer;
begin
  if not public.is_admin_like() then
    raise exception 'not authorized';
  end if;

  select * into period_row from public.billing_periods where id = target_period_id;
  if not found then
    raise exception 'billing period not found';
  end if;

  if period_row.status not in ('draft', 'open') then
    raise exception 'billing period must be draft/open';
  end if;

  for kav in select * from public.kavlings where active = true order by sort_order, code loop
    insert into public.invoices (
      billing_period_id,
      kavling_id,
      invoice_number,
      amount_due,
      due_date,
      status
    ) values (
      period_row.id,
      kav.id,
      public.generate_invoice_number(period_row.year, period_row.month, kav.code),
      0,
      period_row.due_date,
      'unpaid'
    )
    on conflict (billing_period_id, kavling_id) do nothing
    returning id into new_invoice_id;

    if new_invoice_id is not null then
      created_count := created_count + 1;

      for fee in select * from public.fee_types where active = true and is_recurring = true and is_penalty = false order by sort_order, code loop
        select coalesce((
          select kfo.amount
          from public.kavling_fee_overrides kfo
          where kfo.kavling_id = kav.id
            and kfo.fee_type_id = fee.id
            and (kfo.active_from is null or kfo.active_from <= make_date(period_row.year, period_row.month, 1))
            and (kfo.active_until is null or kfo.active_until >= make_date(period_row.year, period_row.month, 1))
          order by kfo.active_from desc nulls last
          limit 1
        ), fee.default_amount) into resolved_amount;

        insert into public.invoice_items (invoice_id, fee_type_id, description, amount, sort_order)
        values (new_invoice_id, fee.id, fee.name, resolved_amount, fee.sort_order);
      end loop;

      update public.invoices
      set amount_due = coalesce((
        select sum(ii.amount)
        from public.invoice_items ii
        where ii.invoice_id = new_invoice_id
      ), 0)
      where public.invoices.id = new_invoice_id;
    end if;

    new_invoice_id := null;
  end loop;

  update public.billing_periods
  set status = 'open', opened_at = coalesce(opened_at, now())
  where id = target_period_id;

  return created_count;
end;
$$;
```

Implementation must keep this function free of variable shadowing. `supabase db reset` and SQL tests must fail the milestone if invoice item totals do not become invoice `amount_due`.

### 9.4 Recalculate invoice status

```sql
create or replace function public.recalculate_invoice_status(target_invoice_id uuid)
returns invoice_status
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  total_paid integer;
  pending_count integer;
  new_status invoice_status;
begin
  select * into invoice_row from public.invoices where id = target_invoice_id;
  if not found then
    raise exception 'invoice not found';
  end if;

  if invoice_row.status in ('waived', 'cancelled') then
    return invoice_row.status;
  end if;

  select coalesce(sum(amount), 0) into total_paid
  from public.payments
  where invoice_id = target_invoice_id;

  select count(*) into pending_count
  from public.payment_submissions
  where invoice_id = target_invoice_id
    and status = 'submitted';

  if total_paid >= invoice_row.amount_due then
    new_status := 'paid';
  elsif total_paid > 0 then
    new_status := 'partial';
  elsif pending_count > 0 then
    new_status := 'pending_verification';
  elsif invoice_row.due_date < current_date then
    new_status := 'overdue';
  else
    new_status := 'unpaid';
  end if;

  update public.invoices
  set status = new_status,
      amount_paid = total_paid,
      paid_at = case when new_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where id = target_invoice_id;

  return new_status;
end;
$$;
```

### 9.5 Verify/reject manual payment

Use database functions or Edge Functions for these actions. Recommended: authenticated frontend or Edge Function verifies the caller JWT, then calls RPC to keep transition logic central. If an Edge Function uses `service_role`, it must pass an explicit verified `actor_id` into a server-side variant; do not depend on `auth.uid()` being populated under service role.

```sql
create or replace function public.verify_payment_submission(target_submission_id uuid, admin_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.payment_submissions%rowtype;
  payment_id uuid;
begin
  if not public.is_admin_like() then
    raise exception 'not authorized';
  end if;

  select * into submission_row
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
  where id = target_submission_id;

  insert into public.payments (
    invoice_id,
    payment_submission_id,
    amount,
    method,
    paid_at,
    verified_by,
    notes
  ) values (
    submission_row.invoice_id,
    submission_row.id,
    submission_row.amount_submitted,
    'manual_transfer',
    now(),
    auth.uid(),
    admin_note
  ) returning id into payment_id;

  perform public.recalculate_invoice_status(submission_row.invoice_id);
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
begin
  if not public.is_admin_like() then
    raise exception 'not authorized';
  end if;

  if reason is null or length(trim(reason)) < 3 then
    raise exception 'rejection reason is required';
  end if;

  select * into submission_row
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
  set status = 'rejected',
      rejection_reason = reason,
      rejected_by = auth.uid(),
      rejected_at = now()
  where id = target_submission_id;

  perform public.recalculate_invoice_status(submission_row.invoice_id);
end;
$$;
```

---

## 10. RLS policy requirements

Create `supabase/migrations/0005_rls_policies.sql`.

### 10.1 Enable RLS on every public table

```sql
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
```

### 10.2 Policy matrix

Implement these exact rules.

| Table | Resident | Treasurer | Admin | Super admin | Public anon |
|---|---|---|---|---|---|
| profiles | select own | select residents, update limited | manage residents except super_admin | manage all | none |
| telegram_accounts | select/update own notification pref | select all | select all | manage all | none |
| kavlings | select active kavlings or own detail | select all | manage | manage | public aggregate view only |
| kavling_residents | select own mapping | select all | manage | manage | none |
| fee_types | select active | select all | manage | manage | public active fee summary optional |
| billing_periods | select open/closed | select all | manage | manage | public current period only through view |
| invoices | select own | select all | manage | manage | none |
| invoice_items | select own invoice items | select all | manage | manage | none |
| invoice_penalties | select own invoice penalties | select all | manage | manage | none |
| payment_submissions | insert own invoice, select own | manage all | manage all | manage all | none |
| payments | select own invoice payments | select all | select all | manage all | none |
| gateway_transactions | select own invoice tx | select all | manage | manage | none |
| audit_logs | none | select | select | select | none |
| notification_deliveries | select own | select all | select all | manage | none |
| reports | select own receipt, admin report only admin | select all | manage | manage | none |
| import_jobs | none | select | manage | manage | none |

### 10.3 Example policies

Codex must implement full policy set using the matrix above. At minimum include these:

```sql
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin_like());

-- Do not allow direct resident profile updates for production.
-- RLS cannot reliably restrict updated columns. Expose an RPC such as
-- public.update_own_profile(display_name, phone) for resident-editable fields.
-- Admin/super_admin profile changes must go through admin RPC/Edge Function
-- with explicit role-change checks and audit logs.

create policy "profiles_admin_manage"
on public.profiles for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "kavlings_select_authenticated"
on public.kavlings for select
to authenticated
using (active = true or public.is_admin_like());

create policy "kavlings_admin_manage"
on public.kavlings for all
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

-- Production implementation should prefer an RPC/Edge Function for resident
-- submission creation so amount <= outstanding, proof upload cleanup, status
-- recalculation, Telegram notification, and audit behavior happen atomically.

create policy "payment_submissions_admin_update"
on public.payment_submissions for update
to authenticated
using (public.is_admin_like())
with check (public.is_admin_like());

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

create policy "payments_admin_insert"
on public.payments for insert
to authenticated
with check (public.is_admin_like());

create policy "audit_logs_select_admin"
on public.audit_logs for select
to authenticated
using (public.is_admin_like());
```

### 10.4 Public dashboard view

Do not grant anon access to tables. Create a safe public publishing surface for aggregate dashboard only.

Important: a `security_invoker` view over tables protected from anon may return no rows or fail for anon. For production, implement the public dashboard as one of:

1. A `security definer` SQL function that returns only aggregate/public fields and sets a locked `search_path`.
2. A materialized/public summary table refreshed by trusted jobs.
3. Tightly scoped anon policies that expose only the exact rows/columns needed by the public views.

Do not ship the public dashboard until anon access is tested with the anon key and cannot read private tables directly.

```sql
create or replace view public.public_period_summary
with (security_invoker = true)
as
select
  bp.id as billing_period_id,
  bp.year,
  bp.month,
  bp.label,
  bp.due_date,
  count(i.id)::integer as total_invoices,
  count(*) filter (where i.status = 'paid')::integer as paid_count,
  count(*) filter (where i.status in ('unpaid', 'overdue', 'pending_verification', 'partial', 'rejected'))::integer as unpaid_count,
  coalesce(sum(i.amount_due), 0)::integer as total_amount_due,
  coalesce(sum(i.amount_paid), 0)::integer as total_amount_paid
from public.billing_periods bp
left join public.invoices i on i.billing_period_id = bp.id
where bp.status in ('open', 'closed')
group by bp.id, bp.year, bp.month, bp.label, bp.due_date;
```

Grant anon select on this view only after the chosen access pattern above is implemented and tested. The view must not be treated as private-data protection by itself.

Optional public kavling status view if the community explicitly wants per-kavling transparency. It must not include resident names, proof links, notes, timestamps, phone, or nominal paid.

```sql
create or replace view public.public_kavling_status
with (security_invoker = true)
as
select
  bp.year,
  bp.month,
  k.code as kavling_code,
  case when i.status = 'paid' then 'paid' else 'not_paid' end as public_status
from public.billing_periods bp
join public.invoices i on i.billing_period_id = bp.id
join public.kavlings k on k.id = i.kavling_id
where bp.status in ('open', 'closed')
  and k.active = true;
```

Feature flag frontend with `VITE_PUBLIC_DASHBOARD_MODE`:

- `aggregate`: show only totals.
- `kavling_status`: show paid/not-paid per kavling without proof/amount/name.

---

## 11. Storage design

Create `supabase/migrations/0006_storage.sql`.

### 11.1 Buckets

Required buckets:

```text
payment-proofs  private
report-files     private
```

SQL setup:

```sql
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('report-files', 'report-files', false)
on conflict (id) do update set public = false;
```

### 11.2 Payment proof object path format

```text
proofs/{auth_uid}/{invoice_id}/{submission_id}.{ext}
```

Allowed MIME types:

```text
image/jpeg
image/png
image/webp
application/pdf
```

Max size:

```text
5 MB
```

### 11.3 Storage RLS

```sql
create policy "payment_proofs_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = 'proofs'
  and (storage.foldername(name))[2] = (auth.uid())::text
);

create policy "payment_proofs_select_owner_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    owner_id = auth.uid()
    or public.is_admin_like()
  )
);

create policy "payment_proofs_delete_admin_only"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin_like()
);

create policy "report_files_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-files'
  and public.is_admin_like()
);

create policy "report_files_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-files'
  and public.is_admin_like()
);
```

### 11.4 Signed URL Edge Function

Do not call `getPublicUrl` for proof files. Implement `get-proof-signed-url`:

Request:

```json
{
  "submissionId": "uuid"
}
```

Response:

```json
{
  "signedUrl": "https://...",
  "expiresInSeconds": 300
}
```

Rules:

- User must be authenticated.
- User can access proof if:
  - user is admin-like; or
  - submission belongs to an invoice for a kavling linked to the user.
- URL expiration: 300 seconds.
- Log access in `audit_logs` for admin-like access. Resident own access can be logged optionally.

---

## 12. Seed data

Create `supabase/migrations/0007_seed_initial_data.sql`.

### 12.1 Kavlings

Seed current kavling list:

```sql
insert into public.kavlings (code, sort_order) values
('Kav 1', 1),
('Kav 2', 2),
('Kav 3A', 3),
('Kav 3B', 4),
('Kav 5', 5),
('Kav 6', 6),
('Kav 7', 7),
('Kav 8', 8),
('Kav 9', 9),
('Kav 10', 10),
('Kav 11', 11),
('Kav 12', 12),
('Kav 15A', 13),
('Kav 15B', 14),
('Kav 16', 15),
('Kav 17', 16),
('Kav 18', 17),
('Kav 19', 18),
('Kav 20', 19),
('Kav 21', 20),
('Kav 22', 21),
('Kav 23A', 22),
('Kav 23B', 23),
('Kav 25', 24),
('Kav 26', 25),
('Kav 27', 26),
('Kav 28', 27),
('Kav 30', 28),
('Kav 31', 29),
('Kav 32A', 30),
('Kav 32B', 31),
('Kav 35', 32),
('Kav 36', 33),
('Kav 37', 34)
on conflict (code) do update set sort_order = excluded.sort_order;
```

### 12.2 Fee types

Seed defaults. Amounts must be configurable later; choose safe placeholder defaults and document that admin must review before generating production invoices.

```sql
insert into public.fee_types (code, name, description, default_amount, is_recurring, is_penalty, sort_order) values
('IPL', 'IPL', 'Iuran Pengelolaan Lingkungan', 350000, true, false, 1),
('SECURITY', 'Keamanan', 'Iuran keamanan lingkungan', 0, true, false, 2),
('CLEANING', 'Kebersihan', 'Iuran kebersihan lingkungan', 0, true, false, 3),
('SINKING_FUND', 'Sinking Fund', 'Dana cadangan/perawatan', 0, true, false, 4),
('EVENT', 'Iuran Event', 'Iuran kegiatan khusus', 0, false, false, 5),
('PENALTY', 'Denda', 'Denda keterlambatan pembayaran', 0, false, true, 99)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;
```

### 12.3 Notification templates

No WhatsApp wording.

```sql
insert into public.notification_templates (code, channel, title, body_template) values
('resident_invoice_created', 'telegram', 'Tagihan baru', 'Halo {{name}}, tagihan {{period_label}} untuk {{kavling_code}} sudah terbit. Total: Rp {{amount_due}}. Jatuh tempo: {{due_date}}.'),
('resident_payment_pending', 'telegram', 'Bukti pembayaran diterima', 'Bukti pembayaran {{kavling_code}} untuk {{period_label}} sudah diterima dan menunggu verifikasi bendahara.'),
('resident_payment_verified', 'telegram', 'Pembayaran terverifikasi', 'Pembayaran {{kavling_code}} untuk {{period_label}} sudah diverifikasi. Terima kasih.'),
('resident_payment_rejected', 'telegram', 'Bukti pembayaran ditolak', 'Bukti pembayaran {{kavling_code}} untuk {{period_label}} ditolak. Alasan: {{reason}}.'),
('resident_payment_reminder', 'telegram', 'Pengingat IPL', 'Pengingat: tagihan {{period_label}} untuk {{kavling_code}} masih {{status}}. Total: Rp {{amount_due}}. Jatuh tempo: {{due_date}}.'),
('admin_pending_submission', 'telegram', 'Bukti baru menunggu verifikasi', '{{kavling_code}} mengirim bukti pembayaran {{period_label}} sebesar Rp {{amount_submitted}}.'),
('admin_monthly_summary', 'telegram', 'Ringkasan bulanan IPL', 'Ringkasan {{period_label}}: {{paid_count}}/{{total_count}} lunas. Total diterima Rp {{total_paid}}. Tunggakan Rp {{total_unpaid}}.')
on conflict (code) do update set
  title = excluded.title,
  body_template = excluded.body_template,
  active = true;
```

---

## 13. Frontend routes and UX requirements

### 13.1 Route map

```text
/                         Public dashboard
/login                    Login
/auth/callback             Supabase auth callback if needed
/app                      Resident home
/app/invoices             Resident invoices
/app/invoices/:invoiceId  Invoice detail and payment submission
/app/history              Resident payment history
/app/telegram             Link Telegram account
/admin                    Admin dashboard
/admin/kavlings           Kavling management
/admin/residents          Resident management
/admin/billing            Billing periods and invoice generation
/admin/billing/:periodId  Period detail, invoices, status
/admin/submissions        Pending/verified/rejected manual submissions
/admin/reports            CSV/PDF reports
/admin/import             Bulk import
/admin/settings           Bank account, fee types, penalty rules, notification settings
/admin/audit              Audit log
```

### 13.2 Public dashboard

Modes:

- `aggregate`: show only progress, paid count, unpaid count, total invoice count, due date.
- `kavling_status`: show per-kavling paid/not-paid, no proof, no name, no nominal, no notes.

Required UI:

- Current period summary.
- Month/year selector from `billing_periods`, not hard-coded years.
- Progress bar.
- CTA: `Masuk untuk lihat tagihan saya`.
- Optional public status grid if configured.
- No proof links.

### 13.3 Login

Minimum acceptable auth:

- Supabase email magic link or email/password.
- Admin can invite residents through admin function.
- A resident can only see invoices for linked kavlings.

Avoid phone OTP unless the Supabase project has SMS provider configured. Do not invent SMS setup.

### 13.4 Resident home

Show:

- User name.
- Linked kavling(s).
- Current open period invoice(s).
- Status chips.
- `Bayar / Upload Bukti` button for unpaid/overdue/rejected/partial invoices.
- `Menunggu Verifikasi` badge for pending.
- `Cetak Bukti Lunas` button for paid.
- Telegram link status.

### 13.5 Invoice detail

Show:

- Period label.
- Kavling code.
- Due date.
- Invoice status.
- Itemized fee lines.
- Amount due.
- Amount paid.
- Outstanding amount.
- Manual bank transfer section.
- Optional QRIS section if `VITE_ENABLE_MIDTRANS_QRIS=true` and backend gateway is configured.
- Submission history.
- Payment history.

Manual proof form:

- Amount: integer, required, min 1, max outstanding unless admin override. Resident cannot submit more than outstanding without warning.
- Bank account: selected default.
- Proof file: required for resident manual transfer.
- Note: optional, max 500 chars.
- File validation: MIME type and size before upload.
- On submit:
  1. Call an RPC/Edge Function to validate invoice access and amount against outstanding balance.
  2. Create `payment_submissions` row with status `submitted`.
  3. Upload proof to private bucket path using submission ID.
  4. Update submission with `proof_path`, MIME type, size through RPC/Edge Function.
  5. Recalculate invoice status to `pending_verification`.
  6. Send resident Telegram confirmation if linked.
  7. Send admin Telegram notification if admin chat configured.

Important: if upload fails after row creation, mark submission cancelled or delete the submission inside a safe cleanup. Do not leave broken pending submissions without proof.

### 13.6 Admin dashboard

Show:

- Current period summary.
- Paid/unpaid/pending/rejected counts.
- Total billed.
- Total received.
- Outstanding amount.
- Pending verifications.
- Top overdue kavlings.
- Quick actions:
  - Create/open billing period.
  - Verify submissions.
  - Send Telegram reminders.
  - Export report.

### 13.7 Kavling management

CRUD fields:

- Code.
- Block.
- Sort order.
- Active.
- Notes.
- Linked residents.

Rules:

- Cannot delete kavling with invoices. Use inactive.
- Sort order controls dashboard order.

### 13.8 Resident management

Admin can:

- Create/invite resident.
- Edit full name, display name, phone, email.
- Assign role.
- Link/unlink kavling.
- Mark primary resident.
- Disable account.

Super admin only:

- Assign `super_admin`.
- Downgrade `super_admin`.

### 13.9 Billing management

Admin can:

- Create billing period with year/month/due date.
- Generate invoices for all active kavlings.
- Add one-off event contribution to selected or all kavlings.
- Open/close period.
- View invoices by status.
- Waive/cancel invoices with reason.
- Apply penalty rules.

Rules:

- Year/month comes from period table.
- No hard-coded `[2025, 2026, 2027]`.
- Due date must be a real date, not `30 ${month}` text.
- Once closed, only admin/super_admin can modify with audit reason.

### 13.10 Submission verification

Admin/treasurer can:

- See pending submissions.
- Open signed proof URL.
- Approve with optional note.
- Reject with required reason.
- Verify amount.
- See duplicate submissions for same invoice.

On approve:

- Call `verify_payment_submission` RPC.
- Send Telegram notification to resident.
- Log audit.

On reject:

- Call `reject_payment_submission` RPC.
- Send Telegram notification to resident.
- Log audit.

### 13.11 Reports

Reports page must support:

1. Current month CSV export.
2. All data CSV export.
3. Monthly PDF report.
4. Receipt PDF per paid invoice.
5. Arrears/tunggakan report.
6. Kavling history report.

CSV columns for monthly export:

```text
period_label,year,month,kavling_code,invoice_number,status,amount_due,amount_paid,outstanding,due_date,paid_at,submission_count,last_submission_status
```

CSV columns for all payments export:

```text
payment_id,period_label,kavling_code,invoice_number,amount,method,paid_at,verified_by,external_reference,notes
```

PDF monthly report sections:

- Title.
- Period.
- Generated at.
- Generated by.
- Summary cards.
- Paid table.
- Pending table.
- Overdue table.
- Total amounts.
- Notes/disclaimer.

Receipt PDF fields:

- Receipt number: `RCPT-{year}-{month}-{kavling_code}-{payment_id_short}`.
- Kavling.
- Period.
- Invoice number.
- Fee items.
- Amount paid.
- Payment method.
- Paid/verified timestamp.
- Treasurer/admin verifier.
- App name.

### 13.12 PWA

Implement:

- `public/manifest.webmanifest`.
- App icon placeholders.
- Mobile safe viewport.
- Service worker registration.
- Cache shell assets only.
- Do not cache authenticated API responses or proof files.
- Add install hint: `Install aplikasi`.

PWA must not break Supabase auth callback.

---

## 14. Telegram bot integration

### 14.1 Telegram role in the product

Telegram replaces all WhatsApp-related ideas.

Telegram must be used for:

- Reminder messages.
- Resident invoice/status commands.
- Resident payment confirmation notifications.
- Admin pending-submission alerts.
- Monthly admin summary.
- Optional link button to the app or Telegram Mini App.

Telegram must not be used to expose private proof images in group chats. If sending proof to admin is desired, send only a secure app link, not raw proof files.

### 14.2 Bot setup

Docs file: `docs/TELEGRAM_BOT_SETUP.md` must include:

1. Create bot with BotFather.
2. Save `TELEGRAM_BOT_TOKEN` as Supabase secret.
3. Generate `TELEGRAM_WEBHOOK_SECRET`.
4. Deploy `telegram-webhook` Edge Function.
5. Set webhook:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<project-ref>.supabase.co/functions/v1/telegram-webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query", "my_chat_member"],
    "drop_pending_updates": true
  }'
```

6. Configure bot menu button to app URL if desired.
7. Configure commands list:

```text
start - Mulai dan hubungkan akun
help - Bantuan
status - Ringkasan status IPL saya
tagihanku - Lihat tagihan bulan ini
riwayat - Riwayat pembayaran saya
link - Hubungkan akun Telegram
unlink - Putuskan akun Telegram
settings - Pengaturan notifikasi
admin - Ringkasan admin, khusus pengurus
```

### 14.3 Account linking

Do not rely on Telegram username as identity.

Use one of these flows. Implement Flow A first.

#### Flow A: App-generated one-time token

1. Resident logs into web app.
2. Resident opens `/app/telegram`.
3. App calls Edge Function `telegram-link-account` to create one-time token.
4. Function stores SHA-256 hash in `telegram_link_tokens`, expires in 15 minutes.
5. App shows deep link:

```text
https://t.me/<bot_username>?start=link_<plain_token>
```

6. Resident opens bot link.
7. Telegram sends `/start link_<plain_token>` to webhook.
8. Webhook hashes token, finds unexpired row, links `telegram_user_id` and `telegram_chat_id` to profile.
9. Mark token consumed.
10. Send confirmation message.

Security rules:

- Token length: at least 32 random bytes, base64url encoded.
- Store only token hash.
- Token one-time use.
- Expire after 15 minutes.
- If token invalid/expired, bot says to generate a new link from the app.

#### Flow B: Telegram Mini App validation

Optional later. If implemented:

- Include Telegram WebApp script in app.
- Send `window.Telegram.WebApp.initData` to Edge Function.
- Edge Function validates HMAC with bot token.
- Then link or authenticate based on validated Telegram user ID.
- Never trust `initDataUnsafe` directly.

### 14.4 Bot commands

Implement in `telegram-webhook`.

#### `/start`

Behavior:

- If command has `link_<token>`, run linking flow.
- If user already linked, greet by name and show menu buttons.
- If not linked, explain that user must log into app and link Telegram first.

Reply buttons:

```json
{
  "inline_keyboard": [
    [{ "text": "Buka Aplikasi", "url": "${APP_BASE_URL}/app" }],
    [{ "text": "Bantuan", "callback_data": "help" }]
  ]
}
```

#### `/help`

Return concise command list.

#### `/status`

If linked:

- Query open/current period invoices for user’s kavlings.
- Return summary:

```text
Status IPL {{period_label}}
{{kavling_code}}: {{status_label}} — Rp {{outstanding}}
```

Add inline button to app invoice page.

If not linked: ask to link account.

#### `/tagihanku`

Return itemized current invoice(s): fee lines, due date, outstanding.

#### `/riwayat`

Return latest 5 paid invoices/payments.

#### `/settings`

Inline buttons:

```text
Notifikasi: ON/OFF
Kirim pengingat test
```

Callback data:

```text
notif:on
notif:off
notif:test
```

#### `/unlink`

Ask confirmation with inline buttons:

```text
unlink:confirm
unlink:cancel
```

#### `/admin`

Only linked profiles with role `treasurer`, `admin`, `super_admin`.

Return current period summary:

```text
Admin IPL {{period_label}}
Lunas: {{paid_count}}/{{total_count}}
Pending verifikasi: {{pending_count}}
Tunggakan: {{overdue_count}}
Total masuk: Rp {{total_paid}}
```

Buttons:

```text
admin:pending
admin:send_reminders
admin:report
```

### 14.5 Callback query handling

Callback data must be short. Use IDs when needed.

Accepted callbacks:

```text
help
notif:on
notif:off
notif:test
unlink:confirm
unlink:cancel
admin:pending
admin:send_reminders
admin:report
invoice:<invoice_id>
pay:<invoice_id>
```

For callback actions that show an invoice or admin page, prefer app links instead of dumping private data in chat.

### 14.6 Telegram message templates

Implement template renderer:

```ts
type TemplateVars = Record<string, string | number | null | undefined>;
function renderTemplate(template: string, vars: TemplateVars): string;
```

Rules:

- Replace `{{key}}` with escaped string.
- Unknown variables become empty string.
- Use Indonesian date and rupiah formatting.
- Use Telegram-safe plain text. Avoid fragile Markdown formatting unless properly escaped.

### 14.7 `telegram-webhook` Edge Function

Path: `supabase/functions/telegram-webhook/index.ts`

Function config:

```toml
[functions.telegram-webhook]
verify_jwt = false
```

Required request validation:

- Read header `X-Telegram-Bot-Api-Secret-Token`.
- Compare to `TELEGRAM_WEBHOOK_SECRET` using constant-time comparison if possible.
- Reject missing/wrong header with `401`.
- Accept only POST.
- Parse Telegram update JSON.
- Respond quickly with 200 JSON `{ "ok": true }` after processing.
- Log errors but do not leak secrets.

Shared Telegram client:

```ts
async function telegramApi<T>(method: string, payload: unknown): Promise<T> {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(json)}`);
  return json as T;
}
```

### 14.8 Scheduled Telegram reminders

Implement `run-scheduled-reminders`.

Function config:

```toml
[functions.run-scheduled-reminders]
verify_jwt = false
```

Security:

- It is called by Supabase Cron or internal admin button.
- Require `Authorization: Bearer ${APP_INTERNAL_CRON_SECRET}` or `X-Internal-Secret` header.
- If invoked by admin from frontend, use a separate authenticated function that checks role and then calls reminder logic.

Reminder schedule:

- 7 days before due date.
- 3 days before due date.
- On due date morning.
- 3 days after due date if unpaid/overdue.
- Weekly after overdue until paid, max 4 overdue reminders per invoice per period.

Implement idempotency:

- Before sending, check `notification_deliveries` for same `template_code`, `profile_id`, `related_invoice_id`, and same date.
- Do not send duplicates on same day.

Recipients:

- Linked Telegram users with `allows_notifications = true`.
- Residents linked to the invoice kavling.
- Skip if invoice paid/waived/cancelled.

Message must include:

- Kavling code.
- Period label.
- Status.
- Outstanding amount.
- Due date.
- App link.

### 14.9 Monthly Telegram admin report

Implement `run-monthly-report`.

Trigger:

- Daily at 20:00 Asia/Jakarta on due date and final day of month; or manual from admin panel.

Send to:

- `TELEGRAM_ADMIN_CHAT_ID` if configured.
- Also individual treasurer/admin Telegram accounts if configured.

Include:

- Paid count.
- Pending verification count.
- Overdue count.
- Total billed.
- Total received.
- Outstanding.
- Link to admin report page.

Do not include proof links in Telegram group.

---

## 15. Payment gateway / QRIS plan

### 15.1 Feature flag

QRIS/payment gateway is required in the roadmap but must be feature-flagged.

Frontend:

```bash
VITE_ENABLE_MIDTRANS_QRIS=false
```

Backend:

```bash
MIDTRANS_ENV=sandbox
MIDTRANS_SERVER_KEY=...
```

Rules:

- If disabled, hide QRIS payment button and show manual transfer only.
- If enabled but secrets missing, show admin warning only; do not show broken resident UI.
- Manual bank transfer remains available even when QRIS is enabled.

### 15.2 Provider abstraction

Create shared provider interface:

```ts
export type CreatePaymentInput = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  customerName: string;
  customerEmail?: string | null;
};

export type CreatePaymentOutput = {
  provider: 'midtrans';
  providerOrderId: string;
  providerTransactionId?: string;
  status: 'created' | 'pending';
  paymentType: 'qris';
  qrString?: string;
  qrImageUrl?: string;
  raw: unknown;
};

export interface PaymentGatewayProvider {
  createQrisPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput>;
  verifyWebhook(payload: unknown): Promise<boolean>;
  normalizeWebhook(payload: unknown): NormalizedGatewayEvent;
}
```

### 15.3 Midtrans QRIS create payment

Function: `create-qris-payment`.

Request:

```json
{
  "invoiceId": "uuid"
}
```

Rules:

- Authenticated resident can create QRIS only for own accessible invoice.
- Admin/treasurer can create for any invoice.
- Invoice status must be `unpaid`, `overdue`, `partial`, or `rejected`.
- Amount is outstanding amount, not arbitrary resident input.
- Generate `provider_order_id` as:

```text
IPL-{YYYYMM}-{KAVLING_CODE_NORMALIZED}-{short_invoice_uuid}-{unix_seconds}
```

- Insert `payment_gateway_transactions` row before or after provider call with idempotency.
- If there is an existing pending QRIS transaction for the same invoice that has not expired, return it instead of creating a duplicate.
- Use Midtrans sandbox base URL when `MIDTRANS_ENV=sandbox`, production base URL when production.
- Use server key only in Edge Function.
- Include notification URL header if supported/needed.

Midtrans Core API request shape for QRIS:

```json
{
  "payment_type": "qris",
  "transaction_details": {
    "order_id": "IPL-202604-KAV1-abc123-171...",
    "gross_amount": 350000
  }
}
```

Persist raw response. Extract QR display value from `actions` if present. Codex must inspect the actual Midtrans QRIS response shape while implementing and map the correct `qr_string` or `qr_image_url` field. The DB schema supports both.

### 15.4 Midtrans webhook

Function: `midtrans-webhook`.

Function config:

```toml
[functions.midtrans-webhook]
verify_jwt = false
```

Rules:

- Accept POST only.
- Verify Midtrans `signature_key`:

```text
sha512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
```

- Find `payment_gateway_transactions.provider_order_id = order_id`.
- Store raw notification.
- Update gateway status.
- If transaction_status is `settlement`, create `payments` row and recalculate invoice.
- If transaction_status is `capture`, create payment only if fraud_status is missing or `accept`.
- If denied/cancelled/expired/failure, update gateway status but do not create payment.
- Idempotency: never create duplicate `payments` for the same external reference.
- Send Telegram notification to resident when paid.
- Send Telegram admin summary alert if configured.

### 15.5 Reconciliation

Function: `reconcile-payment-gateway`.

Rules:

- Admin-only or cron-secret only.
- Query pending/created gateway tx older than 15 minutes.
- Call Midtrans get-status API.
- Apply same normalization as webhook.
- Use when webhook is delayed or missed.

---

## 16. Bulk import plan

### 16.1 Import types

Implement CSV import for:

1. Kavlings.
2. Residents.
3. Kavling-resident mapping.
4. Fee overrides.
5. Opening balances / historical unpaid invoices.

### 16.2 UI flow

Route: `/admin/import`

Steps:

1. Choose import type.
2. Download sample CSV.
3. Upload CSV.
4. Parse client-side with PapaParse.
5. Validate rows with Zod.
6. Show preview:
   - valid rows
   - invalid rows
   - errors by row number
7. Admin confirms apply.
8. Write `import_jobs` row.
9. Apply inserts/updates through Edge Function or admin-only RPC.
10. Show result.

### 16.3 CSV specs

#### Kavlings CSV

```csv
code,block,sort_order,active,notes
Kav 1,A,1,true,
Kav 2,A,2,true,
```

Validation:

- `code` required.
- `sort_order` integer.
- `active` boolean.

#### Residents CSV

```csv
email,full_name,display_name,phone,role,is_active
resident1@example.com,Budi Santoso,Budi,08123456789,resident,true
```

Validation:

- `email` required for auth invite.
- `full_name` required.
- `role` default `resident`.
- Role must be one of app roles.
- Only super_admin can import admin/super_admin roles.

#### Mapping CSV

```csv
kavling_code,email,relation,is_primary,active
Kav 1,resident1@example.com,owner,true,true
```

Validation:

- Kavling must exist.
- Resident must exist or be included in same import batch.
- Only one primary resident per kavling preferred; warn if multiple.

#### Fee overrides CSV

```csv
kavling_code,fee_code,amount,active_from,active_until,notes
Kav 1,IPL,350000,2026-04-01,,
```

Validation:

- Amount integer >= 0.
- Date format ISO `YYYY-MM-DD`.
- Fee code must exist.

#### Opening balance CSV

```csv
kavling_code,year,month,fee_code,amount_due,amount_paid,status,notes
Kav 1,2025,12,IPL,350000,0,overdue,Saldo awal
```

Validation:

- Period generated or created if missing.
- Status valid.
- amount_paid <= amount_due unless admin confirms overpayment.

---

## 17. Reports and PDF generation details

### 17.1 Frontend PDF utility

Create `src/lib/pdf.ts`.

Functions:

```ts
export function generateReceiptPdf(input: ReceiptPdfInput): Blob;
export function generateMonthlyReportPdf(input: MonthlyReportPdfInput): Blob;
export function downloadBlob(blob: Blob, filename: string): void;
```

Use jsPDF and jspdf-autotable.

### 17.2 Receipt input type

```ts
export type ReceiptPdfInput = {
  appName: string;
  receiptNumber: string;
  invoiceNumber: string;
  kavlingCode: string;
  periodLabel: string;
  paidAt: string;
  verifiedBy: string;
  paymentMethod: string;
  items: Array<{ description: string; amount: number }>;
  amountDue: number;
  amountPaid: number;
  notes?: string | null;
};
```

### 17.3 Monthly report input type

```ts
export type MonthlyReportPdfInput = {
  appName: string;
  periodLabel: string;
  generatedAt: string;
  generatedBy: string;
  summary: {
    totalInvoices: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    totalAmountDue: number;
    totalAmountPaid: number;
    totalOutstanding: number;
  };
  rows: Array<{
    kavlingCode: string;
    status: string;
    amountDue: number;
    amountPaid: number;
    outstanding: number;
    paidAt?: string | null;
  }>;
};
```

### 17.4 Report file storage

For admin-generated reports, optionally store metadata in `reports`. Do not store every generated browser PDF unless explicitly saved by admin.

If storing report PDF:

- Upload to `report-files` private bucket.
- Path: `reports/{year}/{month}/{report_type}-{timestamp}.pdf`.
- Only admin-like roles can access.

---

## 18. Tunggakan / arrears feature

### 18.1 Admin dashboard query

Create a view:

```sql
create or replace view public.admin_arrears_view
with (security_invoker = true)
as
select
  k.id as kavling_id,
  k.code as kavling_code,
  count(i.id)::integer as unpaid_invoice_count,
  coalesce(sum(i.amount_due - i.amount_paid), 0)::integer as outstanding_amount,
  min(i.due_date) as oldest_due_date
from public.invoices i
join public.kavlings k on k.id = i.kavling_id
where i.status in ('unpaid', 'overdue', 'partial', 'rejected')
  and i.amount_due > i.amount_paid
group by k.id, k.code;
```

Do not expose this to anon.

### 18.2 UI

Route: `/admin/reports?tab=tunggakan` or admin dashboard widget.

Show:

- Kavling code.
- Oldest due period.
- Number of unpaid invoices.
- Outstanding amount.
- Button: send Telegram reminder.
- Button: view kavling history.

---

## 19. Penalty/denda feature

### 19.1 Penalty rules

Admin can configure:

- Days after due date.
- Fixed amount.
- Percent of invoice amount.
- Max amount.
- Active/inactive.

### 19.2 Applying penalties

Implement admin action and scheduled job.

Rules:

- Apply only to unpaid/partial/overdue invoices.
- Add an `invoice_items` row using fee type `PENALTY`.
- Do not duplicate same penalty rule for same invoice. The initial schema includes `invoice_penalties`:

```sql
create table public.invoice_penalties (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  penalty_rule_id uuid not null references public.penalty_rules(id),
  amount integer not null check (amount >= 0),
  applied_at timestamptz not null default now(),
  unique(invoice_id, penalty_rule_id)
);
```

- After adding penalty item, update invoice amount_due and recalculate status.
- Audit log every penalty application.

---

## 20. Audit log requirements

Sensitive actions must write `audit_logs`:

- Role change.
- Resident invite/create/update/deactivate.
- Kavling create/update/deactivate.
- Kavling-resident link/unlink.
- Fee type change.
- Fee override change.
- Billing period create/open/close/archive.
- Invoice generation.
- Invoice waive/cancel.
- Payment proof signed URL access by admin.
- Payment approve/reject.
- Manual payment insert.
- Reminder batch send.
- Import job apply.
- QRIS payment creation.
- Midtrans webhook status changes.

Audit format:

```ts
type AuditLogInput = {
  actorId: string | null;
  actorRole: 'resident' | 'treasurer' | 'admin' | 'super_admin' | null;
  action: string;
  entityTable: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  requestId?: string;
};
```

Edge Functions using service role must explicitly set `actorId` based on verified auth user, Telegram linked profile, or `null` for system jobs.

---

## 21. Security checklist

Implement and test these.

### 21.1 Browser and RLS

- Anon cannot select `profiles`, `invoices`, `payment_submissions`, `payments`, `telegram_accounts`, `audit_logs`.
- Resident cannot select neighbor invoice details.
- Resident cannot insert payment submission for neighbor invoice.
- Resident cannot update invoice status.
- Resident cannot verify/reject submission.
- Treasurer/admin can verify/reject submissions.
- Only super_admin can assign super_admin role.

### 21.2 Storage

- Payment proof bucket is private.
- `getPublicUrl` is never used for payment proof.
- Unauthenticated user cannot download proof file.
- Resident cannot download neighbor proof file.
- Admin can get signed URL.
- Signed URL expires in 300 seconds.

### 21.3 Telegram

- Webhook rejects missing/wrong `X-Telegram-Bot-Api-Secret-Token`.
- Link token is hashed and expires.
- Telegram user ID cannot be spoofed from frontend.
- Bot command output does not include proof URLs in group/admin chat.
- Unknown Telegram user receives linking instructions only.

### 21.4 Midtrans

- Server key is not in frontend.
- Webhook verifies signature.
- Webhook is idempotent.
- Only settlement/capture-accepted creates payment.
- Failed/expired transactions do not mark invoice paid.

### 21.5 Privacy

- Public dashboard does not show resident names, proof links, notes, phone, timestamps, or payment nominal unless explicitly made admin-only.
- Telegram group admin summary does not expose proof files.
- Export/report routes are admin-only.

---

## 22. Milestone plan

Each milestone includes implementation tasks, acceptance criteria, and tests. Complete in order.

---

### Milestone 0 — Project baseline and tooling

Goal: make the repo testable and ready for structured work.

Tasks:

1. Rename `src/App.jsx` to keep as reference only:
   - Move to `src/legacy/App.legacy.jsx` or delete after copying useful UI styles.
2. Add TypeScript config.
3. Convert Vite config to `vite.config.ts`.
4. Create target folder structure.
5. Add dependencies from section 7.
6. Create `src/lib/format.ts`:
   - `formatRupiah(amount: number): string`
   - `formatDateId(date: string | Date): string`
   - `formatDateTimeId(date: string | Date): string`
7. Create basic `src/lib/validation.ts` with Zod schemas.
8. Add Vitest setup and one smoke test.
9. Update README with local dev commands.

Acceptance criteria:

- `npm run typecheck` passes.
- `npm run test` passes.
- `npm run build` passes.
- App renders a placeholder dashboard route.
- No WhatsApp string in repo.

Test command:

```bash
npm run typecheck && npm run test && npm run build
```

---

### Milestone 1 — Supabase schema, storage, seed, and local reset

Goal: replace demo SQL with production schema.

Tasks:

1. Create Supabase migration files from sections 8–12.
2. Remove old `supabase-setup.sql` or mark it deprecated in README.
3. Configure `supabase/config.toml` for Edge Functions.
4. Add seed kavlings and fee types.
5. Add private buckets.
6. Add basic SQL tests if possible.
7. Run local Supabase reset.

Acceptance criteria:

- `supabase db reset` succeeds locally.
- Tables exist.
- Buckets exist and are private.
- Current kavlings are seeded.
- Fee types are seeded.
- Old public CRUD policies are gone.

Test command:

```bash
supabase db reset
```

Manual SQL checks:

```sql
select count(*) from public.kavlings;
select count(*) from public.fee_types;
select * from storage.buckets where id in ('payment-proofs', 'report-files');
```

Expected kavling count: `34`.

---

### Milestone 2 — Auth, profile, roles, and route guards

Goal: users can log in and see only allowed routes.

Tasks:

1. Implement `src/lib/supabaseClient.ts`.
2. Implement auth provider/hook:
   - current session
   - current profile
   - loading state
   - sign in
   - sign out
3. Implement `/login`.
4. Implement route guards:
   - `RequireAuth`
   - `RequireAdminLike`
   - `RequireSuperAdmin`
5. Implement admin invite Edge Function `admin-invite-user`:
   - requires authenticated admin/super_admin
   - uses service role on server only
   - creates/invites user
   - creates/updates profile
6. Implement a temporary first-super-admin setup path only for local/dev:
   - Either SQL seed specific test user profile after signup.
   - Or document manual SQL update.
   - Do not create public self-promotion endpoint.
7. Add a profile creation path:
   - Preferred: trigger on `auth.users` insert that creates `public.profiles` with resident defaults.
   - Acceptable alternative: admin invite Edge Function creates both auth user and profile in one transaction-like flow.
   - First super admin bootstrap documentation must account for profile row creation before role update.

Acceptance criteria:

- Unauthenticated users can see public dashboard and login only.
- Resident cannot open `/admin`.
- Admin can open `/admin`.
- Sign out works.
- `service_role` is not imported in frontend.

Tests:

- Unit test route guard behavior.
- Manual test with two users: resident and admin.

---

### Milestone 3 — Kavling and resident management

Goal: admin can manage kavlings and resident mappings.

Tasks:

1. Build `/admin/kavlings` list/create/edit/deactivate.
2. Build `/admin/residents` list/create/edit/deactivate.
3. Add resident-to-kavling mapping UI.
4. Enforce role restrictions:
   - Admin can assign resident/treasurer/admin.
   - Only super_admin can assign super_admin.
5. Add audit logs for CRUD/mapping actions.
6. Add resident `/app` home showing linked kavlings.

Acceptance criteria:

- Admin can link resident to `Kav 1`.
- Resident sees only `Kav 1`.
- Resident cannot see neighbor mapping.
- Inactive kavlings do not receive new invoices.
- Audit logs appear for admin actions.

Tests:

- Component test for kavling form validation.
- RLS/manual test resident cannot query neighbor mapping.

---

### Milestone 4 — Billing periods, fee types, fee overrides, invoice generation

Goal: monthly invoices are generated from configurable fee settings.

Tasks:

1. Build `/admin/settings` fee type management:
   - add/edit/activate/deactivate fee type
   - recurring/non-recurring
   - penalty flag
2. Build fee override UI per kavling.
3. Build `/admin/billing`:
   - create period
   - set due date
   - generate invoices
   - open/close period
4. Implement invoice generation RPC using section 9.3.
5. Build period detail `/admin/billing/:periodId`.
6. Build resident invoice list `/app/invoices`.
7. Build invoice detail `/app/invoices/:invoiceId` with itemized lines.

Acceptance criteria:

- Admin creates April 2026 period with due date `2026-04-30`.
- Admin generates invoices for all active kavlings.
- Invoice amount equals sum of active recurring fee types and kavling overrides.
- Resident sees own invoice itemized.
- Public dashboard shows aggregate period summary.
- No hard-coded month/year arrays remain.

Tests:

- Unit test invoice number generator.
- Integration/manual SQL test invoice count equals active kavling count.
- UI test period creation form.

---

### Milestone 5 — Manual transfer and private proof upload

Goal: residents can submit proof safely; proof is private.

Tasks:

1. Build payment submission form in invoice detail.
2. Validate amount and proof file.
3. Create `payment_submissions` row.
4. Upload file to `payment-proofs` path.
5. Update submission with proof metadata.
6. Update invoice status to `pending_verification` through RPC or function.
7. Implement `get-proof-signed-url` Edge Function.
8. Remove all uses of `getPublicUrl` for proof files.
9. Add resident submission history UI.

Acceptance criteria:

- Resident uploads proof and sees status `Menunggu verifikasi`.
- Admin sees pending submission.
- Proof file cannot be opened via public URL.
- Admin can open signed proof URL.
- Resident cannot submit proof for neighbor invoice.

Tests:

- Unit tests for file validation.
- Edge Function test for signed URL authorization.
- Manual RLS test for neighbor access rejection.

---

### Milestone 6 — Admin verification workflow and audit

Goal: treasurer/admin can approve/reject proof and invoice status updates correctly.

Tasks:

1. Build `/admin/submissions` with tabs:
   - Pending
   - Verified
   - Rejected
2. Add signed proof preview/open button.
3. Approve action calls `verify_payment_submission`.
4. Reject action calls `reject_payment_submission` with required reason.
5. Update invoice status and amount paid.
6. Add audit logs.
7. Add resident notification placeholder hook; actual Telegram send comes later.

Acceptance criteria:

- Approving full amount marks invoice `paid`.
- Approving partial amount marks invoice `partial`.
- Rejecting marks invoice `rejected` if no other valid payment.
- Rejection requires reason.
- Resident sees updated status.
- Audit log records approve/reject.

Tests:

- Unit/status transition tests.
- SQL/RPC tests for verify/reject.
- UI test approve/reject flow with mocked Supabase.

---

### Milestone 7 — Reports, CSV export, PDF receipts, history, arrears

Goal: financial reporting features exist before bot automation.

Tasks:

1. Build payment history per kavling.
2. Build `/admin/reports`.
3. Implement CSV exports:
   - monthly invoice status
   - all payments
   - arrears
4. Implement PDF receipt generation.
5. Implement monthly PDF report generation.
6. Implement admin arrears/tunggakan view.
7. Add receipt button to paid invoice.
8. Add report metadata table write when admin saves report.

Acceptance criteria:

- Admin can export current period CSV.
- Admin can export all payments CSV.
- Admin can generate monthly PDF report.
- Resident/admin can generate receipt for paid invoice.
- Arrears dashboard shows unpaid/overdue kavlings with totals.

Tests:

- Unit test CSV generation.
- Unit test PDF blob generation returns non-empty PDF.
- Component test report filters.

---

### Milestone 8 — Telegram bot foundation and account linking

Goal: Telegram bot works and linked users can query status.

Tasks:

1. Implement shared Telegram client.
2. Implement `telegram-webhook` with secret header validation.
3. Implement bot commands:
   - `/start`
   - `/help`
   - `/status`
   - `/tagihanku`
   - `/riwayat`
   - `/settings`
   - `/unlink`
   - `/admin`
4. Implement account linking Flow A.
5. Build `/app/telegram` UI.
6. Add docs `docs/TELEGRAM_BOT_SETUP.md`.
7. Add tests with sample Telegram update JSON.

Acceptance criteria:

- Webhook rejects wrong secret.
- User can link Telegram from app-generated link.
- Linked user `/status` returns only own kavling status.
- Unlinked user gets linking instructions.
- Admin `/admin` works only for admin-like linked users.
- No WhatsApp text in bot messages.

Tests:

- Edge Function test `/start link_<token>`.
- Edge Function test `/status` linked/unlinked.
- Search repo for WhatsApp:

```bash
! grep -Rni "whatsapp\|wa.me\|wa group\|group wa" . --exclude-dir=node_modules --exclude-dir=.git --exclude="CODEx_MASTER_PLAN*.md"
```

---

### Milestone 9 — Telegram notifications, reminders, and monthly summaries

Goal: Telegram replaces reminder/report messaging.

Tasks:

1. Implement notification template renderer.
2. Implement notification delivery logging.
3. Send Telegram message on:
   - proof submitted
   - payment verified
   - payment rejected
   - admin pending proof alert
4. Implement `run-scheduled-reminders`.
5. Configure Supabase Cron migration or documented dashboard schedule.
6. Implement manual admin action `Send Telegram reminders`.
7. Implement `run-monthly-report`.
8. Add admin settings for notification templates and toggles.

Acceptance criteria:

- Resident receives pending/verified/rejected Telegram messages if linked.
- Admin chat receives pending submission alert if configured.
- Reminder job sends to only unpaid/overdue/pending residents.
- No duplicate reminder on same day.
- Monthly summary message is sent to admin chat.
- Notification deliveries are logged.

Tests:

- Unit test template rendering.
- Edge Function test reminder idempotency.
- Mock Telegram API in tests.

---

### Milestone 10 — Bulk import

Goal: admin can import data safely from CSV.

Tasks:

1. Implement CSV sample downloads.
2. Implement client-side CSV parser.
3. Implement Zod validation per import type.
4. Build preview UI with invalid row errors.
5. Implement apply import through admin-only Edge Function/RPC.
6. Write `import_jobs` records.
7. Add audit logs.

Acceptance criteria:

- Admin imports kavlings CSV.
- Admin imports residents CSV.
- Admin imports kavling-resident mapping CSV.
- Admin imports fee overrides CSV.
- Invalid rows are shown and not applied.
- Import can be cancelled before apply.

Tests:

- Unit tests for each CSV validator.
- Component test import preview.

---

### Milestone 11 — Penalties and advanced fee automation

Goal: denda and fee flexibility are production-ready.

Tasks:

1. Use the initial `invoice_penalties` table and verify its unique constraint prevents duplicate penalty application.
2. Build penalty rules UI.
3. Implement apply penalty RPC/job.
4. Add manual one-off event contribution flow:
   - selected kavlings
   - all active kavlings
5. Add invoice recalculation after fee/penalty changes.
6. Add audit logs.
7. Add Telegram reminder wording that includes denda when applicable.

Acceptance criteria:

- Admin configures fixed denda after due date.
- Job/admin action applies denda exactly once per invoice/rule.
- Invoice amount_due increases correctly.
- Duplicate penalty is prevented.
- Event contribution can be added to all kavlings for one period.

Tests:

- SQL test penalty idempotency.
- Unit test penalty amount calculation.

---

### Milestone 12 — PWA

Goal: app is installable and mobile-friendly.

Tasks:

1. Add manifest.
2. Add icons.
3. Add service worker.
4. Register service worker in frontend.
5. Cache app shell only.
6. Add install prompt UI.
7. Test auth callback and app routes with service worker enabled.

Acceptance criteria:

- Lighthouse/PWA installability passes basic checks.
- App can be installed on mobile browser.
- Auth and Supabase calls still work.
- Proof files and API responses are not cached.

Tests:

- Build passes.
- Manual mobile browser install test.

---

### Milestone 13 — Midtrans QRIS/payment gateway

Goal: optional QRIS payment automation works in sandbox.

Tasks:

1. Add `docs/MIDTRANS_QRIS_SETUP.md`.
2. Implement shared Midtrans client.
3. Implement `create-qris-payment`.
4. Implement `midtrans-webhook` with signature verification.
5. Implement gateway transaction UI in invoice detail.
6. Implement payment status polling or manual refresh.
7. Implement `reconcile-payment-gateway`.
8. Send Telegram notification on QRIS paid.
9. Add sandbox test instructions.

Acceptance criteria:

- With feature flag off, app works exactly as manual-transfer app.
- With feature flag on and sandbox keys, resident can generate QRIS for outstanding amount.
- Midtrans sandbox payment/webhook marks invoice paid.
- Duplicate webhook does not create duplicate payment.
- Expired/failed/denied does not mark paid.
- QRIS secrets never appear in browser bundle.

Tests:

- Unit test Midtrans signature verification.
- Edge Function test webhook idempotency.
- Manual sandbox QRIS flow.

---

### Milestone 14 — Deployment, hardening, and production handover

Goal: app can be handed to neighborhood admins without footguns.

Tasks:

1. Write `DEPLOYMENT.md`:
   - Supabase project setup.
   - Migrations.
   - Storage buckets.
   - Edge Function deployment.
   - Secrets.
   - Telegram webhook setup.
   - Vercel deployment.
   - Midtrans sandbox/production setup.
   - Backup/export routine.
2. Write `docs/SECURITY.md`:
   - Roles.
   - Data privacy.
   - Proof file privacy.
   - Incident checklist.
3. Add production checklist.
4. Add admin user guide.
5. Run full test suite.
6. Run repo scan:
   - no WhatsApp references
   - no `ADMIN_PIN`
   - no `getPublicUrl` for proof bucket
   - no service role in `src/`
7. Build production bundle.

Acceptance criteria:

- `npm run typecheck` passes.
- `npm run test` passes.
- `npm run build` passes.
- Edge Functions deploy.
- Telegram webhook set successfully.
- Manual payment end-to-end works.
- Telegram notifications work.
- QRIS sandbox works if enabled.
- Docs are usable by a non-developer admin.

Final verification commands:

```bash
npm run typecheck
npm run test
npm run build
npm run lint
supabase db reset

grep -Rni "ADMIN_PIN\|getPublicUrl(.*payment-proofs\|whatsapp\|wa.me\|group wa" . --exclude-dir=node_modules --exclude-dir=.git --exclude="CODEx_MASTER_PLAN*.md" || true
```

Expected: grep should not find dangerous strings. If it does, fix or document why it is safe.

---

## 23. Testing strategy

### 23.1 Unit tests

Required unit coverage:

- `formatRupiah`.
- Date formatting.
- Invoice status mapping.
- CSV parsing/validation.
- PDF generation returns non-empty blob.
- Telegram template rendering.
- Telegram Mini App HMAC validation if implemented.
- Midtrans signature verification.
- Penalty amount calculation.

### 23.2 Component tests

Required component coverage:

- Login form.
- Resident invoice card.
- Payment submission form validation.
- Admin verification approve/reject modal.
- Import preview.
- Telegram linking page.
- Report filters.

### 23.3 Edge Function tests

Required tests with mocked fetch/Supabase where practical:

- `telegram-webhook` rejects wrong secret.
- `/start link_<token>` consumes valid token.
- `/status` for linked user.
- `run-scheduled-reminders` avoids duplicates.
- `get-proof-signed-url` denies neighbor access.
- `midtrans-webhook` verifies signature.
- `midtrans-webhook` is idempotent.

### 23.4 E2E smoke tests

Use Playwright.

Scenarios:

1. Resident login -> sees own invoice -> submits proof -> status pending.
2. Admin login -> sees pending submission -> opens proof -> approves -> invoice paid.
3. Resident downloads receipt.
4. Admin exports monthly CSV.
5. Admin sends Telegram reminder with Telegram API mocked or disabled.

### 23.5 Manual production smoke test

Before launch:

1. Create test resident and test kavling.
2. Generate invoice for current month.
3. Submit test proof.
4. Verify payment.
5. Generate receipt.
6. Link Telegram account.
7. Run `/status`.
8. Send test reminder.
9. Export report.
10. Delete or cancel test invoice/payment with audit note.

---

## 24. Deployment notes

### 24.1 Supabase

1. Create project.
2. Run migrations.
3. Confirm RLS is enabled.
4. Confirm buckets are private.
5. Set Edge Function secrets.
6. Deploy Edge Functions.
7. Configure cron jobs.
8. Create first super admin manually through SQL after signup.

Example first super admin SQL:

```sql
update public.profiles
set role = 'super_admin'
where email = 'your-email@example.com';
```

Only run this manually in Supabase SQL editor by project owner.

### 24.2 Telegram

1. Create bot.
2. Configure commands.
3. Set webhook with secret token.
4. Send `/start` to bot.
5. Link account from app.
6. Test `/status`.
7. Configure admin chat ID if needed.

### 24.3 Vercel

1. Import repo.
2. Set browser-safe env vars.
3. Deploy.
4. Confirm app URL.
5. Update `APP_BASE_URL` secret in Supabase.
6. Re-set Telegram webhook if function/app URL changed.

### 24.4 Midtrans

1. Create or access merchant account.
2. Start in sandbox.
3. Set server key as Supabase secret.
4. Set notification URL to `midtrans-webhook`.
5. Test QRIS charge in sandbox.
6. Verify settlement webhook.
7. Only switch to production after admin approves fees/settlement/account ownership.

---

## 25. Documentation deliverables

Codex must create/update these docs.

### `README.md`

Must include:

- Project overview.
- Local dev setup.
- Commands.
- Feature flags.
- Testing.

### `DEPLOYMENT.md`

Must include:

- Supabase setup.
- Vercel setup.
- Telegram bot setup summary.
- Midtrans QRIS setup summary.
- Backup/export routine.
- Production checklist.

### `docs/TELEGRAM_BOT_SETUP.md`

Must include:

- BotFather setup.
- Commands.
- Webhook setup.
- Account linking.
- Admin chat ID discovery.
- Troubleshooting.

### `docs/MIDTRANS_QRIS_SETUP.md`

Must include:

- Sandbox setup.
- Required secrets.
- QRIS feature flag.
- Webhook URL.
- Testing flow.
- Production switch checklist.

### `docs/SECURITY.md`

Must include:

- Roles.
- RLS overview.
- Storage privacy.
- Telegram security.
- Midtrans webhook security.
- Incident response.

### `docs/DATA_DICTIONARY.md`

Must include:

- Tables.
- Important columns.
- Status values.
- Relationships.

---

## 26. Codex CLI execution prompt

Use this prompt in local Codex CLI after placing this file in the repo root:

```text
Read CODEx_MASTER_PLAN.md completely. Implement the IPL Jatiloka Telegram-first app exactly according to the plan. Work milestone-by-milestone. After each milestone, run the listed tests and fix failures before continuing. Do not retain the old public CRUD payment model, do not expose payment proofs publicly, and do not include any WhatsApp references. Prefer TypeScript, Supabase migrations, Supabase Edge Functions, RLS, private storage, and Telegram bot integration as specified. When you need to make a decision, use the plan's canonical statuses, schema names, route names, and acceptance criteria. Start with Milestone 0.
```

For a smaller first run:

```text
Read CODEx_MASTER_PLAN.md and implement only Milestone 0 and Milestone 1. Run the acceptance test commands. Stop after reporting what changed and what tests passed.
```

For security-focused verification after implementation:

```text
Audit the repository against CODEx_MASTER_PLAN.md sections 10, 11, 14, 15, and 21. Fix any violations. Run typecheck, tests, build, and the grep checks from Milestone 14.
```

---

## 27. External references for the coding agent

Use official docs where possible:

- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase private buckets and signed URLs: https://supabase.com/docs/guides/storage/serving/downloads
- Supabase Edge Function auth: https://supabase.com/docs/guides/functions/auth
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase Cron: https://supabase.com/docs/guides/cron
- Midtrans QRIS: https://docs.midtrans.com/docs/qris-payment-method-in-midtrans
- Midtrans QRIS/Core API charge sample: https://docs.midtrans.com/docs/gopay-qris-pos-integration
- Midtrans HTTP notifications/webhooks: https://docs.midtrans.com/docs/https-notification-webhooks

---

## 28. Final release checklist

Before sharing with residents:

- [ ] No hard-coded admin PIN.
- [ ] No public proof bucket.
- [ ] No public table write policies.
- [ ] No payment proof link in public dashboard.
- [ ] Resident submission starts as `pending_verification`.
- [ ] Admin verification required for manual proof.
- [ ] Telegram bot linked and tested.
- [ ] Telegram reminders tested with a test user.
- [ ] CSV export tested.
- [ ] PDF receipt tested.
- [ ] Monthly report tested.
- [ ] Bulk import tested on staging data.
- [ ] PWA install tested.
- [ ] QRIS sandbox tested if enabled.
- [ ] Backup/export routine documented.
- [ ] First admin knows how to disable a user, revoke Telegram link, reject a payment, and export evidence.

The point is simple: public sees progress, residents see their own bills, bendahara sees money, and the database enforces the rules. That is the grown-up version.
