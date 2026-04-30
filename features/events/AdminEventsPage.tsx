"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, FilePlus2, MapPin, RefreshCw, X } from "lucide-react";

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
import { eventFormSchema, type EventStatus } from "@/lib/validation";

type EventTab = "scheduled" | "cancelled" | "past";

interface EventRow {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: EventStatus;
  cancellation_note: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface RSVPSummary {
  attending: number;
  not_attending: number;
  no_response: number;
}

interface EventRowWithRSVP extends EventRow {
  rsvp: RSVPSummary;
}

function parseTab(value: string | null): EventTab {
  if (value === "cancelled" || value === "past") {
    return value;
  }
  return "scheduled";
}

function formatEventStatusLabel(status: EventStatus): string {
  if (status === "scheduled") return "Mendatang";
  return "Dibatalkan";
}

function statusBadgeVariant(status: EventStatus): "default" | "destructive" {
  if (status === "scheduled") return "default";
  return "destructive";
}

interface EditorState {
  id?: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
  cancellation_note: string;
}

function emptyEditor(): EditorState {
  return {
    title: "",
    description: "",
    location: "",
    starts_at: "",
    ends_at: "",
    status: "scheduled",
    cancellation_note: "",
  };
}

export function AdminEventsPage() {
  const client = getSupabaseBrowserClient();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<EventTab>("scheduled");
  const [items, setItems] = useState<EventRow[]>([]);
  const [rsvpSummaries, setRsvpSummaries] = useState<Record<string, RSVPSummary>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());

