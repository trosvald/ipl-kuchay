"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, FilePlus2, Inbox, MapPin, RefreshCw } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { ListContainer } from "@/components/ui/ListContainer";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { StatusDot } from "@/components/ui/StatusDot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DataList } from "@/features/layout/DataList";
import { PageHeader } from "@/features/layout/PageHeader";
import { useAuth } from "@/features/auth/authHooks";
import { cn } from "@/lib/utils";
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

const TAB_OPTIONS: EventTab[] = ["scheduled", "cancelled", "past"];

function tabLabel(tab: EventTab): string {
  if (tab === "scheduled") return "Mendatang";
  if (tab === "cancelled") return "Dibatalkan";
  return "Selesai";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

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

  const filteredItems = useMemo(() => items.filter((item) => {
    const now = new Date();
    if (activeTab === "cancelled") return item.status === "cancelled";
    if (activeTab === "past") return item.status === "scheduled" && new Date(item.starts_at) < now;
    return item.status === "scheduled" && new Date(item.starts_at) >= now;
  }), [activeTab, items]);
  const totalRows = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedItems = useMemo(
    () => filteredItems.slice((page - 1) * pageSize, page * pageSize),
    [filteredItems, page, pageSize],
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

    let data: EventRow | null = null;
    let error: { message: string } | null = null;
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

  const hasNoContent = !loading && !errorMessage && filteredItems.length === 0;

  const mobileContent = hasNoContent ? (
    <EmptyState
      icon={Inbox}
      title="Tidak ada acara"
      description={`Tidak ada acara ${tabLabel(activeTab).toLowerCase()} saat ini.`}
    />
  ) : (
    <ListContainer>
      {pagedItems.map((row) => {
        const rsvp = rsvpSummaries[row.id] ?? { attending: 0, not_attending: 0, no_response: 0 };
        const isPast = new Date(row.starts_at) < new Date();
        const isExpanded = expandedId === row.id;
        const statusLabel = isPast && row.status === "scheduled" ? "Selesai" : formatEventStatusLabel(row.status);
        const statusVariant = row.status === "cancelled" ? "destructive" : isPast ? "muted" : "success";

        return (
          <CompactListRow
            key={row.id}
            primary={row.title}
            trailing={
              <Badge variant={statusBadgeVariant(row.status)} className="text-[10px] h-4 px-1.5">
                {statusLabel}
              </Badge>
            }
            secondary={
              <span className="flex items-center gap-1.5">
                <StatusDot variant={statusVariant} />
                <span>{formatDateId(row.starts_at)}</span>
                <span className="text-slate-300">·</span>
                <MapPin className="size-3 text-slate-400" />
                <span className="truncate">{row.location}</span>
              </span>
            }
            accentColor={row.status === "cancelled" ? "border-l-red-500" : isPast ? "border-l-slate-300" : "border-l-indigo-500"}
            expandedOpen={isExpanded}
            onToggle={() => setExpandedId(isExpanded ? null : row.id)}
            expanded={
              <div className="space-y-2">
                {row.description ? (
                  <p className="text-xs text-slate-600">{row.description}</p>
                ) : null}
                <div className="flex items-center gap-3 text-xs">
                  <span><span className="text-slate-400">Hadir</span> <span className="font-semibold text-slate-800">{rsvp.attending}</span></span>
                  <span><span className="text-slate-400">Tidak</span> <span className="font-semibold text-slate-800">{rsvp.not_attending}</span></span>
                  <span><span className="text-slate-400">Belum</span> <span className="font-semibold text-slate-800">{rsvp.no_response}</span></span>
                </div>
                {row.status === "scheduled" && !isPast ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => openEditEditor(row)}
                      disabled={workingId === row.id}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      onClick={() => setConfirmCancel({ id: row.id, title: row.title, note: "" })}
                      disabled={workingId === row.id}
                    >
                      Batalkan
                    </Button>
                  </div>
                ) : null}
              </div>
            }
          />
        );
      })}
    </ListContainer>
  );

  const desktopContent = hasNoContent ? (
    <EmptyState
      icon={Inbox}
      title="Tidak ada acara"
      description={`Tidak ada acara ${tabLabel(activeTab).toLowerCase()} saat ini.`}
    />
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
          {pagedItems.map((row) => {
          const rsvp = rsvpSummaries[row.id] ?? { attending: 0, not_attending: 0, no_response: 0 };
          const isPast = new Date(row.starts_at) < new Date();
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
  );

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="Admin Communication"
        title="Acara"
        subtitle="Kelola acara warga dan lihat ringkasan RSVP."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => loadEvents()} disabled={loading || saving}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button size="sm" onClick={openNewEditor} disabled={saving}>
              <FilePlus2 className="size-4" /> Acara Baru
            </Button>
          </>
        }
      />

      {/* Tab switcher — scrollable pills on mobile, inline on desktop */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-max gap-1 rounded-lg bg-muted p-1 sm:min-w-0">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "touch-target-sm whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === activeTab
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab(tab)}
              disabled={loading || saving}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <DataList
        loading={loading}
        skeletonCount={5}
        error={errorMessage}
        onRetry={loadEvents}
        mobile={mobileContent}
        desktop={desktopContent}
      />

      {/* Pagination */}
      {!loading && !errorMessage && filteredItems.length > 0 ? (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalRows={totalRows}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(open) => !open && setEditorOpen(false)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editor.id ? "Edit Acara" : "Acara Baru"}
            </DialogTitle>
            <DialogDescription>
              {editor.id ? "Perbarui detail acara." : "Buat acara baru untuk warga."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label htmlFor="eventTitle" className="space-y-2 text-sm text-slate-700">
              <span>Judul Acara <span className="text-red-500">*</span></span>
              <Input
                id="eventTitle"
                value={editor.title}
                onChange={(e) => setEditor((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Judul acara"
              />
              {formErrors.title ? <p className="text-xs text-red-600">{formErrors.title}</p> : null}
            </label>

            <label htmlFor="eventDescription" className="space-y-2 text-sm text-slate-700">
              <span>Deskripsi</span>
              <Textarea
                id="eventDescription"
                value={editor.description}
                onChange={(e) => setEditor((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi acara (opsional)"
                rows={3}
              />
            </label>

            <label htmlFor="eventLocation" className="space-y-2 text-sm text-slate-700">
              <span>Lokasi <span className="text-red-500">*</span></span>
              <Input
                id="eventLocation"
                value={editor.location}
                onChange={(e) => setEditor((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Lokasi acara"
              />
              {formErrors.location ? <p className="text-xs text-red-600">{formErrors.location}</p> : null}
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label htmlFor="eventStartsAt" className="space-y-2 text-sm text-slate-700">
                <span>Waktu Mulai <span className="text-red-500">*</span></span>
                <Input
                  id="eventStartsAt"
                  type="datetime-local"
                  value={editor.starts_at}
                  onChange={(e) => setEditor((prev) => ({ ...prev, starts_at: e.target.value }))}
                />
                {formErrors.starts_at ? <p className="text-xs text-red-600">{formErrors.starts_at}</p> : null}
              </label>

              <label htmlFor="eventEndsAt" className="space-y-2 text-sm text-slate-700">
                <span>Waktu Selesai</span>
                <Input
                  id="eventEndsAt"
                  type="datetime-local"
                  value={editor.ends_at}
                  onChange={(e) => setEditor((prev) => ({ ...prev, ends_at: e.target.value }))}
                />
                {formErrors.ends_at ? <p className="text-xs text-red-600">{formErrors.ends_at}</p> : null}
              </label>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background pt-3">
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
            <label htmlFor="eventCancelNote" className="space-y-2 text-sm text-slate-700">
              <span>Catatan Pembatalan</span>
              <Textarea
                id="eventCancelNote"
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
