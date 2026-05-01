---
phase: 04-announcements-events-resident-home
plan: "03"
subsystem: ui
tags: [next.js, react, supabase, announcements, events, rsvp, resident, navigation, tdd]

# Dependency graph
requires:
  - phase: 04-announcements-events-resident-home
    plan: "01"
    provides: announcements, events, announcement_attachments, event_attendees tables; RLS policies; Zod contracts
  - phase: 04-announcements-events-resident-home
    plan: "02"
    provides: AdminAnnouncementsPage, AdminEventsPage with lifecycle controls; admin navigation
provides:
  - Phase 4 resident-facing workspace: unified home, announcement feed/detail, event feed/detail, RSVP control
  - Resident navigation: Pengumuman and Acara entries between Invoice and Pengaturan
affects:
  - Any phase consuming resident home dashboard context
  - Future phase adding Telegram push for announcements/events

# Tech tracking
tech-stack:
  added:
    - Megaphone, Calendar, ArrowLeft, Paperclip, MapPin lucide-react icons
  patterns:
    - Multi-fetch via Promise.all with per-slice loading/error/empty states
    - Per-kavling billing summary cards with no merged household total
    - Urgent pinned announcement hero with fallback to newest published
    - RSVP upsert with event-start cutoff and locked state messaging

key-files:
  created:
    - features/announcements/ResidentAnnouncementsPage.tsx - Resident announcement feed with urgent hero, active feed, archive history
    - features/announcements/ResidentAnnouncementDetailPage.tsx - Resident announcement detail with archive note
    - features/events/ResidentEventsPage.tsx - Resident events with tabs Mendatang/Dibatalkan/Selesai and RSVP badges
    - features/events/ResidentEventDetailPage.tsx - Resident event detail with RSVP segmented control
    - app/app/announcements/page.tsx - Route stub
    - app/app/announcements/[id]/page.tsx - Route stub
    - app/app/events/page.tsx - Route stub
    - app/app/events/[id]/page.tsx - Route stub
  modified:
    - features/resident/ResidentHomePage.tsx - Rebuilt as billing-first dashboard with billing summary, announcement hero, events slice
    - features/layout/ResidentShell.tsx - Added Pengumuman and Acara navigation entries

key-decisions:
  - "Replaced kavling table + placeholder queue with billing-first dashboard: per-kavling cards with outstanding/arrears, unpaid count, nearest due date, and Lihat Tagihan CTA"
  - "No merged household total above per-kavling cards — each kavling shows its own summary, matching Phase 2 contract"
  - "Announcement hero uses urgent+pinned OR falls back to newest published, then up to 2 preview cards"
  - "Events: tabs in exact UI-SPEC order Mendatang/Dibatalkan/Selesai; upcoming shows RSVP badge; cancelled/past hide RSVP"
  - "RSVP upsert on event_attendees with event-start cutoff enforced on backend (WITH CHECK) and frontend locked messaging"

patterns-established:
  - "Per-slice loading (Skeleton), error (ErrorCard with Muat Ulang), empty (EmptyCard) states — slices render independently when one fails"
  - "ResidentAnnouncementsPage: one urgent hero + active feed + archived history, all in Indonesian"
  - "ResidentEventsPage: 3-tab layout with count badges, event cards with date tile, RSVP labels per upcoming card"
  - "RSVP locked message when event cancelled vs started/past — different copy per UI-SPEC"

requirements-completed: [COMM-01, EVNT-01, EVNT-02, HOME-01]

# Metrics
duration: 14min
completed: 2026-04-30
---

# Phase 04 Plan 03 Summary

**Resident-facing announcements and events workspace: billing-first home dashboard, announcement feed/detail, event feed/detail with RSVP control, and resident navigation updates.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-30T11:18:06Z
- **Completed:** 2026-04-30T11:32:21Z
- **Tasks:** 3 (each committed atomically)
- **Files created:** 8 new
- **Files modified:** 2

## Accomplishments

