"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateId } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { rsvpUpsertSchema } from "@/lib/validation";
import { useAuth } from "@/features/auth/authHooks";

interface EventDetailRow {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  cancellation_note: string;
}

type RSVPResponse = "attending" | "not_attending" | "no_response";

function RSVPControl({
  currentRsvp,
  isLocked,
  lockedReason,
  onUpdate,
  saving,
}: {
  currentRsvp: RSVPResponse | null;
  isLocked: boolean;
  lockedReason: string;
  onUpdate: (rsvp: RSVPResponse) => void;
  saving: boolean;
}) {
  const options: { value: RSVPResponse; label: string; variant: "default" | "outline" }[] = [
    { value: "attending", label: "Saya Hadir", variant: "default" },
    { value: "not_attending", label: "Tidak Bisa Hadir", variant: "outline" },
    { value: "no_response", label: "Belum Menjawab", variant: "outline" },
  ];

  return (
    <div className="space-y-3">
      {isLocked ? (
        <div className="rounded-md bg-muted/50 border border-border p-4">
          <p className="text-sm text-muted-foreground text-center">{lockedReason}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const isSelected = currentRsvp === opt.value;
            return (
              <Button
                key={opt.value}
                variant={isSelected ? "default" : "outline"}
                size="lg"
                onClick={() => onUpdate(opt.value)}
                disabled={saving}
                className="min-h-[44px]"
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ResidentEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile } = useAuth();
  const client = getSupabaseBrowserClient();

  const [event, setEvent] = useState<EventDetailRow | null>(null);
  const [myRsvp, setMyRsvp] = useState<RSVPResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!client || !id) return;

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("events")
      .select("id, title, description, location, starts_at, ends_at, status, cancellation_note")
      .eq("id", id)
      .single();

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setEvent(data as EventDetailRow);

    // Load my RSVP
    if (profile) {
      const { data: rsvpRows } = await client
        .from("event_attendees")
        .select("response")
        .eq("event_id", id)
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (rsvpRows && (rsvpRows as { response: string }).response) {
        setMyRsvp((rsvpRows as { response: string }).response as RSVPResponse);
      }
    }

    setLoading(false);
  }, [client, id, profile]);

  useEffect(() => {
    loadEvent().catch(() => {
      setErrorMessage("Gagal memuat detail acara.");
      setLoading(false);
    });
  }, [loadEvent]);

  const handleRsvpUpdate = async (response: RSVPResponse) => {
    if (!client || !profile || !id) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsed = rsvpUpsertSchema.safeParse({
      event_id: id,
      response,
    });

    if (!parsed.success) {
      setErrorMessage("Data RSVP tidak valid.");
      setSaving(false);
      return;
    }

    const { error } = await client
      .from("event_attendees")
      .upsert(
        {
          ...parsed.data,
          profile_id: profile.id,
        },
        { onConflict: "event_id,profile_id" },
      );

    if (error) {
      setErrorMessage("Gagal memperbarui RSVP.");
      setSaving(false);
      return;
    }

    setMyRsvp(response);
    setSaving(false);
    setSuccessMessage("RSVP Anda berhasil diperbarui.");
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  if (errorMessage && !event) {
    return (
      <section className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/events">
            <ArrowLeft className="size-4" /> Kembali
          </Link>
        </Button>
        <Card className="rounded-xl border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{errorMessage}</p>
            <Button size="sm" variant="outline" onClick={loadEvent}>
              <RefreshCw className="size-4" /> Muat Ulang
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!event) {
    return (
      <section className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/events">
            <ArrowLeft className="size-4" /> Kembali
          </Link>
        </Button>
        <Card className="rounded-xl">
          <CardContent className="py-8 text-center">
            <p className="text-base font-semibold text-slate-900">Acara tidak ditemukan</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const startDate = new Date(event.starts_at);
  const endDate = event.ends_at ? new Date(event.ends_at) : null;
  const now = new Date();

  const isPast = startDate < now;
  const isCancelled = event.status === "cancelled";

  let rsvpLocked = false;
  let rsvpLockedReason = "";

  if (isCancelled) {
    rsvpLocked = true;
    rsvpLockedReason = "Acara ini dibatalkan. RSVP tidak dapat diubah.";
  } else if (isPast) {
    rsvpLocked = true;
    rsvpLockedReason = "RSVP sudah ditutup karena acara telah dimulai.";
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <section className="space-y-4">
      <Button asChild variant="outline" size="sm">
        <Link href="/app/events">
          <ArrowLeft className="size-4" /> Kembali
        </Link>
      </Button>

      <Card className="rounded-xl">
        <CardContent className="p-6 space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {isCancelled && (
              <Badge variant="destructive" className="text-xs">Dibatalkan</Badge>
            )}
            {!isCancelled && isPast && (
              <Badge variant="secondary" className="text-xs">Selesai</Badge>
            )}
            {!isCancelled && !isPast && (
              <Badge variant="default" className="text-xs">Mendatang</Badge>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-foreground">{event.title}</h2>

          {/* Date/time/location */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              <span>{formatDateId(event.starts_at)}</span>
              <span>•</span>
              <span>{formatTime(startDate)}{endDate ? ` - ${formatTime(endDate)}` : ""}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {/* Cancellation note */}
          {isCancelled && event.cancellation_note && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700 font-medium">Alasan pembatalan:</p>
              <p className="text-sm text-red-600">{event.cancellation_note}</p>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">{event.description}</p>
            </div>
          )}

          {/* RSVP Section */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Konfirmasi Kehadiran</p>

            {successMessage && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            <RSVPControl
              currentRsvp={myRsvp}
              isLocked={rsvpLocked}
              lockedReason={rsvpLockedReason}
              onUpdate={handleRsvpUpdate}
              saving={saving}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
