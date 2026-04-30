---
phase: 04-announcements-events-resident-home
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - app/admin/announcements/page.tsx
  - app/admin/events/page.tsx
  - app/app/announcements/[id]/page.tsx
  - app/app/announcements/page.tsx
  - app/app/events/[id]/page.tsx
  - app/app/events/page.tsx
  - features/announcements/AdminAnnouncementsPage.tsx
  - features/announcements/ResidentAnnouncementDetailPage.tsx
  - features/announcements/ResidentAnnouncementsPage.tsx
  - features/events/AdminEventsPage.tsx
  - features/events/ResidentEventDetailPage.tsx
  - features/events/ResidentEventsPage.tsx
  - features/layout/adminNavigation.ts
  - features/layout/ResidentShell.tsx
  - features/resident/ResidentHomePage.tsx
  - lib/__tests__/adminNavigation.test.ts
  - lib/__tests__/validation.test.ts
  - lib/validation.ts
  - package.json
  - supabase/migrations/0019_m08_announcements_events.sql
  - supabase/tests/sql/m08_announcements_events_access.sql
findings:
  critical: 2
  warning: 4
  info: 5
  total: 11
status: issues_found
---

# Phase 04: Code Review Report — Announcements, Events & Resident Home

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found — 2 critical, 4 warnings, 5 info items

## Summary

Phase 04 introduces announcements, events, RSVP functionality, and a revamped resident home dashboard. The SQL schema and RLS policies are well-structured with appropriate access controls — residents see only published/archived content, operators manage all lifecycle, and treasurers are excluded from content management. The test suite demonstrates good coverage of policy enforcement and schema validation.

However, two critical bugs were identified:
1. **The resident home page will never display any announcements** — the Supabase `.select()` call omits the `status` column, making all subsequent filtering logic compare against `undefined`.
2. **The `events` table is missing its `updated_at` trigger** — every other table in the codebase has one; `events` was omitted.

There are also several warnings about RSVP lock timing mismatches and announcement visibility logic that could exclude important announcements from the home page.

---

## Critical Issues

### CR-01: Resident Home Page — `status` column omitted from `.select()`, breaking all announcement display

**File:** `features/resident/ResidentHomePage.tsx:459-465`
**Issue:** The `loadAnnouncements` function fetches announcements with `.select("id, title, body, is_urgent, is_pinned, published_at, created_at")` — notably **missing the `status` field**. The `AnnouncementRow` interface (line 42-51) declares `status: string`, but since it isn't selected, every row will have `status: undefined`.

All downstream logic that reads `a.status` will silently fail:
- **Line 532:** `announcements.find(a => a.status === "published" && ...)` → `undefined === "published"` → always `null`. The urgent hero card is never rendered.
- **Line 536:** `announcements.filter(a => a.status === "published" && ...)` → always empty. No regular announcement cards appear.
- **Lines 539-544:** `latestAnnouncements` is always empty.

**Result:** The "Pengumuman Terbaru" section on the resident home page perpetually shows the empty state ("Belum ada pengumuman") regardless of how many published announcements exist in the database.

**Fix:** Add `status` (and `archived_at` for completeness) to the select list:
```typescript
// features/resident/ResidentHomePage.tsx, line 461
.select("id, title, body, status, is_urgent, is_pinned, published_at, archived_at, created_at")
```

---

### CR-02: `events` table missing `updated_at` trigger — inconsistent with codebase pattern

**File:** `supabase/migrations/0019_m08_announcements_events.sql:95-111`
**Issue:** Migration `0002_tables.sql` establishes a codebase-wide pattern: every table with `updated_at` gets a `before update` trigger calling `public.set_updated_at()`. Migration `0019` adds triggers for `announcements` (line 105-107) and `event_attendees` (line 109-111), but **omits `events`**. The `events` table has an `updated_at` column (line 59) that will never be automatically updated. The app code in `AdminEventsPage.tsx` (lines 229-272) does not manually set `updated_at` in the update payload.

**Result:** When an admin edits an event, `updated_at` remains at the row creation timestamp. This breaks data integrity for any debugging, audit, or sync logic that relies on `updated_at` across tables.

**Fix:** Add the missing trigger in the migration:
```sql
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
```

---

## Warnings

### WR-01: Resident Home Page — `nonUrgentPublished` filter excludes urgent-but-not-pinned announcements

**File:** `features/resident/ResidentHomePage.tsx:531-544`
**Issue:** The `nonUrgentPublished` filter (line 536) uses `!a.is_urgent` to exclude all urgent announcements from the regular feed. However, `urgentAnnouncement` (line 531-533) requires **both** `is_urgent` AND `is_pinned` to qualify as the hero. An announcement that is urgent but not pinned falls through both gaps — it qualifies as neither the hero nor a regular card, making it completely invisible on the home page.

**Fix:** Exclude the hero announcement by ID rather than by the `is_urgent` flag:
```typescript
const nonUrgentPublished = useMemo(() => {
  return announcements.filter(
    (a) => a.status === "published" && a.id !== urgentAnnouncement?.id
  );
}, [announcements, urgentAnnouncement]);
```

---

### WR-02: RSVP frontend lock uses strict `<` while RLS uses strict `>` — boundary mismatch