  // Cancel confirmation
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; title: string; note: string } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("events")
      .select("id, title, description, location, starts_at, ends_at, status, cancellation_note, cancelled_at, created_at, updated_at, created_by, updated_by")
      .order("starts_at", { ascending: false });

    if (error) {
      setItems([]);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as EventRow[];
    setItems(rows);

    // Load RSVP summaries for all events
    if (rows.length > 0) {
      const eventIds = rows.map((r) => r.id);
      const { data: rsvpRows } = await client
        .from("event_attendees")
        .select("event_id, response");

      const summaryMap: Record<string, RSVPSummary> = {};
      for (const id of eventIds) {
        summaryMap[id] = { attending: 0, not_attending: 0, no_response: 0 };
      }
      if (rsvpRows) {
        for (const row of rsvpRows as { event_id: string; response: string }[]) {
          if (summaryMap[row.event_id]) {
            if (row.response === "attending") summaryMap[row.event_id].attending++;
            else if (row.response === "not_attending") summaryMap[row.event_id].not_attending++;
            else summaryMap[row.event_id].no_response++;
          }
        }
      }
      setRsvpSummaries(summaryMap);
    }

    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadEvents().catch(() => {
      setLoading(false);
      setErrorMessage("Gagal memuat data acara.");
    });
  }, [loadEvents]);

  const now = new Date();

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === "cancelled") return item.status === "cancelled";
      if (activeTab === "past") return item.status === "scheduled" && new Date(item.starts_at) < now;
      return item.status === "scheduled" && new Date(item.starts_at) >= now;
    });
  }, [items, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(parseTab(value));
  };

  const openNewEditor = () => {
    setEditor(emptyEditor());
    setFormErrors({});
    setEditorOpen(true);
  };

  const openEditEditor = (row: EventRow) => {
    setEditor({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      starts_at: row.starts_at.slice(0, 16),
      ends_at: row.ends_at ? row.ends_at.slice(0, 16) : "",
      status: row.status,
      cancellation_note: row.cancellation_note,
    });
    setFormErrors({});
    setEditorOpen(true);
  };

  const handleSave = async (targetStatus?: EventStatus) => {
    if (!client || !profile) return;

    const parsed = eventFormSchema.safeParse({
      title: editor.title,
      description: editor.description,
      location: editor.location,
      starts_at: editor.starts_at,
      ends_at: editor.ends_at || null,
      status: targetStatus ?? editor.status,
      cancellation_note: editor.cancellation_note,
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
      description: parsed.data.description?.trim() ?? "",
      location: parsed.data.location.trim(),
      starts_at: new Date(parsed.data.starts_at).toISOString(),
      ends_at: parsed.data.ends_at ? new Date(parsed.data.ends_at).toISOString() : null,
      status: parsed.data.status,
      cancellation_note: parsed.data.cancellation_note?.trim() ?? "",
      cancelled_at: parsed.data.status === "cancelled" ? new Date().toISOString() : null,
      ...(isNew ? { created_by: profile.id } : { updated_by: profile.id }),
    };

    let data;
    let error;
    if (isNew) {
      const result = await client
        .from("events")
        .insert(payload as Record<string, unknown>)
        .select("id, title, description, location, starts_at, ends_at, status, cancellation_note, cancelled_at, created_at, updated_at, created_by, updated_by")
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await client
        .from("events")
        .update(payload as Record<string, unknown>)
        .eq("id", editor.id)
        .select("id, title, description, location, starts_at, ends_at, status, cancellation_note, cancelled_at, created_at, updated_at, created_by, updated_by")
        .single();
      data = result.data;
      error = result.error;
    }

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal menyimpan acara.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditorOpen(false);
    await loadEvents();
  };

  const handleCancelEvent = async () => {
    if (!confirmCancel || !client || !profile) return;
    setWorkingId(confirmCancel.id);
    setErrorMessage(null);

    const { error } = await client
      .from("events")
      .update({
        status: "cancelled",
        cancellation_note: confirmCancel.note,
        cancelled_at: new Date().toISOString(),
        updated_by: profile.id,
      } as Record<string, unknown>)
      .eq("id", confirmCancel.id);

    if (error) {
      setErrorMessage(error.message);
      setWorkingId(null);
      setConfirmCancel(null);
      return;
    }

    setWorkingId(null);
    setConfirmCancel(null);
    await loadEvents();
  };

  const rsvpVariant = (count: number, total: number): "success" | "destructive" | "secondary" => {
    if (count === 0 && total === 0) return "secondary";
    if (count > 0) return "success";
    return "secondary";
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Communication</p>
          <h1 className="text-2xl font-semibold text-slate-900">Acara</h1>
          <p className="text-sm text-slate-600">
            Kelola acara warga dan lihat ringkasan RSVP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => loadEvents()} disabled={loading || saving}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button onClick={openNewEditor} disabled={saving}>
            <FilePlus2 className="size-4" /> Acara Baru
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
          <TabsTrigger value="scheduled">Mendatang</TabsTrigger>
          <TabsTrigger value="cancelled">Dibatalkan</TabsTrigger>
          <TabsTrigger value="past">Selesai</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Acara —{" "}
            {activeTab === "scheduled" ? "Mendatang" : activeTab === "cancelled" ? "Dibatalkan" : "Selesai"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat data...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-slate-600">Tidak ada acara pada tab ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>Judul</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>RSVP Hadir</TableHead>
                    <TableHead>RSVP Tidak Hadir</TableHead>
                    <TableHead>Belum Menjawab</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((row) => {
                    const rsvp = rsvpSummaries[row.id] ?? { attending: 0, not_attending: 0, no_response: 0 };
                    const isPast = new Date(row.starts_at) < now;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-xs">
                          <p className="truncate font-medium text-slate-900">{row.title}</p>
                          {row.description ? (
                            <p className="truncate text-xs text-slate-500">{row.description.slice(0, 60)}{row.description.length > 60 ? "…" : ""}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          <p>{formatDateId(row.starts_at)}</p>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          <p className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {row.location}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(row.status)}>
                            {isPast && row.status === "scheduled"
                              ? "Selesai"
                              : formatEventStatusLabel(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rsvpVariant(rsvp.attending, rsvp.attending + rsvp.not_attending + rsvp.no_response)}>
                            {rsvp.attending}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rsvpVariant(rsvp.not_attending, rsvp.attending + rsvp.not_attending + rsvp.no_response)}>
                            {rsvp.not_attending}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">{rsvp.no_response}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {row.status === "scheduled" && !isPast && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditEditor(row)}
                                disabled={workingId === row.id}
                              >
                                Edit
                              </Button>
                            )}
                            {row.status === "scheduled" && !isPast && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setConfirmCancel({ id: row.id, title: row.title, note: "" })}
                                disabled={workingId === row.id}
                              >
                                Batalkan Acara
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
              {editor.id ? "Edit Acara" : "Acara Baru"}
            </DialogTitle>
            <DialogDescription>
              {editor.id ? "Perbarui detail acara." : "Buat acara baru untuk warga."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Judul Acara <span className="text-red-500">*</span></span>
              <Input
                value={editor.title}
                onChange={(e) => setEditor((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Judul acara"
              />
              {formErrors.title ? <p className="text-xs text-red-600">{formErrors.title}</p> : null}
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span>Deskripsi</span>
              <Textarea
                value={editor.description}
                onChange={(e) => setEditor((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi acara (opsional)"
                rows={3}
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span>Lokasi <span className="text-red-500">*</span></span>
              <Input
                value={editor.location}
                onChange={(e) => setEditor((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Lokasi acara"
              />
              {formErrors.location ? <p className="text-xs text-red-600">{formErrors.location}</p> : null}
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Waktu Mulai <span className="text-red-500">*</span></span>
                <Input
                  type="datetime-local"
                  value={editor.starts_at}
                  onChange={(e) => setEditor((prev) => ({ ...prev, starts_at: e.target.value }))}
                />
                {formErrors.starts_at ? <p className="text-xs text-red-600">{formErrors.starts_at}</p> : null}
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Waktu Selesai</span>
                <Input
                  type="datetime-local"
                  value={editor.ends_at}
                  onChange={(e) => setEditor((prev) => ({ ...prev, ends_at: e.target.value }))}
                />
                {formErrors.ends_at ? <p className="text-xs text-red-600">{formErrors.ends_at}</p> : null}
              </label>
            </div>
          </div>

          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={() => handleSave()} disabled={saving}>
              {saving ? "Menyimpan..." : editor.id ? "Simpan Perubahan" : "Simpan Acara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog
        open={!!confirmCancel}
        onOpenChange={(open) => !open && setConfirmCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Acara?</AlertDialogTitle>
            <AlertDialogDescription>
              Acara akan ditandai sebagai dibatalkan. Catatan pembatalan akan ditampilkan kepada warga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Catatan Pembatalan</span>
              <Textarea
                value={confirmCancel?.note ?? ""}
                onChange={(e) =>
                  setConfirmCancel((prev) => (prev ? { ...prev, note: e.target.value } : null))
                }
                placeholder="Alasan pembatalan (opsional)"
                rows={2}
              />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCancel(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancelEvent} disabled={saving || workingId !== null}>
              {saving || workingId !== null ? "Menyimpan..." : "Batalkan Acara"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
