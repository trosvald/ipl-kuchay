"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateId } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface EventRow {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  cancellation_note: string;
}

interface RSVPRow {
  event_id: string;
  response: string;
  profile_id: string;
}

type EventTab = "upcoming" | "cancelled" | "past";

function EventCardSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-[60px] w-[48px] rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="rounded-xl border-red-200 bg-red-50">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-red-700">{message}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-4" /> Muat Ulang
        </Button>
      </CardContent>
    </Card>
  );
}

function EventCard({
  event,
  rsvpCount,
  rsvpLabel,
  rsvpVariant,
  showRsvp = true,
}: {
  event: EventRow;
  rsvpCount?: number;
  rsvpLabel?: string;
  rsvpVariant?: "success" | "destructive" | "secondary";
  showRsvp?: boolean;
}) {
  const startDate = new Date(event.starts_at);
  const dayStr = String(startDate.getDate()).padStart(2, "0");
  const monthStr = startDate.toLocaleDateString("id-ID", { month: "short" });
  const yearNum = startDate.getFullYear();
  const timeStr = startDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  const endTimeStr = event.ends_at
    ? new Date(event.ends_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <Card className={`rounded-xl ${event.status === "cancelled" ? "border-red-200" : "border-border"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`flex flex-col items-center justify-center min-w-[48px] rounded-md border px-2 py-1.5 ${event.status === "cancelled" ? "border-red-200 bg-red-50" : "border-border bg-background"}`}>
            <span className={`text-xs font-medium ${event.status === "cancelled" ? "text-red-600" : "text-muted-foreground"}`}>{monthStr}</span>
            <span className={`text-xl font-semibold ${event.status === "cancelled" ? "text-red-600" : "text-foreground"}`} style={{ fontVariantNumeric: "tabular-nums" }}>{dayStr}</span>
            <span className={`text-xs ${event.status === "cancelled" ? "text-red-500" : "text-muted-foreground"}`}>{yearNum}</span>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {event.status === "cancelled" && (
                <Badge variant="destructive" className="text-xs">Dibatalkan</Badge>
              )}
              {event.status === "scheduled" && new Date(event.starts_at) < new Date() && (
                <Badge variant="secondary" className="text-xs">Selesai</Badge>
              )}
            </div>
            <p className="font-semibold text-foreground line-clamp-1">{event.title}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
              <span>{timeStr}{endTimeStr ? ` - ${endTimeStr}` : ""}</span>
              {event.location && (
                <>
                  <span>•</span>
                  <span className="truncate">{event.location}</span>
                </>
              )}
            </p>
            {event.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
            )}
            {event.status === "cancelled" && event.cancellation_note && (
              <p className="text-xs text-red-600 italic">Pembatalan: {event.cancellation_note}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {showRsvp && rsvpLabel && (
            <Badge variant={rsvpVariant ?? "secondary"} className="text-xs">
              {rsvpLabel}{rsvpCount !== undefined ? ` (${rsvpCount})` : ""}
            </Badge>
          )}
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={`/app/events/${event.id}`}>Lihat Detail Acara</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResidentEventsPage() {
  const client = getSupabaseBrowserClient();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const now = new Date();

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
      .select("id, title, description, location, starts_at, ends_at, status, cancellation_note")
      .order("starts_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = data as EventRow[];
    setEvents(rows);

    // Load RSVPs
    const { data: rsvpRows } = await client
      .from("event_attendees")
      .select("event_id, response");

    if (rsvpRows) {
      const rsvpMap: Record<string, string> = {};
      for (const row of rsvpRows as RSVPRow[]) {
        rsvpMap[row.event_id] = row.response;
      }
      setRsvps(rsvpMap);
    }

    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadEvents().catch(() => {
      setErrorMessage("Gagal memuat data acara.");
      setLoading(false);
    });
  }, [loadEvents]);

  const upcomingEvents = useMemo(() => {
    return events.filter(
      (e) => e.status === "scheduled" && new Date(e.starts_at) >= now,
    );
  }, [events, now]);

  const cancelledEvents = useMemo(() => {
    return events.filter((e) => e.status === "cancelled");
  }, [events]);

  const pastEvents = useMemo(() => {
    return events.filter(
      (e) => e.status === "scheduled" && new Date(e.starts_at) < now,
    );
  }, [events, now]);

  const formatRsvpLabel = (response: string | undefined): { label: string; variant: "success" | "destructive" | "secondary" } => {
    if (!response) return { label: "Belum Menjawab", variant: "secondary" };
    if (response === "attending") return { label: "Saya Hadir", variant: "success" };
    if (response === "not_attending") return { label: "Tidak Bisa Hadir", variant: "destructive" };
    return { label: "Belum Menjawab", variant: "secondary" };
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">User Portal</p>
          <h2 className="text-xl font-semibold text-foreground">Acara</h2>
        </div>
        <Button variant="secondary" onClick={() => loadEvents()} disabled={loading}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </header>

      {errorMessage ? (
        <ErrorCard message={errorMessage} onRetry={loadEvents} />
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">Mendatang</TabsTrigger>
              <TabsTrigger value="cancelled">Dibatalkan</TabsTrigger>
              <TabsTrigger value="past">Selesai</TabsTrigger>
            </TabsList>
          </Tabs>
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">
              Mendatang
              {upcomingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{upcomingEvents.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Dibatalkan
              {cancelledEvents.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs">{cancelledEvents.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">
              Selesai
              {pastEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{pastEvents.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4 space-y-3">
            {upcomingEvents.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="py-8 text-center">
                  <Calendar className="mx-auto size-8 text-muted-foreground mb-3" />
                  <p className="text-base font-semibold text-slate-900">Belum ada acara mendatang</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Jika ada kegiatan warga baru, informasinya akan tampil di sini.
                  </p>
                </CardContent>
              </Card>
            ) : (
              upcomingEvents.map((event) => {
                const myRsvp = rsvps[event.id];
                const { label, variant } = formatRsvpLabel(myRsvp);
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    rsvpLabel={label}
                    rsvpVariant={variant}
                    showRsvp={true}
                  />
                );
              })
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="mt-4 space-y-3">
            {cancelledEvents.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="py-8 text-center">
                  <Calendar className="mx-auto size-8 text-muted-foreground mb-3" />
                  <p className="text-base font-semibold text-slate-900">Tidak ada acara yang dibatalkan</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Perubahan jadwal yang dibatalkan akan tetap terlihat di sini.
                  </p>
                </CardContent>
              </Card>
            ) : (
              cancelledEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  showRsvp={false}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4 space-y-3">
            {pastEvents.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="py-8 text-center">
                  <Calendar className="mx-auto size-8 text-muted-foreground mb-3" />
                  <p className="text-base font-semibold text-slate-900">Belum ada riwayat acara</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Riwayat kegiatan warga akan muncul setelah acara selesai.
                  </p>
                </CardContent>
              </Card>
            ) : (
              pastEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  showRsvp={false}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}