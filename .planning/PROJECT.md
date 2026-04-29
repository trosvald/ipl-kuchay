# IPL Jatiloka Residence

## What This Is

IPL Jatiloka Residence is a neighborhood operations app for managing resident billing, payment confirmation, collection tracking, and neighborhood communication in one place. It serves residents, treasurers, admins, and super admins with a secure web app backed by Supabase, while keeping public access limited to aggregate collection visibility only. The product is intended to replace spreadsheet-driven operations with a resident self-service experience that also includes announcements and event coordination.

## Core Value

Residents can reliably check what they owe, submit payment, track status, and receive neighborhood updates without confusion or manual admin follow-up.

## Requirements

### Validated

- ✓ Public dashboard route exists with collection visibility baseline — existing
- ✓ Secure login, session handling, and role-guarded resident/admin areas exist — existing
- ✓ Resident portal baseline exists for viewing billing-related information — existing
- ✓ Admin portal baseline exists for operational management workflows — existing
- ✓ Supabase-backed schema, RLS, RPCs, and audit-oriented billing workflows are established — existing
- ✓ Manual payment proof submission flow exists with private storage and admin review baseline — existing
- ✓ Billing periods, invoices, kavlings, residents, and payment review foundations exist in the current app — existing

### Active

- [ ] Complete the full production v1 scope defined in `docs/` and `CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md`
- [ ] Deliver resident self-service as the top product priority across billing, payment status, and history
- [ ] Finish the remaining billing and reporting workflows required for full rollout without spreadsheet fallback
- [ ] Add Telegram account linking, resident/admin bot flows, reminders, and notifications where planned
- [ ] Keep the public dashboard aggregate-only at launch
- [ ] Launch with manual transfer as the required payment path; QRIS may exist later but is not required for go-live
- [ ] Add resident-only neighborhood announcements and events as first-class v1 features
- [ ] Provide a unified resident home that combines bills, payment status, announcements, and upcoming events
- [ ] Add resident profile management and notification preferences
- [ ] Add announcement lifecycle support: publish/unpublish, urgent pinning, Telegram push, and attachments
- [ ] Add structured event details and RSVP tracking for residents and admins
- [ ] Execute the project with pragmatic TDD, with stricter test-first discipline on billing, auth, payments, roles/RLS, Telegram, and other security-sensitive flows

### Out of Scope

- Public per-kavling payment visibility at launch — aggregate-only public dashboard is the approved boundary
- Resident chat/forum/social posting — not needed for the core neighborhood operations goal and adds moderation overhead
- WhatsApp-based workflows — product direction is Telegram-only wherever messaging is required
- Public payment proof files or public proof URLs — proof privacy is non-negotiable
- Browser-stored privileged secrets — server-side secrets only
- Treating QRIS as a launch blocker — manual transfer must be enough for first full rollout

## Context

This is a brownfield Next.js + TypeScript + Supabase application with meaningful existing implementation already in place. The current system includes route structure, role-guarded resident and admin portals, Supabase Auth integration, SQL migrations with RLS and RPCs, manual payment proof submission, admin verification flow, and audit logging patterns. However, the codebase still has notable delivery gaps versus the intended product: Telegram runtime integration is not finished, deployment documentation is stale, end-to-end coverage is thin, and the neighborhood communication side of the product is not yet a first-class experience.

The project also has hidden planning context that matters: `docs/plan/` contains milestone shards, and `CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md` contains the broad v1 product intent. The user wants that material treated as baseline v1 scope, but not blindly. Initialization should preserve the current stack and security direction while elevating resident self-service, neighborhood announcements/events, and pragmatic TDD as explicit priorities.

The current process being replaced is spreadsheet-based neighborhood billing and tracking. Success means admins and treasurers can run operations smoothly, residents can self-serve confidently, neighborhood communication works in the same system, and manual errors/disputes drop materially.

## Constraints

- **Stack**: Keep the existing Next.js + TypeScript + Supabase direction — it already reflects current implementation reality
- **Security**: Proof files must remain private, privileged access must rely on Auth/RLS/RPCs/Edge Functions, and browser code must not hold secrets
- **Messaging**: Telegram is the supported messaging channel; WhatsApp is excluded
- **Public Access**: Launch public experience is aggregate-only, not per-kavling status
- **Payments**: Manual transfer must fully support launch; QRIS is not required for initial go-live
- **Delivery Quality**: Use pragmatic TDD project-wide, with stricter test-first practice for critical and security-sensitive flows
- **Rollout**: Target is a real full rollout for neighborhood use, not just an internal prototype or pilot
- **UX Language**: User-facing copy should fit the neighborhood context and use Indonesian where appropriate

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Preserve the current Next.js + Supabase architecture | The repo is already materially implemented in this stack; replatforming would add risk without solving the product problem | — Pending |
| Use the master plan and docs as broad v1 baseline, not immutable truth | Existing planning is valuable but needs refinement around actual priorities and current repo state | — Pending |
| Resident self-service is the top product priority | This is the clearest user-facing value and the main trust layer for launch success | — Pending |
| Public dashboard is aggregate-only at launch | It provides transparency without exposing resident-level payment state publicly | — Pending |
| Manual transfer is the required launch payment path | Launch must not depend on QRIS readiness | — Pending |
| Neighborhood announcements and events are part of v1 | The product must cover neighborhood communication, not only billing operations | — Pending |
| Resident home should unify billing and neighborhood information | Residents need one place to check obligations and updates instead of fragmented sections | — Pending |
| TDD should be pragmatic, with strictness on risky flows | This balances delivery speed with the need for strong protection around billing, auth, payments, and security rules | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-29 after initialization*
