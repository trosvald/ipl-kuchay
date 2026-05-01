# Telegram Bot Setup Guide

**IPL Jatiloka Residence** — Telegram bot integration for resident notifications and account linking.

## Overview

The Telegram bot serves two purposes:

1. **Account linking** — Residents generate a one-time deep link from the web app and complete linking via the bot.
2. **Quick query commands** — Linked residents can check billing status, invoice details, and payment history directly from Telegram.

The bot is a **read-only quick query channel**. Billing operations, payment proof submission, and admin workflows remain in the web app. Telegram never holds privileged secrets — all mutation requests are validated server-side.

---

## Architecture

```
Resident Browser (authenticated)
  → POST /app/settings → link-telegram-account (Edge Function, JWT auth)
      → issue_telegram_link_token (SQL contract)
          ← deep link URL: https://t.me/<bot>?start=link_<token>

Telegram App (resident)
  → /start link_<token>
      → Telegram Bot API
          → telegram-bot-webhook (Edge Function, secret-validated ONLY)
              → consume_telegram_link_token (SQL contract)
                  ← links telegram_accounts record to profile
              → Telegram Bot API (reply with D-11 success copy)
```

### Public Entry Points

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `telegram-bot-webhook` | `X-Telegram-Bot-Api-Secret-Token` header | Consume `/start link_<token>` |
| All other Edge Functions | JWT Bearer token | Authenticated resident/admin operations |

**Only `telegram-bot-webhook` has `verify_jwt = false` in `supabase/config.toml`.**

---

## Setup

### 1. Create the Bot via BotFather

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot`.
3. Follow the prompts:
   - **Bot name**: `IPL Jatiloka` (display name)
   - **Bot username**: `ipljatiloka_bot` (must end in `bot`, globally unique)
4. BotFather will return a **Bot API token** in the format `123456789:ABCdef...`. Copy this.
5. Set the bot username in your environment (see below).

### 2. Configure Environment Variables

On the Supabase dashboard → Project Settings → Edge Functions → Secrets, add:

| Secret | Value |
|--------|-------|
| `TELEGRAM_BOT_TOKEN` | The token from BotFather (e.g. `123456789:ABCdef...`) |
| `TELEGRAM_BOT_USERNAME` | The bot username **without @** (e.g. `ipljatiloka_bot`) |
| `TELEGRAM_WEBHOOK_SECRET` | A random secret string (min 32 chars, base64url-safe). Used to validate incoming webhook requests. Generate with: `openssl rand -base64 32` |

### 3. Set the Webhook

Point the bot's webhook to the deployed `telegram-bot-webhook` function URL:

```
https://<your-supabase-project>.supabase.co/functions/v1/telegram-bot-webhook
```

Set the secret token:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<function-url>&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Or use the Supabase dashboard → Edge Functions → Webhook configuration.

**Verification command:**
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### 4. Retrieve Bot Username for the App

The web app's Telegram linking UI needs the bot username to construct the deep link URL. Pass `TELEGRAM_BOT_USERNAME` to the client via your app's environment or configuration.

---

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message. With `link_<token>` parameter, attempts account linking. |
| `/help` | Lists all available commands with descriptions. |
| `/status` | Shows billing summary for all linked kavlings (multi-kavling residents see per-kavling sections). |
| `/tagihanku` | Detailed invoice breakdown for the current billing period. |
| `/riwayat` | Recent payment history (last 6 months). |
| `/settings` | Directs resident to the web app settings page. |
| `/unlink` | Disconnects the Telegram account from the IPL profile (confirmation required). |
| `/admin` | **Admin-like users only**: pending submission count and recent summary snapshot. |

### Unlinked User Flow

When an unlinked user sends any command, they receive:

> Akun Telegram kamu belum terhubung dengan IPL Jatiloka. Silakan login ke aplikasi web dan hubungkan akun Telegram dari menu Pengaturan.

### Successful Link Flow (D-11)

After `/start link_<token>` succeeds:

> Akun Telegram kamu sudah terhubung dengan IPL Jatiloka. Gunakan /status untuk cek tagihan atau /help untuk daftar perintah.

### Conflict / Already Linked (D-18)

> Akun Telegram @username sudah terhubung ke akun lain. Silakan gunakan akun Telegram yang berbeda atau hubungi pengurus.

---

## Security Notes

- The **bot token** is read server-side only (`TELEGRAM_BOT_TOKEN` env var). Browser code never accesses it.
- The **webhook secret** (`X-Telegram-Bot-Api-Secret-Token`) is validated on every incoming request before parsing the body.
- Link tokens are **hashed at rest** (SHA-256). The plain token is only used once — in the deep link URL sent to the resident.
- Tokens **expire in 15 minutes** and are **single-use**. Replay attempts are rejected.
- Each resident can link **exactly one** Telegram account (enforced at DB and contract level).
- Each Telegram account can link to **exactly one** resident profile (enforced by `telegram_user_id` unique constraint).

---

## Troubleshooting

### Webhook not receiving events

1. Verify the webhook URL is correctly set:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```
2. Check the `TELEGRAM_WEBHOOK_SECRET` matches what was passed to `setWebhook`.
3. Check Supabase Edge Functions logs for errors.

### "Token tidak valid atau sudah kadaluarsa" on valid token

- Token expired (15-minute window). Request a new link from the web app.
- The token was already consumed (replay). Each `/start link_` can only be used once.

### "Akun Telegram sudah terhubung" despite never linking

- The profile already has a `telegram_accounts` row (from a prior partial setup). Use `/unlink` from the Telegram app to reset, or contact an admin to delete the row manually.

### Bot not responding to commands

- Verify the bot username matches `TELEGRAM_BOT_USERNAME` passed to the app.
- Check that the Edge Function is deployed and accessible.
- Check Supabase Edge Functions logs.

---

## Development

### Local Testing

```bash
# Start Supabase local stack
npm run supabase:start

# Serve Edge Functions locally
npm run functions:serve

# Simulate a webhook POST (requires local ngrok or similar for Telegram)
curl -X POST http://localhost:54333/functions/v1/telegram-bot-webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <your-secret>" \
  -d @test/fixtures/telegram-update.json
```

### Test Fixture Example

```json
{
  "update_id": 123456789,
  "message": {
    "from": {
      "id": 999000001,
      "is_bot": false,
      "username": "testuser",
      "first_name": "Test",
      "last_name": "User",
      "language_code": "en"
    },
    "chat": {
      "id": 888000001,
      "type": "private"
    },
    "text": "/start link_abc123"
  }
}
```

---

## References

- Telegram Bot API: https://core.telegram.org/bots/api
- Supabase Edge Functions: `supabase/functions/*/index.ts`
- Linking SQL contract: `supabase/migrations/0020_m09_telegram_linking_foundation.sql`
- Phase context: `.planning/phases/05-telegram-linking-notifications/05-CONTEXT.md`
