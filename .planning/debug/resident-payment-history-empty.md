---
status: investigating
trigger: "Investigate why resident invoice detail shows empty Riwayat Pembayaran Terverifikasi even though verified payments rows exist for the invoice."
created: 2026-04-30T08:08:38Z
updated: 2026-04-30T08:11:18Z
---

## Current Focus

hypothesis: target resident lost invoice-history scope because kavling_residents ended_at window excludes invoice due_date; reports still visible by active=true policy on report kavling
test: inspect actual resident mapping dates vs invoice due_date using privileged query
expecting: ended_at < invoice.due_date (or no matching active mapping) causing can_access_invoice_history false
next_action: query resident profile + kavling_residents rows + target invoice due_date using service key

## Symptoms

expected: resident invoice detail should show verified payment history for invoice 18d5565a-ecf2-45d1-a086-1650659fa561
actual: UI shows "Belum ada pembayaran terverifikasi untuk invoice ini." while verified payments rows exist
errors: no explicit runtime error shown in UI; data appears empty
reproduction: login as resident1@jatiloka.test, open invoice detail for target invoice, observe empty "Riwayat Pembayaran Terverifikasi"
started: observed during UAT on local DB

## Eliminated

## Evidence

- timestamp: 2026-04-30T08:08:58Z
  checked: required reference + knowledge base existence
  found: common bug patterns reference loaded; no .planning/debug/knowledge-base.md exists yet
  implication: proceed with fresh hypothesis formation; likely categories are Data Shape/API Contract and authorization visibility mismatch

- timestamp: 2026-04-30T08:09:18Z
  checked: ResidentPaymentHistory.tsx + reportQueries.ts + thinking-models-debug reference
  found: UI displays empty state only when query returns []; loadResidentPaymentHistory queries public.payments by invoice_id with no verified filter and no joins; any visible payment row should render
  implication: empty result is likely from backend visibility (RLS/policy) rather than frontend rendering logic

- timestamp: 2026-04-30T08:09:59Z
  checked: payments/invoice/report RLS policies in 0012_m07_access_scope_identity.sql (and prior 0005 baseline)
  found: payments select policy depends on public.can_access_invoice_history(i.id); reports select policy uses kavling_residents(active=true) and does not use invoice-date window checks
  implication: receipt history can render while payments are filtered if can_access_invoice_history returns false for invoice date/window edge cases

- timestamp: 2026-04-30T08:10:30Z
  checked: direct SQL access attempt + credential sources
  found: psql binary unavailable in environment; test credentials found in scripts/seed-users.mjs (resident1@jatiloka.test / password123)
  implication: use Supabase JS authenticated queries for runtime-accurate RLS verification

- timestamp: 2026-04-30T08:10:59Z
  checked: resident-auth Supabase API queries for target invoice
  found: resident1 sees 0 rows in invoices and 0 rows in payments for invoice 18d5565a-ecf2-45d1-a086-1650659fa561, but can see receipt reports containing that invoice_id metadata
  implication: issue is RLS visibility inconsistency (reports visible while invoice/payment gated), not frontend query rendering

- timestamp: 2026-04-30T08:11:18Z
  checked: InvoiceDetailPage + SQL tests for can_access_invoice_history
  found: InvoiceDetailPage allows rendering sub-sections even when invoice query returns null; SQL tests intentionally enforce invoice visibility by relation date window and period status via can_access_invoice_history
  implication: empty payment history can appear inside a partially rendered detail page when invoice/payment RLS denies rows

## Resolution

root_cause:
fix:
verification:
files_changed: []
