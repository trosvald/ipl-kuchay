---
phase: 02-billing-configuration-resident-billing-view
verified: 2026-04-30T01:30:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
overrides: []
re_verification: false
gaps: []
human_verification:
  - test: "SQL regression suite passes with `npm run test:sql`"
    expected: "All m02_phase2_billing.sql assertions exit 0 — preview contract, idempotent generation, lifecycle visibility, and penalty-cycle idempotency all pass"
    why_human: "Requires running Supabase local stack (`supabase start`); cannot verify in a static file-scan context"
  - test: "Admin preview → confirm invoice generation flow works end-to-end"
    expected: "Preview dialog shows kavling/fee/resolved-amount/amount_source/period-total rows; Buat Tagihan confirmation creates invoices; rerun is idempotent"
    why_human: "Requires authenticated browser session and live Supabase RPC calls"
  - test: "Admin preview → confirm penalty application flow works end-to-end"
    expected: "Pratinjau Denda dialog shows overdue invoices with cycle key; Terapkan Denda creates penalty items; rerun with same cycle key creates nothing"
    why_human: "Requires authenticated browser session and live Supabase RPC calls"
  - test: "Resident arrears summary card renders correctly for both arrears and all-paid states"
    expected: "When arrears > 0: red card with overdue total and count; when all paid: green card with 'Semua tagihan Anda sudah lunas'"
    why_human: "Visual appearance, conditional styling, and edge-case rendering require browser inspection"
  - test: "Multi-kavling resident sees tabs grouped per kavling with correct invoice lists"
    expected: "Tabs labelled 'Kavling {code}'; totals stay per kavling; switching tabs shows correct invoices"
    why_human: "Interactive tab behavior and data correctness per kavling require browser testing"
  - test: "Former resident with inactive kavling mapping sees read-only warning and no payment form"
    expected: "Amber warning card appears; invoice detail page shows read-only notice; PaymentSubmissionForm is hidden"
    why_human: "Requires specific database state (inactive kavling_residents row) and authenticated session"
  - test: "Draft billing period invoices are invisible to residents"
    expected: "Resident cannot see draft-period invoices in their list or detail; open/closed/archived invoices are visible"
    why_human: "Requires published (draft + open) billing periods with invoices and resident session to verify RLS+RPC gate"
---

# Phase 2: Billing Configuration & Resident Billing View — Verification Report