**File:** `features/events/ResidentEventDetailPage.tsx:218-229` and `supabase/migrations/0019_m08_announcements_events.sql:195-215`
**Issue:** The frontend RSVP lock checks `startDate < now` (line 218: `isPast = startDate < now`). The RLS insert/update policies check `e.starts_at > now()` (line 199-201, 212-213). When `startDate === now` (the exact moment the event starts):
- **Frontend:** `isPast = false` → RSVP controls remain active
- **RLS:** `starts_at > now()` → `false` → DB blocks the upsert with a policy violation error

The user sees "Gagal memperbarui RSVP" with no explanation that the event just started.

**Fix:** Align the frontend check to match RLS behavior:
```typescript
const isPast = startDate <= now;  // was: startDate < now
```

Alternatively, if a grace period is desired, update both to use a consistent boundary.

---

### WR-03: `urgentHero` filter requires `is_pinned` — potentially inconsistent with "satu hero penting" intent

**File:** `features/announcements/ResidentAnnouncementsPage.tsx:149-151` and `features/resident/ResidentHomePage.tsx:531-533`
**Issue:** Both the resident announcements list page and the home page define the hero announcement as one that is `is_urgent && is_pinned`. An urgent announcement that is not pinned never gets hero treatment. The admin UI description (line 498 of AdminAnnouncementsPage) says "Beranda warga hanya menampilkan satu hero penting" — implying urgency alone should qualify.

If the intent is that admins *must* explicitly pin a hero, the admin UI should enforce this (or at least warn). Currently, an admin can mark an announcement as `is_urgent=true, is_pinned=false` and expect it to show as the hero — it won't.

**Fix:** Either:
1. Make `is_pinned` mandatory when `is_urgent` is true (admin-side constraint), or
2. Change the hero filter to use `is_urgent` alone and use `is_pinned` as a tiebreaker: `find(a => a.status === "published" && a.is_urgent)` with `is_pinned` sorting

---

### WR-04: RSVP upsert in `ResidentEventDetailPage` not validated against `rsvpUpsertSchema`

**File:** `features/events/ResidentEventDetailPage.tsx:143-153`
**Issue:** The RSVP upsert builds the payload manually and sends it directly to Supabase without Zod validation, even though `rsvpUpsertSchema` is defined in `lib/validation.ts`. While the `RSVPControl` component limits inputs to three hardcoded buttons, defense-in-depth validation would catch data corruption or future code changes that introduce new input paths.

**Fix:**
```typescript
const parsed = rsvpUpsertSchema.safeParse({ event_id: id, response });
if (!parsed.success) {
  setErrorMessage("Data RSVP tidak valid.");
  setSaving(false);
  return;
}
```

---

## Info

### IN-01: Unused `FormEvent` import in `AdminAnnouncementsPage`

**File:** `features/announcements/AdminAnnouncementsPage.tsx:3`
**Issue:** `FormEvent` is imported from React but never used in the component. The form submissions use `handleSaveDraft`/`handlePublish`/`handleSave` via button `onClick`, not form `onSubmit`.

**Fix:** Remove `type FormEvent` from the import.

---

### IN-02: Unused `FormEvent` and `X` icon imports in `AdminEventsPage`

**File:** `features/events/AdminEventsPage.tsx:3-4`
**Issue:** `FormEvent` is imported from React but never used. The `X` icon from lucide-react is imported but never rendered.

**Fix:** Remove both unused imports.

---

### IN-03: Redundant client-side filtering of already-filtered `upcomingEvents` in `ResidentHomePage`

**File:** `features/resident/ResidentHomePage.tsx:546-551`
**Issue:** `loadEvents` (lines 498-503) already filters to `status === "scheduled" && new Date(e.starts_at) >= now` before setting state. The `upcomingEvents` useMemo applies the same filter again. This is harmless but wasteful.

**Fix:** Remove the redundant filter from `upcomingEvents` or remove it from `loadEvents` and let the memo handle it. Either is fine; the current state does both.

---

### IN-04: Inconsistent error handling patterns across `ResidentHomePage` data loaders

**File:** `features/resident/ResidentHomePage.tsx:398-517`
**Issue:** `loadBilling` (line 398) uses `try/catch` for error handling. `loadAnnouncements` (line 452) and `loadEvents` (line 481) also use `try/catch`. All three are called in `useEffect` (lines 512-517) without `.catch()`. While this works because errors are caught internally, the inconsistency with other pages (e.g., `AdminAnnouncementsPage` line 151-156 using `.catch()` on the promise) makes the codebase harder to reason about.

**Fix:** Either normalize to `.catch()` in the useEffect (matching the pattern in `AdminAnnouncementsPage`, `AdminEventsPage`, `ResidentAnnouncementsPage`, etc.) or document that these loaders are self-contained.

---

### IN-05: `no_response` presented as a user-selectable RSVP option

**File:** `features/events/ResidentEventDetailPage.tsx:44`
**Issue:** `{ value: "no_response", label: "Belum Menjawab", variant: "outline" }` is presented alongside "Saya Hadir" and "Tidak Bisa Hadir" as an active choice. The label "Belum Menjawab" suggests a passive state rather than an action. A resident clicking it might not realize it overwrites their previous RSVP to `no_response`.

**Fix:** Consider renaming to "Hapus Jawaban Saya" or "Batal RSVP" to make the active nature of this choice clearer. Alternatively, make "no_response" the implicit default when no RSVP row exists, and only offer the two active choices.

---

_Reviewed: 2026-04-30T00:00:00Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: standard_
