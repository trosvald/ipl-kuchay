---
phase: 03-manual-payments-reporting-audit
verified: 2026-04-30T07:06:26Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/7
  gaps_closed:
    - "Resident can track payment states, rejection reasons, next steps, and payment/receipt history for their own invoices."
    - "Treasurer/admin can view per-period collection summary and arrears lists and export CSV consistent with on-screen report truth."
    - "Collection summaries, arrears views, CSV exports, monthly report outputs, receipt outputs, and audit trail all reflect the same invoice and payment truth shown in resident-facing screens."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Resident invoice detail payment and receipt history"
    expected: "A resident sees submission history, verified payment history, and only their own receipt entries; 'Buka Bukti Bayar' opens a signed URL artifact."
    why_human: "Requires authenticated browser flow plus real RLS/signed-URL behavior."
  - test: "Admin report artifact generation and download"
    expected: "From /admin/reports, monthly summary and resident receipt generation create rows immediately in output history and each download opens the generated HTML artifact."
    why_human: "Needs live Edge Function, storage, and browser download behavior."
  - test: "Split-payment receipt candidates"
    expected: "For one invoice with multiple verified payments, /admin/reports shows one candidate per payment and each receipt action works independently."
    why_human: "Static review shows payment-specific wiring, but end-to-end behavior with duplicate invoice rows needs UI confirmation."
---

# Phase 3: Manual Payments, Reporting & Audit Verification Report

