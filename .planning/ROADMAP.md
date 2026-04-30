# Roadmap: IPL Jatiloka Residence

## Overview

This roadmap assumes the existing Next.js + Supabase foundation already covers baseline auth, billing, admin, and payment-review primitives. The remaining v1 work focuses on hardening trusted access, completing resident self-service billing, making manual-transfer operations reliable without spreadsheet fallback, adding neighborhood announcements and events, then layering Telegram delivery and optional QRIS readiness without making launch depend on it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Access, Scope & Resident Identity** - Harden role-scoped access, public privacy boundaries, resident profile management, and kavling mapping.
- [ ] **Phase 2: Billing Configuration & Resident Billing View** - Complete invoice configuration and give residents one trustworthy billing experience.
- [ ] **Phase 3: Manual Payments, Reporting & Audit** - Make manual transfer verification, finance reporting, and auditability launch-trustworthy.
- [ ] **Phase 4: Announcements, Events & Resident Home** - Add resident communication features and unify them into one home experience.
- [ ] **Phase 5: Telegram Linking & Notifications** - Turn Telegram into a secure linked channel for reminders, alerts, and billing shortcuts.
- [ ] **Phase 6: Imports, Optional QRIS & Launch Readiness** - Complete cutover workflows, feature-flagged QRIS support, and spreadsheet-free operations.
- [ ] **Phase 7: Phase 1 Gap Closure & Milestone Verification** - Close unresolved Phase 1 human-verification gaps and convert Phase 1 requirements to auditable pass status.

## Phase Details

### Phase 1: Access, Scope & Resident Identity
**Goal**: Residents and operators can securely access only the data and actions that belong to them, with correct resident-to-kavling identity mapping.
**Depends on**: Nothing (brownfield foundation already exists)
**Requirements**: PUBL-01, PUBL-02, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, PROF-01, PROF-02, PROF-03, KAVL-01, KAVL-02
**Success Criteria** (what must be TRUE):
  1. Visitor can open the public dashboard without signing in and see only aggregate collection information for the active billing period.
  2. Resident can sign in, stay signed in across sessions, and access only their own billing, profile, announcements, events, and Telegram-linking data.
  3. Treasurer, admin, and super admin can reach only the privileged workflows allowed for their roles, including finance operations and first-run elevated setup.
  4. Resident can view and update allowed personal/contact fields and notification preferences without changing privileged role data.
  5. Admin can manage kavlings and resident-to-kavling assignments so downstream billing and communication scope resolves correctly.
**Plans**: 6 plans
Plans:
- [ ] 01-01-PLAN.md — Harden schema, helper functions, RLS, and SQL regression coverage for Phase 1 access scope.
- [ ] 01-02-PLAN.md — Update auth provider, login flow, and guards for mapped, unmapped, inactive, and privileged states.
- [ ] 01-03-PLAN.md — Align public dashboard and resident billing/home surfaces with aggregate-only and per-kavling scope rules.
- [ ] 01-04-PLAN.md — Build the resident settings page with safe self-service profile and notification-preference editing.
- [ ] 01-05-PLAN.md — Make admin navigation and audit UI role-scoped, including a finance-only treasurer audit slice.
- [ ] 01-06-PLAN.md — Finish resident/kavling CRUD and explicit mapping handoff workflows for admins.
**UI hint**: yes

### Phase 2: Billing Configuration & Resident Billing View
**Goal**: Admins can configure billing rules and generate invoices, while residents can clearly understand what they owe from one billing experience.
**Depends on**: Phase 1
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07
**Success Criteria** (what must be TRUE):
  1. Admin can create billing periods with lifecycle state and manage fee types, penalties, and default billing rules.
  2. Admin can apply per-kavling overrides and generate invoices for active kavlings for a selected billing period.
  3. Resident can view invoice breakdowns by billing period and fee item, including current dues, arrears, and due dates.
  4. Resident can review historical invoice statuses from the same billing area without needing manual admin explanation.
