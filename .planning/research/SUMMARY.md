# Project Research Summary

**Project:** IPL Jatiloka Residence
**Domain:** Neighborhood billing, resident self-service, and community operations
**Researched:** 2026-04-29
**Confidence:** HIGH

## Executive Summary

IPL Jatiloka Residence is a brownfield neighborhood operations product, not a greenfield experiment. The research is unusually aligned: keep the existing Next.js + Supabase architecture, double down on server-side security and database-enforced billing rules, and build a resident-first product that combines billing, payment status, announcements, events, and Telegram notifications without turning Telegram into the source of truth. Experts build this kind of product as a secure modular monolith: web app as the primary interface, Postgres/RLS as the trust boundary, and background jobs for reminders and delivery fan-out.

The recommended approach is to harden access control and billing invariants first, then finish reporting, then add community features, and only then automate Telegram linking and notifications. That order is not optional. The biggest risk is not lack of features; it is trust failure caused by ledger drift, weak self-service explanations, insecure Telegram linking, or automation running before reports are trustworthy. Mitigation is clear: one canonical billing calculation path, resident-visible status/rejection history, one-time Telegram link tokens with webhook verification, outbox-style notifications, and a release gate around proof privacy, backups, and deployment runbooks.

## Key Findings

### Recommended Stack

The stack recommendation is conservative and strong: preserve the current Next.js 16 + React 19 + TypeScript + Supabase platform and extend it with focused libraries rather than introducing a new backend abstraction. This product already has the right technical shape; the missing work is completion, hardening, and operational correctness.

**Core technologies:**
- **Next.js 16.2.x**: main web app and mutation surface — App Router, Server Components, Route Handlers, and Server Actions fit secure resident/admin workflows.
- **React 19.2.x**: UI runtime — supports modern form/status patterns without forcing SPA complexity.
- **Supabase (`@supabase/supabase-js` 2.105.x)**: system of record — Postgres, Auth, RLS, Storage, Edge Functions, and cron cover billing, privacy, and jobs in one platform.
- **TypeScript 6.0.x**: end-to-end type safety — important for role-sensitive actions, DTOs, and Telegram payloads.
- **Tailwind CSS 4.2.x**: styling baseline — already present and fast for product completion.

**Critical additions:**
- **`@supabase/ssr` 0.10.x** for correct Next.js auth/session handling.
- **`zod` 4.3.x** for shared validation across actions, handlers, and bot flows.
- **`react-hook-form` + resolvers** for complex resident/admin forms.
- **`grammy` + conversations/menu/ratelimiter** for webhook-based Telegram integration.
- **TanStack Table + Recharts** for admin operations and lightweight reporting.
- **Playwright** for rollout-critical end-to-end coverage.

### Expected Features

The product must launch as a trustworthy spreadsheet replacement with community communication built in. Table stakes are resident billing visibility, payment proof submission and status, reminders/receipts, resident profile management, announcements, events with RSVP, admin billing operations, reporting, and auditability. The standout differentiator is secure Telegram linking plus personalized alerts, but research is explicit that Telegram should start as a delivery and shortcut channel, not a full conversational product.

**Must have (table stakes):**
- Resident billing dashboard with current dues, arrears, due dates, and paid history.
- Payment proof submission, review status, rejection reasons, and receipts/history.
- Resident profile and notification preferences.
- Announcements feed with targeting, pinning, attachments, and Telegram push.
- Event calendar with RSVP and admin attendee views.
- Admin billing operations for invoices, verification, adjustments, and follow-up.
- Collection reporting, exports, and audit trail.
- Telegram account linking and reminders.

**Should have (competitive):**
- Unified resident home combining bills, announcements, and events.
- Telegram personalized alerts and narrow high-value action shortcuts.
- Admin operational inbox and exception reporting.
- Announcement delivery/read analytics.
- Onboarding that improves resident rollout adoption.

**Defer (v2+):**
- QRIS or additional payment rails.
- Amenity booking, visitor/package modules.
- Voting, surveys, committee workflows.
- AI-generated support or broad social/community features.

### Architecture Approach

