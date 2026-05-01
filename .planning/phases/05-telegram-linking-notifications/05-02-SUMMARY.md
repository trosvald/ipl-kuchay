---
phase: 05-telegram-linking-notifications
plan: 02
subsystem: notifications
tags: [telegram, edge-functions, sql, supabase, template-rendering, pg_cron]
requires:
  - phase: 05-telegram-linking-notifications
    plan: 01
    provides: "Secure linking foundation — token issue/consume SQL contracts and shared Telegram helper module"
provides:
  - "SQL dispatch contract: eligibility helpers, reminder selector with dedupe, delivery logging function"
  - "send-telegram-notification Edge Function: synchronous, preference-aware, non-blocking dispatch"
  - "run-scheduled-reminders Edge Function: daily job, secret-gated, SQL-backed dedupe"
  - "run-monthly-summary Edge Function: month-end admin summary with billing aggregation"
  - "Real payment notification wiring replacing Phase 3 placeholder"
  - "Announcement publish notification trigger"
  - "resident_announcement notification template seed"
affects: [notifications, payments, announcements, telegram, admin-dashboard]
tech-stack:
  added: []
  patterns:
    - "Edge Function invoke for fire-and-forget Telegram dispatch from client components"
    - "Secret-gated internal Edge Functions for cron/scheduled jobs"
    - "SQL security-definer functions as runtime contracts for eligibility and delivery logging"
    - "Mustache-style {{var}} template rendering with whitelisted variable substitution"
key-files:
  created:
    - "supabase/migrations/0022_m09_telegram_notification_dispatch.sql"
    - "supabase/tests/sql/m08_notification_dispatch.sql"
    - "supabase/functions/_shared/notifications.ts"
    - "supabase/functions/send-telegram-notification/index.ts"
    - "supabase/functions/run-scheduled-reminders/index.ts"
    - "supabase/functions/run-monthly-summary/index.ts"
  modified:
    - "features/payments/submissionNotificationPlaceholder.ts"
    - "features/payments/PaymentSubmissionForm.tsx"
    - "features/announcements/AdminAnnouncementsPage.tsx"
    - "supabase/migrations/0021_m09_telegram_linking_foundation.sql"
    - "package.json"
key-decisions:
  - "Template rendering uses simple {{var}} replacement matching existing seed data conventions"
  - "Delivery is fire-and-forget from client side with .catch(() => {}) — notification failure never blocks source-of-truth mutations"
  - "cron.schedule wrapped in conditional DO block for pg_cron availability — local dev skips, production activates"
  - "Admin-like targeting uses same get_linked_telegram_recipients helper, requiring notification_preferences like residents"
patterns-established:
  - "Shared notifications.ts module mirrors existing _shared pattern (telegram.ts, responses.ts, supabase.ts)"
  - "Security-definer SQL functions for all notification contract logic — no browser-side business rules"
requirements-completed: [COMM-05, TLGM-02, TLGM-04]
duration: 18min
completed: 2026-05-01
---

# Phase 05 Plan 02: Telegram Notification Dispatch Engine Summary

**Synchronous, preference-aware Telegram delivery engine with SQL-backed eligibility, dedupe, and auditable sent/failed logging for payment, announcement, and scheduled events.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-01T14:00:00Z
- **Completed:** 2026-05-01T14:18:00Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 5

## Accomplishments
- SQL dispatch contracts: recipient eligibility (D-02/D-20), reminder dedupe (D-05), delivery logging with sent/failed status and audit metadata
- Four Edge Functions: `send-telegram-notification` (sync dispatch), `run-scheduled-reminders` (daily cron, secret-gated), `run-monthly-summary` (month-end admin summary), plus shared `_shared/notifications.ts` module
- Real payment notification wiring replaces Phase 3 placeholder — verified/rejected outcomes now invoke Telegram dispatch via `send-telegram-notification`
- Announcement publish now triggers `resident_announcement` Telegram notification for subscribed residents
- Payment submission creation fires `admin_pending_submission` for admin-like users

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL dispatch, dedupe, scheduling contracts** — `937499c` (feat)
2. **Task 2: Sender and scheduled Edge Functions** — `b59526b` (feat)
3. **Task 3: Wire payment and announcement events** — `d8dacf9` (feat)

## Files Created/Modified
- `supabase/migrations/0022_m09_telegram_notification_dispatch.sql` — Eligibility helpers, reminder selector, delivery log function, cron registration, announcement template seed
- `supabase/tests/sql/m08_notification_dispatch.sql` — Regression tests for eligibility, dedupe, and sent/failed logging
- `supabase/functions/_shared/notifications.ts` — Template renderer, recipient resolver, delivery logger shared module
- `supabase/functions/send-telegram-notification/index.ts` — Authenticated sync dispatch endpoint
- `supabase/functions/run-scheduled-reminders/index.ts` — Secret-gated daily reminder job
- `supabase/functions/run-monthly-summary/index.ts` — Secret-gated month-end admin summary
- `features/payments/submissionNotificationPlaceholder.ts` — Replaced with real dispatch invoke
- `features/payments/PaymentSubmissionForm.tsx` — Added admin_pending_submission trigger on submission
- `features/announcements/AdminAnnouncementsPage.tsx` — Added resident_announcement on publish
- `supabase/migrations/0021_m09_telegram_linking_foundation.sql` — Added updated_at column for trigger compatibility
- `package.json` — Added m08_notification_dispatch.sql to test:sql

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration number conflict (0020 already used)**
- **Found during:** task 1 (Migration creation)
- **Issue:** Migration 0020 was already taken by m08_events_updated_at_trigger
- **Fix:** Renamed to 0022 (0021 taken by linking foundation)
- **Files modified:** supabase/migrations/0022_m09_telegram_notification_dispatch.sql

**2. [Rule 1 - Bug] test:sql failed due to cron.schedule not available in local Supabase**
- **Found during:** task 1 verification
- **Issue:** pg_cron extension not available in local Supabase, causing migration rollback
- **Fix:** Wrapped cron.schedule calls in conditional DO block checking for pg_cron extension
- **Files modified:** supabase/migrations/0022_m09_telegram_notification_dispatch.sql

**3. [Rule 1 - Bug] Test scoping — reminder dedupe test asserted cross-kavling behavior**
- **Found during:** task 1 verification
- **Issue:** Test expected resident A to be selected for kavling B's invoice, but resident A is only linked to kavling A
- **Fix:** Changed test to verify resident B's invoice still appears (no dedupe) instead
- **Files modified:** supabase/tests/sql/m08_notification_dispatch.sql

**4. [Rule 2 - Missing Critical] No announcement template existed**
- **Found during:** task 3 wiring
- **Issue:** No resident_announcement template in notification_templates seed data
- **Fix:** Added seed template with Indonesian body text and updated get_linked_telegram_recipients to map 'announcements' category
- **Files modified:** supabase/migrations/0022_m09_telegram_notification_dispatch.sql, supabase/functions/_shared/notifications.ts

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Subagent for inline plan execution produced zero output — switched to sequential inline execution on main tree
- cron.schedule in migrations requires pg_cron extension which is only available in hosted Supabase

## User Setup Required
- `APP_INTERNAL_CRON_SECRET` — needed for run-scheduled-reminders and run-monthly-summary Edge Functions
- `TELEGRAM_BOT_TOKEN` — needed for message delivery via Telegram Bot API

## Next Phase Readiness
- Dispatch engine complete — ready for Plan 05-03 (resident/admin UX: webhook commands, settings UI, admin delivery page)
- No blockers for Wave 3

---
*Phase: 05-telegram-linking-notifications*
*Completed: 2026-05-01*
