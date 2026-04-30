# Phase 3: Manual Payments, Reporting & Audit - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make manual transfer payment operations trustworthy end-to-end by aligning resident submission and status tracking, operator verification and proof review, and finance reporting/export outputs to one consistent invoice/payment truth. This phase includes manual payment lifecycle UX and finance reporting surfaces; it does not add new payment rails or out-of-scope communication features.

</domain>

<decisions>
## Implementation Decisions

### Payment status language
- **D-01:** Use a single canonical status label map in `lib/format.ts` and reuse it across resident and admin surfaces to enforce PAY-07 consistency.
- **D-02:** Rejected submission UX must include an inline actionable checklist (not only a rejection reason), including clear resubmission guidance in Indonesian.

### Verification workflow policy
- **D-03:** Overpay submissions are blocked at submission time (amount must not exceed outstanding amount), with deterministic error messaging.
- **D-04:** Verification notes remain optional for approve; rejection reason remains mandatory (minimum 3 characters).

### Proof review security UX
- **D-05:** Proof preview stays signed-URL based with short-lived, view-oriented access opened per request; no persistent public links.
- **D-06:** Proof preview failures must show inline reason + retry action (no generic-only failure feedback).

### Reporting and export contract
- **D-07:** Default `/admin/reports` scope is all-time dashboard first, with drill-down/filtering to billing period and arrears operations.
- **D-08:** Monthly report and receipt generation is metadata-first for this phase: persist auditable generation records in `public.reports`, with file artifact handling allowed to iterate.
- **D-09:** CSV baseline is one canonical operational export aligned with the same filtered truth shown on-screen.

### Receipt and queue operations
- **D-10:** Resident receipt visibility uses invoice detail as the full source plus a compact list-level summary for quick trust checks.
- **D-11:** Pending review queue defaults to oldest-first ordering to reduce long-tail verification delays.

### Report consistency handling
- **D-12:** `/admin/reports` uses live-query data with last-updated visibility and manual refresh control.
- **D-13:** If cross-screen totals temporarily diverge, show a reconciliation warning + refresh CTA rather than silently ignoring or hard-blocking all actions.

### OpenCode's Discretion
- Exact visual structure of badges, callouts, and reconciliation warning components as long as semantics remain consistent with these decisions.
- Precise CSV column ordering and naming, as long as it remains canonical and reflects the same filtered dataset users see.
- Exact placement of compact receipt summary in resident billing list/detail surfaces.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/PROJECT.md` — non-negotiables for privacy, manual-transfer-first rollout, Indonesian UX language, and role boundaries.
- `.planning/REQUIREMENTS.md` — authoritative scope for `PAY-01..PAY-07` and `RPRT-01..RPRT-05`.
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and fixed scope boundary.

### Prior locked decisions
- `.planning/phases/01-access-scope-resident-identity/01-CONTEXT.md` — finance-only treasurer boundary, private-proof/security posture, and multi-kavling grouping constraints.
- `.planning/phases/02-billing-configuration-resident-billing-view/02-CONTEXT.md` — resident billing IA and status/readability conventions that Phase 3 must remain consistent with.

### Existing payment and verification contracts
- `supabase/migrations/0011_m06_verification_audit.sql` — `recalculate_invoice_status`, `verify_payment_submission`, and `reject_payment_submission` behavior and audit linkage.
- `supabase/functions/create-payment-submission/index.ts` — submission creation contract before proof attachment.
- `supabase/functions/attach-payment-proof/index.ts` — proof metadata attachment flow.
- `supabase/functions/cancel-payment-submission/index.ts` — rollback/cancel path when upload/attach fails.
- `supabase/functions/get-proof-signed-url/index.ts` — permission-checked signed URL access model for private proof files.

### Existing UI contracts
- `features/payments/PaymentSubmissionForm.tsx` — resident manual transfer submission guards and validation boundaries.
- `features/payments/SubmissionHistory.tsx` — resident-visible submission lifecycle and rejection context surface.
- `features/payments/AdminSubmissionsPage.tsx` — operator review queue, tabs, and review action orchestration.
- `features/payments/SubmissionReviewModal.tsx` — approve/reject decision capture and rejection reason UX.
- `features/payments/ProofPreviewButton.tsx` — current signed URL preview interaction and failure handling baseline.

### Planning contracts already present for this phase
- `.planning/phases/03-manual-payments-reporting-audit/03-01-PLAN.md` — SQL/RPC invariants and audit hardening baseline.
- `.planning/phases/03-manual-payments-reporting-audit/03-02-PLAN.md` — resident/operator payment UX alignment baseline.
- `.planning/phases/03-manual-payments-reporting-audit/03-03-PLAN.md` — reporting route, export, and metadata-output baseline.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/payments/PaymentSubmissionForm.tsx`: already enforces invoice-eligibility and overpay guard; can be extended for richer lifecycle feedback without changing trust boundaries.
- `features/payments/SubmissionHistory.tsx`: existing resident table can host standardized labels and explicit next-step guidance.
- `features/payments/AdminSubmissionsPage.tsx`: existing queue/search/tab scaffolding supports ordering, status consistency, and review UX hardening.
- `features/payments/SubmissionReviewModal.tsx`: existing modal already separates approve/reject policy and can enforce structured operator notes behavior.
- `features/payments/ProofPreviewButton.tsx`: existing signed-URL opening flow is the right security pattern to keep.
- `lib/format.ts`: shared formatting/status mapping hub to centralize label consistency across screens.

### Established Patterns
- Role and access enforcement remains backend-first via Supabase Auth + RLS + security-definer/RPC paths.
- Admin mutations and sensitive transitions are auditable through SQL audit logs and existing audit action patterns.
- User-facing errors are rendered inline with component state; this pattern should continue for payment and report reconciliation UX.

### Integration Points
- Resident flow integration: `features/billing/InvoiceDetailPage.tsx` renders payment submission and history components.
- Operator flow integration: `app/admin/submissions/page.tsx` routes into `AdminSubmissionsPage` for verify/reject/proof actions.
- Reporting flow integration: `app/admin/reports/page.tsx` and `features/reports/*` (to be completed) must align with payment/invoice truth and role-scoped navigation.
- Data truth integration: `payment_submissions`, `payments`, and `invoices` status transitions must stay in lockstep with report query/export outputs.

</code_context>

<specifics>
## Specific Ideas

- Rejected payment states should not stop at "Ditolak"; residents should immediately see what to fix and how to resubmit.
- Reports should feel operationally trustworthy: users can see freshness context and quickly reconcile mismatches with explicit prompts.
- Queue fairness matters for neighborhood trust: older pending submissions should not be starved by newer entries.
- All-time reporting default is preferred for leadership visibility, while keeping actionable drill-downs for period operations.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 3 scope.

</deferred>

---

*Phase: 03-manual-payments-reporting-audit*
*Context gathered: 2026-04-30*
