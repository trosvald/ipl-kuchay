# Feature Research

**Domain:** Neighborhood billing, resident self-service, and community operations app
**Researched:** 2026-04-29
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Resident billing dashboard (current dues, arrears, due dates, paid history) | Residents expect a single place to see what they owe and what was already paid | MEDIUM | Most important spreadsheet-replacement feature; must be clear per resident/kavling and period |
| Payment submission and status tracking | Strong products let residents pay or at least submit proof, then see pending/verified/rejected state | MEDIUM | Manual transfer is launch path here, so proof upload + review status + rejection reason are mandatory |
| Payment reminders and receipts | Late-payment reduction is a core value of resident portals | MEDIUM | Needs scheduled reminders, payment confirmations, and downloadable/shareable receipt history |
| Resident profile and contact management | Residents expect to update phone, email, occupant data, and notification preferences | LOW | Critical for full rollout because stale contact data breaks reminders and announcements |
| Announcements feed with targeting | Community apps are expected to show official notices in-app, not only via ad hoc chat | MEDIUM | Must support audience targeting by role/block/status, publish/unpublish, pinning, and read clarity |
| Event calendar with RSVP | Events are a normal expectation once “community communication” is promised | MEDIUM | Needs date/time/location/description, attendance intent, and admin attendee view |
| Telegram notifications for key events | In this project, Telegram is the chosen messaging rail, so users will expect delivery there | MEDIUM | Start with notification push and account linking, not full conversational automation |
| Resident document access | Competitors consistently include access to statements, notices, and community documents | MEDIUM | Important for replacing spreadsheet + WhatsApp/file-scatter workflows |
| Admin billing operations | Operators need invoice generation, payment review, adjustment handling, and collection follow-up | HIGH | Non-negotiable for full neighborhood rollout; otherwise staff falls back to spreadsheets |
| Collection and reconciliation reporting | Boards/treasurers need period totals, unpaid accounts, verified payments, and exportable audit trails | HIGH | Most important admin-side spreadsheet replacement capability |
| Audit trail for billing and communication actions | Billing disputes and compliance questions require a system record | MEDIUM | Track who published, verified, edited, rejected, or resent critical items |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified resident home (bills + payment status + announcements + upcoming events) | Reduces “where do I check?” friction and makes the app feel like the neighborhood’s single source of truth | MEDIUM | Especially strong for adoption in spreadsheet-replacement rollouts |
| Telegram account linking with personalized alerts | Makes the system useful in residents’ existing communication habit instead of waiting for app-open behavior | HIGH | Best differentiator for this project; prioritize secure linking, notification preferences, and deep links back to app |
| Telegram admin/resident action shortcuts | Useful flows like “bill due soon”, “payment rejected”, or “new urgent notice” can be acted on faster | HIGH | Keep scoped to narrow high-value actions; avoid building a full chat product |
| Announcement delivery analytics | Helps admins see sent/read/delivery outcomes and improve reach for urgent notices | MEDIUM | Valuable because communication reliability matters as much as posting content |
| Admin operational inbox / follow-up queue | Gives treasurers a clear list of payments awaiting review, residents missing data, failed notifications, and overdue bills | MEDIUM | High leverage for full rollout because it replaces manual checklists |
| Exception reporting and dispute support | Surfacing mismatches, repeated rejections, unpaid aging, and missing resident links reduces hidden operational risk | HIGH | Strong differentiator for running the neighborhood without spreadsheet shadow systems |
| Resident-friendly onboarding for rollout | Invite flow, first-login guidance, and Telegram linking checklist can materially improve adoption | MEDIUM | Important because neighborhood-wide rollout fails more from adoption gaps than feature gaps |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Resident-to-resident chat/forum | Sounds like “community engagement” | High moderation burden, conflict risk, spam, and major scope expansion away from billing ops | Keep official announcements, event RSVP, and limited replies/contact paths |
| Public resident-level payment visibility | Feels like it would pressure payment compliance | Creates privacy risk and neighborhood tension; conflicts with approved aggregate-only public boundary | Keep public dashboard aggregate-only and resident balances private |
| Too many payment methods at launch | Seems more flexible | Increases reconciliation complexity and rollout risk before manual transfer is fully reliable | Nail manual transfer + proof + verification first; add QRIS later if justified |
| Full Telegram bot for every workflow | Feels modern and convenient | Bot complexity, identity/security issues, and duplicated UX can slow delivery | Use Telegram for linking, reminders, alerts, and a few high-value actions first |
| Broad “custom report builder” in v1 | Admins often ask for limitless exports | High build cost and weak early ROI; most teams really need a few canonical operational reports | Ship opinionated reports + CSV export for key datasets |

## Feature Dependencies

```text
Resident profile + household/contact data
    └──requires──> secure resident identity and role mapping
                        └──enables──> announcement targeting
                        └──enables──> Telegram account linking
                        └──enables──> reminder delivery

Billing dashboard
    └──requires──> billing periods + invoice ledger + payment status model
                        └──enables──> resident self-service history
                        └──enables──> collection reporting

Payment proof submission
    └──requires──> invoice ledger + private file storage + admin review workflow
                        └──enables──> payment status tracking
                        └──enables──> receipts and audit trail

Announcements
    └──enhances──> unified resident home
    └──enhances──> Telegram notifications

Events + RSVP
    └──requires──> resident identity
    └──enhances──> announcements

Operational reports
    └──requires──> normalized billing/payment/audit data

Resident-to-resident chat ──conflicts──> lean v1 neighborhood ops scope
```