- **task 1:** Rebuilt `ResidentHomePage` as billing-first command-center dashboard — per-kavling billing cards (no merged household total), urgent pinned hero with fallback, up to 2 announcement previews, up to 3 event previews — all with per-slice loading/error/empty states. Updated `ResidentShell` navigation to add Pengumuman and Acara between Invoice and Pengaturan.
- **task 2:** Built `ResidentAnnouncementsPage` with urgent pinned hero, active Pengumuman feed, and muted Riwayat Pengumuman archive section. Built `ResidentAnnouncementDetailPage` with archive note, attachment chips, and all Indonesian copy. Created thin route stubs for `/app/announcements` and `/app/announcements/[id]`.
- **task 3:** Built `ResidentEventsPage` with tabs in exact UI-SPEC order (Mendatang/Dibatalkan/Selesai) and count badges. Built `ResidentEventDetailPage` with RSVP segmented control in exact order (Saya Hadir/Tidak Bisa Hadir/Belum Menjawab), event-start and cancellation lock messaging, and inline confirmation after successful upsert. Created thin route stubs for `/app/events` and `/app/events/[id]`.

## task Commits

Each task was committed atomically:

1. **task 1: refactor /app into the approved resident command-center dashboard** - `c3c6178` (feat)
2. **task 2: build resident announcement feed and detail routes with urgent hero and archive history** - `25a0745` (feat)
3. **task 3: build resident events feed and detail routes with editable RSVP until event start** - `92a342d` (feat)

## Files Created/Modified

- `features/resident/ResidentHomePage.tsx` — Rebuilt as billing-first dashboard with billing summary, urgent announcement hero, events slice
- `features/layout/ResidentShell.tsx` — Added Pengumuman (/app/announcements) and Acara (/app/events) nav entries
- `features/announcements/ResidentAnnouncementsPage.tsx` — Urgent hero, active feed, Riwayat Pengumuman archive
- `features/announcements/ResidentAnnouncementDetailPage.tsx` — Detail with archive note and attachment chips
- `app/app/announcements/page.tsx` — Thin route stub
- `app/app/announcements/[id]/page.tsx` — Thin route stub
- `features/events/ResidentEventsPage.tsx` — Tabs Mendatang/Dibatalkan/Selesai with RSVP badges
- `features/events/ResidentEventDetailPage.tsx` — RSVP control with lock messaging and inline confirmation
- `app/app/events/page.tsx` — Thin route stub
- `app/app/events/[id]/page.tsx` — Thin route stub

## Decisions Made

- Replaced kavling table + placeholder queue with billing-first dashboard per D-01 through D-06
- Per-kavling billing cards show outstanding/arrears, unpaid count, nearest due date, Lihat Tagihan CTA — no merged household total
- Announcement hero: urgent+pinned first OR newest published fallback, then up to 2 preview cards
- Event cards show date tile, time, location, description, RSVP badge (upcoming only), Lihat Detail Acara CTA
- RSVP upsert for authenticated resident row only; locked when event cancelled or already started
- All copy in Indonesian — no social-feed language (postingan, timeline, author)

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** No scope changes or auto-fixes needed.

## Issues Encountered

None — TypeScript clean on first typecheck after all three tasks.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| None | - | - | No stubs identified |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-04-08 | features/announcements/ResidentAnnouncementsPage.tsx | Query only resident-visible rows (status=published/archived) under RLS — no draft exposure |
| threat_flag: T-04-09 | features/events/ResidentEventDetailPage.tsx | RSVP UI action validated against strict zod contract (rsvpUpsertSchema); backend self-row policy enforcement |
| threat_flag: T-04-10 | features/resident/ResidentHomePage.tsx | Per-slice loading/error/empty states — one failing slice does not suppress unrelated billing data |

## Next Phase Readiness

- All resident-facing Phase 4 pages are implemented and type-check clean
- Navigation between Invoice, Pengumuman, and Acara is wired
- RSVP control locks correctly for cancelled and past events
- No blockers — Phase 4 resident workspace is complete

---
*Phase: 04-announcements-events-resident-home / Plan 03*
*Completed: 2026-04-30*


## Self-Check: PASSED

- All 8 new files created and verified on disk
- Commit hashes c3c6178, 25a0745, 92a342d confirmed in git history
- TypeScript compiles without errors
- No STATE.md or ROADMAP.md modifications (as instructed)