**Phase Goal:** Manual transfer payments become trustworthy, explainable, and consistent across resident views, operator workflows, reports, and audit logs.
**Verified:** 2026-04-30T07:06:26Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Resident can submit manual transfer proof for an eligible invoice with amount, note, and a private proof attachment. | ✓ VERIFIED | `features/payments/PaymentSubmissionForm.tsx` still blocks ineligible states, validates payload/file, invokes `create-payment-submission`, uploads to private `payment-proofs`, and attaches proof metadata. |
| 2 | Resident can track payment states, rejection reasons, next steps, and payment/receipt history for their own invoices. | ✓ VERIFIED | `InvoiceDetailPage.tsx` renders `SubmissionHistory`, `ResidentPaymentHistory`, and `ResidentReceiptHistory`; `reportQueries.ts` now reads real `payments.method` / `paid_at` / `notes` fields and receipt history comes from `reports` receipt rows filtered by `metadata.invoice_id`. |
| 3 | Treasurer/admin can review payment proof through permission-checked access and verify or reject submissions through an audited workflow. | ✓ VERIFIED | `AdminSubmissionsPage.tsx` still calls `verify_payment_submission` / `reject_payment_submission`; `ProofPreviewButton.tsx` still uses `get-proof-signed-url`; proof/report signed URLs stay permission-checked. |
| 4 | Verification/rejection state transitions are deterministic and block re-verify/re-reject paths. | ✓ VERIFIED | `supabase/migrations/0016_m09_manual_payment_reporting_contract.sql` rejects non-`submitted` transitions; `supabase/tests/sql/m08_phase3_payment_reporting.sql` asserts duplicate-transition failures. |
| 5 | Finance audit evidence includes enough before/after data to explain sensitive payment decisions. | ✓ VERIFIED | `verify_payment_submission` and `reject_payment_submission` still write `before_data` plus structured `after_data` to `public.audit_logs`; report downloads are also audited in `get-report-output-signed-url`. |
| 6 | Treasurer/admin can view per-period collection summary and arrears lists and export CSV consistent with on-screen report truth. | ✓ VERIFIED | `ReportsPage.tsx` now isolates primary summary/arrears loads from output/candidate loads, and CSV export still serializes the same `summaryRows` / `arrearsRows` it renders. |
| 7 | Collection summaries, arrears views, CSV exports, monthly report outputs, receipt outputs, and audit trail all reflect the same invoice and payment truth shown in resident-facing screens. | ✓ VERIFIED | `generate-report-output` now requires `paymentId` for receipts, persists `kavling_id` and receipt metadata, `report-output.ts` loads the exact payment row, and `npm run test:sql` now passes through `m08`, `m09`, and `m10`. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/migrations/0016_m09_manual_payment_reporting_contract.sql` | Deterministic verification/rejection/audit contract | ✓ VERIFIED | Verify/reject/recalculate logic and audit inserts present. |
| `supabase/tests/sql/m08_phase3_payment_reporting.sql` | SQL regression coverage for payment-state invariants | ✓ VERIFIED | Contains verify/reject/duplicate-transition/idempotence checks. |
| `features/payments/ResidentPaymentHistory.tsx` | Resident-visible verified payment history | ✓ VERIFIED | Wired into `InvoiceDetailPage.tsx`; data source now maps actual `payments` columns. |
| `features/payments/ResidentReceiptHistory.tsx` | Resident-visible receipt history/download | ✓ VERIFIED | Wired into `InvoiceDetailPage.tsx`; uses signed-URL download by `report_id`. |
| `features/reports/reportQueries.ts` | Report/payment/receipt query helpers | ✓ VERIFIED | Exports resident history, output history, and receipt-candidate helpers with real payments schema fields. |
| `features/reports/ReportsPage.tsx` | Reports UI with resilient loads and artifact actions | ✓ VERIFIED | Summary/arrears stay available on secondary failures; payment-specific receipt generation and output history are wired. |
| `supabase/functions/generate-report-output/index.ts` | Private artifact generation + report persistence | ✓ VERIFIED | Requires `paymentId` for receipts, writes `file_path`, and sets `kavling_id` on receipt rows. |
| `supabase/functions/get-report-output-signed-url/index.ts` | Permission-checked signed download delivery | ✓ VERIFIED | Caller-scoped report read precedes 300-second signed URL creation; finance downloads are audited. |
| `supabase/migrations/0017_m10_report_output_artifacts.sql` | Private bucket/policy contract | ✓ VERIFIED | Uses valid `drop policy if exists` + `create policy` syntax and creates private `report-outputs` bucket. |
| `supabase/tests/sql/m10_phase3_report_output_access.sql` | SQL checks for report-output access contract | ✓ VERIFIED | Confirms bucket/privacy, reports columns, and receipt RLS policy presence. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `features/payments/PaymentSubmissionForm.tsx` | `supabase/functions/create-payment-submission` | `functions.invoke` create path | ✓ WIRED | Submission create/upload/attach flow still present. |
| `features/payments/ProofPreviewButton.tsx` | `supabase/functions/get-proof-signed-url` | signed URL call | ✓ WIRED | Direct function invoke with signed URL response. |
| `features/payments/AdminSubmissionsPage.tsx` | `public.verify_payment_submission` / `public.reject_payment_submission` | `client.rpc` review actions | ✓ WIRED | Approval/rejection still go through RPCs. |
| `features/billing/InvoiceDetailPage.tsx` | `ResidentPaymentHistory.tsx` | invoice detail resident history section | ✓ WIRED | Component imported and rendered below submission history. |
| `features/billing/InvoiceDetailPage.tsx` | `ResidentReceiptHistory.tsx` | invoice detail receipt history section | ✓ WIRED | Component imported and rendered below payment history. |
| `features/reports/ReportsPage.tsx` | `features/reports/reportQueries.ts` | summary/arrears/output/candidate loads | ✓ WIRED | Primary and secondary report loads now run independently via `Promise.allSettled`. |
| `features/reports/ReportsPage.tsx` | `features/reports/reportOutputClient.ts` | monthly/receipt generation and download actions | ✓ WIRED | Uses `generateReportOutputArtifact` and `getReportOutputSignedUrl`; receipt generation passes `paymentId: candidate.payment_id`. |
| `supabase/functions/generate-report-output/index.ts` | `public.reports` | persisted report rows | ✓ WIRED | Inserts `file_path`, metadata, and `kavling_id` for receipts. |
| `supabase/functions/generate-report-output/index.ts` | `report-outputs` storage bucket | service-role upload | ✓ WIRED | Shared helper uploads generated HTML to private storage. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `PaymentSubmissionForm.tsx` | `preparedInput.payload`, `proofFile` | form input → `create-payment-submission` → storage upload → `attach-payment-proof` | Yes | ✓ FLOWING |
| `ResidentPaymentHistory.tsx` | `items` | `loadResidentPaymentHistory(invoiceId)` → `payments` + `profiles` | Yes | ✓ FLOWING |
| `ResidentReceiptHistory.tsx` | `items` | `loadResidentReceiptHistory(invoiceId)` → `reports` receipt rows | Yes | ✓ FLOWING |
| `ReportsPage.tsx` | `summaryRows`, `arrearsRows`, `outputRows`, `receiptCandidates` | `loadCollectionSummary` / `loadArrearsList` / `loadGeneratedReportOutputs` / `loadReceiptCandidates` | Yes | ✓ FLOWING |
| `generate-report-output/index.ts` | receipt report row | exact `payments` row → HTML artifact upload → `public.reports` insert | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| App code typechecks | `npm run typecheck` | Exit 0 | ✓ PASS |
| Reporting builder/query tests run | `npx vitest run lib/__tests__/features/reportQueries.test.ts lib/__tests__/features/reportOutputBuilders.test.ts` | 45 tests passed | ✓ PASS |
| App builds | `npm run build` | Exit 0 | ✓ PASS |
| Phase 3 SQL acceptance suites apply and run | `npm run test:sql` | Exit 0; `m08`, `m09`, and `m10` all ran, `m10` reported `ALL M10 CHECKS PASSED` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PAY-01 | 03-02 | Resident can submit manual transfer proof | ✓ SATISFIED | `PaymentSubmissionForm.tsx` validates amount/note/file and sends proof through private upload flow. |
| PAY-02 | 03-02 | Resident can track payment states | ✓ SATISFIED | `SubmissionHistory.tsx` and invoice detail status surfaces render lifecycle labels. |
| PAY-03 | 03-02 | Resident can see rejection reasons and next steps | ✓ SATISFIED | `SubmissionHistory.tsx` uses rejection guidance and next-step helpers. |
| PAY-04 | 03-01, 03-02 | Treasurer/admin can verify or reject via audited workflow | ✓ SATISFIED | Admin review uses RPCs backed by audited SQL functions. |
| PAY-05 | 03-02 | Treasurer/admin can review proof with permission-checked access | ✓ SATISFIED | `ProofPreviewButton.tsx` opens proof only through signed-URL function. |
| PAY-06 | 03-02, 03-05, 03-06 | Resident can view payment history and receipt history | ✓ SATISFIED | Invoice detail now includes verified payment history plus receipt history/download actions. |
| PAY-07 | 03-01, 03-02, 03-03, 03-04, 03-05, 03-06, 03-07 | Invoice balances/statuses stay consistent across views, reports, notifications | ✓ SATISFIED | SQL contract passes; reports, receipts, and resident/admin payment views now use the repaired schema and report-output linkage. |
| RPRT-01 | 03-03, 03-07 | View collection summary by billing period | ✓ SATISFIED | `/admin/reports` loads summary rows independently of secondary helpers. |
| RPRT-02 | 03-03, 03-07 | View arrears/outstanding invoice lists | ✓ SATISFIED | `/admin/reports` loads arrears rows independently and renders overdue list. |
| RPRT-03 | 03-03, 03-07 | Export operational billing data to CSV | ✓ SATISFIED | CSV export is derived from rendered summary/arrears rows via `reportCsv.ts`. |
| RPRT-04 | 03-03, 03-04, 03-05, 03-06, 03-07 | Generate monthly report output and resident receipt output | ✓ SATISFIED | Edge Functions generate private HTML artifacts, persist `public.reports` rows, and download via signed URLs. |
| RPRT-05 | 03-01, 03-03, 03-04 | Review audit trail for sensitive actions | ✓ SATISFIED | Payment verification/rejection audit logs remain, and finance report downloads log `report_output.signed_url`. |

All Phase 3 requirement IDs declared in plan frontmatter are accounted for, and no orphaned Phase 3 requirements were found in `REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `lib/__tests__/features/reportQueries.test.ts` | 8-72 | Tests local helper copies instead of imported runtime query functions | ⚠️ Warning | Good schema/mapping coverage, but not true end-to-end query execution coverage. |
| `features/reports/ReportsPage.tsx` | 236, 594 | Receipt candidate loading state and React key are tied to `invoice_id`, not `payment_id` | ⚠️ Warning | Multi-payment invoices need human confirmation that per-payment receipt actions stay distinct in the UI. |
| `features/reports/ReportsPage.tsx` | 53, 536 | `outputLoading` state is rendered but never updated | ℹ️ Info | Does not block workflows, but the output-loading branch is effectively unused. |

