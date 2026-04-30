---
phase: 04-announcements-events-resident-home
plan: "04"
subsystem: auth
tags: [supabase-storage, rls, signed-url, role-guard]

# Dependency graph
requires:
  - phase: "04-01, 04-02, 04-03"
    provides: "Announcement/event schema, RLS policies, resident feed/pages, admin management pages"
provides:
  - "Operator-only route guard (admin/super_admin) blocking treasurer from communication pages"
  - "Real attachment upload flow for admin (storage + DB insert)"
  - "Real attachment delete flow (storage object + DB row)"
  - "Resident-safe signed URL attachment actions (image thumbnail/open, non-image download)"
affects:
  - "Phase 04 remaining plans"
  - "COMM-04 gap closure"
  - "D-23 enforcement"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operator-only route guard: RequireOperatorRole wraps communication route stubs, leaving finance/admin routes unchanged via app/admin/layout.tsx"
    - "Attachment storage path: announcements/{announcement_id}/{uuid}-{originalName}"
    - "Signed URL resident access: 60-second expiry, openSignedArtifactUrl pattern matching payment-proof flow"

key-files:
  created:
    - "features/auth/RequireOperatorRole.tsx"
  modified:
    - "features/auth/authHooks.ts"
    - "app/admin/announcements/page.tsx"
    - "app/admin/events/page.tsx"
    - "features/announcements/AdminAnnouncementsPage.tsx"
    - "features/announcements/ResidentAnnouncementDetailPage.tsx"

key-decisions:
  - "useIsOperatorRole() defined as role === admin || super_admin (excludes treasurer) to enforce D-23 in code"
  - "RequireOperatorRole guard redirects to /admin (not /app) since treasurer legitimately accesses finance pages"
  - "Attachment upload gated on editor.id existence; unsaved announcements show 'Simpan draft terlebih dahulu' copy"
  - "Signed URL opened via openSignedArtifactUrl (same pattern as payment proof) keeping bucket fully private"

patterns-established:
  - "Route-specific guards: communication pages get RequireOperatorRole while finance pages stay under RequireAdminLike via layout"

requirements-completed: [COMM-02, COMM-03, COMM-04, EVNT-03]

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 04 Plan 04: Gap Closure — Communication Route Guard & Announcement Attachments

**Operator-only route guard for communication pages + end-to-end announcement attachment flow (admin upload → storage → resident signed-URL access)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-30T??:??:??Z
- **Completed:** 2026-04-30
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Sealed `/admin/announcements` and `/admin/events` routes to admin/super_admin only; treasurer now blocked even with direct URL access
- Replaced announcement attachment placeholder with real upload (storage + DB insert) and delete (storage + DB delete) for admins
- Replaced resident attachment badges with usable image-open and download actions backed by private signed URLs
- COMM-04 gap closed: attachment flow is now end-to-end from admin upload to resident access

## task Commits

Each task was committed atomically:

1. **task 1: seal communication routes to admin and super_admin only** - `d807a1b` (feat)
2. **task 2: complete announcement attachment flow for admin upload and resident access** - `fe4fba2` (feat)

## Files Created/Modified

- `features/auth/RequireOperatorRole.tsx` - **CREATED** — Operator-only guard (admin/super_admin) redirecting unauthorized users to /admin
- `features/auth/authHooks.ts` - Added `useIsOperatorRole()` hook returning `role === "admin" || role === "super_admin"`
- `app/admin/announcements/page.tsx` - Wrapped with `RequireOperatorRole`
- `app/admin/events/page.tsx` - Wrapped with `RequireOperatorRole`
- `features/announcements/AdminAnnouncementsPage.tsx` - Added `handleFileUpload` (storage upload + attachment insert), extended `handleDeleteAttachment` (storage remove + DB delete), replaced placeholder with real file input
- `features/announcements/ResidentAnnouncementDetailPage.tsx` - Replaced label badges with image-open thumbnail button and "Unduh Lampiran" download button using 60-second signed URLs via `createSignedUrl` + `openSignedArtifactUrl`

## Decisions Made

- `useIsOperatorRole()` excludes treasurer explicitly — D-23 is enforced at the route level, not just navigation hiding
- `RequireOperatorRole` redirects to `/admin` (not `/app`) because treasurer legitimately uses finance/admin pages; sending them to resident home would be disorienting
- Attachment upload gated behind `editor.id` check — unsaved announcements cannot accept uploads; concrete copy guides operator to save first
- Signed URL expiry set to 60 seconds — sufficient for open/download without leaving long-lived access

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: storage-write | features/announcements/AdminAnnouncementsPage.tsx | File uploads from browser to private bucket; mitigated by RLS policy requiring operator role and explicit MIME whitelist (png/jpeg/gif/pdf) |
| threat_flag: signed-url-exposure | features/announcements/ResidentAnnouncementDetailPage.tsx | Short-lived (60s) signed URLs opened via openSignedArtifactUrl; bucket stays private, no public URL leakage |

## Next Phase Readiness

- Phase 04 remaining plans can proceed with full attachment flow and role-sealed communication routes in place
- No blockers for Phase 04 completion

---
*Phase: 04-announcements-events-resident-home*
*Completed: 2026-04-30*
