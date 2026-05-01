---
status: completed
phase: 05-telegram-linking-notifications
source:
  - 05-01-SUMMARY.md
  - 05-02-SUMMARY.md
  - 05-03-SUMMARY.md
started: 2026-05-01T17:05:00Z
updated: 2026-05-01T10:24:00Z
---

## Current Test

number: 7
name: Admin Telegram Bot Snapshot
expected: |
  An admin-like linked Telegram account should be able to use the /admin command and receive the scoped operational summary, while non-admin residents should not get privileged data.
awaiting: none

## Tests

### 1. Cold Start Smoke Test
expected: Starting the app and its backing services from a fresh state should succeed without startup errors, migrations or function boot issues, and the main app should load usable data instead of crashing on the first request.
result: passed
notes: Fresh `npm run build` and `npm run test:sql` passed after `supabase db reset`, Next.js dev booted cleanly, and both `link-telegram-account` and `telegram-bot-webhook` now serve requests successfully under the local Edge Functions runtime.

### 2. Link Telegram from Resident Settings
expected: On the resident settings page, the Akun Telegram section should show the current link state and the Hubungkan Telegram action should open a valid Telegram deep link flow instead of failing with an error.
result: passed
notes: Playwright confirmed `/app/settings` loads the Telegram section, the `Hubungkan Telegram` action succeeds, and the page renders a valid deep link such as `https://t.me/test_ipl_jatiloka_bot?start=link_...` without surfacing an error state.

### 3. Complete Telegram Linking in Bot
expected: After opening the Telegram deep link and starting the bot with the provided token, the account should link successfully and the app should show the linked Telegram identity details on the resident settings page.
result: passed
notes: Simulated `/start link_...` webhook delivery linked the resident account, stored Telegram identity metadata (`username`, `first_name`), and Playwright confirmed the linked identity details appear on `/app/settings`.

### 4. Resident Telegram Commands
expected: A linked resident should be able to use the supported bot commands such as /status, /tagihanku, /riwayat, /settings, and /unlink, and each response should be scoped to that resident's own data only.
result: passed
notes: Simulated webhook requests for `/status`, `/tagihanku`, `/riwayat`, `/settings`, and `/unlink` all returned `200`; mock Telegram send logs showed resident-scoped responses only for the linked resident's kavlings, `/admin` was denied for the resident, and `/unlink` removed the resident's `telegram_accounts` row while keeping preferences intact.

### 5. Telegram Notification Delivery
expected: Eligible Telegram notifications for announcement publish, payment submission, and payment review outcomes should be sent only to linked users whose notification preferences allow that category, without blocking the source action in the web app.
result: passed
notes: Direct invocations of `send-telegram-notification` for `resident_announcement`, `resident_payment_verified`, and `admin_pending_submission` all returned success, logged `sent` deliveries, and respected recipient filtering. The admin-only template no longer targeted residents. Validation used local mock delivery mode via `TELEGRAM_BOT_MOCK=true`, so no real Telegram API call was required in UAT.

### 6. Admin Telegram Operations
expected: Admin or super admin should be able to open /admin/telegram, see linked-account and delivery summaries, filter delivery history, and manage notification templates from that page.
result: passed
notes: Playwright confirmed `/admin/telegram` loads for admin, shows linked-account and delivery summary cards, filters delivery history, and persists template edits in the UI.

### 7. Admin Telegram Bot Snapshot
expected: An admin-like linked Telegram account should be able to use the /admin command and receive the scoped operational summary, while non-admin residents should not get privileged data.
result: passed
notes: Simulated webhook requests showed `/admin` returns the operational summary for a linked admin account and returns `Perintah ini hanya untuk pengurus.` for a linked resident account.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- Local UAT used `TELEGRAM_BOT_MOCK=true` in `supabase/functions/.env` to validate end-to-end bot and delivery behavior without depending on the live Telegram API.
