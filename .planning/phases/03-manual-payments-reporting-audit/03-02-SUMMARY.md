---
phase: 03-manual-payments-reporting-audit
plan: 02
subsystem: payments
tags: [typescript, react, payments, ux, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: M08 SQL acceptance suite and hardened verify/reject RPC functions
provides:
  - Centralized payment submission status formatting in lib/format.ts
  - Resident-facing rejection guidance with next-step action in SubmissionHistory
  - Admin review queue with consistent status semantics
affects: [payments, resident, admin, billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized status formatting in lib/format.ts for consistent resident/admin semantics"
    - "TDD-first approach: RED failing tests → GREEN implementation → passing tests"

key-files:
  created:
    - lib/__tests__/formatSubmissionStatus.test.ts
    - lib/__tests__/formatRejectionGuidance.test.ts
    - lib/__tests__/adminReviewActions.test.ts
  modified:
    - lib/format.ts
    - features/payments/SubmissionHistory.tsx
    - features/payments/AdminSubmissionsPage.tsx

key-decisions:
  - "Centralized formatPaymentSubmissionStatus() in lib/format.ts replaces inline status formatters across SubmissionHistory and AdminSubmissionsPage"
  - "Added buildRejectionGuidance() for actionable Indonesian rejection guidance showing reason plus next-step"
  - "Added formatSubmissionNextStep() for contextual guidance per submission lifecycle state"

patterns-established:
  - "Centralized status helpers ensure resident-facing and admin-facing payment states remain semantically consistent"
  - "Rejection guidance surfaces explicit next-step copy (no vague 'hubungi admin' only)"

requirements-completed: [PAY-01, PAY-02, PAY-03, PAY-05, PAY-06, PAY-07]

# Metrics
duration: 7min
completed: 2026-04-30
---

# Phase 3 Plan 2: Manual Payment Reporting & Audit UX Summary

**Centralized status formatting and actionable rejection guidance with TDD discipline for resident submission/history and admin review surfaces**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-30T05:12:45Z
- **Completed:** 2026-04-30T05:19:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Centralized `formatPaymentSubmissionStatus()`, `buildRejectionGuidance()`, and `formatSubmissionNextStep()` in `lib/format.ts`
- SubmissionHistory now shows Langkah (Next Step) column with actionable Indonesian guidance per status
- AdminSubmissionsPage updated to use centralized status helpers for resident/admin semantic consistency
- All 50 tests pass, typecheck passes, build succeeds

## Task Commits

Each task was committed atomically:

1. **task 1: align resident submission + history UI with full payment lifecycle truth** - `1f03a2c` (feat)
2. **task 2: harden admin review UX and permission-checked proof inspection flow** - `27c9532` (feat)

**Plan metadata:** `27c9532` (docs: complete plan)

## Files Created/Modified
- `lib/format.ts` - Added formatPaymentSubmissionStatus(), buildRejectionGuidance(), formatSubmissionNextStep()
- `features/payments/SubmissionHistory.tsx` - Added Langkah column with next-step guidance; use centralized helpers
- `features/payments/AdminSubmissionsPage.tsx` - Use centralized formatPaymentSubmissionStatus()
- `lib/__tests__/formatSubmissionStatus.test.ts` - RED test for centralized status formatter
- `lib/__tests__/formatRejectionGuidance.test.ts` - RED test for rejection guidance helpers
- `lib/__tests__/adminReviewActions.test.ts` - Admin review contract and error handling tests

## Decisions Made

- Centralized status helpers replace inline formatters to ensure semantic consistency between resident-facing and admin-facing views
- Rejection guidance shows both the reason and a clear next-step action rather than vague "hubungi admin" copy

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** No deviations. All tasks completed as specified.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 payment UX is complete: centralized status labels, rejection guidance, and admin review surfaces are consistent with SQL truth layer
- All PAY-01/PAY-02/PAY-03/PAY-05/PAY-06/PAY-07 requirements addressed
- Ready for next plan in Phase 3 (03-03)

---

*Phase: 03-manual-payments-reporting-audit*
*Completed: 2026-04-30*
