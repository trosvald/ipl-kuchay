# Milestones

## v1.0 v1.0 (Shipped: 2026-04-29)

**Phases completed:** 2 phases, 8 plans, 18 tasks

**Key accomplishments:**

- Supabase now enforces finance-vs-operator role boundaries, mapping-window resident history visibility, and reusable category-based notification preferences through migration-backed RLS contracts.
- Frontend auth now distinguishes mapped, unmapped, inactive, and missing-profile states while keeping password-first login and magic-link onboarding fallback for invited residents.
- Aggregate-only public IPL summary plus kavling-grouped resident invoice visibility with read-only former-resident history behavior.
- Resident settings now ship as a dedicated `/app/settings` page with strict writable-field limits and category-based notification preferences backed by safe profile update flows.
- Role-scoped admin navigation and treasurer-specific finance audit context were implemented so UI boundaries visibly match Phase 1 authorization decisions.
- Admin identity mapping now enforces explicit primary handoff and standardized resident-kavling relation modeling while preserving historical mapping visibility.
- Phase 1 human verification blockers were closed by promoting completed UAT pass evidence into auditable verification status and regenerating requirement/milestone artifacts to a passed gate.
- Milestone closure evidence was re-synchronized by regenerating the milestone audit and rerunning Phase 7 verification so both artifacts now report passed status.

**Known Gaps (accepted at milestone closure):**

- Billing configuration and resident billing completion backlog: `BILL-01` to `BILL-07`
- Manual payments, reporting, and audit completion backlog: `PAY-01` to `PAY-07`, `RPRT-01` to `RPRT-05`
- Neighborhood communication and events backlog: `COMM-01` to `COMM-05`, `EVNT-01` to `EVNT-04`, `HOME-01`
- Telegram integration backlog: `TLGM-01` to `TLGM-04`
- Import/operational readiness and optional QRIS backlog: `IMPT-01` to `IMPT-03`, `OPER-01`, `QRIS-01` to `QRIS-03`

---