The architecture should remain a secure modular monolith. Next.js is the human-facing surface for public, resident, and admin experiences; Supabase is the enforcement and data layer; Edge Functions own webhooks, secrets, reminders, and background work. Billing, payments, communications, notifications, reporting, and audit should stay as distinct bounded contexts joined by shared identity and notification infrastructure rather than being mixed into one generic content system.

**Major components:**
1. **Experience layer** — public dashboard, resident app, admin app, and Telegram bot/webhook.
2. **Application/data access layer** — server-side session verification, DAL, DTO shaping, permissions, and Server Actions/Route Handlers.
3. **Domain modules** — billing, payment verification, communications, reporting, notifications, and audit with Postgres/RPC-backed invariants.
4. **Supabase platform layer** — Auth, Postgres + RLS + RPCs, private Storage, Edge Functions, and cron.

**Key patterns to follow:**
- Server-first DAL with auth checks near the data.
- Database-enforced billing/payment invariants.
- Outbox-style notification delivery with idempotent jobs.
- Communications as a separate bounded context, not a sidecar to billing.

### Critical Pitfalls

1. **Ledger drift across portal, reports, and reminders** — use one canonical billing calculation path, immutable payment records, transactional RPCs, and finish reports before notification automation.
2. **“Self-service” that still requires admin chat** — show residents status explanations, rejection reasons, timestamps, history, and next steps before claiming the portal is done.
3. **Insecure Telegram linking** — use short-lived one-time link tokens, hash at rest, verify webhook secrets, and re-check role/identity on every sensitive command.
4. **Assuming Telegram delivery is exactly-once** — log deliveries, dedupe by resident/template/invoice/date, revalidate state before send, and monitor webhook/job health.
5. **Treating announcements/events like chat posts** — model lifecycle, audience scope, pinning, attachments, RSVP state, and audit history explicitly.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Access, Identity, and Data Trust Foundation
**Rationale:** Every later feature depends on correct resident/admin identity, scoped reads, and safe mutation boundaries.
**Delivers:** `@supabase/ssr` integration, request-scoped server clients, DAL/DTO patterns, role checks, RLS verification, profile-to-kavling mapping hardening.
**Addresses:** Resident profile, targeted announcements, Telegram linking prerequisites, privacy boundary.
**Avoids:** Client-driven authorization, SSR session leakage, resident-data exposure.

### Phase 2: Billing Integrity, Verification, and Audit
**Rationale:** Billing must be trustworthy before the product becomes more visible or automated.
**Delivers:** Canonical invoice/payment state transitions, duplicate-payment prevention, proof privacy hardening, rejection reasons, resident-visible status timeline, append-only audit coverage.
**Addresses:** Billing dashboard, payment proof workflow, receipts/history baseline, admin verification flow.
**Uses:** Next.js Server Actions, Supabase RPCs/RLS, private Storage, Zod validation.
**Avoids:** Ledger drift, fake self-service, manual status edits outside audited flow.

### Phase 3: Reporting and Reconciliation Baseline
**Rationale:** Reporting is a gate for trust and must precede reminders, cutover, and rollout.
**Delivers:** Collection reports, arrears views, CSV exports, receipt/history exports, reconciliation checks between resident views and admin reports.
**Addresses:** Treasurer/admin spreadsheet replacement, audit evidence, reminder eligibility validation.
**Implements:** Reporting domain, SQL views/RPCs, export helpers, audit cross-checks.
**Avoids:** Automation scaling hidden mistakes, staff falling back to spreadsheets.

### Phase 4: Community Communication and Resident Home
**Rationale:** Announcements and events are part of v1, but should reuse the now-stable identity and notification preference model.
**Delivers:** Announcements lifecycle, audience targeting, pinning, attachments, event records, RSVP flows, unified resident home composition.
**Addresses:** Announcements feed, event calendar, RSVP, unified resident home, resident document access basics.
**Uses:** Separate communications bounded context with shared profiles/audit/notifications.
**Avoids:** Treating communications as public content or chat-style posts.

