# Phase 5: Telegram Linking & Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 05-telegram-linking-notifications
**Areas discussed:** Notification dispatch timing, Bot command UX, Resident Telegram settings UX, Admin-side Telegram configuration

---

## Notification dispatch timing

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous at event-time | Payment/announcement events immediately send Telegram API call and log the result. No separate queue processor. | ✓ |
| Async queue + periodic sweep | Events insert into notification_deliveries with status='queued'. Separate function dispatches later. | |

| Option | Description | Selected |
|--------|-------------|----------|
| pg_cron daily job | pg_cron runs a daily scheduled job querying overdue invoices and dispatching reminders automatically. | ✓ |
| Admin manual trigger only | Admin manually clicks 'Send Reminders' from the admin panel. | |
| Both: cron + admin manual | pg_cron automated daily reminders AND admin can manually trigger ad-hoc reminders. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Mix: event-driven + cron | Admin pending submission alerts fire synchronously. Monthly summary runs via pg_cron at month-end. | ✓ |
| pg_cron periodic sweep only | Everything is pg_cron-based — periodic sweeps check for pending submissions and end-of-month summaries. | |
| Manual admin triggers only | All admin notifications manually triggered from the admin panel. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Always log to deliveries | Write to notification_deliveries for every dispatch attempt (success or fail). | ✓ |
| Log failures only | Write only on failure. | |
| Use existing audit_log only | Skip notification_deliveries, use audit_log instead. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Log failure, don't retry | Log to notification_deliveries with status='failed' and error_message. Don't retry. | ✓ |
| Single retry, then log | Retry once immediately, then log as failed. | |
| Fall back to queued for retry | Enqueue to notification_deliveries with status='queued' for periodic sweep retry. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Daily 07:00, all overdue | Run daily around 07:00 WIB/WITA. Query all overdue kavlings. Deduplicate per code+profile+invoice+date. | ✓ |
| Multiple daily windows | Spread across 07:00, 12:00, 19:00. | |
| Admin-configurable schedule | Admin configures cron schedule and scope from app. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Once per month per invoice | At most once per month per invoice per billing period. | ✓ |
| Once total per overdue invoice | One reminder total per overdue invoice. | |
| Daily for all overdue | Send daily for every overdue invoice. | |

---

## Bot command UX

| Option | Description | Selected |
|--------|-------------|----------|
| Text commands only | Classic plain-text replies. No inline keyboards. Simple, universal. | ✓ |
| Text + inline keyboards | Mix of text commands with inline keyboards for navigation. | |
| Quick queries only, app for detail | Push users toward web app for complex interactions, bot handles only quick queries. | |

| Option | Description | Selected |
|--------|-------------|----------|
| All kavlings in one summary | Show all linked kavlings in one message with per-kavling sections. | ✓ |
| Interactive kavling picker first | If multiple kavlings, reply with inline keyboard to select which kavling. | |
| Primary kavling only + hint | Show only primary kavling with instruction for others. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pending count + summary | Pending verification count + recent submission summary. Link to web app for full management. | ✓ |
| Full admin dashboard | Pending count, recent submissions, monthly collection summary, opt-in toggles. | |
| No admin bot commands | Admin users get no special bot commands. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Simple confirmation | "Akun Telegram kamu sudah terhubung dengan IPL Jatiloka." | ✓ |
| Confirmation + command list | Confirmation + list all command shortcuts. | |
| Confirmation + preference setup | Confirmation + prompt to set notification preferences via web app link. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Bot-side confirmation | /unlink prompts confirmation in bot. If confirmed, record deleted. | ✓ |
| App-side unlink only | Unlink only from web app settings page. | |
| Both bot and app | Both bot and web app support unlinking. | |

---

## Resident Telegram settings UX

| Option | Description | Selected |
|--------|-------------|----------|
| New section above preferences | Dedicated "Akun Telegram" section above notification preferences. | ✓ |
| Below notification toggles | Inline below the notification preference toggles. | |
| Header badge only | Simple status badge next to page header. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Deep link in browser | App calls Edge Function → shows clickable deep link → resident clicks, opens Telegram, bot confirms. | ✓ |
| Enter username to link | Resident enters Telegram username → system validates and links. | |
| Code exchange flow | App generates short code → resident sends code to bot. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Show full linked account info | Telegram username, first name, and linked date. | ✓ |
| Status only | Show only Terhubung/Tidak terhubung. | |
| Username only | Show username only, no personal names. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Status resets, prefs preserved | "Tidak terhubung" with note that preferences are saved. | ✓ |
| Status + prefs auto-disabled | Status resets and all Telegram preferences auto-disabled. | |
| Simple status reset only | Status resets, no extra messaging. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reject with clear message | "Akun Telegram @username sudah terhubung ke akun lain." | ✓ |
| Auto-transfer to new profile | Old link silently removed, new link created. | |
| Allow shared accounts | Remove unique constraint, multiple profiles share one Telegram account. | |

---

## Admin-side Telegram configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-editable from web app | Admin can edit notification templates from web app. | ✓ |
| Code-managed only | Templates managed via SQL migrations/seeds only. | |
| Code-managed + admin toggle | Code-managed with per-template active toggle in admin UI. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full CRUD + preview + audit | CRUD with template preview, reset-to-default, and audit logging. | ✓ |
| Simple edit form | Just title and body textarea. | |
| Read-only display only | Templates displayed read-only with request-change flow. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full delivery visibility | Dedicated Telegram page with linked residents count, delivery table with filters, failure summary. | ✓ |
| Aggregate stats only | Linked count and aggregate delivery stats only. | |
| No admin visibility | Telegram delivery is resident-side concern only. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Always on, resident opt-in | All templates active. Residents control their own opt-in per category. | ✓ |
| Admin template toggles | Admin can turn off specific notification types. | |
| Role-based admin alert routing | Admin configures which roles receive admin alerts. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated page + inline badges | admin/telegram page + inline delivery status badges on relevant pages. | ✓ |
| Inline badges only | Show delivery status where the event happened (submission detail, announcement detail). | |
| Dedicated audit page only | One Telegram tab in reports area. No inline badges. | |

---

## OpenCode's Discretion

- Exact layout, copy, and badge styling on the resident settings Telegram section
- Exact visual design of the admin template editor and delivery visibility page
- Exact cron expression for reminder and monthly summary schedules
- Token generation implementation details (byte length, encoding, hashing — as long as the M08 one-time-token contract is satisfied)
- Webhook secret validation implementation (header name, comparison method)
- Whether templates use mustache-style `{{var}}` or another interpolation format

## Deferred Ideas

None — discussion stayed within Phase 5 scope.
