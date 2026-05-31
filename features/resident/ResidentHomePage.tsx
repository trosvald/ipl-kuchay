"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Megaphone,
  ReceiptText,
  RefreshCw,
  Settings,
  Shield,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_NAME } from "@/lib/constants";
import { formatDateId, formatRupiah } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/authHooks";

interface ResidentKavlingMapping {
  id: string;
  relation: string;
  is_primary: boolean;
  active: boolean;
  kavlings: {
    id: string;
    code: string;
    block: string | null;
    active: boolean;
  } | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: string;
  kavlings: {
    id: string;
    code: string;
    block: string | null;
  } | null;
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  status: string;
  is_urgent: boolean;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
}

interface BillingKavlingGroup {
  kavlingCode: string;
  block: string | null;
  kavlingId: string;
  overdueTotal: number;
  outstandingTotal: number;
  unpaidCount: number;
  nearestDueDate: string | null;
}

function normalizeJoinedKavling(
  value:
    | ResidentKavlingMapping["kavlings"]
    | ResidentKavlingMapping["kavlings"][]
    | null,
): ResidentKavlingMapping["kavlings"] {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function groupInvoicesByKavling(invoices: InvoiceRow[]): BillingKavlingGroup[] {
  const map = new Map<string, InvoiceRow[]>();

  for (const inv of invoices) {
    const kavling = normalizeOne(inv.kavlings);
    if (!kavling) continue;
    const key = kavling.code;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(inv);
  }

  const groups: BillingKavlingGroup[] = [];
  for (const [code, invs] of map.entries()) {
    const firstKavling = normalizeOne(invs[0]?.kavlings);
    const overdueTotal = invs
      .filter((i) => i.status === "overdue" || i.status === "unpaid")
      .reduce((sum, i) => sum + Math.max(i.amount_due - i.amount_paid, 0), 0);
    const outstandingTotal = invs.reduce(
      (sum, i) => sum + Math.max(i.amount_due - i.amount_paid, 0),
      0,
    );
    const unpaidCount = invs.filter((i) => i.status === "overdue" || i.status === "unpaid" || i.status === "partial").length;
    const unpaidInvoices = invs.filter((i) => i.status === "overdue" || i.status === "unpaid" || i.status === "partial");
    const nearestDueDate = unpaidInvoices.length > 0
      ? unpaidInvoices.reduce((nearest, inv) => {
          const invDate = new Date(inv.due_date);
          const nearestDate = nearest ? new Date(nearest) : null;
          return !nearestDate || invDate < nearestDate ? inv.due_date : nearest;
        }, unpaidInvoices[0].due_date)
      : null;

    groups.push({
      kavlingCode: code,
      block: firstKavling?.block ?? null,
      kavlingId: firstKavling?.id ?? "",
      overdueTotal,
      outstandingTotal,
      unpaidCount,
      nearestDueDate,
    });
  }

  return groups.sort((a, b) => a.kavlingCode.localeCompare(b.kavlingCode));
}

function BillingCardSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  );
}

