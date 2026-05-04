---
phase: 02
slug: billing-configuration-resident-billing-view
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-05
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| finance-role client → SQL RPC/functions | Privileged billing actions can create or alter many resident obligations at once | Invoice/penalty rows, billing period state |
| SQL functions → invoice and penalty tables | Incorrect writes can create duplicate or hidden financial state | Invoice, invoice_items, invoice_penalties |
| finance-role browser forms → Supabase writes | Untrusted browser payloads can change neighborhood billing rules | Fee types, overrides, billing periods |
| admin UI actions → audit log RPC | Missing audit writes would weaken finance traceability | Audit log entries |
| resident browser → invoice reads | Residents may attempt to access invoice data outside their kavling/history scope | Invoice rows, fee items, payment history |
| billing data → visual summary logic | Incorrect client-side aggregation can misstate what the resident owes | Arrears totals, outstanding balances |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | T | `generate_invoices_for_period` | mitigate | Unique `(billing_period_id, kavling_id)` constraint with rerun idempotency asserted in `m02_phase2_billing.sql` | closed |
| T-02-02 | E | preview/apply RPCs | mitigate | Security-definer functions guarded by `has_finance_role()` checks | closed |
| T-02-03 | I | draft-period resident visibility | mitigate | `can_access_invoice_history` filters draft periods; lifecycle visibility tested | closed |
| T-02-04 | R | penalty-cycle application | mitigate | Explicit `cycle_key` + `unique(invoice_id, penalty_rule_id, cycle_key)` preventing duplicates | closed |
| T-02-05 | T | fee and override forms | mitigate | Zod validation (`feeTypeFormSchema`, `feeOverrideFormSchema`) in UI + DB constraints | closed |
| T-02-06 | R | billing lifecycle and generation actions | mitigate | `writeAuditLog` on create, status change, generation, penalty application | closed |
| T-02-07 | E | reopen/archive/penalty controls | mitigate | Role-specific UI guards + `has_finance_role()` RPC enforcement | closed |
| T-02-08 | I | resident invoice list/detail queries | mitigate | RLS-scoped reads via `can_access_invoice_history`; no bypass queries added | closed |
| T-02-09 | T | arrears and outstanding calculations | mitigate | Totals derived from fetched invoice fields only; centralized labels in `lib/format.ts` | closed |
| T-02-10 | R | resident interpretation of billing state | accept | Operational confusion reduced through explicit Indonesian headings, arrears focal point, consistent status copy | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-10 | Resident billing interpretation risk is inherent in any self-service system; mitigated via Indonesian-only copy (`Ringkasan Tunggakan`, `Jatuh tempo`, `Sisa tagihan`), focal-point arrears summary, and consistent status formatting across list and detail pages | Plan 02-03 | 2026-04-30 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-05 | 10 | 10 | 0 | opencode via /gsd-secure-phase 02 |

**Evidence sources:**
- `02-01-SUMMARY.md` — SQL contract with finance-role guards, draft visibility, penalty idempotency
- `02-02-SUMMARY.md` — Admin UI with preview-before-confirm, audit logging, Zod validation
- `02-03-SUMMARY.md` — Resident view with RLS-scoped reads, arrears from fetched fields
- `02-HUMAN-UAT.md` — 7/7 UAT tests passed including draft invisibility and arrears rendering

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-05
