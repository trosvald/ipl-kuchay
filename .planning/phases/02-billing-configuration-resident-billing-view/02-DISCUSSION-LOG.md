# Phase 2: Billing Configuration & Resident Billing View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 02-billing-configuration-resident-billing-view
**Areas discussed:** Invoice generation flow, Resident billing view, Penalty rules & overdue, Billing period lifecycle

---

## Invoice generation flow

| Option | Description | Selected |
|--------|-------------|----------|
| Preview then confirm | Admin sees which kavlings will receive invoices and their amounts before committing. Safer — catches override or fee mistakes before invoices exist. | ✓ |
| Generate immediately | Admin clicks and invoices are created right away. Simpler flow but less safety net. Requires a way to void/delete if mistakes are found. | |

**User's choice:** Preview then confirm
**Notes:** Safety-first approach. Admin should be able to review and correct mistakes before invoices are created.

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent addition only | Re-running generation only creates invoices for kavlings that don't have one yet. Existing invoices are never overwritten. Safe and simple. | ✓ |
| Full regenerate with void | Existing unpaid invoices are voided, then all invoices are regenerated. Useful for correcting bulk fee changes, but risky if residents have already seen their invoices. | |
| No re-generation | Each kavling can only get one invoice per period. If a new kavling is added, admin creates its invoice manually. Minimal but restrictive. | |

**User's choice:** Idempotent addition only
**Notes:** Supports adding newly-activated kavlings after initial generation without risking existing invoice data.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-resolve at generation time | The RPC checks kavling_fee_overrides whose active window covers the billing period month and applies the override amount instead of the default. This is what the current generate_invoices_for_period already does. | ✓ |
| Admin previews overrides per-kavling | Before confirming, admin sees a per-kavling table showing default amount vs override amount for each kavling, and can adjust before generating. More control but heavier UI. | |

**User's choice:** Auto-resolve at generation time
**Notes:** Override resolution logic already exists in the RPC. Preview shows the resolved amounts but admin doesn't manually adjust overrides in the generation step.

---

## Resident billing view

| Option | Description | Selected |
|--------|-------------|----------|
| Per-kavling cards/tabs | Each kavling gets its own card or tab showing that kavling's invoices. Totals are per-kavling, not combined. Matches Phase 1 D-15 decision. | ✓ |
| Unified list with kavling column | All invoices in one list, with kavling code as a column. Status and period filters apply across all kavlings. Simpler but less structured. | |
| Summary cards + detail expansion | Kavling-level summary cards showing total due and overdue count, then expand each to see individual invoices. Balances quick overview with detail. | |

**User's choice:** Per-kavling cards/tabs
**Notes:** Aligns with Phase 1 decision that multi-kavling data must stay grouped by kavling and not merged.

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable detail within invoice card | Each invoice card shows total amount, status, and due date. Click or expand to see the fee item breakdown (base fee, overrides, penalties) below. Keeps the list scannable. | ✓ |
| Separate invoice detail page | Invoice list shows summary cards. Clicking opens a full detail page with fee item breakdown, payments received, and timeline. More space but requires navigation. | |

**User's choice:** Expandable detail within invoice card
**Notes:** Keeps the billing view as a single page with on-demand detail expansion. Avoids navigation to a separate detail page for each invoice.

| Option | Description | Selected |
|--------|-------------|----------|
| Arrears summary at top, then period list | A summary card at the top shows total arrears across all past overdue periods. Below it, the period-ordered invoice list shows each period's current status. | ✓ |
| Arrears as separate past-due section | Split the view into two sections: 'Overdue' (arrears) and 'Current & Upcoming'. Overdue section uses a distinct visual treatment. | |
| Arrears embedded in each invoice card | Each invoice card shows its own arrears contribution. No separate summary. Resident must scroll to understand total owed. | |

**User's choice:** Arrears summary at top, then period list
**Notes:** Gives residents an immediate sense of total overdue amount without requiring them to scan through past periods.

---