### Human Verification Required

### 1. Resident invoice detail payment and receipt history

**Test:** Sign in as a resident who has one invoice with verified payment(s) and generated receipt(s). Open invoice detail and use the receipt download action.
**Expected:** Submission history, verified payment history, and receipt history all appear together; only that resident's receipts are listed; `Buka Bukti Bayar` opens a signed URL artifact.
**Why human:** Requires authenticated browser flow plus real RLS and storage download behavior.

### 2. Admin report artifact generation and download

**Test:** Sign in as treasurer/admin, open `/admin/reports`, generate one monthly summary and one resident receipt, then download both from output history.
**Expected:** Each action creates an output row immediately, and each download opens the generated HTML artifact via signed URL.
**Why human:** Needs live Edge Function, storage, and browser download behavior.

### 3. Split-payment receipt candidates

**Test:** Use a billing period where one invoice has multiple verified payments and generate receipts from each candidate row.
**Expected:** The page shows one candidate per payment and each button acts on the intended payment-specific receipt.
**Why human:** Static code review shows correct backend payment linkage, but UI behavior with duplicate invoice rows needs confirmation.

### Gaps Summary

No remaining automated gaps were found. The previous resident-history, report-load, and report-output linkage failures are closed.

---

_Verified: 2026-04-30T07:06:26Z_
_Verifier: OpenCode (gsd-verifier)_
