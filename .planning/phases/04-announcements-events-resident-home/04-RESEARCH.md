# Phase 4 Research — Announcements, Events & Resident Home

**Date:** 2026-04-30
**Phase:** 04-announcements-events-resident-home

## Research Goal

Answer: what must be true to plan Phase 4 well without weakening resident-only visibility, role boundaries, or the billing-first resident portal contract.

## Current-State Findings

- `features/resident/ResidentHomePage.tsx` is still a kavling/mapping workspace, not the summary dashboard required by D-01 through D-06 and `HOME-01`.
- `features/layout/ResidentShell.tsx` and `features/layout/adminNavigation.ts` already provide the right route-shell extension points for new resident and admin pages.
- The app already uses direct browser reads/writes with Supabase under RLS, so announcements, attachments, events, and RSVP state should follow the same backend-first authorization model instead of UI-only filtering.
- `lib/validation.ts` already holds the project’s zod contracts; Phase 4 should extend it rather than introduce feature-local ad-hoc validators.
- Multi-kavling billing grouping and shared Indonesian status/formatting conventions were established in Phase 2 and must be summarized on home, not recomputed into one merged household ledger.

## Relevant Source Contracts

- `features/resident/ResidentHomePage.tsx` already loads active kavling mappings and historical invoice visibility context; this is the natural file to evolve into the unified dashboard.
- `features/billing/ResidentInvoicesPage.tsx` already implements the billing-first, per-kavling, arrears-focused resident experience required by Phase 4 home summaries.
- `features/layout/adminNavigation.ts` already enforces the Phase 1 finance-only treasurer split, so new admin communication routes must stay admin/super_admin only.
- `lib/validation.ts` already centralizes writable-field validation, matching the project convention to reject extra client-supplied fields.
- `package.json` confirms existing verification rails: `npm run test:unit`, `npm run test:sql`, `npm run typecheck`, `npm run build`.

## External Documentation Notes

### Supabase RLS / policy patterns

Context7 docs reinforce the same patterns already used in this repo:

- enable RLS per table and define explicit `select` / `insert` / `update` policies;
- prefer `(select auth.uid()) = profile_id` style predicates for per-user writes;
- use security-definer helper functions for cross-table role checks when policies need capability checks from `profiles` or related tables.

Implication: resident announcement visibility, event visibility, and RSVP ownership should be enforced in SQL/RLS, while admin lifecycle operations should rely on narrow helper functions such as `has_operator_role()` rather than trusting navigation.

### Next.js App Router patterns

Context7 Next.js docs confirm the current structure is already aligned with App Router best practices:

- route files stay thin with `page.tsx` entry points;
- `next/link` is the default navigation primitive for new resident/admin pages;
- `usePathname`, `useRouter`, and `useSearchParams` remain client-component-only hooks when navigation state is needed.

Implication: Phase 4 should keep adding thin `app/**/page.tsx` files and put real behavior inside `features/announcements/*`, `features/events/*`, and `features/resident/ResidentHomePage.tsx`.

## Recommended Technical Direction

### 1. Create explicit content lifecycle tables, not overloaded generic content rows

Recommended schema shape:

- `announcements`: `id`, `title`, `body`, `status`, `is_urgent`, `is_pinned`, `published_at`, `archived_at`, `created_by`, `updated_by`, timestamps
- `announcement_attachments`: `id`, `announcement_id`, `label`, `storage_path` or `file_url`, `mime_type`, `size_bytes`, timestamps
- `events`: `id`, `title`, `description`, `location`, `starts_at`, `ends_at`, `status`, `cancelled_at`, `created_by`, `updated_by`, timestamps
- `event_attendees`: `id`, `event_id`, `profile_id`, `response`, timestamps, unique `(event_id, profile_id)`

Why: Phase 4 has distinct lifecycle rules for announcements versus events, plus resident-owned RSVP state.

### 2. Keep resident visibility policy-driven and status-aware

Recommended resident rules:

- announcements visible to residents only when `status = 'published'` and not archived;
- one urgent+pinned item can be surfaced first in UI, but the data model should allow multiple urgent rows so admin history is preserved;
- events remain visible to residents across `upcoming`, `past`, and `cancelled`, with cancelled items still readable per D-17 and D-22;
- RSVP writes allowed only when `profile_id = auth.uid()` and only before `starts_at`.

Why: this matches D-07, D-12, D-15, D-17, D-22 and prevents UI-only enforcement drift.