## Penalty rules & overdue

| Option | Description | Selected |
|--------|-------------|----------|
| Flat amount per period | Admin defines a fixed late fee amount (e.g., Rp 25.000 per period). Each overdue period adds that flat amount. Simple to understand and communicate. | ✓ |
| Percentage-based | Admin defines a percentage of the overdue amount. More financially precise but harder to communicate and can compound unpredictably. | |
| Flat + percentage hybrid | Minimum flat fee plus optional percentage. Flexible but complex to explain and configure. | |

**User's choice:** Flat amount per period
**Notes:** Neighborhood billing context favors simplicity. "Rp 25.000 per bulan terlambat" is clearer than percentage calculations.

| Option | Description | Selected |
|--------|-------------|----------|
| Admin applies penalties on demand | Admin clicks 'Apply penalties' for a billing period. System shows a preview of which invoices will receive penalties before confirming. Controllable and auditable. | ✓ |
| Auto-apply when period is overdue | System automatically adds penalties when the due date passes. No admin action needed, but residents may see penalties before admin has reviewed them. | |
| Mixed: auto-apply with admin override | System auto-applies penalties after due date, admin can review, adjust, or cancel before finalizing. More control but more complex. | |

**User's choice:** Admin applies penalties on demand
**Notes:** Keeps the admin in control. Preview step provides a safety net before penalties are committed.

| Option | Description | Selected |
|--------|-------------|----------|
| Repeated per overdue period | Each penalty application checks if an invoice already has a penalty item for that overdue cycle. If not, one is added. Supports accumulating late fees. | ✓ |
| One-time only per invoice | Each invoice can only receive one penalty item total, regardless of how many months it stays overdue. Simpler but may not incentivize timely payment. | |

**User's choice:** Repeated per overdue period
**Notes:** Supports escalating penalty amounts for persistently overdue invoices while preventing duplicate penalties for the same cycle.

---

## Billing period lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Linear with one-step back: draft → open → closed → archived, closed → open allowed | Admin moves period forward through statuses. Reopening from closed is allowed for corrections. Archive is irreversible. Matches current UI statuses. | ✓ |
| Strictly linear: draft → open → closed → archived, no backward transitions | Each transition is one-way. Corrections require adjustments instead of reopening. Safer for financial data but less flexible. | |
| Fully flexible: any transition between statuses | Admin can move periods freely. Maximum flexibility but risks financial confusion. | |

**User's choice:** Linear with one-step back
**Notes:** Allows reopening for corrections without compromising overall lifecycle integrity. Irreversible archive protects historical data.

| Option | Description | Selected |
|--------|-------------|----------|
| Draft invoices in draft period | Admin creates period in draft, generates invoices (still draft status), previews everything, then opens the period which also activates the invoices. Full control before resident visibility. | ✓ |
| Invoices only generated when period is open | Period must be open before invoices exist. Simpler lifecycle but admin can't preview invoices before making them visible. | |

**User's choice:** Draft invoices in draft period
**Notes:** Gives admin full control to preview and verify invoices before residents can see them. Opening the period publishes both the period and its invoices.

| Option | Description | Selected |
|--------|-------------|----------|
| Archived periods still visible but read-only | Residents can view archived period invoices for history and receipts, but no new actions are possible. Financial records stay accessible. | ✓ |
| Archived periods hidden from resident view | Only the most recent N periods are visible. Archived data is admin-only. Simpler resident view but loses transparency. | |

**User's choice:** Archived periods still visible but read-only
**Notes:** Preserves financial transparency. Residents can always refer back to past invoices for their records.

---

## OpenCode's Discretion

- Exact layout and card design for per-kavling billing tabs
- Arrears summary visual treatment (color, prominence, position)
- Invoice expand/collapse animation and detail formatting
- Penalty preview table columns and confirmation UX
- Draft vs open period visual distinction in admin UI
- Sort order and default period filter for resident invoice list

## Deferred Ideas

None — discussion stayed within Phase 2 scope.