**Plans**: 3 plans
Plans:
- [x] 02-01-PLAN.md — Finalize SQL contract for invoice generation, override resolution, and overdue penalty application.
- [x] 02-02-PLAN.md — Add admin preview/publish billing flows and finish auditable fee + override configuration.
- [x] 02-03-PLAN.md — Rebuild the resident billing experience around arrears focus, kavling grouping, and invoice breakdown clarity.
**UI hint**: yes

### Phase 3: Manual Payments, Reporting & Audit
**Goal**: Manual transfer payments become trustworthy, explainable, and consistent across resident views, operator workflows, reports, and audit logs.
**Depends on**: Phase 2
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, RPRT-01, RPRT-02, RPRT-03, RPRT-04, RPRT-05
**Success Criteria** (what must be TRUE):
  1. Resident can submit manual transfer proof for an eligible invoice with amount, note, and a private proof attachment.
  2. Resident can track payment states, rejection reasons, next steps, and payment/receipt history for their own invoices.
  3. Treasurer or admin can review payment proof through permission-checked access and verify or reject submissions through an audited workflow.
  4. Collection summaries, arrears views, CSV exports, monthly report outputs, receipt outputs, and audit trail all reflect the same invoice and payment truth shown in resident-facing screens.
**Plans**: 7 plans

Plans:
- [x] 03-01-PLAN.md — Harden SQL/RPC payment verification and finance audit invariants with regression coverage.
- [x] 03-02-PLAN.md — Align resident submission/history and admin review/proof flows to full manual-payment lifecycle truth.
- [x] 03-03-PLAN.md — Add treasurer/admin reporting route for collection summary, arrears, CSV export, and monthly/receipt outputs.
- [x] 03-04-PLAN.md — Turn monthly summary and resident receipt outputs into private generated artifacts with signed download access.
- [x] 03-05-PLAN.md — Wire resident payment/receipt history and admin output download UX to the generated artifact truth.
- [x] 03-06-PLAN.md — Repair payment-specific receipt persistence, real-schema report queries, and the broken Phase 3 artifact migration.
- [x] 03-07-PLAN.md — Make `/admin/reports` resilient to receipt-helper failures and switch receipt generation to real payment candidates only.
**UI hint**: yes

### Phase 4: Announcements, Events & Resident Home
**Goal**: Residents can receive neighborhood updates and event information inside the app, with one unified home for their most important information.
**Depends on**: Phase 3
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, EVNT-01, EVNT-02, EVNT-03, EVNT-04, HOME-01
**Success Criteria** (what must be TRUE):
  1. Resident can open a unified home view that combines billing status, announcements, and upcoming events in one place.
  2. Resident can browse a resident-only announcements feed, including urgent pinned content and attached supporting files or images.
  3. Admin can create, publish, unpublish, update, archive, and prioritize announcements for residents.
  4. Resident can view upcoming and past event details and RSVP or update their attendance choice.
  5. Admin can create, update, cancel, and manage events while viewing RSVP summaries for each event.
**Plans**: 3 plans
Plans:
- [ ] 04-01-PLAN.md — Add announcements/events schema, RLS, and validation contracts with SQL regression coverage.
- [ ] 04-02-PLAN.md — Build admin announcements and events management including urgent/publish lifecycle and RSVP summary.
- [ ] 04-03-PLAN.md — Deliver unified resident home plus resident announcements/events pages with RSVP updates.
**UI hint**: yes

### Phase 5: Telegram Linking & Notifications
**Goal**: Telegram works as a secure linked delivery and shortcut channel without becoming the system of record.
**Depends on**: Phase 4
**Requirements**: COMM-05, TLGM-01, TLGM-02, TLGM-03, TLGM-04
**Success Criteria** (what must be TRUE):
  1. Resident can securely link their app account to Telegram through a one-time linking flow tied to their existing account.
  2. Resident can receive Telegram notifications for billing reminders, payment review outcomes, and new or urgent announcements according to stored notification preferences.
  3. Resident can use approved Telegram commands or deep-link flows to check only their own billing status and history.
  4. Admin-like users can receive Telegram summaries or alerts relevant to payment verification and neighborhood operations.
