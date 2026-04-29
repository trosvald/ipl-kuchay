---
phase: 1
slug: access-scope-resident-identity
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Supabase CLI SQL checks |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~45-90 seconds |

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
| 1-01-01 | 01 | 1 | AUTH-02, AUTH-03, AUTH-04, AUTH-05, PROF-03, KAVL-02 | T-01-01 | Treasurers lose broad admin writes; history access remains scoped | sql | `supabase db query --file supabase/tests/sql/m07_phase1_access_identity.sql` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-02, AUTH-03, AUTH-04, AUTH-05, PROF-03, KAVL-02 | T-01-02 | New helper/policy layer compiles and survives reset | sql | `npm run test:sql` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 2 | AUTH-01, AUTH-02, AUTH-03, AUTH-05 | T-02-01 | Session/auth state resolves to explicit portal access state | unit | `npm run test:unit` | ✅ | ⬜ pending |
| 1-02-02 | 02 | 2 | AUTH-01, AUTH-02, AUTH-03, AUTH-05 | T-02-02 | Protected routes block direct access by wrong role/state | build | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 3 | PUBL-01, PUBL-02, AUTH-02 | T-03-01 | Public dashboard stays aggregate-only; resident invoice views stay per-kavling scoped | build | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 1-04-01 | 04 | 3 | PROF-01, PROF-02, PROF-03 | T-04-01 | Settings form validates editable vs read-only identity fields | unit | `npm run test:unit -- lib/__tests__/validation.test.ts` | ✅ | ⬜ pending |
| 1-04-02 | 04 | 3 | PROF-01, PROF-02, PROF-03 | T-04-02 | Resident settings route builds and shell wiring stays valid | build | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 1-05-01 | 05 | 3 | AUTH-03, AUTH-04, AUTH-05 | T-05-01 | Admin shell only exposes allowed routes; treasurer audit remains finance-only | build | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 1-06-01 | 06 | 4 | AUTH-04, KAVL-01, KAVL-02 | T-06-01 | Mapping CRUD validates relation choices and explicit primary handoff rules | unit | `npm run test:unit` | ✅ | ⬜ pending |
| 1-06-02 | 06 | 4 | AUTH-04, KAVL-01, KAVL-02 | T-06-02 | Admin CRUD + mapping UI compile against new DB contract | build | `npm run typecheck && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/tests/sql/m07_phase1_access_identity.sql` — regression checks for Phase 1 SQL/RLS contract
- [ ] `lib/__tests__/validation.test.ts` — extend with resident settings and relation validation cases before UI code relies on them

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inactive resident sees blocked explanation instead of redirect loop | AUTH-01, AUTH-02 | Needs browser navigation state | Login with inactive profile, open `/app`, confirm blocked card copy is shown and no loop occurs |
| Unmapped resident sees limited portal with settings access | AUTH-02, PROF-01 | Needs routed UI state | Login with active profile that has zero active mappings, confirm `/app` renders guidance + settings link without admin data |
| Treasurer sees finance-only admin nav | AUTH-03 | Needs role-specific UI confirmation | Login as treasurer, open `/admin`, confirm residents/kavlings/settings links are absent and finance audit path is present |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-29