### Phase 5: Telegram Linking and Notification Foundation
**Rationale:** Telegram is the main differentiator, but only after web data models and permissions are stable.
**Delivers:** Secure account linking, webhook intake, opt-in/out settings, minimal high-value commands, notification delivery log/outbox, scheduled reminder scaffolding.
**Addresses:** Telegram account linking, personalized alerts, reminder delivery, narrow action shortcuts.
**Uses:** grammY, Supabase Edge Functions, cron, idempotent delivery records.
**Avoids:** Identity spoofing, duplicate/stale messages, bot-first complexity.

### Phase 6: Imports, Rollout Hardening, and Launch Readiness
**Rationale:** Full rollout fails on bad cutover and weak operations, not on missing fancy features.
**Delivers:** Import preview/reconciliation workflow, dual-run cutover, backup/restore drills, deployment runbooks, webhook monitoring, Playwright smoke coverage, admin incident procedures.
**Addresses:** Bulk import, production handover, operational readiness for real neighborhood use.
**Avoids:** Shadow spreadsheets, proof leaks, brittle deploys, unsupported admins after launch.

### Phase Ordering Rationale

- Identity and scoped data access come first because billing, communications, and Telegram all depend on correct resident mapping and secure reads.
- Billing and reporting come before Telegram automation because reminders must reflect verified, explainable, exportable truth.
- Community features belong before advanced Telegram automation because the app must remain the canonical record; Telegram mirrors and accelerates, it does not define state.
- Hardening and cutover are explicit final phases because this product handles money, privacy, and resident communications in production.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5:** Telegram command scope, webhook deployment details, and delivery/retry monitoring need feature-level planning.
- **Phase 6:** Import reconciliation and rollout cutover deserve phase-specific research because errors are costly and domain-specific.
- **Potential v1.x analytics/exception tooling:** Delivery analytics and follow-up queues may need narrower operator workflow research before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Next.js + Supabase SSR/DAL/RLS patterns are well documented.
- **Phase 2:** Billing integrity patterns are already strongly defined by current architecture and internal milestone docs.
- **Phase 3:** Operational reporting/export patterns are straightforward if based on canonical ledger data.
- **Phase 4:** Announcements/events/RSVP are product design work more than technical unknowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strongly backed by official Next.js, Supabase, and grammY guidance; recommendation aligns with current repo reality. |
| Features | MEDIUM | Good competitive framing and clear product fit, but some prioritization still reflects inference from adjacent HOA/resident products. |
| Architecture | HIGH | Consistent with official platform guidance and internal milestone structure; dependencies are clear and actionable. |
| Pitfalls | MEDIUM | Operationally credible and well matched to the project, but several risks are synthesized from experience plus internal docs rather than one external standard. |

**Overall confidence:** HIGH

### Gaps to Address

- **Import/cutover specifics:** Source spreadsheet quality, business keys, and reconciliation rules should be validated before rollout planning.
- **Telegram command depth:** Decide early which commands are truly v1 versus nice-to-have to avoid bot sprawl.
- **Receipt/export format expectations:** Confirm whether CSV is sufficient at launch or whether admins require XLSX/PDF artifacts.
- **Notification policy details:** Define urgency rules, reminder cadence, and opt-out boundaries before implementing automation.
- **Resident onboarding workflow:** Validate invitation, first-login, and Telegram-linking UX with actual rollout constraints.

## Sources

### Primary (HIGH confidence)
- Next.js official authentication/security guidance — App Router auth, DAL/DTO patterns, checks near data.
- Supabase official Next.js SSR, RLS, Storage, Edge Functions, and schedule-function docs — auth/session handling, policy boundaries, private files, jobs.
- Telegram official webhook/Bot API docs — webhook verification and delivery behavior.
- Internal project planning docs (`.planning/PROJECT.md`, milestone docs, master plan) — product scope, rollout constraints, and sequence dependencies.

### Secondary (MEDIUM confidence)
- grammY official docs — recommended TypeScript-first Telegram runtime and Supabase hosting path.
- Buildium, TownSq, and Condo Control product pages — table-stakes and differentiator benchmarking.
- React Hook Form and Recharts official docs — current implementation fit for forms and lightweight reporting UI.

### Tertiary (LOW confidence)
- Inferred operational recommendations from adjacent billing/community-ops experience — especially around rollout adoption, dispute reduction, and shadow-spreadsheet failure modes.

---
*Research completed: 2026-04-29*
*Ready for roadmap: yes*
