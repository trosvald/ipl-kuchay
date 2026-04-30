---
status: partial
phase: 02-billing-configuration-resident-billing-view
source: [02-VERIFICATION.md]
started: 2026-04-30T00:15:00Z
updated: 2026-04-30T10:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SQL regression suite
expected: `npm run test:sql` passes all 6 migration test files without errors
result: passed

### 2. Admin preview → confirm invoice generation end-to-end
expected: Preview flow shows kavling breakdown, fee items with amount_source, period total before Buat Tagihan confirmation. Generation is idempotent and only works on open periods.
result: passed — preview shows kavling × fee breakdown with amount_source (default/override), period total, Buat Tagihan confirmation flow, draft/closed/archived gates work, idempotency enforced via Tagihan Sudah Ada label

### 3. Admin preview → confirm penalty application end-to-end
expected: Preview shows cycle key and affected invoices before Terapkan Denda confirmation. Penalty idempotency enforced per cycle.
result: passed (API/RPC validation) — `preview_penalties_for_period` returned 70 rows with `penalty_cycle_key` and `penalty_amount`, `apply_penalties_for_period` applied 70, second preview same cycle returned 0 (idempotent per cycle)

### 4. Resident arrears summary rendering
expected: Ringkasan Tunggakan card shows overdue total with appropriate messaging for both arrears and all-paid states
result: partial — arrears state validated (resident data has outstanding balances). All-paid UI state not executed in browser session yet.

### 5. Multi-kavling resident tab interaction
expected: Tabs group invoices per kavling. Totals computed per kavling, not merged into one household total.
result: passed (data and query validation) — resident2 sees two kavlings (`Kav 3B`, `Kav 5`) with separate totals (Kav 3B due 1,450,000 vs Kav 5 due 1,500,000), not merged

### 6. Former-resident read-only behavior
expected: Warning card displayed. Invoice history is read-only per existing RLS/history helpers.
result: partial — RLS/history guard validated by `m07_phase1_access_identity.sql` (former resident can access historical invoice only, cannot access future invoice). Browser warning card check still pending.

### 7. Draft period resident invisibility (RLS gate)
expected: Draft period invoices do not appear for residents. Only published/open periods visible.
result: passed (API validation) — resident invoice query returned 3 invoices, none with `billing_periods.status = draft`

## Summary

total: 7
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 2

## Gaps
