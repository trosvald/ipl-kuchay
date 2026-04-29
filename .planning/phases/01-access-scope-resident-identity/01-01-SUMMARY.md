---
phase: 01-access-scope-resident-identity
plan: 01
subsystem: database
tags: [supabase, rls, sql, auth, resident-scope]
requires:
  - phase: 01-access-scope-resident-identity
    provides: role and identity decisions from 01-CONTEXT.md
provides:
  - Finance/operator role helpers for policy scoping
  - Resident mapping-window invoice access helper
  - Notification preference storage with per-category uniqueness
  - SQL regression contract for phase-1 access rules
affects: [auth, billing, resident-home, admin-navigation]
tech-stack:
  added: []
  patterns: [policy narrowing via helper functions, SQL regression-first for RLS]
key-files:
  created:
    - supabase/migrations/0012_m07_access_scope_identity.sql
    - supabase/tests/sql/m07_phase1_access_identity.sql
  modified:
    - package.json
key-decisions:
  - "Use has_finance_role() vs has_operator_role() split to keep treasurer finance-only."
  - "Use can_access_invoice_history(invoice_id) with started_at/ended_at windows for former-resident visibility."
patterns-established:
  - "Policy capability split: operator-only for resident/kavling/settings/import writes; finance role for billing/payment/reporting."
  - "Phase SQL contract runs inside npm run test:sql for continuous regression coverage."
requirements-completed: [AUTH-02, AUTH-03, AUTH-04, AUTH-05, PROF-03, KAVL-02]
duration: 31 min
completed: 2026-04-29
---

# Phase 01 Plan 01: Harden schema, helper functions, RLS, and SQL regression coverage for Phase 1 access scope Summary

**Supabase now enforces finance-vs-operator role boundaries, mapping-window resident history visibility, and reusable category-based notification preferences through migration-backed RLS contracts.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-04-29T11:20:00Z
- **Completed:** 2026-04-29T11:51:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added `0012_m07_access_scope_identity.sql` with `has_finance_role`, `has_operator_role`, `can_view_finance_audit_log`, and `can_access_invoice_history`.
- Added `notification_preferences` table + RLS and extended `kavling_residents` with relation/history columns (`relation_type`, `relation_label`, `started_at`, `ended_at`).
- Added and wired `m07_phase1_access_identity.sql` into `npm run test:sql` to enforce treasurer scope, mapping-window history, notification preference uniqueness, and explicit primary handoff behavior.

## task Commits

Each task was committed atomically:

1. **task 1: write SQL regression contract for Phase 1 access rules** - `715f90e` (test)
2. **task 2: implement the Phase 1 migration and wire it into the SQL suite** - `64fa2a6` (feat)
3. **task 3: [BLOCKING] push the schema before downstream verification** - `4d25dc4` (chore)

## Files Created/Modified
- `supabase/tests/sql/m07_phase1_access_identity.sql` - Regression checks for phase-1 role scope, resident history windows, preference storage, and handoff guard.
- `supabase/migrations/0012_m07_access_scope_identity.sql` - Role helpers, policy narrowing, mapping history columns, notification preferences, and invoice history helper.
- `package.json` - Includes the new M07 SQL regression in `test:sql`.

## Decisions Made
- Split authorization intent into finance-capable and operator-capable helpers to model treasurer constraints cleanly at policy level.
- Enforced historical resident read scope with due-date window checks against mapping intervals instead of active-flag-only checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `supabase db push` unavailable due to unlinked project ref**
- **Found during:** task 3
- **Issue:** `supabase db push` failed with "Cannot find project ref. Have you run supabase link?"
- **Fix:** Followed plan-approved fallback path by running local reset (`npm run supabase:reset -- --yes`) then full SQL verification (`npm run test:sql`).
- **Files modified:** none
- **Verification:** reset succeeded; full SQL suite passed including M07 regression.
- **Committed in:** `4d25dc4`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep; fallback path was explicitly allowed by task definition and kept schema/test state authoritative.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend access-scope contract is in place for downstream auth/UI phase work.
- SQL suite now guards against regressions in treasurer scope, historical visibility, and notification preference model.

## Self-Check: PASSED
- Found file: `.planning/phases/01-access-scope-resident-identity/01-01-SUMMARY.md`
- Found file: `supabase/migrations/0012_m07_access_scope_identity.sql`
- Found file: `supabase/tests/sql/m07_phase1_access_identity.sql`
- Found commit: `715f90e`
- Found commit: `64fa2a6`
- Found commit: `4d25dc4`

---
*Phase: 01-access-scope-resident-identity*
*Completed: 2026-04-29*