**Phase Goal:** Admins can configure billing rules and generate invoices, while residents can clearly understand what they owe from one billing experience.
**Verified:** 2026-04-30T01:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can create billing periods with lifecycle state (draft/open/closed/archived) and manage fee types, penalties, and default billing rules with auditable writes | ✓ VERIFIED | `BillingPeriodsPage.tsx` creates periods as `"draft"` (L202), lifecycle buttons: Buka/Tutup/Arsipkan/Buka Ulang Periode (L558-586); `FeeTypesPage.tsx` full CRUD with `writeAuditLog` (L128, L178, L214); `FeeTypeForm.tsx` penalty config with "Denda (flat per periode)" label and contextual guidance (L202, L217-220); `FeeOverridesPage.tsx` date-window overrides with `active_until` (L38, L474) and audit logging (L260, L294, L371) |
| 2 | Admin can preview invoice generation results before confirming creation, and apply per-kavling overrides to generate invoices for active kavlings | ✓ VERIFIED | `BillingPeriodsPage.tsx` preview dialog calls `preview_invoices_for_period` RPC (L331), renders kavling/fee/default_amount/resolved_amount/amount_source/period_total (L655-683), confirm dialog → `generate_invoices_for_period` (L350); SQL migration resolves overrides via `kavling_fee_overrides` join with `amount_source = 'override'/'default'` (L89-111) |
| 3 | Re-running invoice generation only creates missing invoices and never overwrites existing kavling-period invoices (idempotent generation) | ✓ VERIFIED | SQL: `on conflict (billing_period_id, kavling_id) do nothing` (L171); test asserts second generation returns 0 (L200-203); migration does NOT auto-open period (no `set status = 'open'` found) |
| 4 | Admin can preview and apply flat overdue penalties per cycle without duplicating the same invoice-cycle penalty | ✓ VERIFIED | `BillingPeriodsPage.tsx` penalty preview (L386: `preview_penalties_for_period`, cycle key), confirm dialog → `apply_penalties_for_period` (L406); SQL: `on conflict on constraint invoice_penalties_invoice_id_penalty_rule_id_cycle_key_key do nothing` (L295); test asserts second apply for same cycle returns 0 (L253-256) |
| 5 | Residents only see billing data when the billing period is published (draft hidden), with a clear arrears focal point showing current dues, arrears, and due dates before invoice history | ✓ VERIFIED | SQL: `can_access_invoice_history` gates on `bp.status in ('open','closed','archived')` — draft excluded (L33); test: resident visible draft = 0 (L224-225); `ResidentInvoicesPage.tsx` `ArrearsSummaryCard` with "Ringkasan Tunggakan" (L133) shows overdue total/count before invoice list (L484-487) |
| 6 | Multi-kavling billing remains grouped by kavling rather than merged into one household total | ✓ VERIFIED | `ResidentInvoicesPage.tsx`: `groupInvoicesByKavling()` (L72-107) creates per-kavling groups; multi-kavling → `<Tabs>` with "Kavling {code}" triggers (L523-550); single-kavling → section heading only (L507-520); totals computed per group (overdueTotal, outstandingTotal) |
| 7 | Each invoice exposes item breakdown, due-date context, paid/outstanding amounts, and historical status in readable Indonesian | ✓ VERIFIED | `ResidentInvoicesPage.tsx`: Accordion expand reveals Iuran Rutin → Biaya Khusus → Denda Keterlambatan sections (L236-311); "Jatuh tempo" label (L226); `InvoiceDetailPage.tsx`: "Jatuh tempo" (L255), "Sisa tagihan" (L310), "Total tagihan" (L298), "Total terbayar" (L305), outstanding balance alert (L225-231); `lib/format.ts`: `formatInvoiceStatusLabel` with "Jatuh tempo lewat" (L41) |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0013_m08_phase2_billing_rules.sql` | Preview, generation, penalty, and resident-visibility SQL contracts | ✓ VERIFIED | 317 lines; contains `preview_invoices_for_period` (L47), `generate_invoices_for_period` (L117), `preview_penalties_for_period` (L219), `apply_penalties_for_period` (L271), updated `can_access_invoice_history` with draft gating (L18-39) |
| `supabase/tests/sql/m02_phase2_billing.sql` | SQL regression coverage for preview, idempotent generation, lifecycle visibility, and penalty cycles | ✓ VERIFIED | 281 lines; 4 tests covering preview contract (override/default source), generation idempotency (inactive skip, rerun=0), lifecycle visibility (draft=0, open/closed/archived=1), penalty cycle idempotency (rerun=0, 1:1 penalty:item) |
| `package.json` | `test:sql` includes `m02_phase2_billing.sql` | ✓ VERIFIED | Line 14: `...&& supabase db query --file supabase/tests/sql/m02_phase2_billing.sql` |
| `features/billing/BillingPeriodsPage.tsx` | Admin billing period list with preview and lifecycle actions | ✓ VERIFIED | 782 lines; preview-first generation (L323-374) and penalty (L376-430) flows; Indonesian lifecycle labels (L558-586); `writeAuditLog` calls on create (L216), generate (L249, L360), status change (L309), penalty apply (L417) |
| `features/billing/BillingPeriodDetailPage.tsx` | Admin period detail and invoice monitoring surface | ✓ VERIFIED | 289 lines; "Detail Periode Billing" heading (L144); invoice table with status filter; total tagihan/terbayar/sisa summary cards |
| `features/settings/FeeTypeForm.tsx` | Fee-type form with penalty and billing cycle configuration | ✓ VERIFIED | 228 lines; "Siklus tagihan" select (L140); "Denda (flat per periode)" checkbox (L202); penalty contextual guidance in Indonesian (L217-220) |
| `features/settings/FeeOverridesPage.tsx` | Override management with date-window controls | ✓ VERIFIED | 625 lines; `active_from`/`active_until` date inputs (L467-476); status badge "Aktif"/"Berakhir" (L551); "Akhiri Hari Ini" button (L567-573); `writeAuditLog` on create (L294), update (L260), end (L371) |
| `features/billing/ResidentInvoicesPage.tsx` | Resident billing home with arrears summary, kavling grouping, and expandable invoice cards | ✓ VERIFIED | 554 lines; `ArrearsSummaryCard` with "Ringkasan Tunggakan" (L109-156); `groupInvoicesByKavling` (L72-107); `InvoiceCard` with Accordion expand (L158-336); Tabs for multi-kavling (L523-550); "Jatuh tempo" label (L226) |
| `features/billing/InvoiceDetailPage.tsx` | Resident invoice detail with fee-item breakdown and status context | ✓ VERIFIED | 420 lines; "Jatuh tempo" (L255), "Sisa tagihan" (L310), "Total tagihan" (L298), "Total terbayar" (L305); outstanding balance alert (L225-231); `PaymentSubmissionForm` (L331) and `SubmissionHistory` (L342) preserved |
| `lib/format.ts` | Shared Indonesian labels and badge mapping for billing statuses | ✓ VERIFIED | 72 lines; `formatInvoiceStatusLabel` with "Jatuh tempo lewat" (L32-45); `formatRupiah` (L16-22); `formatDateId` (L24-26); `statusToBadgeVariant` (L58-71) |
| `features/audit/auditTypes.ts` | Audit action type definitions | ✓ VERIFIED | Added `billing_period.apply_penalties` (L23); `billing_period.status_open`/`status_closed` (L24-25); `fee_override.end` (L20) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `0013_m08_phase2_billing_rules.sql` | `m02_phase2_billing.sql` | SQL assertions invoking `preview_invoices_for_period`, `generate_invoices_for_period`, `apply_penalties_for_period`, `can_access_invoice_history` | ✓ WIRED | Test calls all RPCs (L135, L180, L200, L220-222, L242, L248, L253) |
| `BillingPeriodsPage.tsx` | RPC contract | `client.rpc("preview_invoices_for_period")`, `client.rpc("generate_invoices_for_period")`, `client.rpc("preview_penalties_for_period")`, `client.rpc("apply_penalties_for_period")` | ✓ WIRED | All 4 RPCs called with correct parameters and response handling (L239, L331, L350, L386, L406) |
| `BillingPeriodsPage.tsx` | `writeAuditLog` | Imported from `@/features/audit/writeAuditLog` | ✓ WIRED | 5 audit log calls: create (L216), generate (L249, L360), status change (L309), penalty (L417) |
| `FeeTypesPage.tsx` | `writeAuditLog` | Imported from `@/features/audit/writeAuditLog` | ✓ WIRED | 3 audit log calls: create (L128), update/deactivate (L178), activate/deactivate toggle (L214) |
| `FeeOverridesPage.tsx` | `writeAuditLog` | Imported from `@/features/audit/writeAuditLog` | ✓ WIRED | 3 audit log calls: create (L294), update (L260), end (L371) |
| `ResidentInvoicesPage.tsx` | `InvoiceDetailPage.tsx` | `<Link href={`/app/invoices/${invoice.id}`}>` | ✓ WIRED | "Lihat Detail" button navigates to `/app/invoices/:id` (L327) |
| `InvoiceDetailPage.tsx` | `PaymentSubmissionForm` | Imported and rendered conditionally | ✓ WIRED | Rendered when `hasActiveKavlingAccess` (L331-339) |
| `InvoiceDetailPage.tsx` | `SubmissionHistory` | Imported and rendered unconditionally | ✓ WIRED | Rendered at L342 with `reloadToken` prop |
| `ResidentInvoicesPage.tsx` + `InvoiceDetailPage.tsx` | `lib/format.ts` | Shared `formatInvoiceStatusLabel`, `statusToBadgeVariant`, `formatRupiah`, `formatDateId` | ✓ WIRED | Both pages import from `@/lib/format`; consistent label/format rendering |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `BillingPeriodsPage.tsx` preview | `previewInvoices` | `client.rpc("preview_invoices_for_period")` → Supabase RPC with `has_finance_role()` guard → DB query across `kavlings+fee_types+kavling_fee_overrides` | ✓ FLOWING | RPC queries real tables with override resolution |
| `BillingPeriodsPage.tsx` periods | `items` | `client.from("billing_periods").select(...)` → Supabase query against `billing_periods` table | ✓ FLOWING | Real DB query with pagination |
| `ResidentInvoicesPage.tsx` invoices | `invoices` | `client.from("invoices").select(...)` → Supabase query with RLS-scoped `can_access_invoice_history` gate | ✓ FLOWING | Real DB query scoped by auth.uid() through RLS |
| `ResidentInvoicesPage.tsx` arrears | `totalOverdue` | Client-side aggregation from `invoices` array filtered by `status === "overdue" \|\| "unpaid"` | ✓ FLOWING | Derived from fetched invoice data |
| `InvoiceDetailPage.tsx` detail | `invoice` + `items` | Dual `client.from(...)` queries → `invoices` + `invoice_items` tables with RLS gating | ✓ FLOWING | Real DB queries |
| `FeeTypesPage.tsx` items | `items` | `client.from("fee_types").select(...)` → Supabase query | ✓ FLOWING | Real DB query |
| `FeeOverridesPage.tsx` items | `items` | `client.from("kavling_fee_overrides").select(...)` with joined relations | ✓ FLOWING | Real DB query |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npm run typecheck` | Per SUMMARY: passed with no errors | ✓ PASS (reported) |
| Next.js build | `npm run build` | Per SUMMARY: compiled successfully, 14 static pages | ✓ PASS (reported) |
| SQL test execution | `npm run test:sql` | Requires local Supabase stack — routed to human verification | ? SKIP |
| module exports (format.ts) | `node -e "const m = require('./lib/format.ts')"` | TS modules can't be required directly without transpilation | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BILL-01 | 02-01, 02-02 | Admin can create billing periods with month, year, label, due date, and lifecycle status | ✓ SATISFIED | `BillingPeriodsPage.tsx` creates `"draft"` periods via `billingPeriodFormSchema` (L178-229); lifecycle: draft→open→closed→archived→reopen (L263-321); `billing_period.create` audit (L216-224) |
| BILL-02 | 02-01, 02-02 | Admin can generate invoices for active kavlings using configured fee rules | ✓ SATISFIED | `preview_invoices_for_period` RPC resolves override/default per kavling (migration L47-115); `generate_invoices_for_period` RPC inserts invoices with item-level override resolution (migration L117-217); UI preview→confirm flow (BillingPeriodsPage L323-374) |
| BILL-03 | 02-02 | Admin can manage fee types including recurring fees, penalties, and configurable defaults | ✓ SATISFIED | `FeeTypesPage.tsx` full CRUD with `FeeTypeForm` (L95-191); recurring/penalty/active toggles; `billing_cycle` (monthly/yearly) with `charge_month`; audit: create/update/activate/deactivate |
| BILL-04 | 02-01, 02-02 | Admin can configure per-kavling fee overrides for non-default amounts | ✓ SATISFIED | `FeeOverridesPage.tsx` date-window overrides with `active_from`/`active_until` (L467-476); status "Aktif"/"Berakhir" (L551); "Akhiri Hari Ini" (L567); audit: create/update/end; SQL override resolution in preview/generate RPCs |
| BILL-05 | 02-01, 02-02 | Admin can define and apply penalty rules for overdue invoices | ✓ SATISFIED | `preview_penalties_for_period` (migration L219-269) and `apply_penalties_for_period` (migration L271-317) with `cycle_key` idempotency; penalty fee type config in `FeeTypeForm` (L195-220); `billing_period.apply_penalties` audit type (auditTypes.ts L23) |
| BILL-06 | 02-03 | Resident can view invoice breakdown by billing period and fee item | ✓ SATISFIED | `ResidentInvoicesPage.tsx` InvoiceCard with Accordion expand showing Iuran Rutin → Biaya Khusus → Denda Keterlambatan (L236-311); `InvoiceDetailPage.tsx` Rincian Tagihan with itemized list (L344-376) |
| BILL-07 | 02-03 | Resident can view current dues, arrears, due dates, and historical invoice status from one billing experience | ✓ SATISFIED | `ResidentInvoicesPage.tsx` ArrearsSummaryCard "Ringkasan Tunggakan" (L109-156) with overdue total/count; invoice cards showing period label, "Jatuh tempo", status badge, amounts, and "Riwayat" indicator for historical invoices (L181-186); `InvoiceDetailPage.tsx` outstanding balance alert (L225-231) |