**Plans**: 3 plans
Plans:
- [ ] 05-01-PLAN.md — Build secure one-time Telegram account linking contracts (DB + edge consume flow).
- [ ] 05-02-PLAN.md — Implement preference-aware Telegram notification dispatch and wire payment/announcement events.
- [ ] 05-03-PLAN.md — Deliver Telegram command/deep-link utility flows and resident settings link-state management.
**UI hint**: yes

### Phase 6: Imports, Optional QRIS & Launch Readiness
**Goal**: Admins can complete rollout and ongoing operations without spreadsheet fallback, while QRIS remains safely optional behind a feature flag.
**Depends on**: Phase 5
**Requirements**: IMPT-01, IMPT-02, IMPT-03, OPER-01, QRIS-01, QRIS-02, QRIS-03
**Success Criteria** (what must be TRUE):
  1. Admin can preview CSV validation feedback for kavling data, resident/kavling mapping data, and fee override or related setup data before applying imports.
  2. After imports are applied, admin can run core billing, payment verification, communication, and reporting workflows without falling back to spreadsheets.
  3. When the payment gateway feature flag is disabled, the manual-transfer launch workflow still works end-to-end without breakage.
  4. When the payment gateway feature flag is enabled, eligible residents can initiate QRIS payment and the system reconciles gateway notifications to the correct invoice without duplicate or inconsistent state.
**Plans**: 5 plans

Plans:
- [ ] 06-01-PLAN.md — Define and test the CSV preview validation contracts for kavling, resident-mapping, and fee-override imports.
- [ ] 06-02-PLAN.md — Build admin imports preview/apply workflow with Edge functions and import job audit persistence.
- [ ] 06-03-PLAN.md — Implement Midtrans QRIS create/reconciliation backend with idempotent webhook handling.
- [ ] 06-04-PLAN.md — Add admin QRIS feature flag controls and resident QRIS UI while preserving manual-transfer fallback.
- [ ] 06-05-PLAN.md — Produce launch-readiness operational verification artifacts and spreadsheet-free workflow proof.

### Phase 7: Phase 1 Gap Closure & Milestone Verification
**Goal**: Resolve all outstanding Phase 1 human-verification blockers so access/privacy/identity requirements are fully auditable and milestone closure is unblocked.
**Depends on**: Phase 1
**Requirements**: PUBL-01, PUBL-02, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, PROF-01, PROF-02, PROF-03, KAVL-01, KAVL-02
**Success Criteria** (what must be TRUE):
  1. Public dashboard anonymous-access checks are executed and recorded as pass/fail with evidence.
  2. Role route-protection journeys for resident/treasurer/admin/super_admin are executed and recorded with evidence.
  3. Former-resident history/read-only behavior is executed and recorded with evidence.
  4. Phase 1 verification status is updated from `human_needed` to `passed` after all human checks pass.
  5. Milestone audit no longer reports partial status for Phase 1 requirement IDs.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Access, Scope & Resident Identity | 0/6 | Not started | - |
| 2. Billing Configuration & Resident Billing View | 0/TBD | Not started | - |
| 3. Manual Payments, Reporting & Audit | 0/TBD | Not started | - |
| 4. Announcements, Events & Resident Home | 0/TBD | Not started | - |
| 5. Telegram Linking & Notifications | 0/TBD | Not started | - |
| 6. Imports, Optional QRIS & Launch Readiness | 0/TBD | Not started | - |
| 7. Phase 1 Gap Closure & Milestone Verification | 0/TBD | Not started | - |
