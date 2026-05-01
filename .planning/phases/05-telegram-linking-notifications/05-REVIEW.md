---
phase: 05-telegram-linking-notifications
reviewed: 2026-05-01T14:30:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - supabase/migrations/0021_m09_telegram_linking_foundation.sql
  - supabase/migrations/0022_m09_telegram_notification_dispatch.sql
  - supabase/functions/_shared/telegram.ts
  - supabase/functions/_shared/notifications.ts
  - supabase/functions/_shared/supabase.ts
  - supabase/functions/link-telegram-account/index.ts
  - supabase/functions/telegram-bot-webhook/index.ts
  - supabase/functions/send-telegram-notification/index.ts
  - supabase/functions/run-scheduled-reminders/index.ts
  - supabase/functions/run-monthly-summary/index.ts
  - features/payments/submissionNotificationPlaceholder.ts
  - features/payments/PaymentSubmissionForm.tsx
  - features/announcements/AdminAnnouncementsPage.tsx
  - features/resident/ResidentSettingsPage.tsx
  - features/telegram/AdminTelegramPage.tsx
  - app/admin/telegram/page.tsx
  - features/layout/adminNavigation.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-01T14:30:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 05 implements the complete Telegram linking and notification dispatch subsystem across three plans: secure token-based linking foundation (05-01), notification dispatch engine (05-02), and resident/admin UX (05-03). Reviewed 17 source files including 2 SQL migrations, 7 Edge Functions, 3 shared modules, 4 React feature components, and 1 layout module.

The architecture is sound: SHA-256 hashed tokens with 15-minute expiry, secret-validated webhook, security-definer SQL contracts, and non-blocking fire-and-forget delivery. However, one **critical bug** breaks the resident-facing Telegram linking flow entirely — the Resident Settings page sends an empty body to the `link-telegram-account` Edge Function which requires `botUsername`. Additionally, several warnings include a no-op auth guard in `send-telegram-notification`, missing Telegram user metadata during linking, and a skipped notification path on inline announcement publish.

---

## Critical Issues

### CR-01: Telegram Linking from Resident Settings broken — missing `botUsername` in request body

**File:** `features/resident/ResidentSettingsPage.tsx:174` → `supabase/functions/link-telegram-account/index.ts:52-54`
**Issue:** The `handleLinkTelegram` function calls `client.functions.invoke("link-telegram-account", { body: {} })` with an **empty body**. The Edge Function at line 52 validates `body.botUsername` and returns 400 `"botUsername is required"` when absent. This means no resident can initiate Telegram linking from the settings page — the entire resident-facing "Hubungkan Telegram" flow is broken.

The `link-telegram-account` Edge Function was designed to accept `botUsername` from the client (per plan 05-01: "Accepts bot_username to construct the t.me URL without leaking the bot token into browser-accessible code"), but the client never sends it.

**Fix:** The Edge Function should read `TELEGRAM_BOT_USERNAME` from the server environment instead of requiring it from the client. This is both more secure (no reliance on client-provided data) and simpler. Apply both changes:

**In `supabase/functions/link-telegram-account/index.ts`** — read from env instead of body:
```typescript
// Remove the IssueTokenRequest interface and body parsing
// Instead, read bot username from environment at the top:
function getBotUsername(): string {
  const denoEnv = "Deno" in globalThis
    ? (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
    : undefined;
  const username = denoEnv?.get?.("TELEGRAM_BOT_USERNAME");
  if (!username) throw new Error("Missing TELEGRAM_BOT_USERNAME");
  return username;
}

// In serve():
const botUsername = getBotUsername();

// Then:
const { data, error: rpcError } = await adminClient.rpc("issue_telegram_link_token", {
  p_profile_id: user.id,
  p_bot_username: botUsername,
});
```

**In `features/resident/ResidentSettingsPage.tsx:174`** — the call remains unchanged (body can stay empty since the function no longer reads it), but the response type may need adjustment if the function no longer echoes back the bot username.

---

## Warnings

### WR-01: Telegram user metadata not passed to consume function — all linked accounts have null identity fields

**File:** `supabase/functions/telegram-bot-webhook/index.ts:88-96` and `67-71`
**Issue:** When consuming a link token in `handleStart`, the Telegram user metadata (`username`, `first_name`, `last_name`, `language_code`) is hardcoded to `null`/`""`. The `handleStart` function signature (line 67-71) does not accept the `TelegramUser` object, even though it's available in the main handler from `parseTelegramUser(update)` at line 348.

