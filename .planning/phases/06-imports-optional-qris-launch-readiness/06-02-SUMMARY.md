---
phase: 06-imports-optional-qris-launch-readiness
plan: 02
subsystem: api
tags: [supabase-edge-functions, imports, admin-ui, csv]
requires:
  - phase: 06-01
    provides: import type contracts and pure preview parser
provides:
  - Admin `/admin/imports` preview-before-apply workflow for three import types
  - `import-preview` Edge Function with admin/super_admin auth and validation output
  - `import-apply` Edge Function with `import_jobs` draft→applied/failed persistence
affects: [admin-operations, cutover-imports, launch-readiness]
tech-stack:
  added: []
  patterns: [edge-function-auth-guard, preview-before-apply, import-job-audit-trail]
key-files:
  created:
    - app/admin/imports/page.tsx
    - features/imports/ImportJobsPage.tsx
    - supabase/functions/import-preview/index.ts
    - supabase/functions/import-apply/index.ts
    - lib/__tests__/importsAdminFlow.test.ts
  modified:
    - features/layout/adminNavigation.ts
key-decisions:
  - "import-apply always reruns preview and blocks mutation when invalidCount > 0 to enforce T-06-04"
  - "imports menu stays admin/super_admin-only; treasurer remains finance scope"
patterns-established:
  - "Edge Function import endpoints use shared auth + HttpError/jsonResponse wrappers"
  - "Admin import UI requires preview before apply and surfaces row-level error table"
requirements-completed: [IMPT-01, IMPT-02, IMPT-03]
duration: 40min
completed: 2026-05-03
---

# Phase 06 Plan 02: Admin Imports Preview/Apply Summary

**CSV imports now run inside admin operations with server-side preview validation and auditable apply outcomes in `import_jobs`.**

## Performance

- **Duration:** 40 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `import-preview` Edge Function that validates payloads, enforces admin/super_admin role checks, and returns preview counts/errors.
- Added `import-apply` Edge Function that writes `import_jobs` and only applies data when all rows are valid, with failed/applied status transitions.
- Added `/admin/imports` page and navigation link for admin/super_admin with CSV upload, preview results, and guarded apply button.

## task Commits

1. **task 1: implement Edge functions for preview and apply with import_jobs persistence** - `f9501d0` (feat)
2. **task 2: add admin imports page and navigation wiring** - `cf22692` (feat)

## Files Created/Modified

- `supabase/functions/import-preview/index.ts` - admin-only preview endpoint using `buildImportPreview`.
- `supabase/functions/import-apply/index.ts` - apply endpoint with `import_jobs` metadata/status updates and per-import-type upsert flow.
- `features/imports/ImportJobsPage.tsx` - admin import UI for upload → preview → apply.
- `app/admin/imports/page.tsx` - route entrypoint for imports page.
- `features/layout/adminNavigation.ts` - adds `/admin/imports` for admin and super_admin only.
- `lib/__tests__/importsAdminFlow.test.ts` - unit checks for nav gating and preview-before-apply guard text.

## Decisions Made

- Revalidated rows inside `import-apply` (server-side) before any mutation even if UI already previewed, to prevent bypass.
- Used `import_jobs.errors` as structured audit payload for both preview validation errors and apply-time failures.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Self-Check: PASSED

- Verified files exist: `app/admin/imports/page.tsx`, `features/imports/ImportJobsPage.tsx`, `supabase/functions/import-preview/index.ts`, `supabase/functions/import-apply/index.ts`, `lib/__tests__/importsAdminFlow.test.ts`
- Verified task commits exist in git log: `f9501d0`, `cf22692`
