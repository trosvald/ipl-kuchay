# Phase 5 Research — Telegram Linking & Notifications

**Date:** 2026-05-01
**Phase:** 05-telegram-linking-notifications

## Research Goal

Answer: what must be true to plan Phase 5 well without weakening privacy, role scope, or the web-app-as-system-of-record boundary.

## Current-State Findings

- Telegram schema primitives already exist in `supabase/migrations/0002_tables.sql`: `telegram_accounts`, `telegram_link_tokens`, `notification_templates`, and `notification_deliveries`.
- RLS already exists for those tables in `supabase/migrations/0005_rls_policies.sql`, but the runtime layer is still missing: there are no Telegram Edge Functions, webhook handlers, or dispatch jobs under `supabase/functions/`.
- Resident settings already expose per-category `telegram_enabled` toggles in `features/resident/ResidentSettingsPage.tsx`; Phase 5 should extend that page with link-state UX instead of creating a second settings surface.
- Payment review currently calls `notifySubmissionReviewed()` in `features/payments/submissionNotificationPlaceholder.ts`, but that module is still a no-op placeholder.
- Existing admin navigation and route patterns already support adding a dedicated `/admin/telegram` page while preserving the treasurer/admin/super_admin split established in Phase 1.

## Relevant Source Contracts

- `features/resident/ResidentSettingsPage.tsx` is the canonical place for D-14 through D-17 because it already owns notification preference state and save flows.
- `supabase/functions/_shared/supabase.ts` and `supabase/functions/_shared/responses.ts` define the shared Edge Function patterns to reuse for all Telegram endpoints.
- `features/payments/AdminSubmissionsPage.tsx` is the existing payment-review integration point for `admin_pending_submission` and resident payment outcome notifications.
- `features/announcements/AdminAnnouncementsPage.tsx` is the announcement publish/edit surface that should emit `COMM-05` Telegram delivery attempts.
- `features/layout/adminNavigation.ts` is the role-safe admin nav contract and should remain the single source of truth for the new `/admin/telegram` entry.

## External Documentation Notes

### Telegram Bot API

Context7 Telegram Bot API docs confirm two key constraints that align with the phase decisions:

- `setWebhook` supports a `secret_token`, which Telegram returns in `X-Telegram-Bot-Api-Secret-Token`; this matches the locked webhook-secret validation requirement.
- Deep linking uses the bot `start` parameter (`?start=...`), which fits D-15's `link_<token>` flow.

Implication: the safest split is an authenticated app-side token issuer plus a webhook-side `/start link_<token>` consumer, not a browser-direct Telegram account mutation.

### Supabase Edge Functions

Context7 Supabase docs confirm:

- webhook-style functions should set `verify_jwt = false` in `supabase/config.toml`;
- authenticated/internal functions can keep normal JWT enforcement and use env secrets for privileged calls.

Implication: `telegram-bot-webhook` should be the only public-facing function with `verify_jwt = false`, while link issuance, notification send, and cron endpoints stay authenticated or secret-gated.

### Scheduling / Internal Invocation

The milestone contract plus Supabase guidance supports secret-gated scheduled invocation for reminder and monthly-summary jobs.

Implication: daily reminder and month-end summary flows should be implemented as internal Edge Functions invoked by `pg_cron` with a shared secret header, while keeping the core dispatch path synchronous and non-blocking to upstream business actions.

## Recommended Technical Direction

### 1. Split linking into issuer + consumer

Recommended flow:

1. Authenticated resident clicks `Hubungkan Telegram`.
2. `link-telegram-account` creates a one-time token, stores only its SHA-256 hash, and returns `https://t.me/<bot>?start=link_<plain_token>`.
3. `telegram-bot-webhook` validates secret header, parses `/start link_<token>`, consumes the token once, and upserts `telegram_accounts`.

Why: this matches D-15, D-18, M08, and keeps Telegram identity proof on the bot side instead of trusting client input.

### 2. Treat notification delivery as an auditable side effect, never the source of truth

Recommended delivery rules:

- event producers call a shared send contract synchronously per D-01 and D-06;
- every attempt writes one `notification_deliveries` row with `sent` or `failed` per D-02 and D-03;
- upstream payment verification / announcement publish must succeed even when Telegram delivery fails;
- residents are eligible only when both `telegram_accounts.allows_notifications = true` and `notification_preferences.telegram_enabled = true` for the relevant category.

Why: this preserves PAY-07 consistency and the “Telegram is not the system of record” boundary.

### 3. Keep reminder dedupe in SQL, not React or ad-hoc function state

