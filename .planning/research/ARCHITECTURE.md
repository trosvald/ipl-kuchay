# Architecture Research

**Domain:** neighborhood operations, resident billing, and community communication app
**Researched:** 2026-04-29
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         Experience Layer                            │
├──────────────────────────────────────────────────────────────────────┤
│  Public Dashboard   Resident Web App   Admin Web App   Telegram Bot │
│  (aggregate only)   (/app)             (/admin)       (webhook)     │
└──────────────┬───────────────┬───────────────┬───────────────┬───────┘
               │               │               │               │
┌──────────────┴───────────────────────────────────────────────────────┐
│                     Next.js Application Layer                        │
├──────────────────────────────────────────────────────────────────────┤
│  Server Components + Route Handlers + Server Actions                │
│  - auth/session checks                                               │
│  - DAL / permission checks                                           │
│  - resident/admin page composition                                   │
│  - admin-triggered commands                                          │
└──────────────┬───────────────────────────────┬────────────────────────┘
               │                               │
┌──────────────┴──────────────────────┐ ┌──────┴────────────────────────┐
│        Domain / Orchestration       │ │      Integration / Jobs       │
├─────────────────────────────────────┤ ├───────────────────────────────┤
│ Billing & invoices                  │ │ Telegram webhook              │
│ Payment submissions & verification  │ │ Notification sender           │
│ Announcements & events              │ │ Scheduled reminders / reports │
│ Reporting & exports                 │ │ Secure signed-URL helpers     │
│ Audit logging                       │ │ Admin/system automation       │
└──────────────┬──────────────────────┘ └──────────────┬────────────────┘
               │                                       │
┌──────────────┴───────────────────────────────────────┴────────────────┐
│                         Supabase Platform                              │
├────────────────────────────────────────────────────────────────────────┤
│ Auth │ Postgres + RLS + RPCs │ Private Storage │ Edge Functions │ Cron │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Public dashboard | Show only aggregate collection transparency | Next.js public route backed by safe aggregate SQL/view/RPC |
| Resident app | Bills, payment history, proof upload, announcements, events, profile/preferences | Next.js App Router pages with server-side reads and thin client widgets |
| Admin app | Billing operations, payment review, resident management, publishing, reports | Next.js App Router admin routes with role-gated server actions |
| Auth/access boundary | Authenticate users and enforce role/kavling scope | Supabase Auth + Next.js server DAL + Postgres RLS |
| Billing domain | Periods, invoices, fees, penalties, payment state transitions | Postgres tables, RPCs, transactional mutations |
| Payment verification domain | Proof upload, review, approval/rejection, signed proof access | Private Storage + Edge Functions + audit writes |
| Communication domain | Announcements, events, RSVPs, resident notification preferences | Separate tables and services; same auth model, not mixed into billing tables |
| Notification/integration domain | Telegram linking, webhook handling, delivery logging, reminders | Supabase Edge Functions + `notification_deliveries` + cron |
| Reporting domain | Operational summaries, exports, monthly admin reports | SQL views/RPCs + Edge Functions for generated metadata/files |
| Audit domain | Trace sensitive actions and system jobs | Append-only audit log tables/functions |

## Recommended Project Structure

```text
app/
├── page.tsx                     # public dashboard entry
├── login/page.tsx               # auth entry
├── app/
│   ├── page.tsx                 # resident home: bills + announcements + events
│   ├── invoices/                # resident billing views
│   ├── announcements/           # resident announcements
│   ├── events/                  # resident events / RSVP
│   └── telegram/                # account linking + notification prefs
└── admin/
    ├── billing/                 # periods, invoices, fee operations
    ├── submissions/             # payment review
    ├── communications/          # announcements/events publishing
    ├── reports/                 # reports and exports
    └── settings/                # bank, templates, bot/admin settings

features/
├── auth/                        # client auth shell only
├── resident/                    # resident dashboard composition
├── billing/                     # UI for invoice/billing workflows
├── payments/                    # proof upload + verification UI
├── communications/              # announcements/events/RSVP UI
├── telegram/                    # link status, bot-facing UX
├── reports/                     # admin reporting UI
└── audit/                       # admin audit UI

lib/
├── auth/                        # server/client supabase helpers
├── dal/                         # verified session + scoped reads
├── permissions/                 # role helpers and policy checks
├── billing/                     # domain commands/queries
├── communications/              # announcement/event commands/queries
├── notifications/               # template rendering, idempotency helpers
├── telegram/                    # DTOs and command mapping
└── reports/                     # report shaping/export helpers

supabase/
├── migrations/                  # schema, RLS, indexes, RPCs
├── functions/
│   ├── telegram-webhook/
│   ├── telegram-link-account/
│   ├── telegram-send-notification/
│   ├── run-scheduled-reminders/
│   ├── run-monthly-report/
│   └── _shared/
└── tests/sql/                   # RLS, invariants, workflow tests
```

### Structure Rationale

