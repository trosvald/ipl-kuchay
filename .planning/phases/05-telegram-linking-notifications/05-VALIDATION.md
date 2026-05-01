---
phase: 05
slug: telegram-linking-notifications
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Supabase SQL checks |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit` for TS/UI/helper tasks or `npm run typecheck` for Edge-function-only contract tasks.
- **After every plan wave:** Run `npm run test`.
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 60 seconds.

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TLGM-01 | T-05-01 / T-05-02 / T-05-04 | One-time token is hashed, expires, and cannot be replayed | sql | `npm run test:sql` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | TLGM-01 | T-05-03 / T-05-05 | Authenticated resident receives deep link without exposing service secrets | build | `npm run typecheck` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | TLGM-01 | T-05-06 / T-05-07 | Public webhook rejects bad secret and consumes only valid `link_` tokens | build | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | TLGM-02 / TLGM-04 | T-05-08 / T-05-09 / T-05-12 | Eligibility, dedupe, and delivery logging are enforced from SQL truth | sql | `npm run test:sql` | ✅ | ⬜ pending |
| 05-02-02 | 02 | 2 | TLGM-02 / TLGM-04 | T-05-10 / T-05-11 | Sender and scheduled jobs keep secrets server-side and log failed sends non-blockingly | build | `npm run typecheck` | ✅ | ⬜ pending |
| 05-02-03 | 02 | 2 | COMM-05 / TLGM-02 / TLGM-04 | T-05-13 / T-05-14 | Payment and announcement events emit Telegram side effects without corrupting source-of-truth writes | full | `npm run test` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 3 | TLGM-03 / TLGM-04 | T-05-15 / T-05-16 / T-05-18 | Bot commands remain self-scoped for residents and role-gated for admin summary | build | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 05-03-02 | 03 | 3 | TLGM-01 / TLGM-03 | T-05-17 | Resident settings show truthful Telegram link state and preserve preferences across unlink | unit | `npm run test:unit` | ✅ | ⬜ pending |
| 05-03-03 | 03 | 3 | COMM-05 / TLGM-02 | T-05-19 / T-05-20 | Admin page shows delivery truth and auditable template edits without exposing secrets | full | `npm run test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resident completes real Telegram deep-link flow from `/app/settings` | TLGM-01 | Requires live Telegram client + bot | Issue link, tap deep link, confirm bot success reply, reload settings and verify account metadata appears |
| Admin checks delivery badges and `/admin/telegram` filtering UX | COMM-05 / TLGM-02 | Requires visual confirmation of table filters and badge placement | Publish announcement and review payment submission, then verify badges/table/failure summary update in UI |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
