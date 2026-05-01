# Phase 5: Telegram Linking & Notifications - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn Telegram into a secure linked delivery and shortcut channel: one-time Telegram account linking, preference-aware notification dispatch for billing/payment/announcement events, bot command/deep-link flows for resident self-service, and admin visibility into delivery state. Telegram must not become the system of record — the web app remains the authoritative platform.

</domain>

<decisions>
## Implementation Decisions

### Notification dispatch timing
- **D-01:** Notifications dispatch synchronously at event time (e.g., when payment is verified, Telegram API call fires immediately and logs the result). No separate queue processor.
- **D-02:** Every dispatch attempt writes to `notification_deliveries` with status `sent` or `failed` and relevant metadata (template_code, profile_id, related_invoice_id, telegram_message_id, error_message). This is the audit backbone.
- **D-03:** On synchronous dispatch failure (Telegram API error, network issue), log to `notification_deliveries` with status `failed` + error_message. Do NOT retry. The core operation (payment verification, announcement publish) must not block on notification delivery.
- **D-04:** Billing reminders (`resident_payment_reminder`) are triggered by a pg_cron daily job at 07:00 WIB/WITA. The job queries all kavlings with unpaid/overdue invoices where the resident has `telegram_enabled` for `billing_reminders`, then dispatches reminders.
- **D-05:** Reminder deduplication: at most one reminder per invoice per billing month (same template_code + profile_id + related_invoice_id + billing_period). An invoice overdue for 3 months can receive up to 3 reminders across separate monthly cycles.
- **D-06:** Admin operational notifications use a mixed model: `admin_pending_submission` fires synchronously when a resident submits payment (event-driven). `admin_monthly_summary` runs via pg_cron at month-end.

### Bot command UX
- **D-07:** Text commands only (plain text replies, no inline keyboards). The bot is a quick query tool — complex interactions happen in the web app.
- **D-08:** Commands: `/start` (welcome + link/unlinked handling), `/help` (command list), `/status` (billing summary), `/tagihanku` (invoice detail), `/riwayat` (payment history), `/settings` (link to app), `/unlink` (disconnect), `/admin` (admin-like users only: pending verification snapshot).
- **D-09:** For multi-kavling residents, `/status` and `/tagihanku` show all linked kavlings in one message with per-kavling sections. No interactive kavling picker. Aligns with Phase 1 D-14/D-15.
- **D-10:** Unknown/unlinked users receive a single reply: "Akun Telegram kamu belum terhubung dengan IPL Jatiloka. Silakan login ke aplikasi web dan hubungkan akun Telegram dari menu Pengaturan."
- **D-11:** After successful deep-link token consumption, bot replies: "Akun Telegram kamu sudah terhubung dengan IPL Jatiloka. Gunakan /status untuk cek tagihan atau /help untuk daftar perintah."
- **D-12:** `/unlink` flow: bot-side confirmation via "Unlink" command text. Bot confirms with Yes/No. If confirmed, telegram_accounts record is deleted.
- **D-13:** `/admin` shows pending verification count and recent submission summary. A simple operational snapshot. Admins go to the web app for full management.

### Resident Telegram settings UX
- **D-14:** Telegram link state appears as a new dedicated section ("Akun Telegram") in the resident settings page, positioned above the notification preferences section and below the read-only identity section.
- **D-15:** The linking flow: resident clicks "Hubungkan Telegram" → app calls `link-telegram-account` Edge Function → returns a deep link (`t.me/bot?start=link_xxx`). Resident clicks the link, opens Telegram, bot confirms the link.
- **D-16:** Linked state shows full account info: Telegram username, first name, and linked date. Transparency builds trust.
- **D-17:** After unlinking (via bot `/unlink`), settings page shows status "Tidak terhubung" with message: "Preferensi Telegram kamu tetap disimpan. Hubungkan kembali untuk melanjutkan notifikasi Telegram." Notification preferences are preserved, not auto-disabled.
- **D-18:** Account conflict: if a Telegram account is already linked to a different profile, reject with message: "Akun Telegram @username sudah terhubung ke akun lain. Silakan gunakan akun Telegram yang berbeda atau hubungi pengurus." The `telegram_user_id` unique constraint enforces this at the database level.

### Admin-side Telegram configuration
- **D-19:** Admin can edit notification templates from the web app. A dedicated admin page provides full CRUD with template preview (rendered with sample data), a reset-to-default button per template, and audit logging of all template changes.
- **D-20:** All seeded notification templates remain always active for Telegram delivery. Residents control their own opt-in per category. Admin does not gate which event types can flow through Telegram.
- **D-21:** Admin panel has a dedicated Telegram delivery visibility page (`/admin/telegram`) showing: linked resident count, recent deliveries table with filters (by template, status, date), and a failure summary with error messages. Inline delivery status badges appear on relevant pages (submission detail, announcement detail).

### OpenCode's Discretion
- Exact layout, copy, and badge styling on the resident settings Telegram section
- Exact visual design of the admin template editor and delivery visibility page
- Exact cron expression for reminder and monthly summary schedules
- Token generation implementation details (byte length, encoding, hashing — as long as the M08 one-time-token contract is satisfied)
- Webhook secret validation implementation (header name, comparison method)
- Whether templates use mustache-style `{{var}}` or another interpolation format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and locked constraints
- `.planning/PROJECT.md` — Telegram-only messaging, proof privacy non-negotiable, Indonesian UX language, resident self-service priority
- `.planning/REQUIREMENTS.md` — authoritative Phase 5 scope for `COMM-05`, `TLGM-01`..`TLGM-04`
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, 3-plan split, and fixed scope boundary

