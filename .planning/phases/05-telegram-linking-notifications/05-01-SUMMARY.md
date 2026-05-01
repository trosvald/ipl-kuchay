---
phase: 05-telegram-linking-notifications
plan: "01"
subsystem: infra
tags: [telegram, supabase-edge-functions, security, sql-contract, deep-link]

# Dependency graph
requires:
  - phase: "04-announcements-events-resident-home"
    provides: "RLS policies, notification_deliveries table, profiles table, audit patterns"
provides:
  - "One-time Telegram link token SQL contract (issue/consume)"
  - "Authenticated deep-link issuer Edge Function"
  - "Secret-validated Telegram webhook for /start link_<token>"
  - "Shared Telegram helper module for downstream plans"
affects:
  - "05-telegram-linking-notifications (plan 02: notification dispatch)"
  - "05-telegram-linking-notifications (plan 03: bot commands + settings UI)"
  - "features/resident/ResidentSettingsPage.tsx"

# Tech tracking
tech-stack:
  added:
    - "SHA-256 token hashing (gen_random_bytes, pgcrypto)"
    - "Deno fetch for Telegram Bot API"
  patterns:
    - "security-definer SQL contract for token issue/consume"
    - "secret-validated webhook (X-Telegram-Bot-Api-Secret-Token)"
    - "hash-only storage at rest for link tokens"
    - "bot token server-side only, never in browser code"

key-files:
  created:
    - "supabase/migrations/0020_m09_telegram_linking_foundation.sql"
    - "supabase/tests/sql/m08_telegram_linking.sql"
    - "supabase/functions/_shared/telegram.ts"
    - "supabase/functions/link-telegram-account/index.ts"
    - "supabase/functions/telegram-bot-webhook/index.ts"
    - "docs/TELEGRAM_BOT_SETUP.md"
  modified:
    - "supabase/config.toml"
    - "package.json"

key-decisions:
  - "Store SHA-256 hash of plain token only — plain token never persisted (T-05-01)"
  - "15-minute expiry enforced in consume_telegram_link_token, not DB constraint alone (T-05-04)"
  - "Prior unconsumed tokens invalidated on each new issue (T-05-04)"
  - "consume_telegram_link_token rejects caller-supplied profile override — always uses token-owned profile_id (T-05-02)"
  - "telegram_user_id uniqueness conflict surfaced as D-18 Indonesian message (T-05-07)"
  - "verify_jwt=false scoped only to telegram-bot-webhook in config.toml (T-05-06)"
  - "Webhook returns 200 to Telegram even on known errors to prevent retry storms"
  - "Bot token TELEGRAM_BOT_TOKEN read server-side only via Deno.env"

patterns-established:
  - "Pattern 1: security-definer SQL contract as the only DB mutation entry point for sensitive operations"
  - "Pattern 2: deep-link token extraction via extractLinkToken helper (shared, reuseable)"
  - "Pattern 3: secret-validated webhook pattern with generic 401 response to avoid leaking validation details"

requirements-completed: [TLGM-01]

# Metrics
duration: 5min
completed: "2026-05-01"
---

# Phase 05 Plan 01: Telegram Linking Foundation Summary

**One-time Telegram link token SQL contract with authenticated deep-link issuer and secret-validated webhook consume path**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-01T07:05:45Z
- **Completed:** 2026-05-01T07:10:xxZ
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Built the secure linking foundation: hash-only one-time tokens, 15-min expiry, replay-safe consume path
- Implemented `link-telegram-account` authenticated Edge Function returning deep link URL
- Implemented `telegram-bot-webhook` secret-validated webhook consuming `/start link_<token>` and linking Telegram accounts
- Added shared `_shared/telegram.ts` module for downstream plans (token extraction, message send, user parsing)
- Configured `supabase/config.toml` with `verify_jwt=false` scoped only to the public webhook

## task Commits

Each task was committed atomically:

1. **task 1: add one-time Telegram link token SQL contract and regression coverage** - `f2ba831` (feat)
2. **task 2: implement authenticated deep-link issuer and shared Telegram helper contracts** - `ef38298` (feat)
3. **task 3: add webhook foundation for `/start link_...` token consumption** - `d7b7f3d` (feat)

## Files Created/Modified

- `supabase/migrations/0020_m09_telegram_linking_foundation.sql` — Token issue/consume SQL contract (issue_telegram_link_token, consume_telegram_link_token), SHA-256 hashing, indexes
- `supabase/tests/sql/m08_telegram_linking.sql` — Regression tests covering token issue, expiry, replay, cross-account conflict, RLS, and schema integrity
- `supabase/functions/_shared/telegram.ts` — Shared helper: extractLinkToken, parseTelegramUser/Chat, sendTelegramMessage, buildDeepLinkUrl
- `supabase/functions/link-telegram-account/index.ts` — Authenticated deep-link issuer (JWT auth, calls SQL contract, returns deep link)
- `supabase/functions/telegram-bot-webhook/index.ts` — Secret-validated webhook: POST-only, X-Telegram-Bot-Api-Secret-Token validation, /start link_ parsing, consume call, D-11/D-18 reply
- `supabase/config.toml` — Added `[[edge_functions]]` block with `telegram-bot-webhook` override (`verify_jwt = false`), global `verify_jwt = true`
- `docs/TELEGRAM_BOT_SETUP.md` — Complete bot setup guide: BotFather setup, webhook configuration, commands, security notes, troubleshooting
- `package.json` — Added `m08_telegram_linking.sql` to `test:sql` script

## Decisions Made

- Used SHA-256 (via `encode(sha256(...), 'hex')`) for token hashing — matches M08 contract, no extra dependencies
- `gen_random_bytes(32)` for plain tokens — 256 bits of entropy, base64url encoded
- Consumed token marked atomically via UPDATE before INSERT into telegram_accounts (prevents partial state)
- Telegram bot token never leaves Edge Functions — Deno.env read server-side only
- `answerStartParam` Telegram API call skipped — we send a text reply instead, which is simpler and equally effective

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External service configuration required.** Telegram bot setup requires manual steps:

1. **Create bot via @BotFather** — get `TELEGRAM_BOT_TOKEN`
2. **Set environment secrets** in Supabase dashboard → Edge Functions → Secrets:
   - `TELEGRAM_BOT_TOKEN` (from BotFather)
   - `TELEGRAM_BOT_USERNAME` (bot username without @)
   - `TELEGRAM_WEBHOOK_SECRET` (random secret, min 32 chars: `openssl rand -base64 32`)
3. **Configure webhook** — point bot to the deployed function URL with the secret token:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<function-url>&secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```
4. **Verify** — `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

See `docs/TELEGRAM_BOT_SETUP.md` for the complete guide.

## Next Phase Readiness

- Plan 02 (notification dispatch) can proceed — SQL contract and shared helpers are in place
- Plan 03 (bot commands + settings UI) can proceed — webhook consume path and shared `telegram.ts` module are ready
- `consume_telegram_link_token` RPC is live and can be regression-tested with `npm run test:sql`

---
*Phase: 05-telegram-linking-notifications*
*Completed: 2026-05-01*