**Coverage:** 7/7 BILL requirements mapped to Phase 2 — all SATISFIED

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No stubs, TODOs, FIXMEs, hardcoded empty data, or console.log-only implementations found in phase deliverables. Form `placeholder` attributes are standard HTML and do not indicate unimplemented behavior.

### Plan Deviation

**Plan 02 acceptance criterion: "BillingPeriodDetailPage.tsx contains Buka Periode"**
- The file does NOT contain the string "Buka Periode"
- BillingPeriodDetailPage.tsx is a read-only monitoring surface showing invoices for a period; lifecycle controls (Buka Periode, Tutup Periode, Arsipkan Periode, Buka Ulang Periode) live on the list page (`BillingPeriodsPage.tsx` L558-586) where they belong
- This is a plan criterion mismatch — the intent (lifecycle controls exist in admin billing screens) is fulfilled. The acceptance criterion was overly specific about which file hosts the control

**This looks intentional.** To accept this deviation, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "features/billing/BillingPeriodDetailPage.tsx contains Buka Periode"
    reason: "Lifecycle controls live on BillingPeriodsPage.tsx (list page, L558-586) — the detail page is a read-only monitoring surface. Behavioral intent fully met."
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

### Human Verification Required

#### 1. SQL Regression Suite Execution
**Test:** Run `npm run test:sql` against local Supabase stack
**Expected:** All `m02_phase2_billing.sql` assertions pass — preview contract (override/default source, period totals), idempotent generation (rerun=0, inactive skip), lifecycle visibility (draft=0, open/closed/archived=1), penalty-cycle idempotency (rerun=0, 1:1 penalty:item)
**Why human:** Requires running Supabase local stack; cannot verify in a static file-scan context