function BillingCard({
  group,
}: {
  group: BillingKavlingGroup;
}) {
  const hasArrears = group.overdueTotal > 0;

  return (
    <Card className={`rounded-xl ${hasArrears ? "border-red-200" : "border-border"}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Kavling {group.kavlingCode}</p>
            {group.block && (
              <p className="text-xs text-muted-foreground">Blok {group.block}</p>
            )}
          </div>
          {hasArrears && (
            <Badge variant="destructive" className="text-xs">Tunggakan</Badge>
          )}
        </div>

        {hasArrears ? (
          <div className="space-y-1">
            <p
              className="text-2xl font-semibold text-red-600"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatRupiah(group.overdueTotal)}
            </p>
            <p className="text-sm text-red-600">
              {group.unpaidCount} tagihan belum dibayar
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p
              className="text-2xl font-semibold text-green-600"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatRupiah(group.outstandingTotal)}
            </p>
            <p className="text-sm text-green-600">
              {group.unpaidCount} tagihan aktif
            </p>
          </div>
        )}

        {group.nearestDueDate && (
          <p className="text-xs text-muted-foreground">
            Jatuh tempo: {formatDateId(group.nearestDueDate)}
          </p>
        )}

        <div className="pt-2">
          <Button asChild size="sm" variant="default">
            <Link href="/app/invoices">Lihat Tagihan</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
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

function AnnouncementPreviewCard({
  announcement,
}: {
  announcement: AnnouncementRow;
}) {
  return (
    <Card className="rounded-xl">
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
        <Button asChild size="sm" variant="outline" className="mt-1">
          <Link href="/app/announcements">Baca Pengumuman</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function AnnouncementHero({
  announcement,
}: {
  announcement: AnnouncementRow;
}) {
  return (
    <Card className="rounded-xl border-amber-200 bg-amber-50/50">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="warning" className="text-xs">Penting</Badge>
          <span className="text-xs text-amber-700">
            {formatDateId(announcement.published_at ?? announcement.created_at)}
          </span>
        </div>
        <p className="text-lg font-semibold text-foreground">{announcement.title}</p>
        <p className="text-sm text-foreground/80 line-clamp-3">{announcement.body}</p>
        <Button asChild size="default" variant="default">
          <Link href="/app/announcements">Baca Pengumuman</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EventPreviewCard({
  event,
}: {
  event: EventRow;
}) {
  const startDate = new Date(event.starts_at);
  const dayStr = String(startDate.getDate()).padStart(2, "0");
  const monthStr = startDate.toLocaleDateString("id-ID", { month: "short" });
  const yearNum = startDate.getFullYear();
  const timeStr = startDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center justify-center min-w-[48px] rounded-md border border-border bg-background px-2 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">{monthStr}</span>
            <span className="text-xl font-semibold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{dayStr}</span>
            <span className="text-xs text-muted-foreground">{yearNum}</span>
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-foreground line-clamp-1">{event.title}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span>{timeStr}</span>
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
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href="/app/events">Lihat Detail Acara</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EventPreviewCardSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-[60px] w-[48px] rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
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

function EmptyCard({
  heading,
  body,
}: {
  heading: string;
  body: string;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">{heading}</p>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

type ResidentQuickItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

function ResidentQuickTile({ item }: Readonly<{ item: ResidentQuickItem }>) {
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={cn("flex size-10 items-center justify-center rounded-xl", item.accent)}>
        <item.icon className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 leading-snug">{item.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
    </Link>
  );
}

export function ResidentHomePage() {
  const { profile } = useAuth();
  const client = getSupabaseBrowserClient();

  // Billing state
  const [linkedKavlings, setLinkedKavlings] = useState<ResidentKavlingMapping[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  // Events state
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    if (!client || !profile) return;

    setBillingLoading(true);
    setBillingError(null);

    try {
      const [mappingRes, invoiceRes] = await Promise.all([
        client
          .from("kavling_residents")
          .select("id, relation, is_primary, active, kavlings(id, code, block, active)")
          .eq("profile_id", profile.id)
          .eq("active", true)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
        client
          .from("invoices")
          .select("id, invoice_number, amount_due, amount_paid, due_date, status, kavlings(id, code, block)")
          .order("due_date", { ascending: true }),
      ]);

      if (mappingRes.error) {
        setBillingError(mappingRes.error.message);
        setBillingLoading(false);
        return;
      }

      const normalized = ((mappingRes.data ?? []) as Array<
        ResidentKavlingMapping & {
          kavlings:
            | ResidentKavlingMapping["kavlings"]
            | ResidentKavlingMapping["kavlings"][];
        }
      >).map((item) => ({
        ...item,
        kavlings: normalizeJoinedKavling(item.kavlings),
      }));

      setLinkedKavlings(normalized);

      if (invoiceRes.error) {
        setBillingError(invoiceRes.error.message);
        setBillingLoading(false);
        return;
      }

      setInvoices((invoiceRes.data ?? []) as unknown as InvoiceRow[]);
      setBillingLoading(false);
    } catch (err) {
      setBillingError("Gagal memuat data tagihan.");
      setBillingLoading(false);
    }
  }, [client, profile]);

  const loadAnnouncements = useCallback(async () => {
    if (!client) return;

    setAnnouncementsLoading(true);
    setAnnouncementsError(null);

    try {
      const { data, error } = await client
        .from("announcements")
        .select("id, title, body, is_urgent, is_pinned, published_at, created_at")
        .in("status", ["published", "archived"])
        .order("is_urgent", { ascending: false })
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });

      if (error) {
        setAnnouncementsError(error.message);
        setAnnouncementsLoading(false);
        return;
      }

      setAnnouncements((data ?? []) as AnnouncementRow[]);
      setAnnouncementsLoading(false);
    } catch (err) {
      setAnnouncementsError("Gagal memuat pengumuman.");
      setAnnouncementsLoading(false);
    }
  }, [client]);

  const loadEvents = useCallback(async () => {
    if (!client) return;

    setEventsLoading(true);
    setEventsError(null);

    try {
      const { data, error } = await client
        .from("events")
        .select("id, title, description, location, starts_at, ends_at, status")
        .order("starts_at", { ascending: true });

      if (error) {
        setEventsError(error.message);
        setEventsLoading(false);
        return;
      }

      // Only show upcoming events
      const now = new Date();
      const upcoming = (data ?? []).filter(
        (e: EventRow) => e.status === "scheduled" && new Date(e.starts_at) >= now,
      );
      setEvents(upcoming as EventRow[]);
      setEventsLoading(false);
    } catch (err) {
      setEventsError("Gagal memuat acara.");
      setEventsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!profile) return;
    loadBilling();
    loadAnnouncements();
    loadEvents();
  }, [profile, loadBilling, loadAnnouncements, loadEvents]);

  // Derive billing kavling groups from invoices
  const billingGroups = useMemo(() => {
    if (linkedKavlings.length === 0) return [];
    const kavlingIds = new Set(linkedKavlings.map((m) => m.kavlings?.id).filter(Boolean));
    const filteredInvoices = invoices.filter((inv) => {
      const kavling = normalizeOne(inv.kavlings);
      return kavling && kavlingIds.has(kavling.id);
    });
    return groupInvoicesByKavling(filteredInvoices);
  }, [linkedKavlings, invoices]);

// Derive urgent and latest announcements
  const urgentAnnouncement = useMemo(() => {
    return announcements.find((a) => a.status === "published" && a.is_urgent && a.is_pinned) ?? null;
  }, [announcements]);

  const nonUrgentPublished = useMemo(() => {
    return announcements.filter((a) => a.status === "published" && !a.is_urgent);
  }, [announcements]);

  const latestAnnouncements = useMemo(() => {
    if (urgentAnnouncement) {
      return nonUrgentPublished.slice(0, 2);
    }
    return nonUrgentPublished.slice(0, 2);
  }, [urgentAnnouncement, nonUrgentPublished]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => e.status === "scheduled" && new Date(e.starts_at) >= now)
      .slice(0, 3);
  }, [events]);

  const canAccessAdmin = profile?.role === "admin" || profile?.role === "super_admin" || profile?.role === "treasurer";

  const quickMenuItems: ResidentQuickItem[] = useMemo(() => {
    const items: ResidentQuickItem[] = [
      {
        title: "Tagihan",
        description: "Cek status, bayar, dan lihat riwayat",
        href: "/app/invoices",
        icon: ReceiptText,
        accent: "bg-emerald-100 text-emerald-700",
      },
      {
        title: "Pengumuman",
        description: "Informasi terkini dari pengurus",
        href: "/app/announcements",
        icon: Megaphone,
        accent: "bg-amber-100 text-amber-700",
      },
      {
        title: "Acara",
        description: "Kegiatan lingkungan mendatang",
        href: "/app/events",
        icon: Calendar,
        accent: "bg-fuchsia-100 text-fuchsia-700",
      },
      {
        title: "Pengaturan",
        description: "Profil, notifikasi, dan Telegram",
        href: "/app/settings",
        icon: Settings,
        accent: "bg-sky-100 text-sky-700",
      },
    ];

    if (canAccessAdmin) {
      items.push({
        title: "Panel Admin",
        description: "Kelola data, billing, dan laporan",
        href: "/admin",
        icon: Shield,
        accent: "bg-indigo-100 text-indigo-700",
      });
    }

    return items;
  }, [canAccessAdmin]);

  return (
    <section className="page-section">
      {/* Hero header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            {APP_NAME}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Selamat datang{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-slate-500">
            Pantau tagihan, baca pengumuman, dan ikuti acara lingkungan.
          </p>
        </div>
        <Badge variant={profile?.is_active ? "success" : "destructive"} className="mt-1">
          {profile?.is_active ? "Akun aktif" : "Akun nonaktif"}
        </Badge>
      </header>

      {/* Quick-access tiles */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {quickMenuItems.map((item) => (
          <ResidentQuickTile key={item.href} item={item} />
        ))}
      </div>

      {/* Section 1: Ringkasan Tagihan */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Ringkasan Tagihan</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Status pembayaran periode aktif</p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href="/app/invoices">
              Semua <RefreshCw className="size-3.5" />
            </Link>
          </Button>
        </div>

        {billingLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <BillingCardSkeleton />
            <BillingCardSkeleton />
            <BillingCardSkeleton />
          </div>
        ) : billingError ? (
          <ErrorCard message={billingError} onRetry={loadBilling} />
        ) : billingGroups.length === 0 ? (
          <EmptyCard
            heading="Belum ada tagihan"
            body="Tagihan Anda akan muncul di sini setelah diterbitkan oleh pengurus."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {billingGroups.map((group) => (
              <BillingCard key={group.kavlingId} group={group} />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Pengumuman Hero (if urgent) + Pengumuman Terbaru */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Pengumuman Terbaru</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Informasi dan himbauan dari pengurus lingkungan</p>
        </div>

        {announcementsLoading ? (
          <div className="space-y-3">
            <AnnouncementHeroSkeleton />
          </div>
        ) : announcementsError ? (
          <ErrorCard message={announcementsError} onRetry={loadAnnouncements} />
        ) : urgentAnnouncement ? (
          <div className="space-y-3">
            <AnnouncementHero announcement={urgentAnnouncement} />
            {latestAnnouncements.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {latestAnnouncements.map((a) => (
                  <AnnouncementPreviewCard key={a.id} announcement={a} />
                ))}
              </div>
            )}
          </div>
        ) : latestAnnouncements.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {latestAnnouncements.map((a) => (
              <AnnouncementPreviewCard key={a.id} announcement={a} />
            ))}
          </div>
        ) : (
          <EmptyCard
            heading="Belum ada pengumuman"
            body="Pengumuman warga akan muncul di sini setelah dipublikasikan pengurus."
          />
        )}
      </section>

      {/* Section 3: Acara Mendatang */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Acara Mendatang</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Kegiatan warga yang akan datang</p>
        </div>

        {eventsLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <EventPreviewCardSkeleton />
            <EventPreviewCardSkeleton />
            <EventPreviewCardSkeleton />
          </div>
        ) : eventsError ? (
          <ErrorCard message={eventsError} onRetry={loadEvents} />
        ) : upcomingEvents.length === 0 ? (
          <EmptyCard
            heading="Belum ada acara mendatang"
            body="Jika ada kegiatan warga baru, informasinya akan tampil di sini."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventPreviewCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}