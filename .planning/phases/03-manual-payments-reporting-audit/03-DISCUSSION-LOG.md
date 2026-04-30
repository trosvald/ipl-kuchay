# Phase 3: Manual Payments, Reporting & Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-04-30T04:51:01.255Z
**Phase:** 03-manual-payments-reporting-audit
**Areas discussed:** Payment status language, Verification workflow policy, Proof review security UX, Reporting & export contract, Payment receipt visibility, Admin queue prioritization, Report freshness model, Cross-screen discrepancy handling

---

## Payment status language

| Option | Description | Selected |
|--------|-------------|----------|
| Single canonical map | One shared label map in `lib/format.ts` used by resident + admin views; SQL statuses stay raw in DB but always translated consistently in UI. | ✓ |
| Resident/admin maps split | Different wording per role view; allows role nuance but increases drift risk with PAY-07 consistency. | |
| Keep as-is and patch per screen | Fastest now, but likely causes wording mismatch and support confusion. | |

**User's choice:** Single canonical map
**Notes:** Chosen to prioritize cross-screen consistency and reduce support confusion.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline actionable checklist | Show rejection reason + concrete next steps directly in invoice/submission history. | ✓ |
| Reason only | Show only rejection reason text. | |
| Contact admin CTA only | Direct users to admin/treasurer for all rejected cases. | |

**User's choice:** Inline actionable checklist
**Notes:** Rejection UX should remain self-service and explicit in Indonesian.

---

## Verification workflow policy

| Option | Description | Selected |
|--------|-------------|----------|
| Block overpay at submit | Resident cannot submit above outstanding amount; deterministic error behavior. | ✓ |
| Allow overpay, keep credit | Accept excess and track carry-over credit. | |
| Allow then manual adjust | Allow submission but require operator correction. | |

**User's choice:** Block overpay at submit
**Notes:** Avoids reconciliation ambiguity and keeps deterministic behavior.

| Option | Description | Selected |
|--------|-------------|----------|
| Approve optional, reject mandatory | Approval note optional, rejection reason mandatory. | ✓ |
| Notes mandatory both | Require notes for all decisions. | |
| Notes optional both | Notes optional for approve/reject. | |

**User's choice:** Approve optional, reject mandatory
**Notes:** Keeps operator throughput while preserving rejection explainability.

---

## Proof review security UX

| Option | Description | Selected |
|--------|-------------|----------|
| Short-lived view-only URLs | Brief expiry, open per request, no persistent public links. | ✓ |
| Long-lived convenience URLs | Lower friction, larger leakage window. | |
| Download-only flow | Strict handling, weaker quick-review UX. | |

**User's choice:** Short-lived view-only URLs
**Notes:** Preserves private-proof boundary while supporting review speed.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline retry + clear reason | Contextual error + one-click retry without page reload. | ✓ |
| Generic toast only | Minimal implementation, weak troubleshooting. | |
| Hard-block row actions | Block verify/reject until preview succeeds. | |

**User's choice:** Inline retry + clear reason
**Notes:** Avoids unnecessary workflow stalls.

---

## Reporting & export contract

| Option | Description | Selected |
|--------|-------------|----------|
| Billing period-first | Primary period filter with summary + arrears. | |
| All-time dashboard first | Broad default with drill-down/filtering support. | ✓ |
| Kavling-first drilldown | Per-kavling operations first. | |

**User's choice:** All-time dashboard first
**Notes:** Deviates from recommended default; leadership visibility prioritized while retaining operational drill-down.

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata-first records | Persist generation metadata in `public.reports`; file artifact can iterate. | ✓ |
| Mandatory file artifact now | Require stored output file for every generation action. | |
| UI-only preview for now | No persistence yet. | |

**User's choice:** Metadata-first records
**Notes:** Keeps auditability while reducing early implementation overhead.

| Option | Description | Selected |
|--------|-------------|----------|
| One canonical operational CSV | Single export aligned with filtered on-screen truth. | ✓ |
| Multiple role-specific CSVs | Separate files per use case. | |
| Minimal invoice-only CSV | Basic export only. | |

**User's choice:** One canonical operational CSV
**Notes:** Consistency over breadth for initial rollout.

---

## Payment receipt visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Invoice detail + compact list summary | Full detail in invoice page with quick summary in list context. | ✓ |
| Invoice detail only | Single source with no list summary. | |
| Dedicated receipts page now | New dedicated route/surface in this phase. | |

**User's choice:** Invoice detail + compact list summary
**Notes:** Improves discoverability without introducing a new major navigation surface.

---

## Admin queue prioritization

| Option | Description | Selected |
|--------|-------------|----------|
| Oldest pending first | SLA/fairness-first review order. | ✓ |
| Newest first | Fast responsiveness for new items. | |
| Risk-first hybrid | Prioritize by amount/overdue score. | |

**User's choice:** Oldest pending first
**Notes:** Reduces aged pending risk and resident distrust.

---

## Report freshness model

| Option | Description | Selected |
|--------|-------------|----------|
| Live query + last-updated badge | Current-data reads with visible freshness and manual refresh. | ✓ |
| Manual snapshot only | Stable snapshot until manual reload. | |
| Periodic auto-refresh | Automatic live updates. | |

**User's choice:** Live query + last-updated badge
**Notes:** Balances trust and control for finance operations.

---

## Cross-screen discrepancy handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show reconciliation warning + refresh CTA | Non-blocking warning with guidance and freshness context. | ✓ |
| Hard-block exports/actions | Stop actions on mismatch. | |
| Ignore eventual consistency | No special handling. | |

**User's choice:** Show reconciliation warning + refresh CTA
**Notes:** Prevents silent inconsistencies without stalling operations.

---

## OpenCode's Discretion

- Final UI composition details for status badges, warning cards, and compact receipt snippets.
- Exact CSV column ordering and wording while preserving one canonical operational dataset.

## Deferred Ideas

None.
