---
phase: 06
slug: imports-optional-qris-launch-readiness
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-04
---

# Phase 06 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Admin browser -> import preview/apply/settings | Privileged operator actions originate in the browser and must still be constrained by route guards, shared auth helpers, and RLS-backed mutations. | CSV payloads, import apply requests, payment gateway setting writes |
| Edge Functions -> Postgres | Service-role import and reconciliation paths can touch multiple core tables and must keep writes validated, atomic per statement, and auditable. | Bulk upserts, import job audit rows, gateway reconciliation updates |
| Resident browser -> QRIS/manual-transfer payment actions | Resident payment actions cross into privileged payment processing and must remain eligibility-gated without exposing secrets. | QRIS initiation requests, manual transfer submissions |
| Midtrans -> webhook reconciliation | External callbacks enter settlement logic with untrusted payloads and must be signature-verified plus transition-guarded before state changes. | Webhook status notifications, transaction identifiers, gross amount payloads |
| Operator UAT -> launch evidence/sign-off | Human-run launch checks can hide blockers unless the runbook and evidence matrix force deterministic validation. | Verification evidence links, launch rollback notes, pass/fail sign-off |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | T | `lib/imports/importPreview.ts` | mitigate | `lib/imports/importPreview.ts:22-83,117-195` enforces strict preview parsing with row-numbered validation errors and duplicate rejection. | closed |
| T-06-02 | D | CSV preview processing | mitigate | `lib/imports/importPreview.ts:20,89-107` caps preview rows and fails fast on overflow. | closed |
| T-06-03 | E | `import-apply` | mitigate | `supabase/functions/import-apply/index.ts:228-233` authenticates the caller and requires `admin` or `super_admin` before any mutation path runs. | closed |
| T-06-04 | T | import apply SQL writes | mitigate | `supabase/functions/import-apply/index.ts:104-164,166-225,233-270,272-301` now resolves referenced IDs before a single bulk upsert per import type, preventing partial row writes from sequential mutation loops. | closed |
| T-06-05 | R | import operations | mitigate | `supabase/functions/import-apply/index.ts:237-249,281-299` persists actor, counts, timestamps, preview rows, and error payloads in `import_jobs`. | closed |
| T-06-06 | S | `midtrans-webhook` | mitigate | `supabase/functions/_shared/midtrans.ts:24-59` and `supabase/functions/midtrans-webhook/index.ts:38-60` verify Midtrans signatures before reconciliation. | closed |
| T-06-07 | T | reconciliation update path | mitigate | `supabase/migrations/0025_m08_qris_status_transition_guards.sql:52-99` adds terminal-state transition guards, and `supabase/tests/sql/m08_qris_reconciliation.sql:176-257` covers regressive webhook cases. | closed |
| T-06-08 | I | gateway secrets | mitigate | `supabase/functions/_shared/midtrans.ts:24-33,67-85` keeps the server key in Edge Function env access only, while `features/payments/QrisPaymentPanel.tsx:71-74` invokes the function without browser-held secrets. | closed |
| T-06-09 | E | gateway settings UI | mitigate | `app/admin/settings/page.tsx:6-15` wraps the route in `RequireOperatorRole`, `features/auth/RequireOperatorRole.tsx:12-19,21-35` blocks treasurer direct access, and `supabase/migrations/0012_m07_access_scope_identity.sql:9-15,202-207` keeps `app_settings` writes operator-only at RLS level. | closed |
| T-06-10 | T | invoice payment UI branching | mitigate | `features/payments/PaymentSubmissionForm.tsx:56-60,279-352`, `lib/__tests__/qrisFeatureFlagFlow.test.ts:31-41`, and `lib/__tests__/phase06LaunchReadinessContract.test.ts:56-67` preserve manual-transfer fallback when QRIS is disabled. | closed |
| T-06-11 | R | launch verification evidence | mitigate | `.planning/phases/06-imports-optional-qris-launch-readiness/06-VERIFICATION.md:7,26-35,41-56` requires explicit evidence links before phase sign-off. | closed |
| T-06-12 | D | operational cutover | mitigate | `.planning/phases/06-imports-optional-qris-launch-readiness/06-LAUNCH-UAT.md:19-27,45-52` keeps the runbook deterministic and includes rollback guidance. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-04 | 12 | 12 | 0 | OpenCode + gsd-security-auditor |

### Security Audit 2026-05-04

| Metric | Count |
|--------|-------|
| Threats found | 12 |
| Closed | 12 |
| Open | 0 |

Verification note: targeted unit tests, `npm run typecheck`, and direct execution of `supabase/tests/sql/m08_qris_reconciliation.sql` passed. Full `npm run test:sql` remained environment-blocked by a local Supabase storage restart failure during `supabase db reset`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-04