- **app/** should stay route-oriented; keep it thin and let domain logic live in `lib/` and `supabase/`.
- **features/** should group UI by business domain, not by generic component type.
- **lib/dal + permissions/** should become the main secure boundary for Next.js reads/mutations.
- **communications/** should be a first-class module beside billing, not bolted into resident home as miscellaneous content.
- **supabase/functions/** should own secrets, webhooks, scheduled jobs, and any operation that must not trust the browser.

## Architectural Patterns

### Pattern 1: Server-first data access boundary

**What:** Route pages, server actions, and handlers call a DAL that verifies session and requests only scoped data.
**When to use:** All resident/admin reads and all sensitive mutations.
**Trade-offs:** Slightly more ceremony than direct client queries, but much safer and easier to audit.

**Example:**
```typescript
export async function getResidentHomeData() {
  const session = await verifySession();
  const profile = await getProfileDTO(session.userId);
  return homeQueries.getResidentHome({ profileId: profile.id });
}
```

### Pattern 2: Database-enforced domain invariants

**What:** Keep invoice/payment state rules in Postgres transactions, constraints, RPCs, and RLS instead of trusting UI logic.
**When to use:** Approval/rejection, duplicate-payment prevention, invoice totals, resident scoping.
**Trade-offs:** More SQL work up front, but prevents the expensive class of billing bugs.

**Example:**
```typescript
await supabase.rpc("verify_payment_submission", {
  submission_id,
  actor_id,
  approved: true,
});
```

### Pattern 3: Outbox-style notification delivery

**What:** Business events write durable delivery records first; Telegram sending happens via dedicated function/job with idempotency checks.
**When to use:** Payment notifications, reminders, monthly summaries, urgent announcement fan-out.
**Trade-offs:** Slightly delayed delivery, but avoids duplicate sends and keeps billing mutations fast.

**Example:**
```typescript
await db.tx(async (trx) => {
  await trx.verifyPayment(submissionId, actorId);
  await trx.insertNotificationDelivery({
    template_code: "payment_verified",
    profile_id,
    related_invoice_id,
    status: "queued",
  });
});
```

### Pattern 4: Community content as separate bounded context

**What:** Announcements, events, RSVPs, and notification preferences live in their own tables/services but reuse profiles, kavling scope, audit, and notifications.
**When to use:** All resident communication features.
**Trade-offs:** More modules than a single “misc” table, but much cleaner than coupling content lifecycle to invoices.

## Data Flow

### Request Flow

```text
Resident/Admin action
    ↓
Next.js page / form / route
    ↓
verifySession() + permission check
    ↓
DAL / command service
    ↓
Postgres query / RPC / Storage signed URL / Edge Function
    ↓
Scoped DTO returned to UI
```

### State Management

```text
Supabase Auth session
    ↓
Client auth shell (minimal)
    ↓
Server-rendered page fetches scoped data
    ↓
Client components mutate via server actions / handlers
    ↓
Revalidate page data
```

### Key Data Flows

1. **Resident invoice view:** resident opens `/app` or `/app/invoices` → Next.js verifies session → DAL resolves profile/kavling scope → billing query returns only own invoice DTOs.
2. **Manual payment proof:** resident uploads proof → server/Edge Function creates submission row and private storage object → admin fetches signed preview URL only when authorized.
3. **Payment verification:** admin approves/rejects → transactional RPC updates submission/payment/invoice/audit → queue notification delivery → Telegram sender processes if linked.
4. **Announcement publish:** admin creates announcement/event → row saved with publish window/audience → resident home reads published items beside billing summary → urgent items optionally enqueue Telegram fan-out.
5. **Telegram linking:** authenticated resident requests link token → token hash stored → Telegram webhook consumes one-time token → profile linked to Telegram account.
6. **Reminders/reports:** cron or internal trigger invokes Edge Function → function selects due invoices or report aggregates → writes delivery log → sends Telegram messages to opted-in recipients/admin chats.

## Suggested Build Order

1. **Harden the access layer first**
   - Standardize server-side session verification, DAL shape, DTOs, and role checks.
   - Reason: communication features are less risky than billing, but they still inherit resident privacy requirements.

2. **Finish billing invariants and reporting baseline**
   - Lock down verification, invoice status transitions, audit logging, and export/report queries.
   - Reason: communication should notify about trustworthy billing states, not unstable ones.

3. **Add in-app community information next**
   - Build announcements, events, RSVPs, resident home composition, and notification preferences.
   - Reason: these features reuse auth/profile/kavling data but do not require external integration yet.

4. **Add Telegram account linking and command foundation**
   - Implement webhook security, one-time link tokens, `/status`, `/tagihanku`, `/riwayat`, `/settings`, `/admin`.
   - Reason: bot reads should come only after web data models and permissions are stable.

5. **Add notification fan-out and scheduled jobs**
   - Queue payment notifications, reminders, monthly summaries, urgent announcement pushes.
   - Reason: idempotent job infrastructure is easier once content and billing events already exist.

6. **Finish rollout hardening**
   - Deployment docs, secret management, webhook verification, backup/export routine, incident checklist, end-to-end tests.
   - Reason: this product handles money, identity, and neighborhood communications; launch safety is a feature.

## How Community Features Should Fit Beside Billing

- **Resident home should be a composed read model, not a merged schema.** Show bills, payment status, announcements, and upcoming events together in UI, but keep billing tables and communication tables separate.
- **Announcements/events should reuse the same identity and audience model.** Scope content by resident/auth status, not by public access. Public dashboard remains aggregate-only.
- **Telegram should be a delivery channel, not the source of truth.** Billing state, announcement content, and event RSVP state live in Postgres first; Telegram mirrors selected outputs.
- **Audit and moderation rules should match billing sensitivity where needed.** Publishing urgent announcements, editing event details, and sending bulk reminders should all create audit records.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k residents | Keep a modular monolith: Next.js + Supabase is enough. Prioritize RLS correctness, indexes, and simple cron jobs. |
| 1k-10k residents | Add stronger query shaping, indexes on scope/status/date columns, delivery batching, and report generation off request path. |
| 10k+ residents | Separate heavy exports/report generation, introduce queue-backed notification workers if needed, and review whether some reporting should move to precomputed tables/materialized views. |

### Scaling Priorities

1. **First bottleneck:** poorly indexed RLS queries on invoices/submissions/deliveries. Fix with indexes matching policy/filter columns and explicit filtered queries.
2. **Second bottleneck:** bursty Telegram/report jobs. Fix with idempotent batching, durable delivery records, and background execution rather than inline sends.

## Anti-Patterns

### Anti-Pattern 1: Client-driven authorization

**What people do:** Fetch resident/admin data directly from broad browser queries and trust route guards/UI hiding.
**Why it's wrong:** Next.js docs explicitly recommend secure checks close to data access, and Supabase warns to rely on RLS for exposed schemas.
**Do this instead:** Server-side DAL + RLS + DTOs; treat server actions and route handlers like public APIs.

### Anti-Pattern 2: Mixing billing mutations with external sends

**What people do:** Approve payment and send Telegram immediately in the same request path.
**Why it's wrong:** External API failures create partial success, retries create duplicates, and admin workflows become fragile.
**Do this instead:** Commit billing state first, then queue/log notification work separately.

### Anti-Pattern 3: Using Telegram as identity

**What people do:** Link by Telegram username or trust frontend-supplied Telegram IDs.
**Why it's wrong:** Usernames are mutable; frontend identity is spoofable.
**Do this instead:** One-time app-issued link tokens and webhook-side verification.

### Anti-Pattern 4: Treating announcements as public content

**What people do:** Reuse public dashboard patterns for resident messages/events.
**Why it's wrong:** Community information is resident-scoped and often operationally sensitive.
**Do this instead:** Protected resident reads with explicit publish status and audience rules.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Telegram Bot API | Supabase Edge Function webhook + send functions | Verify secret header, use webhook not polling, never expose bot token to browser |
| Supabase Auth | Server/client Supabase helpers with cookie-based SSR support | On server, trust validated claims/session handling rather than client-only session state |
| Supabase Storage | Private bucket + signed URL helper function | Proof files stay private; no public proof URLs |
| Supabase Cron / pg_cron | Scheduled invocation of reminder/report functions | Use internal secret and idempotency guards |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Next.js app ↔ DAL | direct server function calls | Central place for session verification and DTO shaping |
| DAL ↔ Postgres/RPC | typed queries and RPCs | Prefer transactional SQL for billing-critical writes |
| Billing ↔ Notifications | outbox/delivery records | Avoid inline third-party calls from billing mutations |
| Communications ↔ Notifications | publish event to delivery queue | Reuse the same template/logging infrastructure as billing notices |
| Admin UI ↔ Edge Functions | authenticated server action or route | For webhook-like, cron-like, or secret-bearing operations only |

## Sources

- Next.js authentication guide (App Router, DAL/DTO guidance, auth checks near data): https://nextjs.org/docs/app/guides/authentication — HIGH
- Supabase Next.js server-side auth guide (SSR clients, proxy refresh, `getClaims()` warning): https://supabase.com/docs/guides/auth/server-side/nextjs — HIGH
- Supabase Row Level Security guide: https://supabase.com/docs/guides/database/postgres/row-level-security — HIGH
- Supabase Edge Functions overview: https://supabase.com/docs/guides/functions — HIGH
- Telegram webhook guide: https://core.telegram.org/bots/webhooks — HIGH
- Project context: `.planning/PROJECT.md` — HIGH
- Product/master-plan architecture and milestones: `CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md`, `docs/plan/milestones/M08-telegram-foundation.md`, `docs/plan/milestones/M09-telegram-notifications.md`, `docs/plan/milestones/M14-deployment-hardening.md` — HIGH

---
*Architecture research for: IPL Jatiloka Residence*
*Researched: 2026-04-29*