Recommended reminder contract:

- model dedupe around `template_code + profile_id + related_invoice_id + billing month` per D-05;
- daily reminder job filters unpaid/overdue invoices only per D-04;
- monthly admin summary job is separate from reminder job per D-06.

Why: idempotency and billing-state filtering belong closest to the data truth and can be regression-tested with SQL.

### 4. Keep bot UX text-only and scope-first

Recommended command contract:

- `/start`, `/help`, `/status`, `/tagihanku`, `/riwayat`, `/settings`, `/unlink`, `/admin` only;
- unlinked users always receive the single guidance string from D-10;
- multi-kavling residents get grouped sections in one reply per D-09;
- `/admin` requires admin-like linked profile and returns an operational snapshot only.

Why: Phase 5 is explicitly a quick-query channel, not a parallel full product surface.

### 5. Put admin Telegram operations in one dedicated surface

Recommended admin UI split:

- `/admin/telegram` owns linked-account metrics, delivery filters, failure summary, and notification template CRUD/preview/reset;
- existing payment/announcement pages show compact inline delivery badges only, not full delivery management UI.

Why: this matches D-19 through D-21 while keeping other admin pages lightweight.

## Planning Implications

### Files likely to change

- `supabase/migrations/0020_m09_telegram_linking_foundation.sql`
- `supabase/migrations/0021_m09_telegram_notification_dispatch.sql`
- `supabase/tests/sql/m08_telegram_linking.sql`
- `supabase/tests/sql/m08_notification_dispatch.sql`
- `supabase/functions/link-telegram-account/index.ts`
- `supabase/functions/telegram-bot-webhook/index.ts`
- `supabase/functions/send-telegram-notification/index.ts`
- `supabase/functions/run-scheduled-reminders/index.ts`
- `supabase/functions/run-monthly-summary/index.ts`
- `supabase/functions/_shared/telegram.ts`
- `supabase/functions/_shared/notifications.ts`
- `features/resident/ResidentSettingsPage.tsx`
- `features/payments/submissionNotificationPlaceholder.ts`
- `features/telegram/AdminTelegramPage.tsx`
- `app/admin/telegram/page.tsx`
- `features/layout/adminNavigation.ts`
- `supabase/config.toml`

### No new npm library required

The existing stack is sufficient. Telegram can be called via plain HTTP from Edge Functions, and template rendering can stay in a small shared helper module.

### High-risk areas to plan explicitly

- accidental browser-side secret exposure if bot token handling leaks outside Edge Functions;
- replay or conflict bugs in link-token consume flow;
- delivery dedupe drift if monthly reminder logic is implemented outside SQL truth;
- treasurer accidentally gaining communication operations through overly broad admin-like page exposure;
- inline badge/file overlap across `ResidentSettingsPage`, `adminNavigation`, and payment/announcement admin pages.

## Common Pitfalls To Avoid

- Do **not** let Telegram mutate billing or payment truth directly.
- Do **not** send proof files, proof URLs, or resident-to-resident data through Telegram.
- Do **not** disable seeded templates globally; D-20 says they remain active and residents control opt-in.
- Do **not** collapse multi-kavling replies into one merged balance; D-09 requires per-kavling sections.
- Do **not** make notification failure block payment verification, announcement publish, or other source-of-truth mutations.

## Validation Architecture

- Fast loop: `npm run test:unit`
- DB safety checks: extend `npm run test:sql` with Phase 5 SQL regressions
- Function/build gate: `npm run typecheck && npm run build`
- Phase completion gate: `npm run test`
- Webhook/public-function safety gate: verify `supabase/config.toml` explicitly scopes `verify_jwt = false` only to `telegram-bot-webhook`

## Recommended Plan Shape

1. **Secure linking foundation first** — token issue/consume SQL contract, authenticated deep-link issuer, webhook secret validation, `/start link_<token>` consume path.
2. **Dispatch engine second** — synchronous send contract, delivery logging, reminder/month-end jobs, payment/announcement event wiring.
3. **User/admin experience third** — full command set, resident settings link-state UX, admin delivery/template operations UI, inline delivery badges.

## Research Conclusion

Phase 5 should build on the existing schema and resident settings surface rather than introducing a separate Telegram subsystem. The safe architecture is: authenticated app issues one-time link token, public webhook consumes it with secret validation, Edge Functions send Telegram messages synchronously but non-blockingly, SQL owns dedupe/eligibility rules, and admin visibility stays in a dedicated `/admin/telegram` page.
