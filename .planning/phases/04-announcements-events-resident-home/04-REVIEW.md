---
phase: 04-announcements-events-resident-home
reviewed: 2026-04-30T13:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/admin/announcements/page.tsx
  - app/admin/events/page.tsx
  - features/announcements/AdminAnnouncementsPage.tsx
  - features/announcements/ResidentAnnouncementDetailPage.tsx
  - features/auth/RequireOperatorRole.tsx
  - features/auth/authHooks.ts
  - features/events/ResidentEventDetailPage.tsx
  - supabase/tests/sql/m08_announcements_events_access.sql
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-30T13:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed 8 files from Phase 04 gap closure: operator role guard, announcement attachment flow, event RSVP fix, and SQL regression tests. The code is generally well-structured with proper RLS enforcement and consistent patterns. Found 5 warnings and 3 info items. No critical security vulnerabilities or crash-level bugs detected.

Key concerns: two bugs in the attachment upload flow (client-generated UUID doesn't match DB, storage orphan on failed insert), a publish-date overwrite issue in announcement editing, a popup-blocking risk for attachment viewing, and a missing nullable type annotation on the event cancellation_note field.

## Warnings

### WR-01: Client-generated attachment ID doesn't match DB-assigned ID

**File:** `features/announcements/AdminAnnouncementsPage.tsx:365`
**Issue:** After inserting an attachment row into `announcement_attachments`, the code adds a local state entry using `crypto.randomUUID()` as the `id` field. This UUID does not match the server-generated ID. If the user clicks delete on this attachment before the editor is closed and re-fetched, `handleDeleteAttachment(att.id, att.storage_path)` sends the fake UUID to `.eq("id", attachmentId)`, which matches 0 rows — the DB row is never deleted while the storage file is removed, creating an orphan DB row.
**Fix:**
```typescript
// In handleFileUpload (line 349-374):
const { data: insertData, error: insertError } = await client
  .from("announcement_attachments")
  .insert({
    announcement_id: editor.id,
    label: file.name,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
  })
  .select("id")
  .single();

if (insertError) {
  setErrorMessage(`Gagal menyimpan data lampiran ${file.name}.`);
  return;
}
setEditor((prev) => ({
  ...prev,
  attachments: [
    ...prev.attachments,
    {
      id: insertData.id,  // Use the real server-assigned ID
      announcement_id: editor.id!,
      label: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      created_at: new Date().toISOString(),
    },
  ],
}));
```

### WR-02: Storage orphan when DB insert fails after upload

**File:** `features/announcements/AdminAnnouncementsPage.tsx:341-358`
**Issue:** In `handleFileUpload`, the file is uploaded to storage first (line 341-344), then a DB row is inserted (line 349). If the storage upload succeeds but the DB insert fails, the storage object remains as an orphan with no corresponding DB reference. No cleanup/rollback of the storage object is attempted.
**Fix:**
```typescript
// In handleFileUpload, after a failed DB insert, remove the orphaned storage file:
if (insertError) {
  // Clean up orphaned storage object
  await client.storage.from("announcement-assets").remove([storagePath]);
  setErrorMessage(`Gagal menyimpan data lampiran ${file.name}.`);
  return;
}
```

### WR-03: `published_at` overwritten on every save of a published announcement

**File:** `features/announcements/AdminAnnouncementsPage.tsx:237`
**Issue:** When editing an existing published announcement (e.g., changing its title), `handleSave` sets `published_at: targetStatus === "published" ? new Date().toISOString() : null`. This overwrites the original publication timestamp with the current time every time the announcement is saved. The `published_at` should be preserved when editing an already-published announcement.
**Fix:**
```typescript
// Replace line 237-238 with:
published_at: isNew
  ? (targetStatus === "published" ? new Date().toISOString() : null)
  : (targetStatus === "published"
    ? (editor.published_at ?? new Date().toISOString())
    : null),
archived_at: isNew
  ? null
  : (targetStatus === "archived" ? new Date().toISOString() :
    targetStatus === "draft" ? null : editor.archived_at),
```
Note: `published_at` and `archived_at` fields need to be added to the `EditorState` interface and populated from the fetched row in `openEditEditor`.

### WR-04: Browser popup likely blocked due to async window.open

**File:** `features/announcements/ResidentAnnouncementDetailPage.tsx:94-111`
**Issue:** `handleOpenAttachment` is an async click handler. It first `await`s `createSignedUrl`, then calls `openSignedArtifactUrl`, which calls `globalThis.open("", "_blank")`. Because `window.open` occurs after an `await` (not in the synchronous click call stack), most browsers will block it as a popup. The same issue exists in `lib/privateArtifact.ts` which is shared with the payment proof flow.
**Fix:** Open the popup synchronously during the click handler, then navigate it after the async work completes:
```typescript
const handleOpenAttachment = async (att: AttachmentRow) => {
  if (!client || openingId) return;
  setOpeningId(att.id);
  // Open popup synchronously during click event to avoid popup blocker
  const popup = globalThis.open("", "_blank");
  if (popup) {
    popup.document.write("<p style=\"font-family:sans-serif;padding:16px;\">Memuat dokumen...</p>");
  }
  try {
    const { data, error } = await client.storage
      .from("announcement-assets")
      .createSignedUrl(att.storage_path, 60);
    if (error || !data?.signedUrl) {
      setErrorMessage("Gagal menghasilkan tautan lampiran.");
      popup?.close();
      return;
    }
    // Navigate the existing popup instead of opening a new one
    const response = await fetch(data.signedUrl, { method: "GET", credentials: "omit" });
    if (!response.ok) throw new Error(`Failed to load artifact: ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.arrayBuffer();
    const blob = new Blob([body], { type: contentType || "application/octet-stream" });
    const objectUrl = URL.createObjectURL(blob);
    if (popup && !popup.closed) {
      popup.location.replace(objectUrl);
    } else {
      globalThis.open(objectUrl, "_blank", "noopener,noreferrer");
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    setErrorMessage("Gagal membuka lampiran.");
    popup?.close();
  } finally {
    setOpeningId(null);
  }
};
```
Note: This fix should also be applied to `lib/privateArtifact.ts` for the same pattern used by payment proofs.

### WR-05: `cancellation_note` typed as `string` but should be nullable

**File:** `features/events/ResidentEventDetailPage.tsx:24`
**Issue:** The `EventDetailRow` interface declares `cancellation_note: string`, but for non-cancelled events this field is `null` in the database. The code at line 277 handles this with a truthiness check (`isCancelled && event.cancellation_note`), which works at runtime, but the TypeScript type is inaccurate and could lead to type-safety issues in other contexts where `null` is not handled.
**Fix:**
```typescript
// Line 24: Change to nullable type
cancellation_note: string | null;
```

## Info

### IN-01: Missing space in "Aksesoperator" label

**File:** `features/auth/RequireOperatorRole.tsx:30`
**Issue:** The card title says "Aksesoperator diperlukan" — the word "Aksesoperator" is missing a space. In Indonesian, it should be "Akses operator" or "Akses Operator" (two words).
**Fix:** Change `"Aksesoperator diperlukan"` to `"Akses operator diperlukan"`.

### IN-02: No file size validation for announcement attachments

**File:** `features/announcements/AdminAnnouncementsPage.tsx:335`
**Issue:** `handleFileUpload` accepts files without checking their size. The project has a `PAYMENT_PROOF_MAX_SIZE_BYTES` constant in `lib/storage.ts`, but no equivalent size limit is enforced for announcement attachments. A user could upload arbitrarily large files.
**Fix:** Add a size check before uploading:
```typescript
const MAX_ANNOUNCEMENT_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
if (file.size > MAX_ANNOUNCEMENT_ATTACHMENT_BYTES) {
  setErrorMessage(`File ${file.name} melebihi batas 5 MB.`);
  return;
}
```

### IN-03: Attachment count loads all rows instead of using aggregate

**File:** `features/announcements/AdminAnnouncementsPage.tsx:134-146`
**Issue:** `loadAnnouncements` fetches all rows from `announcement_attachments` just to count per-announcement. With many announcements this could be expensive. A Supabase RPC or a `select("announcement_id")` with client-side grouping (current approach) works but may not scale.
**Fix:** Consider adding a `count` query with grouping, or including attachment counts in the initial announcements query via an RPC. This is a scalability concern for later, not a correctness bug.

---

_Reviewed: 2026-04-30T13:00:00Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: standard_