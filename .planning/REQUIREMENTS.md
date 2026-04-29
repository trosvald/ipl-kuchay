# Requirements: IPL Jatiloka Residence

**Defined:** 2026-04-29
**Core Value:** Residents can reliably check what they owe, submit payment, track status, and receive neighborhood updates without confusion or manual admin follow-up.

## v1 Requirements

Requirements for the initial release. Each maps to roadmap phases.

### Public Access

- [ ] **PUBL-01**: Visitor can view aggregate collection status for the active billing period without signing in
- [ ] **PUBL-02**: Visitor cannot view resident names, resident-level balances, payment proofs, or per-kavling payment detail from the public dashboard

### Authentication & Access

- [ ] **AUTH-01**: Resident can sign in securely and stay signed in across sessions
- [ ] **AUTH-02**: Resident can access only their own billing, profile, announcements, events, and Telegram-linking data
- [ ] **AUTH-03**: Treasurer can access billing, verification, reporting, and audit workflows required for finance operations
- [ ] **AUTH-04**: Admin can manage residents, kavlings, billing configuration, communication content, imports, and reports
- [ ] **AUTH-05**: Super admin can manage elevated roles and first-run administrative setup without exposing a public privilege-escalation path

### Resident Profile & Kavling Scope

- [ ] **PROF-01**: Resident can view their own profile and contact details
- [ ] **PROF-02**: Resident can update allowed personal and contact fields without changing privileged role data
- [ ] **PROF-03**: Resident can manage notification preferences for Telegram and in-app communication
- [ ] **KAVL-01**: Admin can create, edit, activate, and deactivate kavlings
- [ ] **KAVL-02**: Admin can assign residents to kavlings with correct relationship and primary-resident mapping

### Billing Configuration & Invoices

- [ ] **BILL-01**: Admin can create billing periods with month, year, label, due date, and lifecycle status
- [ ] **BILL-02**: Admin can generate invoices for active kavlings for a billing period using configured fee rules
- [ ] **BILL-03**: Admin can manage fee types including recurring fees, penalties, and configurable defaults
- [ ] **BILL-04**: Admin can configure per-kavling fee overrides when a resident or property needs a non-default amount
- [ ] **BILL-05**: Admin can define and apply penalty rules for overdue invoices
- [ ] **BILL-06**: Resident can view invoice breakdown by billing period and fee item
- [ ] **BILL-07**: Resident can view current dues, arrears, due dates, and historical invoice status from a single billing experience

### Manual Payments & Verification

- [ ] **PAY-01**: Resident can submit manual transfer proof for an eligible invoice with amount, note, and private proof attachment
- [ ] **PAY-02**: Resident can track whether a submitted payment is pending verification, verified, rejected, partial, paid, overdue, waived, or cancelled where applicable
- [ ] **PAY-03**: Resident can see rejection reasons and next steps when a payment submission is rejected
- [ ] **PAY-04**: Treasurer or admin can verify or reject a submitted payment through an audited workflow
- [ ] **PAY-05**: Treasurer or admin can review payment proof through permission-checked access without exposing public file URLs
- [ ] **PAY-06**: Resident can view payment history and receipt history for their own invoices
- [ ] **PAY-07**: Invoice balances and statuses remain consistent across resident views, admin views, reports, and notification flows

### Reporting & Audit

- [ ] **RPRT-01**: Treasurer or admin can view collection summary by billing period
- [ ] **RPRT-02**: Treasurer or admin can view arrears and outstanding invoice lists for operational follow-up
- [ ] **RPRT-03**: Treasurer or admin can export operational billing data to CSV
- [ ] **RPRT-04**: Treasurer or admin can generate monthly report output and resident receipt output for finance operations
- [ ] **RPRT-05**: Treasurer or admin can review an audit trail for sensitive billing and verification actions

### Neighborhood Communication

- [ ] **COMM-01**: Resident can view a resident-only announcements feed from the app
- [ ] **COMM-02**: Admin can create, publish, unpublish, update, and archive announcements
- [ ] **COMM-03**: Admin can mark an announcement as urgent so it is pinned or emphasized for residents
- [ ] **COMM-04**: Admin can attach supporting files or images to an announcement
- [ ] **COMM-05**: Resident can receive Telegram notification for new or urgent announcements according to notification preferences

### Events & Resident Home

- [ ] **EVNT-01**: Resident can view upcoming and past neighborhood events with date, time, location, and description
- [ ] **EVNT-02**: Resident can RSVP to an event and update their attendance choice
- [ ] **EVNT-03**: Admin can create, update, cancel, and manage neighborhood events
- [ ] **EVNT-04**: Admin can view RSVP summary for each event
- [ ] **HOME-01**: Resident can open a unified home view that combines billing status, announcements, and upcoming events in one place

### Telegram Integration

