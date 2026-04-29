# Milestone 8 - Telegram Bot Foundation And Account Linking

Source sections:

- Master plan sections 14.1 through 14.7, 21.3, 22 Milestone 8.

Goal:

- Telegram bot webhook works, users can link accounts, and basic commands return authorized data.

Files to create/change:

- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-link-account/index.ts`
- `supabase/functions/_shared/telegram.ts`
- `supabase/functions/_shared/telegramMiniApp.ts` only if optional mini app validation is started
- `supabase/functions/_shared/auth.ts`
- `features/telegram/TelegramLinkPage.tsx`
- `features/telegram/telegramTypes.ts`
- `app/app/telegram/page.tsx`
- `docs/TELEGRAM_BOT_SETUP.md`
- `tests/edge-functions/telegram-webhook.test.ts` or equivalent.

Webhook contract:

- Path: `supabase/functions/telegram-webhook/index.ts`.
- `verify_jwt = false`.
- Accept only POST.
- Require `X-Telegram-Bot-Api-Secret-Token`.
- Return `401` for missing/wrong secret.
- Return quickly with JSON `{ "ok": true }`.

Linking contract:

- App calls `telegram-link-account` while authenticated.
- Function returns deep link `https://t.me/<bot_username>?start=link_<plain_token>`.
- Store only SHA-256 token hash.
- Token is at least 32 random bytes, base64url encoded.
- Token expires in 15 minutes and is consumed once.

Command contract:

- `/start`, `/help`, `/status`, `/tagihanku`, `/riwayat`, `/settings`, `/unlink`, `/admin`.
- Unknown/unlinked users receive linking instructions only.
- Admin commands require linked profile with admin-like role.

Tasks:

1. Implement shared Telegram client.
2. Implement `telegram-webhook` with secret header validation.
3. Implement commands `/start`, `/help`, `/status`, `/tagihanku`, `/riwayat`, `/settings`, `/unlink`, `/admin`.
4. Implement app-generated one-time token linking.
5. Build `/app/telegram`.
6. Add `docs/TELEGRAM_BOT_SETUP.md`.
7. Add Edge Function tests with sample update JSON.

Acceptance:

- Webhook rejects wrong/missing secret.
- Link token is hashed, expires, and is one-time use.
- Linked user sees only own kavling status.
- Unlinked user gets linking instructions.
- Admin command works only for admin-like linked profiles.
- No WhatsApp strings in bot output.
- Bot output does not include proof URLs or raw proof files.

Out of scope:

- Do not implement scheduled reminders yet.
- Do not implement Telegram Mini App unless explicitly needed.

Verification:

```bash
npm run typecheck
npm run test
npm run build
grep -Rni "whatsapp\|wa.me\|wa group\|group wa" . --exclude-dir=node_modules --exclude-dir=.git --exclude="CODEx_MASTER_PLAN*.md" || true
```
