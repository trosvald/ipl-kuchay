"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, Paperclip, Pin, PinOff, RefreshCw, Trash2, X } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/authHooks";
import { formatDateId } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { announcementAttachmentSchema, announcementFormSchema, type AnnouncementStatus } from "@/lib/validation";

type AnnouncementTab = "draft" | "published" | "archived";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  is_urgent: boolean;
  is_pinned: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface AttachmentRow {
  id: string;
  announcement_id: string;
  label: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

function parseTab(value: string | null): AnnouncementTab {
  if (value === "published" || value === "archived") {
    return value;
  }
  return "draft";
}

function formatAnnouncementStatusLabel(status: AnnouncementStatus): string {
  if (status === "draft") return "Draft";
  if (status === "published") return "Terbit";
  return "Arsip";
}

function statusBadgeVariant(status: AnnouncementStatus): "secondary" | "default" | "outline" {
  if (status === "draft") return "secondary";
  if (status === "published") return "default";
  return "outline";
}

interface EditorState {
  id?: string;
  title: string;
  body: string;
  is_urgent: boolean;
  is_pinned: boolean;
  status: AnnouncementStatus;
  attachments: AttachmentRow[];
}

function emptyEditor(): EditorState {
  return {
    title: "",
    body: "",
    is_urgent: false,
    is_pinned: false,
    status: "draft",
    attachments: [],
  };
}

export function AdminAnnouncementsPage() {
  const client = getSupabaseBrowserClient();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<AnnouncementTab>("draft");
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());

  // Destructive confirmations
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("announcements")
      .select("id, title, body, status, is_urgent, is_pinned, published_at, archived_at, created_at, updated_at, created_by, updated_by")
      .order("created_at", { ascending: false });

    if (error) {
      setItems([]);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as AnnouncementRow[];
    setItems(rows);

    // Load attachment counts
    if (rows.length > 0) {
      const { data: attachmentRows, error: attachError } = await client
        .from("announcement_attachments")
        .select("announcement_id");

      if (!attachError && attachmentRows) {
        const countMap: Record<string, number> = {};
        for (const row of attachmentRows as { announcement_id: string }[]) {
          countMap[row.announcement_id] = (countMap[row.announcement_id] ?? 0) + 1;
        }
        setAttachmentCounts(countMap);
      }
    }

    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadAnnouncements().catch(() => {
      setLoading(false);
      setErrorMessage("Gagal memuat data pengumuman.");
    });
  }, [loadAnnouncements]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => item.status === activeTab);
  }, [items, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(parseTab(value));
  };

  const openNewEditor = () => {
    setEditor(emptyEditor());
    setFormErrors({});
    setEditorOpen(true);
  };

  const openEditEditor = async (row: AnnouncementRow) => {
    setEditor({
      id: row.id,
      title: row.title,
      body: row.body,
      is_urgent: row.is_urgent,
      is_pinned: row.is_pinned,
      status: row.status,
      attachments: [],
    });
    setFormErrors({});
    setEditorOpen(true);
    // Load attachments for this announcement
    if (client) {
      const { data } = await client
        .from("announcement_attachments")
        .select("id, announcement_id, label, storage_path, mime_type, size_bytes, created_at")
        .eq("announcement_id", row.id);
      if (data) {
        setEditor((prev) => ({ ...prev, attachments: (data as AttachmentRow[]) ?? [] }));
      }
    }
  };

  const handleSaveDraft = async () => {
    await handleSave("draft");
  };

  const handlePublish = async () => {
    await handleSave("published");
  };

  const handleSave = async (targetStatus: AnnouncementStatus) => {
    if (!client || !profile) return;

    const parsed = announcementFormSchema.safeParse({
      title: editor.title,
      body: editor.body,
      is_urgent: editor.is_urgent,
      is_pinned: editor.is_pinned,
      status: targetStatus,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path.length > 0) {
          nextErrors[String(issue.path[0])] = issue.message;
        }
      }
      setFormErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setFormErrors({});

    const isNew = !editor.id;
    const payload = {
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      is_urgent: parsed.data.is_urgent,
      is_pinned: parsed.data.is_pinned,
      status: parsed.data.status,
      published_at: targetStatus === "published" ? new Date().toISOString() : null,
      archived_at: targetStatus === "archived" ? new Date().toISOString() : null,
      ...(isNew ? { created_by: profile.id } : { updated_by: profile.id }),
    };

    let data;
    let error;
    if (isNew) {
      const result = await client
        .from("announcements")
        .insert(payload as Record<string, unknown>)
        .select("id, title, body, status, is_urgent, is_pinned, published_at, archived_at, created_at, updated_at, created_by, updated_by")
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await client
        .from("announcements")
        .update(payload as Record<string, unknown>)
        .eq("id", editor.id)
        .select("id, title, body, status, is_urgent, is_pinned, published_at, archived_at, created_at, updated_at, created_by, updated_by")
        .single();
      data = result.data;
      error = result.error;
    }

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal menyimpan pengumuman.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditorOpen(false);
    await loadAnnouncements();
  };

  const handleUpdateFields = async (id: string, updates: Partial<AnnouncementRow>) => {
    if (!client || !profile) return;
    setWorkingId(id);
    setErrorMessage(null);

    const { data, error } = await client
      .from("announcements")
      .update({ ...updates, updated_by: profile.id } as Record<string, unknown>)
      .eq("id", id)
      .select("id, title, body, status, is_urgent, is_pinned, published_at, archived_at, created_at, updated_at, created_by, updated_by")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal memperbarui pengumuman.");
      setWorkingId(null);
      return;
    }

    setWorkingId(null);
    await loadAnnouncements();
  };

  const handleArchive = async () => {
    if (!confirmArchive) return;
    await handleUpdateFields(confirmArchive, {
      status: "archived",
      archived_at: new Date().toISOString(),
    });
    setConfirmArchive(null);
  };

  const handleUnpublish = async () => {
    if (!confirmUnpublish) return;
    await handleUpdateFields(confirmUnpublish, {
      status: "draft",
      published_at: null,
      archived_at: null,
    });
    setConfirmUnpublish(null);
  };

  const handleDeleteAttachment = async (attachmentId: string, storagePath: string) => {
    if (!client) return;
    setErrorMessage(null);
    // Remove storage object first, then the attachment row
    const { error: storageError } = await client.storage.from("announcement-assets").remove([storagePath]);
    if (storageError) {
      setErrorMessage("Gagal menghapus file dari penyimpanan.");
      return;
    }
    const { error } = await client.from("announcement_attachments").delete().eq("id", attachmentId);
    if (error) {
      setErrorMessage("Gagal menghapus lampiran.");
      return;
    }
    setEditor((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== attachmentId),
    }));
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!client || !editor.id || !files || files.length === 0) return;
    setErrorMessage(null);
    for (const file of Array.from(files)) {
      const uuid = crypto.randomUUID();
      const storagePath = `announcements/${editor.id}/${uuid}-${file.name}`;
      const { error: uploadError } = await client.storage.from("announcement-assets").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) {
        setErrorMessage(`Gagal mengunggah ${file.name}.`);
        return;
      }
      const { error: insertError } = await client.from("announcement_attachments").insert({
        announcement_id: editor.id,
        label: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (insertError) {
        setErrorMessage(`Gagal menyimpan data lampiran ${file.name}.`);
        return;
      }
      setEditor((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          {
            id: crypto.randomUUID(),
            announcement_id: editor.id!,
            label: file.name,
            storage_path: storagePath,
            mime_type: file.type,
            size_bytes: file.size,
            created_at: new Date().toISOString(),
          },
        ],
      }));
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Communication</p>
          <h1 className="text-2xl font-semibold text-slate-900">Pengumuman</h1>
          <p className="text-sm text-slate-600">
            Kelola pengumuman warga. Simpan sebagai draft sebelum dipublikasikan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => loadAnnouncements()} disabled={loading || saving}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button onClick={openNewEditor} disabled={saving}>
            <FilePlus2 className="size-4" /> Pengumuman Baru
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="published">Terbit</TabsTrigger>
          <TabsTrigger value="archived">Arsip</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Pengumuman —{" "}
            {activeTab === "draft" ? "Draft" : activeTab === "published" ? "Terbit" : "Arsip"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat data...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-slate-600">Tidak ada pengumuman pada tab ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>Judul</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Lampiran</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((row) => {
                    const attachCount = attachmentCounts[row.id] ?? 0;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-xs">
                          <p className="truncate font-medium text-slate-900">{row.title}</p>
                          <p className="truncate text-xs text-slate-500">{row.body.slice(0, 60)}{row.body.length > 60 ? "…" : ""}</p>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          <p>{formatDateId(row.published_at ?? row.created_at)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(row.status)}>
                            {formatAnnouncementStatusLabel(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.is_urgent ? (
                              <Badge variant="destructive" className="text-xs">Penting</Badge>
                            ) : null}
                            {row.is_pinned ? (
                              <Badge variant="outline" className="text-xs">Pinned</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {attachCount > 0 ? (
                            <span className="flex items-center gap-1 text-xs">
                              <Paperclip className="size-3" /> {attachCount}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditEditor(row)}
                              disabled={workingId === row.id}
                            >
                              Edit
                            </Button>
                            {row.status === "published" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmUnpublish(row.id)}
                                  disabled={workingId === row.id}
                                >
                                  Tarik Publikasi
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setConfirmArchive(row.id)}
                                  disabled={workingId === row.id}
                                >
                                  Arsipkan
                                </Button>
                              </>
                            )}
                            {row.status === "draft" && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={async () => {
                                  setWorkingId(row.id);
                                  await handleUpdateFields(row.id, {
                                    status: "published",
                                    published_at: new Date().toISOString(),
                                  });
                                }}
                                disabled={workingId === row.id}
                              >
                                Publikasikan
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(open) => !open && setEditorOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editor.id ? "Edit Pengumuman" : "Pengumuman Baru"}
            </DialogTitle>
            <DialogDescription>
              {editor.status === "draft"
                ? "Simpan sebagai draft atau langsung terbitkan."
                : "Perbarui detail pengumuman."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Beranda warga hanya menampilkan satu hero penting. Pengumuman penting lain tetap muncul di daftar.</p>
            </div>

            <label className="space-y-2 text-sm text-slate-700">
              <span>Judul <span className="text-red-500">*</span></span>
              <Input
                value={editor.title}
                onChange={(e) => setEditor((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Judul pengumuman"
              />
              {formErrors.title ? <p className="text-xs text-red-600">{formErrors.title}</p> : null}
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span>Isi Pengumuman <span className="text-red-500">*</span></span>
              <Textarea
                value={editor.body}
                onChange={(e) => setEditor((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Tulis isi pengumuman di sini..."
                rows={6}
              />
              {formErrors.body ? <p className="text-xs text-red-600">{formErrors.body}</p> : null}
            </label>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editor.is_urgent}
                  onChange={(e) => setEditor((prev) => ({ ...prev, is_urgent: e.target.checked }))}
                  className="size-4 rounded border-slate-300"
                />
                <span>Tandai Penting</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editor.is_pinned}
                  onChange={(e) => setEditor((prev) => ({ ...prev, is_pinned: e.target.checked }))}
                  className="size-4 rounded border-slate-300"
                />
                <span>Tandai Pin</span>
              </label>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Lampiran</p>
              {editor.attachments.length > 0 ? (
                <div className="space-y-2">
                  {editor.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="size-4 shrink-0 text-slate-400" />
                        <span className="truncate text-sm text-slate-700">{att.label}</span>
                        <span className="text-xs text-slate-400">({(att.size_bytes / 1024).toFixed(1)} KB)</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAttachment(att.id, att.storage_path)}
                        disabled={saving}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Belum ada lampiran.</p>
              )}
              {editor.id ? (
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 hover:border-slate-400">
                  <Paperclip className="size-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Tambah lampiran</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </label>
              ) : (
                <p className="text-xs text-slate-400">
                  Simpan draft terlebih dahulu untuk menambahkan lampiran.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
              Batal
            </Button>

            {!editor.id || editor.status === "draft" ? (
              <>
                <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan Draft"}
                </Button>
                <Button onClick={handlePublish} disabled={saving}>
                  {saving ? "Menyimpan..." : "Publikasikan"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirmArchive(editor.id!);
                    setEditorOpen(false);
                  }}
                  disabled={saving}
                >
                  Arsipkan
                </Button>
                <Button onClick={() => handleSave(editor.status)} disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!confirmArchive} onOpenChange={(open) => !open && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arsipkan pengumuman?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengumuman ini akan dipindahkan ke riwayat warga dan tidak lagi tampil di daftar aktif.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleArchive} disabled={saving}>
              {saving ? "Menyimpan..." : "Arsipkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpublish Confirmation */}
      <AlertDialog open={!!confirmUnpublish} onOpenChange={(open) => !open && setConfirmUnpublish(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarik Publikasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengumuman akan dikembalikan ke status draft dan tidak lagi terlihat oleh warga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleUnpublish} disabled={saving}>
              {saving ? "Menyimpan..." : "Tarik Publikasi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
