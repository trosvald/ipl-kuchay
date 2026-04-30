---
phase: 02
slug: billing-configuration-resident-billing-view
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-30
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + Supabase CLI SQL checks |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BILL-02, BILL-04, BILL-05 | T-02-01 | Preview/apply RPCs only return or mutate admin-authorized billing data | sql | `npm run test:sql` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | BILL-01, BILL-02 | T-02-02 | Draft/open publication rules prevent resident visibility drift | sql | `npm run test:sql` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | BILL-01, BILL-03, BILL-04, BILL-05 | T-02-03 | Admin UI only triggers preview/confirm flows and records audit entries | unit | `npm run test:unit` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 2 | BILL-06, BILL-07 | T-02-04 | Resident UI groups by accessible kavling and shows only resident-readable invoice history | unit | `npm run test:unit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/tests/sql/m02_phase2_billing.sql` — SQL acceptance coverage for preview generation, draft/open visibility, and penalty-cycle idempotency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin preview table clearly distinguishes default vs override-derived amounts | BILL-02, BILL-04 | Readability and operator confidence are visual | Open billing period admin page, run preview for a mixed default/override period, verify override rows are visually labeled before confirmation |
| Resident invoice cards/tabs remain scannable with expandable breakdown details | BILL-06, BILL-07 | Expand/collapse clarity and information hierarchy are visual | Open resident billing page with multiple kavlings and past invoices, verify arrears summary appears first and each invoice expands to itemized detail |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
