# Milestone 11 - Penalties And Advanced Fee Automation

Source sections:

- Master plan sections 19, 20, 22 Milestone 11.

Goal:

- Denda and one-off fee automation are production-ready.

Files to create/change:

- `features/settings/PenaltyRulesPage.tsx`
- `features/billing/AddEventContributionModal.tsx`
- `supabase/functions/apply-penalties/index.ts` or RPC/job
- `supabase/functions/_shared/notifications.ts` if reminder wording needs data
- tests for penalty calculation and idempotency.

Penalty contract:

- Penalty rule fields: `days_after_due`, `fixed_amount`, `percent_amount`, `max_amount`, `active`.
- Apply only to invoices with status `unpaid`, `partial`, or `overdue`.
- Create one `invoice_items` row using fee type `PENALTY`.
- Create one `invoice_penalties` metadata row.
- Recalculate invoice amount/status after application.

Event contribution contract:

- Admin can apply a non-recurring fee to selected kavlings or all active kavlings for one period.
- Action must be audited.
- Recalculation must update affected invoice totals.

Critical corrections to apply:

- `invoice_penalties` exists from the initial schema.
- Unique `(invoice_id, penalty_rule_id)` must prevent duplicate application.

Tasks:

1. Verify `invoice_penalties` table and uniqueness.
2. Build penalty rules UI.
3. Implement apply penalty RPC/job.
4. Add one-off event contribution flow for selected/all active kavlings.
5. Recalculate invoices after fee/penalty changes.
6. Write audit logs.
7. Update Telegram reminder wording to include denda when applicable.

Acceptance:

- Fixed denda can be configured.
- Penalty applies exactly once per invoice/rule.
- Invoice `amount_due` increases correctly.
- Event contribution can be added to all active kavlings for one period.
- Applying penalties twice leaves totals unchanged on second run.

Out of scope:

- Do not add payment gateway late fees outside invoice item model.

Verification:

```bash
npm run typecheck
npm run test
npm run build
```
