# Phase 4: Announcements, Events & Resident Home - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Add resident-only announcements and neighborhood events, give admins explicit management workflows for both, and turn `/app` into a unified resident home that combines billing status, announcements, and upcoming events. Telegram delivery is a later phase; this phase focuses on the in-app experience and its supporting data/admin flows.

</domain>

<decisions>
## Implementation Decisions

### Resident home layout
- **D-01:** `/app` becomes a summary dashboard, not a long mixed-content page or an updates-first feed.
- **D-02:** The resident home leads with billing first, then urgent announcements, then upcoming events.
- **D-03:** Home billing content is actionable-only: show arrears/current outstanding and current actionable invoices, then link deeper to the full invoice experience.
- **D-04:** Multi-kavling billing on the home must stay separated per kavling, not rolled up into one merged household total.
- **D-05:** Announcements and events get dedicated resident pages in addition to home previews.
- **D-06:** The home shows compact non-billing previews rather than expanded feeds: urgent announcement first if present, then only the latest one or two updates and a short upcoming-events slice.

### Announcement presentation
- **D-07:** Resident announcement UX uses a single pinned urgent hero at the top. Additional urgent items fall back into the normal feed with urgent badges rather than stacking multiple pinned banners.
- **D-08:** Regular announcements use newest-first cards rather than a dense table or grouped category layout.
- **D-09:** Announcement cards show publish date and urgency state prominently; they should feel like an official notice board, not an author-centric social feed.
- **D-10:** Feed cards show a short preview with a CTA to open the full announcement detail rather than rendering the entire body inline.
- **D-11:** Attachments should appear as inline chips or thumbnails with clear open/download affordances.
- **D-12:** Residents see published history only: unpublished announcements disappear from resident view, while archived items move into older history rather than remaining mixed with current items.
- **D-13:** The home announcement slice prioritizes the active urgent item first, then the latest one or two regular announcements.

### Event RSVP behavior
- **D-14:** Resident RSVP is a simple 3-state model: attending, not attending, or no response yet.
- **D-15:** Residents can change their RSVP any time before the event starts.
- **D-16:** Resident event browsing separates upcoming events, cancelled events, and past events rather than using one undifferentiated chronological list.
- **D-17:** Cancelled events remain visible to residents with a clear cancelled status instead of disappearing silently.
- **D-18:** Event cards should already show core details in-list: date, time, location, short description, current RSVP status, and the main CTA.

### Admin content lifecycle
- **D-19:** Announcement management uses an explicit draft -> publish lifecycle, with later unpublish and archive actions. It should not default to immediate live publish on save.
- **D-20:** Announcement urgency and pinning are explicit admin-controlled properties, not inferred from recency.
- **D-21:** Admin management is split into separate announcements and events pages rather than one combined content workspace.
- **D-22:** Event cancellation should be a transparent lifecycle state that residents can still see, not a destructive removal from their view.
- **D-23:** Communication and event management remain admin/super-admin workflows; treasurer does not gain these controls.

### OpenCode's Discretion
- Exact card styling, spacing, and responsive layout details for the resident home, announcement feed, and event cards.
- Exact CTA labels, badge colors, and empty-state visuals, as long as the copy stays Indonesian and the semantics above remain intact.
- Exact route naming and page/chrome composition for resident and admin announcement/event pages, as long as the information architecture decisions above are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and locked product constraints
- `.planning/PROJECT.md` — resident self-service priority, Indonesian UX language, Telegram-not-now boundary, and v1 communication/event intent.
- `.planning/REQUIREMENTS.md` — authoritative Phase 4 scope for `COMM-01..COMM-04`, `EVNT-01..EVNT-04`, and `HOME-01`.
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, existing plan split, and fixed scope boundary.

### Prior locked decisions that still apply
- `.planning/phases/01-access-scope-resident-identity/01-CONTEXT.md` — admin/treasurer role boundary, resident-only access model, notification-preference categories, and multi-kavling separation rules.
- `.planning/phases/02-billing-configuration-resident-billing-view/02-CONTEXT.md` — billing IA, arrears-summary expectations, and per-kavling resident billing grouping.
- `.planning/phases/03-manual-payments-reporting-audit/03-CONTEXT.md` — trust-oriented resident UX expectations, consistent status language, and billing/reporting truth patterns that the new home should not contradict.

### Existing product and baseline-home references
- `CODEx_MASTER_PLAN_IPL_Jatiloka_Telegram.md` §13.4 — prior resident-home baseline, including current-home intent and billing/action emphasis.
- `docs/plan/milestones/M03-kavlings-residents.md` — current resident-home baseline and the original `/app` linked-kavling contract that Phase 4 is evolving.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/resident/ResidentHomePage.tsx` — current `/app` home already loads resident kavling context and is the natural place to evolve into the new summary dashboard.
- `features/billing/ResidentInvoicesPage.tsx` — already contains the arrears-summary and per-kavling resident billing patterns the new home should summarize rather than reinvent.
- `features/layout/ResidentShell.tsx` — established resident shell that can add announcement and event navigation entries.
- `features/layout/AdminShell.tsx` and `features/layout/adminNavigation.ts` — established admin sidebar/navigation system where dedicated announcement and event pages should plug in.
- `features/resident/ResidentSettingsPage.tsx` and `lib/validation.ts` — existing notification-preference model already includes `announcements` and `events`, so Phase 4 should reuse those categories instead of creating a parallel preference concept.

### Established Patterns
- Thin route files in `app/**` delegate real behavior into `features/**` modules.
- Client-side Supabase access is acceptable, but authorization and visibility rules must still be enforced by RLS/RPC/backend policy rather than UI-only filtering.
- Resident-facing screens already use Indonesian copy, inline error messages, and trust-oriented status feedback.
- Admin-side sensitive mutations are expected to stay auditable.

### Integration Points
- Resident home changes land through `app/app/page.tsx` and likely add new resident routes under `app/app/**` for announcements and events.
- Admin management should add dedicated routes under `app/admin/**` and corresponding entries in `adminNavigation.ts`.
- New announcement/event schema, lifecycle rules, and resident visibility constraints must connect to Supabase migrations/RLS plus SQL regression coverage under `supabase/tests/sql/`.
- Home billing summaries must stay aligned with invoice truth already used by the resident billing and payment flows.

</code_context>

<specifics>
## Specific Ideas

- The resident home should feel like a trustworthy command center, not a social feed.
- Billing should remain the first thing residents notice when they enter `/app`.
- Announcement UX should feel like an official neighborhood notice board: urgency/date matter more than author identity.
- The home announcement slice should surface the active urgent item first, then only a very small latest-updates preview.
- Event cards should be actionable without forcing residents into detail views just to understand the basics.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 4 scope.

</deferred>

---

*Phase: 04-announcements-events-resident-home*
*Context gathered: 2026-04-30*
