# Phase 2: Billing Configuration & Resident Billing View - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete admin billing configuration (periods, fee types, overrides, penalties, invoice generation) and give residents one trustworthy billing experience showing invoice breakdowns, arrears, due dates, and historical status. Payment submission, verification, and reporting are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Invoice generation flow
- **D-01:** Invoice generation uses a two-step preview-then-confirm flow. Admin sees which kavlings will receive invoices and their amounts before committing. This catches override or fee mistakes before invoices exist.
- **D-02:** Re-running invoice generation is idempotent addition only. Existing invoices are never overwritten. Only kavlings that don't yet have an invoice for the period get one created. This supports adding newly-activated kavlings without risking data loss.
- **D-03:** Fee overrides are auto-resolved at generation time. The `generate_invoices_for_period` RPC checks `kavling_fee_overrides` whose active window covers the billing period month and applies the override amount instead of the default. No per-kavling override preview step before generation.

### Resident billing view
- **D-04:** Residents with multiple kavlings see their billing organized as per-kavling cards or tabs. Totals are per-kavling, not merged into one combined household total. This aligns with Phase 1 decision D-15 that multi-kavling data must stay grouped by kavling.
- **D-05:** Invoice breakdowns are displayed as expandable detail within each invoice card. Each card shows total amount, status badge, and due date. Clicking or expanding reveals the fee item breakdown (base fee, overrides, penalties). Keeps the list scannable while providing full detail on demand.
- **D-06:** Arrears are shown as a summary card at the top of the resident billing view, then the period-ordered invoice list appears below. The arrears summary gives the total overdue amount across all past periods so residents see the big number immediately, while the list provides per-period detail.

### Penalty rules and overdue
- **D-07:** Penalties use a flat amount per overdue period model. Admin defines a penalty fee type with a fixed late fee amount (e.g., Rp 25.000). Each overdue period adds that flat amount. Simple to understand, communicate, and audit.
- **D-08:** Penalty application is admin-triggered on demand. Admin clicks "Apply penalties" for a billing period. The system finds overdue invoices and presents a preview of which invoices will receive penalty items before confirming. Controllable and auditable; residents won't see automatic penalties before admin review.
- **D-09:** Penalties can be applied repeatedly per overdue period cycle. Each penalty application checks whether an invoice already has a penalty item for that overdue cycle. If not, one is added. An invoice overdue for 3 months can accumulate up to 3 penalty items across separate application cycles.

### Billing period lifecycle
- **D-10:** Billing period status follows linear with one-step-back: draft → open → closed → archived. Reopening from closed to open is allowed for corrections. Archiving is irreversible. The existing `draft`, `open`, `closed`, `archived` statuses in `BillingPeriodsPage` and `billingPeriodStatusSchema` are preserved.
- **D-11:** Invoices can be generated while a period is in draft status. Draft period invoices start in draft status. The admin previews everything, then opens the period which also activates the invoices for resident visibility. This gives full control before residents see anything.
- **D-12:** Archived periods remain visible to residents but read-only. Residents can still view archived period invoices for history and receipts, but no new actions (payments, adjustments) are possible on archived invoices. Financial records stay accessible for transparency.

### OpenCode's Discretion
- Exact layout and card design for per-kavling billing tabs
- Arrears summary visual treatment (color, prominence, position)
- Invoice expand/collapse animation and detail formatting
- Penalty preview table columns and confirmation UX
- Draft vs open period visual distinction in admin UI
- Sort order and default period filter for resident invoice list

</decisions>

<specifics>
## Specific Ideas

- Invoice preview should show kavlings, amounts, and overrides clearly so admin can catch mistakes before committing.
- Arrears summary should give residents an immediate sense of total overdue without scrolling through past periods.
- Flat penalty amounts are easier for a neighborhood context — residents understand "Rp 25.000 per bulan terlambat" more than percentage calculations.
- Draft invoice workflow mirrors common billing tools — configure offline, then publish when ready.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/PROJECT.md` — product constraints, billing and rollout priorities, PRD-level billing expectations.
- `.planning/REQUIREMENTS.md` — authoritative Phase 2 requirements BILL-01 through BILL-07.
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and fixed scope boundary.

### Existing billing and invoice contracts
- `supabase/migrations/0010_m04_yearly_fee_cycle.sql` — `generate_invoices_for_period` RPC, billing_cycle/charge_month columns on fee_types, yearly fee handling.
- `supabase/migrations/0002_tables.sql` — baseline tables: billing_periods, invoices, invoice_items, fee_types, kavling_fee_overrides schema.
- `supabase/migrations/0005_rls_policies.sql` — RLS policy baseline for billing, invoice, and fee tables.
- `lib/validation.ts` — existing Zod schemas: `billingPeriodFormSchema`, `billingPeriodStatusSchema`, `feeTypeFormSchema`, `feeOverrideFormSchema`.
- `features/billing/BillingPeriodsPage.tsx` — current admin billing period management UI.
- `features/billing/ResidentInvoicesPage.tsx` — current resident invoice list page (single-kavling, no breakdown, no arrears summary).
- `features/settings/FeeTypesPage.tsx` — current admin fee type management.
- `features/settings/FeeOverridesPage.tsx` — current admin fee override management.

### Access and identity contracts (Phase 1)
- `.planning/phases/01-access-scope-resident-identity/01-CONTEXT.md` — role boundaries (treasurer finance-only, admin operations), multi-kavling model, resident self-service patterns.
- `supabase/migrations/0012_m07_access_scope_identity.sql` — RLS helpers, mapping history, notification preferences.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/billing/BillingPeriodsPage.tsx` — current admin period management with lifecycle status transitions; serves as the base for draft/open/close/archive flow extension.
- `features/billing/ResidentInvoicesPage.tsx` — current resident invoice list; needs per-kavling grouping, breakdown expansion, and arrears summary additions.
- `features/settings/FeeTypesPage.tsx` and `FeeOverridesPage.tsx` — admin fee type and override CRUD; penalty fee type configuration should extend this.
- `supabase/migrations/0010_m04_yearly_fee_cycle.sql` — `generate_invoices_for_period` RPC already resolves overrides and creates invoices; needs draft invoice support and preview capability.
- `lib/validation.ts` — existing Zod schemas for billing period form, fee type form, and fee override form provide validation baseline.
- `lib/format.ts` — `formatRupiah`, `formatMonthYearId`, `formatBillingPeriodStatusLabel`, `statusToBadgeVariant` — reuse for resident-facing formatting.

### Established Patterns
- Client components query Supabase directly with RLS-enforced authorization (established in Phase 1).
- Admin mutations use `writeAuditLog` for auditable operations; penalty application and invoice generation should follow this pattern.
- Status lifecycle uses `billingPeriodStatusSchema` and `statusToBadgeVariant` for consistent badge rendering.
- Fee types support `is_penalty` flag and `is_recurring` with `billing_cycle` and `charge_month` — penalty configuration should build on this existing model.

### Integration Points
- Invoice generation RPC should be updated to support draft invoice creation and preview mode without persisting.
- Resident billing view connects via `RequireAuth` and `ResidentShell` in the `/app` route.
- Admin billing period pages connect via `RequireAdminLike` and `AdminShell` in the `/admin` route.
- Treasurer-specific nav entry for billing periods already exists in `features/layout/adminNavigation.ts` per Phase 1 D-01.
- Penalty application is a new admin action that needs both a UI entry point and a new RPC or extension of existing generation logic.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 02-billing-configuration-resident-billing-view*
*Context gathered: 2026-04-30*