### 3. Preserve admin/operator boundaries from Phase 1

Recommended capability split:

- `admin` and `super_admin`: full create/update/publish/unpublish/archive announcements, create/update/cancel events, view RSVP summaries;
- `treasurer`: read-only absence or no route access for communication/event management;
- resident: read published announcement/event data and mutate only their own RSVP.

Why: D-23 is explicit that treasurer does not gain communication controls.

### 4. Treat resident home as a composed summary page, not a new billing screen

Recommended home sections in order:

1. billing summary card(s) driven from the same invoice truth as `ResidentInvoicesPage.tsx`, grouped per kavling;
2. one urgent announcement hero if present, otherwise latest published announcement;
3. a short latest-announcements slice;
4. a short upcoming-events slice with current RSVP state and CTA.

Why: D-01 through D-06 require a billing-first summary dashboard with compact previews and separate resident detail pages.

### 5. Reuse existing Indonesian UX and card patterns

Recommended interaction patterns:

- resident pages use card-based lists like Phase 2 billing, not dense admin tables;
- admin pages can reuse the large stateful page pattern from `BillingPeriodsPage.tsx` and `AdminSubmissionsPage.tsx`;
- attachment presentation should use visible chips/thumbnails with explicit open/download affordances;
- event list items should show date, time, location, short description, and RSVP state inline before drilling into details.

Why: matches D-08 through D-11 and D-18 while staying consistent with current feature architecture.

## Planning Implications

### Files likely to change

- New migration: `supabase/migrations/0019_m08_announcements_events.sql`
- New SQL regression: `supabase/tests/sql/m08_announcements_events_access.sql`
- Validation/tests: `lib/validation.ts`, `lib/__tests__/validation.test.ts`
- Resident portal: `features/resident/ResidentHomePage.tsx`, `features/layout/ResidentShell.tsx`
- New resident pages: `features/announcements/ResidentAnnouncementsPage.tsx`, `features/events/ResidentEventsPage.tsx`, `app/app/announcements/page.tsx`, `app/app/events/page.tsx`
- New admin pages: `features/announcements/AdminAnnouncementsPage.tsx`, `features/events/AdminEventsPage.tsx`, `app/admin/announcements/page.tsx`, `app/admin/events/page.tsx`, `features/layout/adminNavigation.ts`

### No new external libraries needed

The existing Next.js + React + Supabase + zod + Vitest stack is sufficient.

### High-risk areas to plan explicitly

- resident-only visibility drift if announcement/event filters live in React instead of SQL/RLS;
- treasurer accidentally inheriting new admin routes through shared navigation or permissive helper reuse;
- shared-file collisions in `lib/validation.ts`, `ResidentHomePage.tsx`, `ResidentShell.tsx`, and `adminNavigation.ts`;
- RSVP update semantics if UI allows editing after event start but backend does not enforce the same rule.

## Common Pitfalls To Avoid

- Do **not** roll multi-kavling billing into one combined home total; keep summaries separated per D-04.
- Do **not** make announcement urgency purely recency-based; urgency/pinning is explicitly admin-controlled per D-20.
- Do **not** hide cancelled events entirely from residents; cancelled visibility is required by D-17.
- Do **not** give treasurer communication/event management because existing “admin-like” helpers are broader than the Phase 4 decision boundary.
- Do **not** implement resident announcement access with unpublished rows loaded then filtered client-side.

## Validation Architecture

- Fast loop: `npm run test:unit`
- Full loop: `npm run test`
- DB safety checks: add Phase 4 SQL regression and keep `npm run test:sql` green
- Build gate: `npm run typecheck && npm run build`
- Schema-changing work must include a blocking `supabase db push` before verification because this phase adds new Supabase migration files.

## Recommended Plan Shape

1. **Schema and contracts first** — announcement/event/RSVP tables, lifecycle/RLS rules, SQL regression, zod contracts.
2. **Admin operations second** — separate admin announcement and event pages, publish/archive/cancel flows, RSVP summaries, role-safe navigation.
3. **Resident experience third** — unified home, resident announcement feed, resident events pages, RSVP updates, resident navigation.

## Research Conclusion

Phase 4 should stay on the established app pattern: SQL/RLS defines who can see and mutate announcement/event data, while the frontend adds two thin route families (resident and admin) plus a billing-first resident dashboard. The critical planning constraint is preserving Phase 1 role boundaries and Phase 2 per-kavling billing truth while adding communication features.
