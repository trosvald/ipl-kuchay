---
status: partial
phase: 02-billing-configuration-resident-billing-view
source: [02-VERIFICATION.md]
started: 2026-04-30T00:15:00Z
updated: 2026-04-30T01:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SQL regression suite
expected: `npm run test:sql` passes all 6 migration test files without errors
result: passed

### 2. Admin preview → confirm invoice generation end-to-end
expected: Preview flow shows kavling breakdown, fee items with amount_source, period total before Buat Tagihan confirmation. Generation is idempotent and only works on open periods.
result: [pending]

### 3. Admin preview → confirm penalty application end-to-end
expected: Preview shows cycle key and affected invoices before Terapkan Denda confirmation. Penalty idempotency enforced per cycle.
result: [pending]

### 4. Resident arrears summary rendering
expected: Ringkasan Tunggakan card shows overdue total with appropriate messaging for both arrears and all-paid states
result: [pending]

### 5. Multi-kavling resident tab interaction
expected: Tabs group invoices per kavling. Totals computed per kavling, not merged into one household total.
result: [pending]

### 6. Former-resident read-only behavior
expected: Warning card displayed. Invoice history is read-only per existing RLS/history helpers.
result: [pending]

### 7. Draft period resident invisibility (RLS gate)
expected: Draft period invoices do not appear for residents. Only published/open periods visible.
result: [pending]

## Summary

total: 7
passed: 1
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