#### 2. Admin Preview → Confirm Invoice Generation
**Test:** As admin, navigate to billing periods, click "Pratinjau Tagihan" on a draft/open period, review the preview table (kavling, fee items, default/resolved amounts, override/default source, period total), click "Buat Tagihan", confirm in the AlertDialog
**Expected:** Preview shows correct fee resolution with overrides; confirmation creates invoices only for missing kavling-period pairs; rerun is idempotent (creates 0 new invoices)
**Why human:** Requires authenticated browser session and live Supabase RPC calls

#### 3. Admin Preview → Confirm Penalty Application
**Test:** As admin, click "Pratinjau Denda" on an open period with overdue invoices, review penalty preview, confirm "Terapkan Denda"
**Expected:** Preview shows overdue invoices with penalty amounts and cycle key; confirmation creates penalty items; rerun with same cycle key creates nothing
**Why human:** Requires authenticated browser session and live Supabase RPC calls

#### 4. Resident Arrears Summary Rendering
**Test:** Open resident billing page with overdue invoices vs. all-paid scenario
**Expected:** When arrears > 0: red card with "Ringkasan Tunggakan", overdue total in rupiah, "{n} tagihan belum dibayar". When all paid: green card with "Semua tagihan Anda sudah lunas"
**Why human:** Visual appearance, conditional styling, and edge-case rendering require browser inspection