This means every resident who links their Telegram account via the bot will have:
- `telegram_accounts.username = null`
- `telegram_accounts.first_name = ""`
- `telegram_accounts.last_name = null`
- `telegram_accounts.language_code = null`

The Resident Settings page (line 322-328) and Admin Telegram page both display this metadata, but it will always show empty/placeholder values for linked accounts.

**Fix:** Pass the parsed `TelegramUser` into `handleStart`:
```typescript
// Change handleStart signature:
async function handleStart(
  client: SupabaseClient,
  chatId: number,
  telegramUser: { id: number; username: string | null; first_name: string; last_name: string | null; language_code: string | null },
  messageText: string | null,
): Promise<string> {
  // ...
  // At the consume call (line 88-96):
  const { data } = await client.rpc("consume_telegram_link_token", {
    p_plain_token: linkToken,
    p_telegram_user_id: telegramUser.id,
    p_telegram_chat_id: chatId,
    p_username: telegramUser.username ?? null,
    p_first_name: telegramUser.first_name ?? "",
    p_last_name: telegramUser.last_name ?? null,
    p_language_code: telegramUser.language_code ?? null,
  });
}

// Update call site (line 361):
const reply = await handleStart(adminClient, telegramChat.id, telegramUser, messageText);
```

---

### WR-02: `requireAuth` in send-telegram-notification is a security no-op

**File:** `supabase/functions/send-telegram-notification/index.ts:36-47`
**Issue:** The `requireAuth` function checks that an `Authorization` header starts with `"Bearer "` but **never validates the JWT**. It extracts the token (line 44) but discards it, returning a hardcoded `{ userId: "authenticated" }`. Any caller with any Bearer token can invoke this function.

The comment says "Supabase auth is validated by the gateway (verify_jwt = true default)" which is true on the hosted Supabase platform, but:
1. The code-level guard is misleading — it claims to require auth but doesn't
2. If this function is ever deployed outside Supabase's gateway, it has no auth
3. Combined with `createServiceRoleClient()`, any authenticated (or spoofed) caller can send arbitrary Telegram messages to any recipient

**Fix:** Either remove the `requireAuth` function entirely (relying on platform-level JWT validation), or implement proper JWT verification using the Supabase client:
```typescript
function requireAuth(req: Request): { userId: string } {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authentication required");
  }
  // Delegate actual validation to Supabase platform (verify_jwt=true)
  // The token is extracted for audit/logging purposes only
  const token = authHeader.slice(7);
  return { userId: token }; // Pass token through for audit, not for auth decisions
}
```

---

### WR-03: Inline "Publikasikan" button on announcements skips Telegram notification dispatch

**File:** `features/announcements/AdminAnnouncementsPage.tsx:517-532`
**Issue:** When an admin publishes an announcement by clicking the inline "Publikasikan" button in the table row (draft tab), it calls `handleUpdateFields` directly, which updates the status to `"published"` but does **NOT** trigger the Telegram notification dispatch. The notification is only dispatched through the editor dialog's "Publikasikan" button (which goes through `handleSave` at line 272-283).

This means announcements published via the inline button will silently go live without notifying subscribed residents on Telegram.

**Fix:** Add notification dispatch to the inline publish flow or refactor to share a common publish function:
```typescript
// Line 521-527: After handleUpdateFields succeeds, fire the notification:
onClick={async () => {
  setWorkingId(row.id);
  await handleUpdateFields(row.id, {
    status: "published",
    published_at: new Date().toISOString(),
  });
  // COMM-05: trigger resident announcement notification (fire-and-forget, T-05-14)
  client.functions
    .invoke("send-telegram-notification", {
      body: {
        template_code: "resident_announcement",
        template_vars: { title: row.title },
      },
    })
    .catch(() => {});
}}
```

---

### WR-04: Unused invoice query in run-monthly-summary — dead code

**File:** `supabase/functions/run-monthly-summary/index.ts:92-101`
**Issue:** The `invoices` variable (lines 92-101) is fetched but never used. The variable `invoicesError` is also never checked. This is dead code that adds latency and could mask errors (e.g., if the query fails silently, no one notices because nothing depends on it).

Additionally, the `MonthlyStats` interface (lines 38-44) is declared but never used.

**Fix:** Remove the dead code block:
```typescript
// Remove lines 92-101 (the unused invoices query) and the MonthlyStats interface (lines 38-44)
```

---

### WR-05: Null-unsafe subquery chain in run-monthly-summary billing_period_id lookups

