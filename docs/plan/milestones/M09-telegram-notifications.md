# Milestone 9 - Telegram Notifications, Reminders, Monthly Summaries

Source sections:

- Master plan sections 12.3, 14.6, 14.8, 14.9, 20, 22 Milestone 9.

Goal:

- Telegram replaces reminder/report messaging.

Files to create/change:

- `supabase/functions/telegram-send-notification/index.ts`
- `supabase/functions/run-scheduled-reminders/index.ts`
- `supabase/functions/run-monthly-report/index.ts`
- `supabase/functions/_shared/telegram.ts`
- `supabase/functions/_shared/notifications.ts`
- `features/settings/NotificationSettingsPage.tsx`
- update payment submission/verification hooks from M05/M06.
- cron migration or deployment docs.

Template renderer contract:

```ts
type TemplateVars = Record<string, string | number | null | undefined>;
function renderTemplate(template: string, vars: TemplateVars): string;
```

Reminder idempotency:

- Same `template_code`, `profile_id`, `related_invoice_id`, and local date must not send twice.
- Skip paid, waived, and cancelled invoices.
- Respect `telegram_accounts.allows_notifications`.

Internal function security:

- Cron-triggered functions require `Authorization: Bearer ${APP_INTERNAL_CRON_SECRET}` or `X-Internal-Secret`.
- Admin-triggered reminder action must verify authenticated admin role before invoking reminder logic.

Tasks:

1. Implement template renderer.
2. Implement notification delivery logging.
3. Send notifications on proof submitted, verified, rejected, and admin pending proof alert.
4. Implement `run-scheduled-reminders`.
5. Configure cron migration or deployment docs.
6. Add manual admin action to send reminders.
7. Implement `run-monthly-report`.
8. Add admin notification template/toggle settings.

Acceptance:

- Residents receive pending/verified/rejected messages if linked and opted in.
- Admin chat receives pending proof alert when configured.
- Reminder job skips paid/waived/cancelled invoices.
- Reminder job is idempotent per day.
- Monthly summary is sent and logged.
- Telegram group/admin summaries do not expose proof files.

Out of scope:

- Do not implement QRIS payment notifications until M13.

Verification:

```bash
npm run typecheck
npm run test
npm run build
```
