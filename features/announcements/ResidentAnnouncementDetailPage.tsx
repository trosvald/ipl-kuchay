"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Paperclip, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateId } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface AttachmentRow {
  id: string;
  announcement_id: string;
  label: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}

interface AnnouncementDetailRow {
  id: string;
  title: string;
  body: string;
  status: string;
  is_urgent: boolean;
  is_pinned: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export function ResidentAnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const client = getSupabaseBrowserClient();

  const [announcement, setAnnouncement] = useState<AnnouncementDetailRow | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAnnouncement = useCallback(async () => {
    if (!client || !id) return;

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("announcements")
      .select("id, title, body, status, is_urgent, is_pinned, published_at, archived_at, created_at")
      .eq("id", id)
      .single();

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setAnnouncement(data as AnnouncementDetailRow);

    // Load attachments
    const { data: attachRows } = await client
      .from("announcement_attachments")
      .select("id, announcement_id, label, storage_path, mime_type, size_bytes")
      .eq("announcement_id", id);

    if (attachRows) {
      setAttachments(attachRows as AttachmentRow[]);
    }

    setLoading(false);
  }, [client, id]);

  useEffect(() => {
    loadAnnouncement().catch(() => {
      setErrorMessage("Gagal memuat detail pengumuman.");
      setLoading(false);
    });
  }, [loadAnnouncement]);

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

  if (errorMessage || !announcement) {
    return (
      <section className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/announcements">
            <ArrowLeft className="size-4" /> Kembali
          </Link>
        </Button>
        <Card className="rounded-xl border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{errorMessage ?? "Pengumuman tidak ditemukan."}</p>
            <Button size="sm" variant="outline" onClick={loadAnnouncement}>
              <RefreshCw className="size-4" /> Muat Ulang
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const isArchived = announcement.status === "archived";

  return (
    <section className="space-y-4">
      <Button asChild variant="outline" size="sm">
        <Link href="/app/announcements">
          <ArrowLeft className="size-4" /> Kembali
        </Link>
      </Button>

      <Card className="rounded-xl">
        <CardContent className="p-6 space-y-4">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {announcement.is_urgent && (
                <Badge variant="warning" className="text-xs">Penting</Badge>
              )}
              {isArchived && (
                <Badge variant="secondary" className="text-xs">Arsip</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {formatDateId(announcement.published_at ?? announcement.created_at)}
              </span>
            </div>

            <h2 className="text-2xl font-semibold text-foreground">{announcement.title}</h2>
          </div>

          {/* Archive note */}
          {isArchived && (
            <div className="rounded-md bg-muted/50 border border-border p-3">
              <p className="text-sm text-muted-foreground italic">
                Pengumuman ini berada di arsip dan disimpan sebagai riwayat informasi warga.
              </p>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground flex items-center gap-1">
                <Paperclip className="size-4" /> Lampiran
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <Badge key={att.id} variant="outline" className="text-xs">
                    {att.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="prose prose-sm max-w-none text-foreground">
            <p className="whitespace-pre-wrap text-base leading-relaxed">{announcement.body}</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}