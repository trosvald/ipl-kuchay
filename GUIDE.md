# IPL Jatiloka Implementation Guide

This guide is a local companion for running the implementation with an AI coding agent. It is intentionally ignored by git.

Canonical local planning files:

- `CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md`
- `docs/plan/MILESTONE_INDEX.md`
- `docs/plan/milestones/M00-project-baseline.md` through `M14-deployment-hardening.md`

## Operating Rules

1. Work exactly one milestone at a time.
2. Start from the milestone shard, then read only the referenced master-plan sections.
3. Do not implement future milestone features early unless required to make the current milestone pass.
4. Run every verification command listed in the milestone shard.
5. If verification fails, fix it before moving to the next milestone.
6. Stop after each milestone with changed files, test results, and blockers.
7. Keep security rules above convenience:
   - no public CRUD payment model
   - no public proof files
   - no secrets in browser code
   - no client-side admin security
   - no direct workflow table mutation where RPC/Edge Function invariants are required
   - no WhatsApp references

## Standard Completion Report

Ask the coding agent to finish each milestone with this structure:

```text
Milestone completed: Mxx - <name>

Changed files:
- ...

Verification:
- npm run typecheck: pass/fail/not run
- npm run test: pass/fail/not run
- npm run build: pass/fail/not run
- milestone-specific checks: pass/fail/not run

Notes:
- ...

Blockers:
- none
```

## Before Starting

Recommended repository hygiene:

```bash
git status --short
npm install
```

If dependencies or Supabase CLI are missing, install/configure them before starting the affected milestone. Do not skip verification silently.

## Companion Prompts

### M00 - Project Baseline And Tooling

```text
Read docs/plan/milestones/M00-project-baseline.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 0.

Focus on TypeScript/Vite tooling, dependency setup, folder structure, format/validation helpers, test setup, and a placeholder dashboard route. Move the old prototype to legacy reference only; do not keep ADMIN_PIN or old Supabase payments logic in active code.

Run:
npm run typecheck
npm run test
npm run build
grep -Rni "ADMIN_PIN\|whatsapp\|wa.me\|group wa" . --exclude-dir=node_modules --exclude-dir=.git --exclude="CODEx_MASTER_PLAN*.md" || true

Stop after reporting changed files, verification results, and blockers.
```

### M01 - Supabase Schema, Storage, Seed, Local Reset

```text
Read docs/plan/milestones/M01-supabase-schema.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 1.

Create Supabase config and migrations for enums, tables, indexes, triggers, RLS helpers, business RPCs, policies, private storage buckets, and seed data. Apply all critical corrections from the shard: corrected invoice generation SQL, safe public dashboard publishing, payment idempotency indexes, primary resident uniqueness, fee override overlap protection, and initial invoice_penalties table.

Run:
supabase db reset

Then run the manual SQL checks listed in the shard if local Supabase is available. Stop after reporting changed files, verification results, and blockers.
```

### M02 - Auth, Profiles, Roles, Route Guards

```text
Read docs/plan/milestones/M02-auth-roles.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 2.

Build Supabase browser client, auth provider/hooks, login page, route guards, admin invite Edge Function, profile creation path, and first-super-admin bootstrap docs. Do not import service-role secrets in frontend code. Do not create a public self-promotion endpoint.

Run:
npm run typecheck
npm run test
npm run build
grep -Rni "SERVICE_ROLE\|service_role" src || true

Stop after reporting changed files, verification results, and blockers.
```

### M03 - Kavling And Resident Management

```text
Read docs/plan/milestones/M03-kavlings-residents.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 3.

Build admin kavling management, resident management, resident-kavling mapping, resident home linked kavling view, and audit logging for sensitive changes. Enforce super_admin-only super_admin role changes and one active primary resident per kavling.

Run:
npm run typecheck
npm run test
npm run build

Manually verify resident cannot access neighbor mappings through UI or direct Supabase query if local Supabase is available. Stop after reporting changed files, verification results, and blockers.
```

### M04 - Billing Periods, Fee Types, Invoice Generation

```text
Read docs/plan/milestones/M04-billing-invoices.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 4.

Build fee type management, fee overrides, billing period management, invoice generation RPC integration, period detail, resident invoice list/detail, and public aggregate dashboard. Use real due dates and DB periods; remove hard-coded month/year arrays from active code.

Run:
npm run typecheck
npm run test
npm run build

If local Supabase is available, verify invoice count equals active kavling count and invoice amount_due equals item totals. Stop after reporting changed files, verification results, and blockers.
```

### M05 - Manual Transfer And Private Proof Upload

```text
Read docs/plan/milestones/M05-manual-proof-upload.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 5.

Build resident manual payment submission with private proof upload, controlled RPC/Edge Function workflow, proof metadata attachment, invoice status recalculation, signed proof URL function, and submission history. Never use getPublicUrl for payment proofs. Clean up broken submissions if upload fails.

Run:
npm run typecheck
npm run test
npm run build
grep -Rni "getPublicUrl" app components features lib supabase/functions || true

Stop after reporting changed files, verification results, and blockers.
```

### M06 - Admin Verification Workflow And Audit

