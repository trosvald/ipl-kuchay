---
status: partial
phase: 03-manual-payments-reporting-audit
source: [03-VERIFICATION.md]
started: 2026-04-30T07:08:10Z
updated: 2026-04-30T07:08:10Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Resident invoice detail history
expected: Resident sees submission history, verified payment history, and only their own receipt entries. `Buka Bukti Bayar` opens a signed URL artifact.
result: [pending]

### 2. Admin report generation/download
expected: Generating a monthly summary and a resident receipt from `/admin/reports` creates output rows immediately and each download opens the generated HTML artifact.
result: [pending]

### 3. Split-payment receipt candidates
expected: For an invoice with multiple verified payments, the page shows one receipt candidate per payment and each action targets the correct payment-specific receipt.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
