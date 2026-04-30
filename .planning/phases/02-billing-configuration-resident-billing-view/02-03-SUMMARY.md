---
phase: 02-billing-configuration-resident-billing-view
plan: 03
subsystem: ui
tags: [billing, resident-portal, accordion, tabs, shadcn, indonesia]

# Dependency graph
requires:
  - phase: 01-access-scope-resident-identity
    provides: RLS-enforced invoice access, kavling_residents mapping, can_access_invoice_history RPC
  - phase: 02-billing-configuration
    provides: billing_periods, invoices, invoice_items, fee_types, penalty schema
provides:
  - Resident billing home with kavling-grouped invoice cards and arrears focal point
  - Card-based invoice detail with Indonesian labels and status/formatter consistency
  - Shared billing label helpers in lib/format.ts
affects:
  - 02-billing-configuration (admin billing period management)
  - resident-self-service (billing view integrates with PaymentSubmissionForm, SubmissionHistory)

# Tech tracking
tech-stack:
  added: [shadcn/accordion, shadcn/skeleton, shadcn/tabs]
  patterns:
    - Card-based invoice layout with Accordion expand/collapse for fee breakdown
    - Per-kavling Tabs grouping for multi-kavling residents
    - Arrears summary card as primary focal point with semantic destructive/green tint
    - Shared status/formatter helpers in lib/format.ts for consistent Indonesian labels

key-files:
  created:
    - components/ui/accordion.tsx - Accordion for invoice fee item expand/collapse
    - components/ui/skeleton.tsx - Loading skeleton for invoice card list
    - components/ui/tabs.tsx - Tabs for per-kavling grouping
    - lib/__tests__/ResidentInvoicesPage.test.ts - TDD RED tests
  modified:
    - features/billing/ResidentInvoicesPage.tsx - Rebuilt with kavling grouping + arrears card
    - features/billing/InvoiceDetailPage.tsx - Indonesian labels, outstanding alert, tabular-nums

key-decisions:
  - "Arrears summary as primary surface (D-06): Ringkasan Tunggakan card at top, computed from overdue/unpaid invoices across all kavlings"
  - "Per-kavling Tabs (D-04): Multi-kavling residents see tabbed grouping; single-kavling residents see section heading only"
  - "Card-based invoices with Accordion expand (D-05): Period, status badge, total, due date visible by default; breakdown shows Iuran Rutin → Biaya Khusus → Denda Keterlambatan"
  - "InvoiceDetailPage aligned with list-page contract: all labels Indonesian, shared helpers from lib/format.ts, outstanding alert for unpaid/overdue/partial"

patterns-established:
  - "Shadcn Accordion for invoice fee item breakdown with expand/collapse"
  - "Semantic destructive/green for arrears summary card (red when has arrears, green when all paid)"
  - "Shared formatInvoiceStatusLabel/statusToBadgeVariant used in both list and detail pages"
  - "tabular-nums font variant for all monetary amounts"

requirements-completed: [BILL-06, BILL-07]

# Metrics
duration: 14min
completed: 2026-04-30
---

# Phase 02-billing-configuration-resident-billing-view Plan 03 Summary

**Resident billing view rebuilt with kavling-grouped invoice cards and arrears focal point; invoice detail updated with full Indonesian labels and outstanding balance alert.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-30T00:56:58Z
- **Completed:** 2026-04-30T01:11:02Z
- **Tasks:** 2 completed
- **Files modified:** 6 files, 1 test file

## Accomplishments
- Rebuilt ResidentInvoicesPage with ArrearsSummaryCard as primary focal point (D-06)
- Per-kavling Tabs for multi-kavling residents; single-kavling shows section heading (D-04)
- Card-based invoice list with Accordion expand/collapse showing fee breakdown (D-05)
- Fee breakdown ordered: Iuran Rutin → Biaya Khusus → Denda Keterlambatan
- InvoiceDetailPage fully Indonesian: Due date → Jatuh tempo, Sisa tagihan, tabular-nums
- Added outstanding balance alert for unpaid/overdue/partial invoices
- Preserved PaymentSubmissionForm and SubmissionHistory integration
- New shadcn components: accordion, skeleton, tabs

## task Commits

Each task was committed atomically:

1. **task 1: rebuild the resident invoice list around kavling grouping and arrears focus** - `893c093` (feat/test)
2. **task 2: align invoice detail with the new resident billing clarity contract** - `cefb5fd` (feat)

**Plan metadata:** `893c093` (docs: complete plan)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `features/billing/ResidentInvoicesPage.tsx` - Rebuilt with arrears card, kavling tabs, accordion invoice cards
- `features/billing/InvoiceDetailPage.tsx` - Indonesian labels, outstanding alert, consistent formatters
- `lib/format.ts` - Contains formatInvoiceStatusLabel with "Jatuh tempo lewat", used by both pages
- `components/ui/accordion.tsx` - New shadcn component for invoice expand/collapse
- `components/ui/skeleton.tsx` - New shadcn component for loading states
- `components/ui/tabs.tsx` - New shadcn component for kavling grouping
- `lib/__tests__/ResidentInvoicesPage.test.ts` - TDD RED/GREEN tests

## Decisions Made

- Arrears summary card at top of page aggregates all overdue/outstanding amounts across all kavlings
- Multi-kavling residents get tabbed interface; single-kavling residents see section heading only (no empty tab chrome)
- Invoice cards use Accordion with single collapsible item; breakdown shows ordered sections
- InvoiceDetailPage uses key-value row layout with Separator for visual hierarchy
- Outstanding alert only shown for actionable invoices (unpaid/overdue/partial), not historical

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TypeScript type mismatch on Supabase array responses resolved with `as unknown as ResidentInvoiceRow[]` cast
- Pre-existing test failure in `phase01AccessScopeNyquist.test.ts` unrelated to this plan (shows "resident invoice kavling-scoped and history-only guidance" test failing) — not modified by this plan

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-02-08 | features/billing/ResidentInvoicesPage.tsx | Invoice reads remain RLS-scoped via existing can_access_invoice_history policy — no bypass queries added |
| threat_flag: T-02-09 | features/billing/ResidentInvoicesPage.tsx | Arrears totals derived from fetched invoice fields only, not from external aggregation — threat model mitigation preserved |

## Next Phase Readiness

- Resident billing list and detail pages deliver BILL-06 and BILL-07 per the Phase 2 scope
- All status labels sourced from shared lib/format.ts helpers for consistency across list and detail
- PaymentSubmissionForm and SubmissionHistory integration preserved on the detail page
- Access boundaries remain intact via existing RLS/helper functions

---
*Phase: 02-billing-configuration-resident-billing-view*
*Completed: 2026-04-30*