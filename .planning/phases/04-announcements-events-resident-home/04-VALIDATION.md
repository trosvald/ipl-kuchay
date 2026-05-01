---
phase: 04
slug: announcements-events-resident-home
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-30
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Supabase CLI SQL checks |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | COMM-01, COMM-02, COMM-03, COMM-04, EVNT-01, EVNT-02, EVNT-03, EVNT-04 | T-04-01..04 | Resident only sees published rows; RSVP write scope stays self-only | sql | `supabase db reset --yes && supabase db query --file supabase/tests/sql/m08_announcements_events_access.sql` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | COMM-02, COMM-04, EVNT-02, EVNT-03 | T-04-03 | Invalid announcement/event/RSVP payloads rejected before write | unit | `npm run test:unit -- lib/__tests__/validation.test.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | COMM-02, COMM-03, COMM-04 | T-04-05..07 | Admin-only announcement lifecycle actions respect writable fields | type+lint | `npm run typecheck && npm run lint` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 2 | EVNT-03, EVNT-04 | T-04-05..07 | Event lifecycle + RSVP summary remain admin-only | type+lint | `npm run typecheck && npm run lint` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | HOME-01 | T-04-08, T-04-10 | Resident home stays billing-first and tolerates partial fetch failure | type+lint | `npm run typecheck && npm run lint` | ✅ | ⬜ pending |
| 04-03-02 | 03 | 2 | COMM-01, EVNT-01, EVNT-02 | T-04-08, T-04-09 | Resident pages expose only resident-visible content and RSVP self-updates | type+lint | `npm run typecheck && npm run lint` | ✅ | ⬜ pending |
| 04-03-03 | 03 | 2 | HOME-01, COMM-01, EVNT-01, EVNT-02 | T-04-08..10 | Resident manual UAT confirms home/feed/RSVP contract end-to-end | manual | `MISSING — execute after task 04-03-01 and 04-03-02 automated checks pass` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resident home information hierarchy feels correct | HOME-01 | Requires visual confirmation of billing-first order and compact previews | Login as resident, open `/app`, verify billing summary appears before announcement/event slices and multi-kavling info is not merged |
| Urgent announcement hero and event RSVP UX | COMM-01, EVNT-02 | Requires end-user interaction and visual state confirmation | Open `/app/announcements` and `/app/events`, confirm urgent item placement, attachment affordances, RSVP change persistence after refresh |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
