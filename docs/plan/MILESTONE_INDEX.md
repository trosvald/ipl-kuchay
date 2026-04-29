# IPL Jatiloka Milestone Shards

Use these files as the execution entrypoints. The master plan remains the product/spec source:

- `CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md`

Execution rules:

1. Work one milestone at a time.
2. Read the milestone shard first, then only the referenced master-plan sections.
3. Do not start the next milestone until acceptance checks pass or blockers are documented.
4. Keep the old prototype available only as reference until its replacement is working.
5. Preserve the non-negotiables: no public CRUD model, no public proof files, no browser secrets, no client-side admin security, no WhatsApp references.

Current frontend baseline after M02:

- Next.js App Router with TypeScript.
- Tailwind CSS and shadcn/ui component patterns.
- Frontend paths use `app/`, `features/`, `components/`, and `lib/` (not `src/`).

Milestones:

- [M00 Project Baseline](milestones/M00-project-baseline.md)
- [M01 Supabase Schema](milestones/M01-supabase-schema.md)
- [M02 Auth Roles](milestones/M02-auth-roles.md)
- [M03 Kavlings Residents](milestones/M03-kavlings-residents.md)
- [M04 Billing Invoices](milestones/M04-billing-invoices.md)
- [M05 Manual Proof Upload](milestones/M05-manual-proof-upload.md)
- [M06 Verification Audit](milestones/M06-verification-audit.md)
- [M07 Reports History](milestones/M07-reports-history.md)
- [M08 Telegram Foundation](milestones/M08-telegram-foundation.md)
- [M09 Telegram Notifications](milestones/M09-telegram-notifications.md)
- [M10 Bulk Import](milestones/M10-bulk-import.md)
- [M11 Penalties Automation](milestones/M11-penalties-automation.md)
- [M12 PWA](milestones/M12-pwa.md)
- [M13 Midtrans QRIS](milestones/M13-midtrans-qris.md)
- [M14 Deployment Hardening](milestones/M14-deployment-hardening.md)

Recommended first execution prompt:

```text
Read docs/plan/milestones/M00-project-baseline.md and the referenced sections of CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md. Implement only Milestone 0. Run its verification commands. Stop with changed files, test results, and blockers.
```