#### 5. Multi-Kavling Resident Tabs
**Test:** Sign in as resident with multiple active kavling mappings
**Expected:** Tabs appear labelled "Kavling {code}"; each tab shows correct invoices for that kavling; totals stay per kavling; single-kavling residents see section heading only (no tabs)
**Why human:** Interactive tab behavior and data correctness per kavling require browser testing

#### 6. Former-Resident Read-Only Behavior
**Test:** Sign in as resident with inactive kavling mapping, view invoices
**Expected:** Amber warning card "Anda tidak punya kavling aktif saat ini" appears on list page; invoice detail shows "Invoice ini berasal dari riwayat kavling yang sudah tidak aktif" notice; PaymentSubmissionForm is hidden
**Why human:** Requires specific database state (inactive kavling_residents row) and authenticated session

#### 7. Draft Period Resident Invisibility
**Test:** Create draft billing period, generate invoices, then sign in as resident
**Expected:** Resident cannot see draft-period invoices in their list; open/closed/archived invoices are visible. Admin can see all periods
**Why human:** Requires published (draft + open) billing periods with invoices and resident session to verify RLS+RPC gate end-to-end

### Summary

All 7 must-have truths verified through codebase inspection. All 7 BILL requirements covered by implementation. All artifacts exist, are substantive, and are wired with correct data flows. One minor plan acceptance criterion mismatch found (BillingPeriodDetailPage "Buka Periode") — behavioral intent fulfilled by lifecycle controls on list page; override suggested.

7 human verification items identified — covering SQL test execution, admin RPC workflows, resident visual rendering, multi-kavling interaction, former-resident edge cases, and draft-visibility gating. These require running Supabase local stack and browser sessions to confirm.

---

_Verified: 2026-04-30T01:30:00Z_
_Verifier: OpenCode (gsd-verifier)_
