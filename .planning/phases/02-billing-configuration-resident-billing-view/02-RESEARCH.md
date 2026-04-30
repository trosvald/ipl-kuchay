# Phase 2 Research — Billing Configuration & Resident Billing View

**Date:** 2026-04-30
**Phase:** 02-billing-configuration-resident-billing-view

## Research Goal

Answer: what must be true to plan Phase 2 well without weakening the current Supabase trust boundary or confusing residents about billing truth.

## Current-State Findings

- Admin billing already has working CRUD for billing periods, fee types, and fee overrides, but invoice generation is still a one-click commit with no preview step.
- `generate_invoices_for_period(...)` already resolves active kavling overrides and yearly/monthly fee rules, so the core generation logic should be extended rather than replaced.
- The current RPC auto-opens the billing period after generation and creates invoices directly as `unpaid`; this conflicts with D-10 and D-11, which require draft invoices that only become resident-visible when the period is opened.
- Resident billing currently renders a flat table of invoices with totals and filters, but it does not expose invoice item breakdowns, per-kavling grouping, or a top-level arrears summary.
- Penalty infrastructure exists only partially: `fee_types.is_penalty`, `penalty_rules`, and `invoice_penalties` tables exist, but there is no admin-triggered preview/apply flow matching D-07 through D-09.

## Relevant Source Contracts

- `features/billing/BillingPeriodsPage.tsx` already owns billing period lifecycle transitions, invoice generation buttoning, and audit-log writes for period actions.
- `features/settings/FeeTypesPage.tsx` already supports penalty fee-type configuration through `is_penalty`, `default_amount`, and recurrence fields.
- `features/settings/FeeOverridesPage.tsx` already restricts overrides to recurring non-penalty fee types and validates date windows with `feeOverrideFormSchema`.
- `supabase/migrations/0010_m04_yearly_fee_cycle.sql` is the authoritative invoice-generation contract today: active kavlings only, idempotent insert-on-conflict, recurring non-penalty fee types, and override resolution by active date window.
- `supabase/migrations/0005_rls_policies.sql` already keeps billing reads in SQL via `public.can_access_kavling(...)`; resident billing improvements should keep using direct client reads under RLS instead of adding browser-only filtering.

## External Documentation Notes

### Supabase RLS helper-function patterns

Context7 Supabase docs reinforce two practices relevant here:

- keep row access decisions in SQL policies and helper functions instead of UI checks alone;
- use `security definer` helper/RPC functions carefully for cross-table checks and mutation workflows.

Implication: invoice preview/apply and penalty preview/apply are best modeled as SQL functions or SQL-backed RPC workflows consumed by the existing client components, while resident visibility still depends on RLS and billing-period status.

### Supabase policy performance guidance

Context7 also notes that `auth.uid()`-based checks are commonly wrapped with `select auth.uid()` in RLS helpers/policies to avoid repeated evaluation costs.

Implication: if Phase 2 introduces new billing-access helper functions or resident history predicates, they should match the existing helper-function pattern instead of pushing access logic into React state.

## Recommended Technical Direction

### 1. Split invoice generation into preview and commit RPCs

Recommended contract:

- `preview_invoices_for_period(target_period_id uuid)` returns kavling-level rows with resolved fee items, override source, and total;
- `generate_invoices_for_period(target_period_id uuid)` remains the commit step and preserves D-02 idempotency by inserting only missing `(billing_period_id, kavling_id)` invoices;
- commit RPC should create invoices in `draft` lifecycle state or equivalent resident-hidden state and must not auto-open the period.

Why: D-01, D-02, D-03, D-10, and D-11 require admin review before persistence becomes resident-visible.

### 2. Treat billing-period open as the publication gate

Recommended rule:

- draft period: admin-visible only, generation allowed, residents cannot see it;
- open period: resident-visible and eligible for later payment flows;
- closed and archived: resident-visible history, but no new mutable resident actions in later phases.

Why: this is the cleanest way to honor D-10 through D-12 using the existing `billing_periods.status` contract and `billing_periods_select_open_closed_or_admin` policy shape.

### 3. Keep override resolution in SQL and expose the winning source in preview output

Recommended preview row fields:

- `kavling_id`, `kavling_code`
- `fee_type_id`, `fee_code`, `fee_name`
- `default_amount`, `resolved_amount`
- `amount_source` = `default` | `override`
- `override_id` nullable
- `period_total`

Why: D-03 forbids a separate override workflow before generation, but D-01 still requires admin confidence that the generated amount is correct.

### 4. Add a dedicated penalty apply workflow instead of overloading invoice generation

Recommended contract:

- `preview_penalties_for_period(target_period_id uuid, cycle_key text)` returns overdue invoices eligible for a new penalty item;
- `apply_penalties_for_period(target_period_id uuid, cycle_key text)` inserts penalty rows/items only when that invoice has not yet been penalized for the same cycle;
- cycle identity should be explicit (for example `YYYY-MM`) so repeated monthly penalty runs are auditable and idempotent per cycle.

Why: D-07 through D-09 require flat late-fee accumulation across repeated overdue cycles with clear duplicate prevention.

### 5. Rebuild the resident billing page around kavling-first grouping

Recommended UI/data shape:

- top summary card for total arrears across overdue/unpaid past-due invoices;
- per-kavling sections/cards or tabs (per D-04), each containing invoices ordered by newest due date first;
- invoice card summary with status, due date, total, and expandable fee-item breakdown (per D-05);
- history remains in the same surface with archived/closed visibility preserved (per D-12).

Why: BILL-06 and BILL-07 depend on one trustworthy resident billing surface, not a flat undifferentiated table.

## Planning Implications

### Files likely to change

- New migration for preview/apply RPCs and billing-period publication behavior: `supabase/migrations/0013_*.sql`
- New SQL test coverage for invoice preview/idempotency/penalty cycles: `supabase/tests/sql/m02_phase2_billing.sql`
- Admin billing page: `features/billing/BillingPeriodsPage.tsx`
- Fee configuration pages/forms: `features/settings/FeeTypesPage.tsx`, `features/settings/FeeOverridesPage.tsx`, and related form components
- Resident billing surface: `features/billing/ResidentInvoicesPage.tsx`
- Validation/types: `lib/validation.ts`, possibly `lib/format.ts` for new labels/badges

### No new external libraries needed

The existing Next.js + React + Supabase + zod + Vitest stack is sufficient for this phase.

### High-risk areas to plan explicitly

- status/visibility drift between draft/open periods and resident invoice queries;
- preserving D-02 idempotency while adding preview and publication behavior;
- duplicate-penalty prevention across repeated admin-triggered cycles;
- shared-file collisions in `BillingPeriodsPage.tsx`, `ResidentInvoicesPage.tsx`, and `lib/validation.ts`.

## Common Pitfalls To Avoid

- Do **not** auto-open a billing period as a side effect of invoice generation.
- Do **not** overwrite existing invoices when re-running generation for newly activated kavlings.
- Do **not** calculate resident arrears by merging all kavlings into one household-only ledger; keep grouping per D-04.
- Do **not** expose draft-period invoices to residents just because the invoice rows exist.
- Do **not** model repeated penalty runs with only `(invoice_id, penalty_rule_id)` uniqueness if D-09 needs multiple monthly cycles.

## Validation Architecture

- Fast loop: `npm run test:unit`
- Full loop: `npm run test`
- DB safety checks: add a dedicated Phase 2 SQL test and keep `npm run test:sql` green
- Build gate: `npm run typecheck && npm run build`
- Every schema-changing plan should include a blocking `supabase db push` step before verification.

## Recommended Plan Shape

1. **SQL contract first** — preview/commit generation flow, draft/open resident visibility, penalty-cycle logic, SQL tests.
2. **Admin billing configuration second** — period lifecycle UI, preview/confirm actions, fee/penalty configuration, audit logging.
3. **Resident billing experience third** — per-kavling grouping, arrears summary, invoice breakdown expansion, history clarity.

## Research Conclusion

Phase 2 should be planned around a database contract first: billing preview, idempotent generation, publication gating, and repeatable penalty application all belong in SQL-backed workflows. Once that contract is explicit, the admin and resident UI plans can stay thin, auditable, and aligned with the existing direct-to-Supabase architecture.