- [ ] **TLGM-01**: Resident can link their app account to a Telegram account through a secure one-time linking flow
- [ ] **TLGM-02**: Resident can receive Telegram reminders and status notifications for billing, payment review outcomes, and neighborhood announcements
- [ ] **TLGM-03**: Resident can use approved Telegram commands or deep-link flows to check their own billing status and history without exposing other residents' data
- [ ] **TLGM-04**: Admin-like users can receive Telegram summaries or alerts relevant to payment verification and neighborhood operations

### Imports & Operational Readiness

- [ ] **IMPT-01**: Admin can import kavling data from CSV with validation feedback before applying changes
- [ ] **IMPT-02**: Admin can import resident and kavling-mapping data from CSV with validation feedback before applying changes
- [ ] **IMPT-03**: Admin can import fee override or related setup data from CSV with validation feedback before applying changes
- [ ] **OPER-01**: Admin can operate the system without spreadsheet fallback for core billing, payment verification, communication, and reporting workflows

### QRIS / Gateway Support

- [ ] **QRIS-01**: Resident can initiate QRIS payment for an eligible invoice when the payment gateway feature flag is enabled
- [ ] **QRIS-02**: System can reconcile Midtrans payment notifications to the correct invoice without duplicate or inconsistent payment state
- [ ] **QRIS-03**: Admin can keep QRIS disabled for launch without breaking the manual-transfer workflow

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Community Extras

- **DOCS-01**: Resident can browse a dedicated document center for neighborhood rules, forms, and reference files
- **ANLT-01**: Admin can review announcement delivery/read analytics beyond basic notification status
- **TLGX-01**: Resident and admin can use richer Telegram action shortcuts beyond core reminder and status flows

### Payments & Expansion

- **PAYX-01**: Resident can use additional payment rails beyond manual transfer and the initial QRIS integration
- **VOTE-01**: Resident can participate in polls, voting, or committee workflows from the app

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Public per-kavling payment visibility | Launch decision is aggregate-only public transparency |
| Resident-to-resident chat or forum | Adds moderation burden and distracts from the operational core |
| WhatsApp notifications or workflows | Product direction is Telegram-only for messaging |
| Public payment proof links or files | Violates privacy and billing trust requirements |
| Browser-side privileged secrets | Violates security constraints |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PUBL-01 | Phase 7 | Pending |
| PUBL-02 | Phase 7 | Pending |
| AUTH-01 | Phase 7 | Pending |
| AUTH-02 | Phase 7 | Pending |
| AUTH-03 | Phase 7 | Pending |
| AUTH-04 | Phase 7 | Pending |
| AUTH-05 | Phase 7 | Pending |
| PROF-01 | Phase 7 | Pending |
| PROF-02 | Phase 7 | Pending |
| PROF-03 | Phase 7 | Pending |
| KAVL-01 | Phase 7 | Pending |
| KAVL-02 | Phase 7 | Pending |
| BILL-01 | Phase 2 | Pending |
| BILL-02 | Phase 2 | Pending |
| BILL-03 | Phase 2 | Pending |
| BILL-04 | Phase 2 | Pending |
| BILL-05 | Phase 2 | Pending |
| BILL-06 | Phase 2 | Pending |
| BILL-07 | Phase 2 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 3 | Pending |
| PAY-03 | Phase 3 | Pending |
| PAY-04 | Phase 3 | Pending |
| PAY-05 | Phase 3 | Pending |
| PAY-06 | Phase 3 | Pending |
| PAY-07 | Phase 3 | Pending |
| RPRT-01 | Phase 3 | Pending |
| RPRT-02 | Phase 3 | Pending |
| RPRT-03 | Phase 3 | Pending |
| RPRT-04 | Phase 3 | Pending |
| RPRT-05 | Phase 3 | Pending |
| COMM-01 | Phase 4 | Pending |
| COMM-02 | Phase 4 | Pending |
| COMM-03 | Phase 4 | Pending |
| COMM-04 | Phase 4 | Pending |
| EVNT-01 | Phase 4 | Pending |
| EVNT-02 | Phase 4 | Pending |
| EVNT-03 | Phase 4 | Pending |
| EVNT-04 | Phase 4 | Pending |
| HOME-01 | Phase 4 | Pending |
| COMM-05 | Phase 5 | Pending |
| TLGM-01 | Phase 5 | Pending |
| TLGM-02 | Phase 5 | Pending |
| TLGM-03 | Phase 5 | Pending |
| TLGM-04 | Phase 5 | Pending |
| IMPT-01 | Phase 6 | Pending |
| IMPT-02 | Phase 6 | Pending |
| IMPT-03 | Phase 6 | Pending |
| OPER-01 | Phase 6 | Pending |
| QRIS-01 | Phase 6 | Pending |
| QRIS-02 | Phase 6 | Pending |
| QRIS-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-29*
*Last updated: 2026-04-29 after milestone gap-phase creation*
