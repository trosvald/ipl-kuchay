---
phase: 04-announcements-events-resident-home
plan: "02"
subsystem: ui
tags: [next.js, react, supabase, announcements, events, admin, navigation, rsvp]

# Dependency graph
requires:
  - phase: 04-announcements-events-resident-home
    plan: "01"
    provides: announcements, events, announcement_attachments, event_attendees tables; RLS policies; Zod contracts (announcementFormSchema, eventFormSchema, rsvpUpsertSchema)
provides:
  - Phase 4 admin workspace: separate announcement and event management pages with full lifecycle controls
  - Role-sealed admin navigation: Pengumuman and Acara entries only for admin/super_admin
affects:
  - Phase 04 plan 03 (resident-facing announcements and events pages)
  - Any phase consuming admin navigation context

# Tech tracking
tech-stack:
  added:
    - Megaphone and Calendar lucide-react icons
  patterns:
    - Admin stateful page pattern: useCallback + useEffect + useState for data loading
    - Tab-based status filtering with URL search params
    - Dialog + AlertDialog composition for editor and destructive confirmations
    - RSVP aggregation via client-side count from event_attendees query

key-files:
  created:
    - features/announcements/AdminAnnouncementsPage.tsx - Announcement management with draft/publish/archive/unpublish lifecycle
    - features/events/AdminEventsPage.tsx - Event management with RSVP summary and cancel flow
    - app/admin/announcements/page.tsx - Route stub
    - app/admin/events/page.tsx - Route stub
  modified:
    - features/layout/adminNavigation.ts - Added COMMUNICATION_GROUP with Pengumuman and Acara for admin/super_admin only
    - lib/__tests__/adminNavigation.test.ts - Added test for Pengumuman/Acara role sealing

key-decisions:
  - "Added COMMUNICATION_GROUP nav section between Dashboards and Pages for admin/super_admin only — treasurer navigation stays finance-only as required by D-23"
  - "RSVP summary computed client-side from event_attendees query — avoids extra RPC while still showing Hadir/Tidak Hadir/Belum Menjawab per event"
  - "Event 'Selesai' state derived from starts_at < now() in UI, not a third mutable status — aligns with D-17/D-22 contract from plan 01"

patterns-established:
  - "Admin lifecycle pages use: loading state → error card → table/list render pattern matching BillingPeriodsPage and AdminSubmissionsPage"
  - "Tab-based status filtering (Draft/Terbit/Arsip for announcements; Mendatang/Dibatalkan/Selesai for events) mirrors resident-facing segmentation"
  - "Editor Dialog with form fields + footer action buttons, destructive confirm via AlertDialog in separate composition"

requirements-completed: [COMM-02, COMM-03, COMM-04, EVNT-03, EVNT-04]

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 04 Plan 02 Summary

**Admin announcements and events workspace with separate management pages, lifecycle controls, RSVP summary, and role-sealed navigation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-30T09:36:39Z
- **Completed:** 2026-04-30T09:44:43Z
- **Tasks:** 2 (each committed atomically)
- **Files created:** 4 new
- **Files modified:** 2 (adminNavigation.ts, adminNavigation.test.ts)

## Accomplishments

- Built `AdminAnnouncementsPage` with full draft/publish/archive/unpublish lifecycle: Dialog editor with title/body/urgent/pinned/attachment display, AlertDialog confirmations for archive and unpublish, tabs for Draft/Terbit/Arsip segmentation
- Built `AdminEventsPage` with event management and RSVP summary: tabs for Mendatang/Dibatalkan/Selesai, per-row RSVP totals in exact order Hadir/Tidak Hadir/Belum Menjawab, cancel confirmation with cancellation note, event editor dialog
- Updated `adminNavigation.ts` to add `COMMUNICATION_GROUP` containing `Pengumuman` (/admin/announcements) and `Acara` (/admin/events) for `admin` and `super_admin` only; treasurer navigation is unchanged
- Added TDD test verifying Pengumuman and Acara appear for admin/super_admin but not treasurer

## task Commits

Each task was committed atomically:

1. **task 1: admin announcements management page** - `5fdb9bd` (feat)
2. **task 2: admin events management + role-sealed navigation** - `6a037d6` (feat)

## Files Created/Modified

- `features/announcements/AdminAnnouncementsPage.tsx` — Announcement lifecycle page: tabs, editor dialog, archive/unpublish confirmations, attachment display
- `app/admin/announcements/page.tsx` — Route stub
- `features/events/AdminEventsPage.tsx` — Event management page: tabs, editor dialog, RSVP summary, cancel confirmation
- `app/admin/events/page.tsx` — Route stub
- `features/layout/adminNavigation.ts` — Added COMMUNICATION_GROUP with Megaphone and Calendar icons; inserted between ADMIN_DASHBOARDS_GROUP and SHARED_PAGES_GROUP for admin/super_admin
- `lib/__tests__/adminNavigation.test.ts` — Added test for Pengumuman/Acara role sealing

## Decisions Made

- Added COMMUNICATION_GROUP nav section between Dashboards and Pages for admin/super_admin only — treasurer navigation stays finance-only as required by D-23
- RSVP summary computed client-side from event_attendees query — avoids extra RPC while still showing Hadir/Tidak Hadir/Belum Menjawab per event
- Event 'Selesai' state derived from starts_at < now() in UI, not a third mutable status — aligns with D-17/D-22 contract from plan 01

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** No scope changes or auto-fixes needed.

## Issues Encountered

None.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Attachment upload placeholder | features/announcements/AdminAnnouncementsPage.tsx | editor dialog footer | Upload to `announcement-assets` storage bucket is out of scope for plan 02; metadata display and delete work; upload UI will be wired in a later plan |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-04-05 | features/announcements/AdminAnnouncementsPage.tsx | Form payloads validated against strict zod contracts from plan 01 (announcementFormSchema); no extra fields accepted |
| threat_flag: T-04-06 | features/layout/adminNavigation.ts | COMMUNICATION_GROUP excluded from TREASURER_DASHBOARDS_GROUP; treasurer cannot see Pengumuman or Acara in navigation |
| threat_flag: T-04-07 | features/announcements/AdminAnnouncementsPage.tsx, features/events/AdminEventsPage.tsx | created_by/updated_by persisted on all mutations; archive/unpublish/cancel are non-destructive |

## Next Phase Readiness

- Both admin pages are implemented and type-check clean
- Navigation is role-sealed; treasurer cannot access communication routes
- 138 unit tests passing
- Plan 03 (resident announcements and events pages) can now be implemented using the same data contracts

---
*Phase: 04-announcements-events-resident-home / Plan 02*
*Completed: 2026-04-30*


## Self-Check: PASSED

- All 4 new files created and verified on disk
- Commit hashes 5fdb9bd and 6a037d6 confirmed in git history
- TypeScript compiles without errors
- 138 unit tests passing (17 test files)
- ESLint: not configured (pre-existing project issue)