### Dependency Notes

- **Resident profile requires secure identity and role mapping:** targeted communication, RSVP, and billing visibility break if a resident is not reliably mapped to the correct kavling/household.
- **Billing dashboard requires invoice ledger and payment status model:** without normalized statuses, residents and admins will not trust balances or payment history.
- **Payment proof submission requires private storage and admin review:** manual transfer only works at full rollout if proof privacy, rejection reasons, and review traceability are solid.
- **Announcements enhance the unified resident home:** the app becomes habit-forming when residents open one page for bills and neighborhood updates.
- **Events enhance announcements:** event posts should convert directly into RSVP and attendance tracking instead of being dead-end notices.
- **Operational reports require normalized data:** if admins can edit data loosely or outside workflow, reports will drift and spreadsheets will come back.
- **Resident-to-resident chat conflicts with lean v1 scope:** it diverts effort from high-trust billing and official communication needs.

## MVP Definition

### Launch With (v1)

Minimum viable product — what’s needed to validate the concept.

- [ ] Resident billing dashboard — core self-service value and the main spreadsheet-replacement experience
- [ ] Payment proof submission, review status, and receipts — required to make manual transfer viable for launch
- [ ] Resident profile + notification preferences — needed for clean rollout and reliable communication
- [ ] Announcements feed with targeting, pinning, attachments, and Telegram push — required for official neighborhood communication
- [ ] Event calendar with RSVP — enough to make events first-class without overbuilding
- [ ] Admin billing operations (issue/manage invoices, verify payments, handle rejections/adjustments) — must eliminate spreadsheet fallback
- [ ] Collection reporting and exports — treasurer/admin must be able to run the neighborhood operationally from the app
- [ ] Telegram account linking + reminder notifications — highest-value communication differentiator aligned with product direction

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Delivery/read analytics for announcements — add when message reliability becomes a recurring admin concern
- [ ] Telegram action shortcuts for common resident/admin flows — add after linking and notifications are stable
- [ ] Exception dashboards and delinquency follow-up queues — add when operational volume makes manual follow-up costly
- [ ] Richer document library and policy acknowledgements — add when announcement/billing flows are stable

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] QRIS or broader online payment rails — defer until manual transfer workflow is trusted end-to-end
- [ ] Amenity booking / visitor / package modules — common in larger HOA suites, but not core to this project’s current value
- [ ] Voting, surveys, or formal committee workflows — useful later, but not necessary for initial neighborhood billing + comms success
- [ ] AI-generated resident support or auto-replies — promising, but low priority versus operational correctness and adoption

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Resident billing dashboard | HIGH | MEDIUM | P1 |
| Payment proof + review status | HIGH | MEDIUM | P1 |
| Announcements with Telegram push | HIGH | MEDIUM | P1 |
| Event calendar + RSVP | MEDIUM | MEDIUM | P1 |
| Resident profile + notification preferences | HIGH | LOW | P1 |
| Admin billing operations | HIGH | HIGH | P1 |
| Collection/reporting exports | HIGH | HIGH | P1 |
| Telegram account linking | HIGH | HIGH | P1 |
| Unified resident home | HIGH | MEDIUM | P2 |
| Delivery/read analytics | MEDIUM | MEDIUM | P2 |
| Exception dashboards | HIGH | HIGH | P2 |
| QRIS / additional payment rails | MEDIUM | HIGH | P3 |
| Resident social/forum features | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Buildium | TownSq / Condo Control | Our Approach |
|---------|----------|------------------------|--------------|
| Resident self-service payments | Strong resident center, autopay, reminders, payment history | Strong homeowner app and online payment positioning | Match clarity/status/history now, but optimize for manual-transfer proof workflow first |
| Community announcements | Multi-channel communications and resident portal messaging | Strong emphasis on announcements, bulletin boards, and event/news communication | Make official announcements first-class, targeted, pinned, and Telegram-delivered |
| Events | Present but secondary | Prominent event calendar/community engagement pattern | Treat events as first-class v1 because project scope explicitly includes them |
| Operational reporting | Strong accounting/reporting suites | Reporting plus record-keeping modules | Focus on opinionated billing/collections reports that replace spreadsheets immediately |
| Mobile/notification habit | Portal/mobile app centric | Portal/mobile app centric with engagement emphasis | Differentiate with Telegram linking because that matches local communication behavior better |
| Community/social layer | Some message board/community features | Some forums/community extras | Avoid full social/community network scope in v1 |

## Sources

- Project context: `.planning/PROJECT.md`
- Buildium Resident Center (official): https://www.buildium.com/features/resident-center/
- Buildium Community Association Management (official): https://www.buildium.com/portfolios/association-management-software/
- Buildium Online Payments (official): https://www.buildium.com/features/online-rent-payments/
- TownSq homepage and Community/Homeowners pages (official): https://www.townsq.io/ , https://www.townsq.io/solutions/townsq-community , https://www.townsq.io/solutions/by-role/homeowners
- Condo Control product overview and Announcements feature (official): https://www.condocontrol.com/product/ , https://www.condocontrol.com/communication/announcements/
- Condo Control blog on check-processing and transition costs (official but marketing-informed, lower authority than product pages): https://www.condocontrol.com/blog/still-collecting-checks-hoa-costs/

---
*Feature research for: IPL Jatiloka Residence neighborhood billing and resident-ops app*
*Researched: 2026-04-29*
