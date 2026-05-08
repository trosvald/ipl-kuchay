## Phase 06 Security Audit

- Phase: 06 — imports optional QRIS launch readiness
- Audit date: 2026-05-04
- Auditor: OpenCode / gpt-5.4
- threats_open: 0

### Threat Verification

| Threat ID | Status | Evidence |
|---|---|---|
| T-06-01 | CLOSED | `lib/imports/importPreview.ts:22-83,117-195` strict zod parsing, row-numbered errors, duplicate rejection before preview output. |
| T-06-02 | CLOSED | `lib/imports/importPreview.ts:20,89-107` enforces `DEFAULT_MAX_ROWS` and fail-fast overflow error. |
| T-06-03 | CLOSED | `supabase/functions/import-apply/index.ts:228-233` resolves caller profile and requires `admin`/`super_admin` before mutation. |
| T-06-04 | CLOSED | `supabase/functions/import-apply/index.ts:233-270,272-301` reruns preview, blocks invalid batches, records apply errors; `104-164,166-225` resolves all referenced IDs before each single bulk upsert. |
| T-06-05 | CLOSED | `supabase/functions/import-apply/index.ts:237-249,281-299` persists actor, counts, preview/errors, and applied/failed timestamps in `import_jobs`. |
| T-06-06 | CLOSED | `supabase/functions/_shared/midtrans.ts:24-59` computes/verifies signature from env-held server key; `supabase/functions/midtrans-webhook/index.ts:38-60` rejects mismatches before RPC reconciliation. |
| T-06-07 | CLOSED | `supabase/migrations/0025_m08_qris_status_transition_guards.sql:52-70,72-99` freezes terminal states and ignores regressions; `supabase/tests/sql/m08_qris_reconciliation.sql:176-257` asserts settlement→expire and expire→settlement regressions are ignored. |
| T-06-08 | CLOSED | `supabase/functions/_shared/midtrans.ts:24-33,67-85` reads `MIDTRANS_SERVER_KEY` only from Edge Function env; `features/payments/QrisPaymentPanel.tsx:71-74` invokes server function without embedding gateway secret in client code. |
| T-06-09 | CLOSED | `app/admin/settings/page.tsx:6-15` wraps route in `RequireOperatorRole`; `features/auth/RequireOperatorRole.tsx:12-19,21-35` excludes non-operator users; `supabase/migrations/0012_m07_access_scope_identity.sql:9-15,202-207` limits `app_settings` RLS to operator role only. |
| T-06-10 | CLOSED | `features/payments/PaymentSubmissionForm.tsx:56-60,279-352` preserves manual transfer eligibility and UI; `lib/__tests__/qrisFeatureFlagFlow.test.ts:31-41` and `lib/__tests__/phase06LaunchReadinessContract.test.ts:56-67` lock QRIS-disabled fallback behavior. |
| T-06-11 | CLOSED | `.planning/phases/06-imports-optional-qris-launch-readiness/06-VERIFICATION.md:7,26-35,41-56` requires explicit evidence links and records PASS only with populated evidence matrix. |
| T-06-12 | CLOSED | `.planning/phases/06-imports-optional-qris-launch-readiness/06-LAUNCH-UAT.md:19-27,45-52` defines deterministic execution order and rollback/escalation steps. |

### Consolidated Trust Boundaries

- Admin browser -> preview/apply/settings flows (`lib/imports/*`, `supabase/functions/import-*`, `app/admin/settings/page.tsx`)
- Edge Functions -> Postgres bulk-write and reconciliation paths (`import-apply`, QRIS RPC)
- Resident browser -> QRIS initiation/manual-transfer invoice actions (`QrisPaymentPanel`, `PaymentSubmissionForm`)
- Midtrans -> webhook reconciliation (`midtrans-webhook`, `reconcile_midtrans_qris_notification`)
- Operator-run UAT -> launch go/no-go evidence (`06-LAUNCH-UAT.md`, `06-VERIFICATION.md`)

### Notable Artifact Signals

- Verified remediation targets: `supabase/functions/import-apply/index.ts`, `supabase/migrations/0025_m08_qris_status_transition_guards.sql`, `supabase/tests/sql/m08_qris_reconciliation.sql`, `app/admin/settings/page.tsx`, `lib/__tests__/phase06LaunchReadinessContract.test.ts`.
- User-reported verification passed: targeted unit tests, `npm run typecheck`, and direct SQL execution of `supabase/tests/sql/m08_qris_reconciliation.sql`.
- `npm run test:sql` remained environment-blocked by local Supabase storage restart during `supabase db reset`; audit relied on updated code plus targeted SQL contract file and recorded verification artifact.

### Threat Flags

- No `## Threat Flags` section found in phase summaries.
- unregistered_flags: none

### Accepted Risks Log

- none