### Prior locked decisions that still apply
- `.planning/phases/01-access-scope-resident-identity/01-CONTEXT.md` — D-11/D-12 (notification preferences by category), D-14/D-15 (multi-kavling grouping rules), D-07 (resident settings structure), D-25/D-26 (former-resident access boundaries)
- `.planning/phases/03-manual-payments-reporting-audit/03-CONTEXT.md` — D-05 (proof files remain private, signed-URL access only — Telegram must never transmit proof files or URLs)
- `.planning/phases/04-announcements-events-resident-home/04-CONTEXT.md` — D-23 (communication/event management admin/super_admin only), D-20 (urgency/pinning are admin-controlled), D-12 (unpublished announcements invisible to residents)

### Telegram design contracts
- `docs/plan/milestones/M08-telegram-foundation.md` — Webhook contract, deep-link token contract, command list, linking flow
- `docs/plan/milestones/M09-telegram-notifications.md` — Template renderer contract, reminder idempotency rules, cron security contract, delivery logging

### Existing schema and RLS contracts
- `supabase/migrations/0001_extensions_and_types.sql` — `notification_channel` enum ('telegram'), `notification_status` enum
- `supabase/migrations/0002_tables.sql` — `telegram_accounts` (profile_id, telegram_user_id, telegram_chat_id, allows_notifications), `telegram_link_tokens` (token_hash, expires_at, consumed_at), `notification_templates`, `notification_deliveries`
- `supabase/migrations/0005_rls_policies.sql` — RLS policies for `telegram_accounts` and `telegram_link_tokens` (select/insert/update/delete per role)
- `supabase/migrations/0007_seed_initial_data.sql` — 7 seeded notification templates with Indonesian body text and Mustache-style `{{var}}` placeholders
- `supabase/migrations/0012_m07_access_scope_identity.sql` — `notification_preferences` table (profile_id, category, in_app_enabled, telegram_enabled) with RLS policies

### Existing UI contracts
- `features/resident/ResidentSettingsPage.tsx` — Existing per-category notification toggles (billing_reminders, payment_status, announcements, events) with separate in_app and telegram checkboxes
- `lib/validation.ts` — `residentNotificationCategorySchema`, `residentNotificationPreferencesSchema`, `residentSettingsProfileSchema`

### Existing plan contracts (to be replaced by replanning)
- `.planning/phases/05-telegram-linking-notifications/05-01-PLAN.md` — Current plan for linking contracts (DB + edge consume flow)
- `.planning/phases/05-telegram-linking-notifications/05-02-PLAN.md` — Current plan for notification dispatch + event wiring
- `.planning/phases/05-telegram-linking-notifications/05-03-PLAN.md` — Current plan for bot webhook commands + settings UI

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/resident/ResidentSettingsPage.tsx`: already has per-category notification preference UI with in_app + telegram checkboxes per category (billing_reminders, payment_status, announcements, events). The Telegram link section should be added to this existing page.
- `supabase/functions/_shared/supabase.ts`: existing shared Supabase client initialization for Edge Functions that new `link-telegram-account`, `send-telegram-notification`, and `telegram-bot-webhook` functions should reuse.
- `supabase/functions/_shared/responses.ts`: existing `jsonResponse` and `HttpError` utilities for Edge Function response handling.
- `lib/validation.ts`: existing Zod schemas for notification preferences that can be extended with Telegram link action validation.
- `lib/format.ts`: existing formatting hub for consistent label rendering that delivery status badges should use.
- `components/ui/*`: existing Button, Badge, Card, Input, Table components for the admin template editor and delivery visibility UI.

### Established Patterns
- Thin route files in `app/**` delegate to `features/**` modules.
- Client-side Supabase access is acceptable, but notification dispatch must happen server-side (Edge Functions or DB triggers).
- Edge Functions use `_shared/` for common utilities (supabase client, responses, auth).
- Sensitive admin mutations stay auditable through `writeAuditLog` patterns — template editing should follow this.
- Resident-facing screens use Indonesian copy, inline error messages, and trust-oriented status feedback.
- Notification dispatch must respect `telegram_accounts.allows_notifications` and `notification_preferences.telegram_enabled`.

### Integration Points
- New Edge Functions: `link-telegram-account`, `send-telegram-notification`, `telegram-bot-webhook`, `run-scheduled-reminders`, `run-monthly-summary` under `supabase/functions/`.
- New shared modules: `supabase/functions/_shared/telegram.ts` (Telegram Bot API client), `supabase/functions/_shared/notifications.ts` (template renderer, preference checker).
- Payment/announcement event wiring: notification dispatch calls should be inserted at the point where payment submissions are verified/rejected and announcements are published. Existing files: `features/payments/AdminSubmissionsPage.tsx`, `features/payments/SubmissionReviewModal.tsx`, `features/announcements/AnnouncementForm.tsx`.
- Settings UI expansion: `features/resident/ResidentSettingsPage.tsx` gets a Telegram link section.
- Admin UI: new `features/telegram/` module for template editing and delivery visibility, new route under `app/admin/telegram/`.
- pg_cron jobs: migration to register cron schedules for reminders and monthly summaries.
- RLS and regression tests: `supabase/tests/sql/m08_telegram_linking.sql` and `supabase/tests/sql/m08_notification_dispatch.sql`.

</code_context>

<specifics>
## Specific Ideas

- The bot should feel lightweight — residents use it for quick status checks, not as a full replacement for the web app.
- "Check tagihan" from Telegram should be as easy as typing `/tagihanku` and seeing the numbers immediately.
- Admin delivery visibility should make it obvious when notifications are failing so they can be proactive about resident communication.
- Template editing should feel safe — the preview and reset-to-default safeguard against accidentally breaking all notification delivery.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 5 scope.

</deferred>

---

*Phase: 05-telegram-linking-notifications*
*Context gathered: 2026-05-01*
