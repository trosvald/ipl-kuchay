---
phase: 06
slug: imports-optional-qris-launch-readiness
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-05
---

# Phase 06 — Validation Strategy

> Reconstructed Nyquist validation contract for phase 06 after execution, gap audit, and targeted test backfill.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + Supabase SQL checks |
| **Config file** | `vitest.config.ts` + `package.json` scripts |
| **Quick run command** | `npm run test:unit -- lib/__tests__/importPreview.test.ts lib/__tests__/importsAdminFlow.test.ts lib/__tests__/qrisFeatureFlagFlow.test.ts lib/__tests__/importApplyContract.test.ts lib/__tests__/createQrisTransactionContract.test.ts lib/__tests__/phase06LaunchReadinessContract.test.ts` |
| **Full suite command** | `npm run test && npm run typecheck` |
| **Estimated runtime** | ~2 seconds quick run, ~120 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -- lib/__tests__/importPreview.test.ts lib/__tests__/importsAdminFlow.test.ts lib/__tests__/qrisFeatureFlagFlow.test.ts lib/__tests__/importApplyContract.test.ts lib/__tests__/createQrisTransactionContract.test.ts lib/__tests__/phase06LaunchReadinessContract.test.ts`
- **After every plan wave:** Run `npm run test && npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | IMPT-01/02/03 | T-06-01 / T-06-02 | Preview rejects malformed rows, reports indexed Indonesian errors, and enforces preview-size guardrails before any write path exists. | unit | `npm run test:unit -- lib/__tests__/importPreview.test.ts` | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | IMPT-01/02/03 | T-06-01 / T-06-02 | Pure preview engine normalizes valid kavling, resident mapping, and fee override rows without persistence side effects. | unit | `npm run test:unit -- lib/__tests__/importPreview.test.ts` | ✅ | ✅ green |
| 06-02-01 | 02 | 2 | IMPT-01/02/03 | T-06-03 / T-06-04 / T-06-05 | `import-apply` records `import_jobs`, blocks invalid batches before business-table writes, and marks successful batches as applied. | contract | `npm run test:unit -- lib/__tests__/importApplyContract.test.ts` | ✅ | ✅ green |
| 06-02-02 | 02 | 2 | IMPT-01/02/03 | T-06-03 / T-06-04 / T-06-05 | Admin-only imports workflow exposes preview-before-apply guardrails and preserves safe apply behavior for all three import types. | unit + contract | `npm run test:unit -- lib/__tests__/importsAdminFlow.test.ts lib/__tests__/importApplyContract.test.ts` | ✅ | ✅ green |
| 06-03-01 | 03 | 1 | QRIS-02 | T-06-07 | Midtrans reconciliation remains idempotent for settlement, duplicate settlement, expire, and regressive status paths. | SQL | `npm run test:sql` | ✅ | ✅ green |
| 06-03-02 | 03 | 1 | QRIS-01/02 | T-06-06 / T-06-08 | QRIS creation only accepts eligible invoices, blocks concurrent active transactions, and persists mapped gateway response fields while reconciliation truth stays SQL-backed. | contract + SQL | `npm run test:unit -- lib/__tests__/createQrisTransactionContract.test.ts && npm run test:sql` | ✅ | ✅ green |
| 06-04-01 | 04 | 2 | QRIS-01/03 | T-06-09 | Payment-gateway setting defaults safe, reads malformed values as disabled, and writes a stable `app_settings` payload. | unit | `npm run test:unit -- lib/__tests__/qrisFeatureFlagFlow.test.ts` | ✅ | ✅ green |
| 06-04-02 | 04 | 2 | QRIS-01/03 | T-06-10 | Resident QRIS UI only appears for eligible invoices when enabled, while manual transfer stays available when QRIS is disabled. | unit | `npm run test:unit -- lib/__tests__/qrisFeatureFlagFlow.test.ts lib/__tests__/phase06LaunchReadinessContract.test.ts` | ✅ | ✅ green |
| 06-05-01 | 05 | 3 | OPER-01 / QRIS-03 | T-06-11 / T-06-12 | Launch-critical routes stay reachable and in-app report export can represent billing truth without spreadsheet formulas. | unit | `npm run test:unit -- lib/__tests__/phase06LaunchReadinessContract.test.ts` | ✅ | ✅ green |
| 06-05-02 | 05 | 3 | OPER-01 / QRIS-03 | T-06-11 / T-06-12 | Launch UAT and verification artifacts remain in repo and type-safe project changes do not regress surrounding app code. | typecheck | `npm run typecheck` | ✅ | ✅ green |
| 06-05-03 | 05 | 3 | OPER-01 / QRIS-03 | T-06-11 / T-06-12 | Operator can complete launch-readiness flows end-to-end with explicit evidence and no spreadsheet fallback. | manual | `MISSING — human-run UAT evidence capture required` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end launch UAT across billing generation, manual payment verification, announcement publish/view, report export, and QRIS-disabled resident fallback with evidence capture. | OPER-01 / QRIS-03 | Cross-role UI execution, live environment state transitions, and screenshot/log evidence collection require a real operator flow beyond deterministic unit and SQL harnesses. | Execute `.planning/phases/06-imports-optional-qris-launch-readiness/06-LAUNCH-UAT.md` and record evidence in `.planning/phases/06-imports-optional-qris-launch-readiness/06-VERIFICATION.md`. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-05
