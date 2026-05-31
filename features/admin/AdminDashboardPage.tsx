"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BellRing,
  Building2,
  Calendar,
  ClipboardCheck,
  FileSpreadsheet,
  Megaphone,
  ReceiptText,
  Send,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/features/layout/PageHeader";
import { useAuth } from "../auth/authHooks";

type AdminMenuItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

function AdminMenuTile({ item, featured = false }: Readonly<{ item: AdminMenuItem; featured?: boolean }>) {
  return (
    <Link
      href={item.href}
      className={[
        "group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md",
        featured ? "bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 text-white ring-0" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "flex size-11 items-center justify-center rounded-2xl",
            featured ? "bg-white/15 text-white" : item.accent,
          ].join(" ")}
        >
          <item.icon className="size-5" />
        </div>
        <ArrowRight className={featured ? "size-4 text-white/80" : "size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700"} />
      </div>

      <div className="mt-4 space-y-1">
        <p className={featured ? "text-base font-semibold tracking-tight text-white" : "text-base font-semibold tracking-tight text-slate-900"}>
          {item.title}
        </p>
        <p className={featured ? "text-sm text-white/85" : "text-sm text-slate-500"}>{item.description}</p>
      </div>
    </Link>
  );
}

function AdminMenuSection({
  title,
  description,
  items,
}: Readonly<{
  title: string;
  description: string;
  items: AdminMenuItem[];
}>) {
  return (
    <Card className="rounded-3xl border-0 bg-white shadow-sm ring-1 ring-slate-200">
      <CardHeader className="space-y-2 px-5 pt-5">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</CardTitle>
        <CardDescription className="text-sm text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <AdminMenuTile key={item.href} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const isTreasurer = role === "treasurer";
  const canManageCommunication = role === "admin" || role === "super_admin";

  const featuredItem: AdminMenuItem = isTreasurer
    ? {
        title: "Verifikasi Pembayaran",
        description: "Cek bukti transfer dan lanjutkan approval lebih cepat.",
        href: "/admin/submissions",
        icon: ClipboardCheck,
        accent: "bg-indigo-100 text-indigo-700",
      }
    : {
        title: "Tagihan & Periode",
        description: "Kelola periode billing, terbitkan tagihan, dan pantau progres.",
        href: "/admin/billing",
        icon: Wallet,
        accent: "bg-indigo-100 text-indigo-700",
      };

  const operationalItems: AdminMenuItem[] = [
    {
      title: "Verifikasi Pembayaran",
      description: "Lihat bukti transfer dan tindak lanjuti submission.",
      href: "/admin/submissions",
      icon: ClipboardCheck,
      accent: "bg-amber-100 text-amber-700",
    },
    {
      title: "Tagihan & Periode",
      description: "Buat periode, pratinjau, dan kelola penagihan warga.",
      href: "/admin/billing",
      icon: Wallet,
      accent: "bg-indigo-100 text-indigo-700",
    },
    {
      title: "Data Warga",
      description: "Kelola akun penghuni, role, dan mapping kavling.",
      href: "/admin/residents",
      icon: Users,
      accent: "bg-sky-100 text-sky-700",
    },
    {
      title: "Data Kavling",
      description: "Atur blok, nomor, dan status kavling aktif.",
      href: "/admin/kavlings",
      icon: Building2,
      accent: "bg-emerald-100 text-emerald-700",
    },
  ];

  const communicationItems: AdminMenuItem[] = [
    {
      title: "Pengumuman",
      description: "Buat informasi penting dan publikasi ke warga.",
      href: "/admin/announcements",
      icon: Megaphone,
      accent: "bg-rose-100 text-rose-700",
    },
    {
      title: "Acara",
      description: "Kelola kegiatan lingkungan dan RSVP warga.",
      href: "/admin/events",
      icon: Calendar,
      accent: "bg-fuchsia-100 text-fuchsia-700",
    },
  ];

  const reportingItems: AdminMenuItem[] = [
    {
      title: "Laporan Keuangan",
      description: "Pantau ringkasan pembayaran, tunggakan, dan ekspor laporan.",
      href: "/admin/reports",
      icon: ReceiptText,
      accent: "bg-violet-100 text-violet-700",
    },
    {
      title: "Audit Log",
      description: "Lihat jejak perubahan operasional dan aktivitas admin.",
      href: "/admin/audit",
      icon: ShieldCheck,
      accent: "bg-slate-200 text-slate-700",
    },
  ];

  const configurationItems: AdminMenuItem[] = [
    {
      title: "Pengaturan Biaya",
      description: "Atur jenis iuran, override, dan konfigurasi biaya.",
      href: "/admin/settings",
      icon: Settings2,
      accent: "bg-cyan-100 text-cyan-700",
    },
    {
      title: "Impor Data",
      description: "Unggah data massal untuk kavling, mapping, dan override.",
      href: "/admin/imports",
      icon: FileSpreadsheet,
      accent: "bg-lime-100 text-lime-700",
    },
    {
      title: "Notifikasi Telegram",
      description: "Kelola template pesan dan riwayat pengiriman bot.",
      href: "/admin/telegram",
      icon: Send,
      accent: "bg-blue-100 text-blue-700",
    },
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Menu Admin"
        subtitle="Pilih area kerja utama untuk melanjutkan operasional harian lebih cepat."
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <AdminMenuTile item={featuredItem} featured />

        <Card className="rounded-3xl border-0 bg-white shadow-sm ring-1 ring-slate-200">
          <CardHeader className="space-y-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Butuh tindakan</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Fokuskan akses cepat ke alur yang paling sering dipakai hari ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 text-sm text-slate-600">
            <Link
              href="/admin/submissions?tab=pending"
              className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 text-amber-900 transition-colors hover:bg-amber-100"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <BellRing className="size-4" />
                </div>
                <div>
                  <p className="font-semibold">Submission pending</p>
                  <p className="text-xs text-amber-800/80">Cek bukti transfer yang menunggu verifikasi.</p>
                </div>
              </div>
              <ArrowRight className="size-4" />
            </Link>

            <Link
              href="/admin/reports"
              className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-slate-900 transition-colors hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-white text-violet-700 ring-1 ring-slate-200">
                  <ReceiptText className="size-4" />
                </div>
                <div>
                  <p className="font-semibold">Laporan & tunggakan</p>
                  <p className="text-xs text-slate-500">Pantau koleksi pembayaran dan sisa tagihan.</p>
                </div>
              </div>
              <ArrowRight className="size-4 text-slate-400" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <AdminMenuSection
        title="Operasional"
        description="Akses utama untuk pembayaran, billing, data warga, dan data kavling."
        items={operationalItems}
      />

      {canManageCommunication ? (
        <AdminMenuSection
          title="Komunikasi"
          description="Publikasikan informasi lingkungan dan kelola kegiatan warga."
          items={communicationItems}
        />
      ) : null}

      <AdminMenuSection
        title="Laporan & Audit"
        description="Lacak performa pembayaran dan histori perubahan operasional."
        items={reportingItems}
      />

      {!isTreasurer ? (
        <AdminMenuSection
          title="Konfigurasi"
          description="Atur biaya, impor data massal, dan pengiriman notifikasi Telegram."
          items={configurationItems}
        />
      ) : null}
    </section>
  );
}
