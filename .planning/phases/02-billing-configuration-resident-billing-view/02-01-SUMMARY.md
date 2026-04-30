---
phase: 02-billing-configuration-resident-billing-view
plan: 01
subsystem: database
tags: [supabase, postgres, rls, rpc, billing]
requires:
  - phase: 01-access-scope-resident-identity
    provides: finance-role helpers and invoice access policy baselines
provides:
  - Preview-before-generate billing SQL contract with resolved override source output
  - Idempotent invoice generation that only inserts missing period+kavling invoices
  - Cycle-key penalty preview/apply flow preventing duplicate invoice-cycle penalties
  - Resident visibility gating for draft vs open/closed/archived billing periods
affects: [phase-02-plan-02-admin-billing-ui, phase-02-plan-03-resident-billing-view]
tech-stack:
  added: []
  patterns: [SQL-first contract testing, security-definer finance RPC guards, cycle-key idempotency]
key-files:
  created: [supabase/migrations/0013_m08_phase2_billing_rules.sql, supabase/tests/sql/m02_phase2_billing.sql]
  modified: [package.json]
key-decisions:
  - "Applied draft visibility gating inside can_access_invoice_history to enforce resident publication lifecycle rules at SQL boundary."
  - "Introduced invoice_penalties.cycle_key and unique(invoice_id, penalty_rule_id, cycle_key) to support repeatable monthly penalty application without duplicates."
patterns-established:
  - "Preview RPCs return resolved amount source (default/override) and per-kavling totals before any inserts."
  - "Penalty apply RPC derives write-set from preview RPC to keep idempotency and auditable cycle behavior aligned."
requirements-completed: [BILL-01, BILL-02, BILL-04, BILL-05]
duration: 34min
completed: 2026-04-30
---

# Phase 02 Plan 01: Billing SQL Contract Summary

**Phase 2 billing now ships SQL-enforced preview, additive invoice generation, lifecycle-based resident visibility, and cycle-key penalty idempotency for auditable overdue processing.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-04-30T00:08:00Z
- **Completed:** 2026-04-30T00:42:20Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added executable SQL regression contract for preview, generate idempotency, resident lifecycle visibility, and penalty cycles.
- Implemented Phase 2 migration with `preview_invoices_for_period`, updated `generate_invoices_for_period`, and penalty preview/apply RPCs.
- Wired `m02_phase2_billing.sql` into default `npm run test:sql` and validated with local schema push plus SQL suite pass.

## task Commits

1. **task 1: write the SQL contract tests first** - `7c7f62c` (test)
2. **task 2: implement preview, publish, and penalty-cycle SQL behavior** - `2d84861` (feat)
3. **task 3: [BLOCKING] push schema before verification** - no code changes required (verification-only task)

## Files Created/Modified
- `supabase/tests/sql/m02_phase2_billing.sql` - Phase 2 contract test covering D-01/D-02/D-03/D-07/D-08/D-09/D-10/D-11/D-12 expectations.
- `supabase/migrations/0013_m08_phase2_billing_rules.sql` - preview/generation/penalty lifecycle SQL behavior and resident visibility gate adjustments.
- `package.json` - extends `test:sql` pipeline to include `m02_phase2_billing.sql`.

## Decisions Made
- Enforced resident draft invisibility via `can_access_invoice_history` billing-period status filtering instead of UI-only checks.
- Kept generation additive-only with existing `on conflict (billing_period_id, kavling_id) do nothing` and removed auto-open side effect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed cycle key ambiguity in penalty apply conflict handling**
- **Found during:** task 2
- **Issue:** PL/pgSQL ambiguity on `cycle_key` caused runtime failure.
- **Fix:** Qualified parameter references and switched to `on conflict on constraint ... do nothing`.
- **Files modified:** `supabase/migrations/0013_m08_phase2_billing_rules.sql`
- **Verification:** `supabase db reset --yes && supabase db query --file supabase/tests/sql/m02_phase2_billing.sql`
- **Committed in:** `2d84861`

**2. [Rule 1 - Bug] Stabilized generation assertions against seeded baseline kavlings**
- **Found during:** task 2
- **Issue:** Test expected fixed invoice count (2) but baseline seed has many active kavlings.
- **Fix:** Computed expected missing invoices dynamically before generation.
- **Files modified:** `supabase/tests/sql/m02_phase2_billing.sql`
- **Verification:** `supabase db reset --yes && supabase db query --file supabase/tests/sql/m02_phase2_billing.sql`
- **Committed in:** `2d84861`

**3. [Rule 3 - Blocking] Adjusted push command to local mode in worktree env**
- **Found during:** task 3
- **Issue:** `supabase db push` required linked remote project ref and blocked verification.
- **Fix:** Ran `supabase db push --local` before `npm run test:sql`.
- **Files modified:** none
- **Verification:** `supabase db push --local && npm run test:sql`
- **Committed in:** task 3 had no file changes

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3)
**Impact on plan:** All deviations were correctness/blocking fixes required to satisfy the contract and verification steps without scope creep.

## Known Stubs

None.

## Issues Encountered

- `supabase db push` without `--local` fails in this worktree because project ref is not linked; local mode resolved it.

## Next Phase Readiness

- Phase 2 SQL contract is enforceable and test-backed for admin billing UI integration.
- Next plans can consume stable RPC contracts for preview, publish lifecycle behavior, and repeatable penalty cycles.

## Self-Check: PASSED

- FOUND: `supabase/migrations/0013_m08_phase2_billing_rules.sql`
- FOUND: `supabase/tests/sql/m02_phase2_billing.sql`
- FOUND: commit `7c7f62c`
- FOUND: commit `2d84861`