**File:** `supabase/functions/run-monthly-summary/index.ts:104-139`
**Issue:** The `billing_period_id` is re-queried 4 separate times (lines 107-114, 119-126, 132-138, 149-155) using deeply nested `await` expressions with `?.data?.id` which could be `undefined`. If any of these subqueries returns no row, `billing_period_id` becomes `undefined`, and the `.eq("billing_period_id", undefined)` filter would return incorrect results (all rows, or none, depending on Supabase behavior).

**Fix:** Extract the `billing_period_id` once before the aggregate queries:
```typescript
// After line 89: extract billing_period_id from the already-loaded periodData
const { data: billingPeriod } = await sb
  .from("billing_periods")
  .select("id")
  .eq("month", periodData.month)
  .eq("year", periodData.year)
  .limit(1)
  .single();

if (!billingPeriod?.id) {
  return jsonResponse(200, {
    success: true,
    message: "Billing period not found — summary skipped",
  });
}

const billingPeriodId = billingPeriod.id;

// Then use billingPeriodId in all 4 queries below, avoiding repeated subqueries
const { count: totalCount } = await sb
  .from("invoices")
  .select("*", { count: "exact", head: true })
  .eq("billing_period_id", billingPeriodId);
// ... etc
```

---

## Info

### IN-01: Dead `/start` handler in COMMANDS dictionary

**File:** `supabase/functions/telegram-bot-webhook/index.ts:295-299`
**Issue:** The `/start` entry in the `COMMANDS` dictionary returns an empty string but is **never reached**. All `/start` messages are intercepted at line 360 (`messageText.trim().startsWith("/start")`) and routed to `handleStart` directly, bypassing the `COMMANDS` dispatch. The dead entry is confusing and could lead to bugs if someone tries to refactor the dispatch logic.

**Fix:** Remove the `/start` entry from `COMMANDS` (lines 296-298) or add a comment explaining it's intentionally bypassed.

---

### IN-02: Unused `answerTelegramStart` function in shared module

**File:** `supabase/functions/_shared/telegram.ts:213-238`
**Issue:** The `answerTelegramStart` function exists in the shared helper module but is **never called** anywhere. Per the 05-01 summary: "answerStartParam Telegram API call skipped — we send a text reply instead." The function is dead code.

**Fix:** Either remove the function or document it as available for future use with a `@deprecated` or `@future` comment. Keeping dead code in a shared module increases maintenance burden and may confuse future developers.

---

### IN-03: `link-telegram-account` should read bot username from env, not client body

**File:** `supabase/functions/link-telegram-account/index.ts:10-12, 45-54`
**Issue:** The function accepts `botUsername` from the client request body. While the bot username is public information, requiring the client to provide it creates unnecessary coupling — the client must know and transmit the bot username. Since `TELEGRAM_BOT_USERNAME` is already configured as an environment variable, the Edge Function should read it server-side.

This is partly addressed by CR-01's fix but deserves its own note as a design concern.

---

### IN-04: Repeated Deno env access pattern across 5 files

**File:** `supabase/functions/_shared/supabase.ts:5-14`, `supabase/functions/_shared/telegram.ts:21-31`, `supabase/functions/telegram-bot-webhook/index.ts:18-26`, `supabase/functions/run-scheduled-reminders/index.ts:24-27`, `supabase/functions/run-monthly-summary/index.ts:22-25`
**Issue:** The pattern for reading Deno environment variables (`"Deno" in globalThis ? (globalThis as {...}).Deno?.env?.get?.(key)`) is repeated across 5 files. `supabase.ts` has a `requireEnv` helper, but the other files reimplement the same logic inline. This increases risk of typos and makes it harder to add cross-cutting env validation.

**Fix:** Use the existing `requireEnv` from `supabase.ts` in other files, or export a `getOptionalEnv` helper for non-required env vars:
```typescript
// In supabase.ts, add:
export function getOptionalEnv(name: string): string | undefined {
  const denoEnv = "Deno" in globalThis
    ? (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
    : undefined;
  return denoEnv?.get?.(name);
}
```

---

### IN-05: Hardcoded default templates in AdminTelegramPage duplicate seed data

**File:** `features/telegram/AdminTelegramPage.tsx:159-168`
**Issue:** The `handleResetTemplate` function contains hardcoded default template strings that duplicate the seed data from migration `0007_seed_initial_data.sql` and `0022_m09_telegram_notification_dispatch.sql` (line 260). If the seed data is ever updated, these hardcoded strings will become stale, and the "reset to default" button will restore an outdated template.

**Fix:** Fetch the default template from the database (e.g., a `default_body_template` column or a separate seed lookup) rather than hardcoding. Alternatively, add a comment linking to the seed migration and a test that verifies consistency.

---

_Reviewed: 2026-05-01T14:30:00Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: standard_
