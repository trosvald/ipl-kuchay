"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateId } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface AnnouncementRow {
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

interface AttachmentRow {
  id: string;
  announcement_id: string;
  label: string;
  mime_type: string;
}

function AnnouncementHeroSkeleton() {
  return (
    <Card className="rounded-xl border-amber-200 bg-amber-50/50">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

function AnnouncementCardSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
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

export function ResidentAnnouncementsPage() {
  const client = getSupabaseBrowserClient();

  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [attachments, setAttachments] = useState<Record<string, AttachmentRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      .select("id, title, body, status, is_urgent, is_pinned, published_at, archived_at, created_at")
      .order("is_urgent", { ascending: false })
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = data as AnnouncementRow[];
    setAnnouncements(rows);

    // Load attachments for all announcements
    if (rows.length > 0) {
      const { data: attachRows } = await client
        .from("announcement_attachments")
        .select("id, announcement_id, label, mime_type");

      if (attachRows) {
        const attachMap: Record<string, AttachmentRow[]> = {};
        for (const att of attachRows as AttachmentRow[]) {
          if (!attachMap[att.announcement_id]) {
            attachMap[att.announcement_id] = [];
          }
          attachMap[att.announcement_id].push(att);
        }
        setAttachments(attachMap);
      }
    }

    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadAnnouncements().catch(() => {
      setErrorMessage("Gagal memuat data pengumuman.");
      setLoading(false);
    });
  }, [loadAnnouncements]);

  // Active announcements: published with is_urgent pinned hero (1 max) then regular published
  const urgentHero = useMemo(() => {
    return announcements.find((a) => a.status === "published" && a.is_urgent && a.is_pinned) ?? null;
  }, [announcements]);

  const activeAnnouncements = useMemo(() => {
    return announcements.filter((a) => a.status === "published");
  }, [announcements]);

  const archivedAnnouncements = useMemo(() => {
    return announcements.filter((a) => a.status === "archived");
  }, [announcements]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">User Portal</p>
          <h2 className="text-xl font-semibold text-foreground">Pengumuman</h2>
        </div>
        <Button variant="secondary" onClick={() => loadAnnouncements()} disabled={loading}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </header>

      {errorMessage ? (
        <ErrorCard message={errorMessage} onRetry={loadAnnouncements} />
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <AnnouncementHeroSkeleton />
          <AnnouncementCardSkeleton />
          <AnnouncementCardSkeleton />
        </div>
      ) : activeAnnouncements.length === 0 && !urgentHero ? (
        <Card className="rounded-xl">
          <CardContent className="py-8 text-center">
            <Megaphone className="mx-auto size-8 text-muted-foreground mb-3" />
            <p className="text-base font-semibold text-slate-900">Belum ada pengumuman</p>
            <p className="mt-1 text-sm text-slate-600">
              Pengumuman warga akan muncul di sini setelah dipublikasikan pengurus.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Urgent hero */}
          {urgentHero && (
            <Card className="rounded-xl border-amber-200 bg-amber-50/50">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="warning" className="text-xs">Penting</Badge>
                  <span className="text-xs text-amber-700">
                    {formatDateId(urgentHero.published_at ?? urgentHero.created_at)}
                  </span>
                </div>
                <p className="text-lg font-semibold text-foreground">{urgentHero.title}</p>
                <p className="text-sm text-foreground/80 line-clamp-3">{urgentHero.body}</p>
                {attachments[urgentHero.id]?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments[urgentHero.id].map((att) => (
                      <Badge key={att.id} variant="outline" className="text-xs">
                        {att.label}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button asChild size="default" variant="default">
                  <Link href={`/app/announcements/${urgentHero.id}`}>Baca Pengumuman</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Active feed: non-hero published announcements */}
          {activeAnnouncements.filter((a) => a.id !== urgentHero?.id).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Pengumuman</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {activeAnnouncements
                  .filter((a) => a.id !== urgentHero?.id)
                  .map((announcement) => (
                    <Card key={announcement.id} className="rounded-xl">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {announcement.is_urgent && (
                            <Badge variant="warning" className="text-xs">Penting</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDateId(announcement.published_at ?? announcement.created_at)}
                          </span>
                        </div>
                        <p className="font-semibold text-foreground line-clamp-2">{announcement.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{announcement.body}</p>
                        {attachments[announcement.id]?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {attachments[announcement.id].map((att) => (
                              <Badge key={att.id} variant="outline" className="text-xs">
                                {att.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Button asChild size="sm" variant="outline" className="mt-1">
                          <Link href={`/app/announcements/${announcement.id}`}>Baca Pengumuman</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Archived history */}
          {archivedAnnouncements.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-muted-foreground">Riwayat Pengumuman</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {archivedAnnouncements.map((announcement) => (
                  <Card key={announcement.id} className="rounded-xl border-muted bg-muted/30">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">Arsip</Badge>
                        {announcement.is_urgent && (
                          <Badge variant="outline" className="text-xs">Penting</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDateId(announcement.archived_at ?? announcement.created_at)}
                        </span>
                      </div>
                      <p className="font-semibold text-muted-foreground line-clamp-2">{announcement.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{announcement.body}</p>
                      {attachments[announcement.id]?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {attachments[announcement.id].map((att) => (
                            <Badge key={att.id} variant="outline" className="text-xs">
                              {att.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Button asChild size="sm" variant="outline" className="mt-1">
                        <Link href={`/app/announcements/${announcement.id}`}>Baca Pengumuman</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
