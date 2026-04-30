---
phase: 03-manual-payments-reporting-audit
plan: 05
subsystem: payments
tags: [supabase, resident-history, receipt-generation, report-output, signed-urls, TDD]

# Dependency graph
requires:
  - phase: 03-04
    provides: Real HTML artifact generation with private storage and signed download access
provides:
  - Resident-visible verified payment history card per invoice (PAY-06)
  - Resident-visible receipt history with signed-URL download access per invoice (PAY-06, D-10)
  - Admin output history UI with download actions per period (RPRT-04, D-12)
  - Resident-specific receipt generation from candidates (RPRT-04, D-13)
affects: [billing, reports, audit]

# Tech tracking
tech-stack:
  added: [loadResidentPaymentHistory, loadResidentReceiptHistory, loadGeneratedReportOutputs, loadReceiptCandidates]
  patterns: [signed-URL download for receipts (T-03-18), reconciliation warning (T-03-20), per-kavling owner mapping without .limit(1)]

key-files:
  created:
    - features/payments/ResidentPaymentHistory.tsx
    - features/payments/ResidentReceiptHistory.tsx
  modified:
    - features/reports/reportQueries.ts
    - features/reports/ReportsPage.tsx
    - features/billing/InvoiceDetailPage.tsx
    - lib/__tests__/features/reportQueries.test.ts

key-decisions:
  - "Receipt history filter uses invoice_id in metadata JSON — confirmed that public.reports.metadata is JSONB and supports invoice_id key"
  - "Removed .limit(1) from kavling_residents owner lookup in loadCollectionSummary and loadArrearsList — every kavling row now gets its own owner name"
  - "Period-wide receipt button generates placeholder artifact; resident-specific receipts come from loadReceiptCandidates + generateReportOutputArtifact in the new candidates table"

patterns-established:
  - "Resident payment/receipt history via dedicated cards beneath SubmissionHistory in InvoiceDetailPage"
  - "Admin output history with Terakhir diperbarui timestamp and inline reconciliation warning per D-12/D-13"
  - "Resident-specific receipt generation via receipt candidate rows instead of single period-wide button"

requirements-completed: [PAY-06, PAY-07, RPRT-04]

# Metrics
duration: 14min
completed: 2026-04-30
---

# Phase 03 Plan 05: Resident Payment/Receipt History and Admin Artifact Gap Closure Summary

**Real HTML artifact generation with private storage and signed download access — closing the metadata-only gap in Phase 3 verification**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-30T06:11:38Z
- **Completed:** 2026-04-30T06:26:16Z
- **Tasks:** 2 completed
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `loadResidentPaymentHistory(invoiceId)` returns verified payment rows with date, amount, method, verifier name, and note
- `loadResidentReceiptHistory(invoiceId)` filters `report_type='receipt'` rows by `metadata.invoice_id` per D-10, exposes only `report_id` for signed-URL access
- `loadGeneratedReportOutputs(billingPeriodId)` returns output history with `file_path` for download controls
- `loadReceiptCandidates(billingPeriodId)` returns invoices with verified payments for resident-specific receipt generation
- Removed `.limit(1)` from `kavling_residents` owner lookup — multi-kavling owner names now preserved per row
- `ResidentPaymentHistory` card (contains `Riwayat Pembayaran Terverifikasi`) renders in InvoiceDetailPage beneath SubmissionHistory
- `ResidentReceiptHistory` card (contains `Riwayat Bukti Bayar` and `Buka Bukti Bayar`) renders in InvoiceDetailPage with signed-URL download actions
- ReportsPage shows `Terakhir diperbarui` timestamp, inline reconciliation warning with retry CTA (D-12/D-13)
- ReportsPage surfaces generated output history with download actions and resident-specific receipt generation from candidates
- Monthly and receipt buttons now call `generateReportOutputArtifact` Edge Function for real artifact persistence

## Task Commits

Each task was committed atomically:

1. **task 1: add resident/admin payment-receipt query contracts and regression coverage** - `f544864` (feat)
2. **task 2: wire resident invoice history and admin report output UX to generated-artifact truth** - `e0106ba` (feat)

**Plan metadata:** `16540f2` (docs: complete plan 03-04 report artifact generation gap closure)

## Files Created/Modified

- `features/payments/ResidentPaymentHistory.tsx` - Resident-visible verified payment history card for one invoice
- `features/payments/ResidentReceiptHistory.tsx` - Resident-visible receipt history and signed-download actions for one invoice
- `features/reports/reportQueries.ts` - Added `loadResidentPaymentHistory`, `loadResidentReceiptHistory`, `loadGeneratedReportOutputs`, `loadReceiptCandidates`; removed `.limit(1)` from owner lookup
- `features/reports/ReportsPage.tsx` - Added output history UI, receipt candidates table, Terakhir diperbarui, reconciliation warning, resident-specific receipt generation
- `features/billing/InvoiceDetailPage.tsx` - Wires ResidentPaymentHistory and ResidentReceiptHistory cards
- `lib/__tests__/features/reportQueries.test.ts` - Replaced placeholder tests with 17 real mapping assertions for payment history, receipt filtering, owner mapping

## Decisions Made

- Receipt history filter uses `invoice_id` in `metadata` JSONB column — confirmed that `public.reports.metadata` is `jsonb` and supports invoice_id key
- Removed `.limit(1)` from kavling_residents owner lookup — every kavling row now gets its own owner name rather than global first-match
- Period-wide receipt button generates placeholder artifact with null invoiceId; resident-specific receipts come from loadReceiptCandidates table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Gap closure is complete — resident payment history and receipt download access are now wired per PAY-06
- Admin reports surface downloadable artifacts and resident-specific receipt generation per RPRT-04
- Ready for Phase 03 verification re-run or next plan in Phase 03

## Self-Check: PASSED

All files exist on disk, commits f544864 and e0106ba present, typecheck passes (0 errors), build succeeds, 17 unit tests pass across reportQueries.test.ts.

---
*Phase: 03-manual-payments-reporting-audit*
*Completed: 2026-04-30*