```text
Read docs/plan/milestones/M06-verification-audit.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 6.

Build admin submissions tabs, signed proof preview/open action, approve/reject flows, invoice status recalculation, duplicate-payment prevention checks, and audit logging. Reject only submitted submissions and require rejection reason.

Run:
npm run typecheck
npm run test
npm run build

Stop after reporting changed files, verification results, and blockers.
```

### M07 - Reports, CSV, PDF, History, Arrears

```text
Read docs/plan/milestones/M07-reports-history.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 7.

Build admin reports, monthly invoice CSV, all payments CSV, arrears view/report, resident payment history, receipt PDF, monthly PDF report, and optional report metadata save. Enforce admin-only report routes and resident-only own receipt/history access.

Run:
npm run typecheck
npm run test
npm run build

Stop after reporting changed files, verification results, and blockers.
```

### M08 - Telegram Bot Foundation And Account Linking

```text
Read docs/plan/milestones/M08-telegram-foundation.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 8.

Build Telegram webhook with secret validation, shared Telegram client, account linking token flow, /app/telegram UI, bot commands, and Telegram setup docs. Store only hashed link tokens. Do not expose proof links or private files in bot output.

Run:
npm run typecheck
npm run test
npm run build
grep -Rni "whatsapp\|wa.me\|wa group\|group wa" . --exclude-dir=node_modules --exclude-dir=.git --exclude="CODEx_MASTER_PLAN*.md" || true

Stop after reporting changed files, verification results, and blockers.
```

### M09 - Telegram Notifications, Reminders, Monthly Summaries

```text
Read docs/plan/milestones/M09-telegram-notifications.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 9.

Build template rendering, notification delivery logging, proof/payment status notifications, scheduled reminders, admin-triggered reminders, monthly admin summaries, and notification settings. Ensure reminder idempotency and cron/admin function security.

Run:
npm run typecheck
npm run test
npm run build

Stop after reporting changed files, verification results, and blockers.
```

### M10 - Bulk Import

```text
Read docs/plan/milestones/M10-bulk-import.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 10.

Build admin CSV imports for kavlings, residents, mappings, fee overrides, and opening balances. Include sample downloads, client validation, server revalidation, preview UI, import_jobs records, and audit logs. Only super_admin may import admin/super_admin roles.

Run:
npm run typecheck
npm run test
npm run build

Stop after reporting changed files, verification results, and blockers.
```

### M11 - Penalties And Advanced Fee Automation

```text
Read docs/plan/milestones/M11-penalties-automation.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 11.

Build penalty rules UI, apply penalty RPC/job, event contribution flow, recalculation after fee/penalty changes, audit logs, and reminder wording support for denda. Verify invoice_penalties uniqueness makes penalty application idempotent.

Run:
npm run typecheck
npm run test
npm run build

Stop after reporting changed files, verification results, and blockers.
```

### M12 - PWA

```text
Read docs/plan/milestones/M12-pwa.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 12.

Add manifest, icons, service worker, registration, install prompt, and app-shell-only caching. Do not cache authenticated API responses, Supabase calls, signed proof URLs, or proof files. Verify auth callback still works.

Run:
npm run typecheck
npm run test
npm run build

Stop after reporting changed files, verification results, and blockers.
```

### M13 - Midtrans QRIS Payment Gateway

```text
Read docs/plan/milestones/M13-midtrans-qris.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 13.

Build feature-flagged Midtrans QRIS flow: shared client, create-qris-payment, webhook signature verification, gateway transaction UI, status refresh, reconciliation, Telegram paid notification, and setup docs. Keep server key out of frontend and make webhook idempotent.

Run:
npm run typecheck
npm run test
npm run build
grep -Rni "MIDTRANS_SERVER_KEY" app components features lib || true

Stop after reporting changed files, verification results, and blockers.
```

### M14 - Deployment, Hardening, Production Handover

```text
Read docs/plan/milestones/M14-deployment-hardening.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 14.

Write deployment, security, data dictionary, Telegram, Midtrans, and admin handover docs. Run full hardening checks, production build, Supabase reset, dangerous-string scans, and final release checklist. Do not add new product features unless required to close a security/deployment/handover gap.

Run:
npm run typecheck
npm run test
npm run lint
npm run build
supabase db reset
grep -Rni "ADMIN_PIN\|getPublicUrl(.*payment-proofs\|whatsapp\|wa.me\|group wa" . --exclude-dir=node_modules --exclude-dir=.git --exclude="CODEx_MASTER_PLAN*.md" || true

Stop after reporting changed files, verification results, blockers, and production readiness.
```

## Recovery Prompts

Use these when work goes off track.

### Security Drift Audit

```text
Audit the current implementation against CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md sections 10, 11, 14, 15, and 21. Fix only security violations. Run typecheck, tests, build, and dangerous-string scans. Report findings first, then changed files.
```

### Resume Current Milestone

```text
Read the current milestone shard in docs/plan/milestones and inspect git status. Continue only unfinished tasks from that shard. Do not start the next milestone. Run the shard verification commands and report blockers.
```

### Stop And Stabilize

```text
Stop feature work. Inspect failing checks, TypeScript errors, tests, build output, and Supabase migration failures. Fix only what is required to restore the current milestone verification commands. Report remaining risks.
```
