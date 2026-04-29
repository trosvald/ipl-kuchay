import Link from "next/link";
import {
  BanknoteArrowDown,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  LayoutGrid,
  MessageSquareShare,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/constants";
import { formatDateId, formatRupiah } from "@/lib/format";

const residentActions = [
  {
    icon: ReceiptText,
    title: "Lihat tagihan periode aktif",
    helper: "Status: unpaid, partial, pending, paid",
  },
  {
    icon: BanknoteArrowDown,
    title: "Bayar via transfer bank",
    helper: "Upload bukti transfer secara aman",
  },
  {
    icon: BellRing,
    title: "Pantau notifikasi pembayaran",
    helper: "Status verifikasi tercatat jelas",
  },
] as const;

const paymentSteps = [
  "Cek total tagihan pada periode berjalan.",
  "Transfer ke rekening resmi pengurus.",
  "Kirim bukti pembayaran untuk diverifikasi.",
  "Pantau status hingga lunas dan tercatat.",
] as const;

export function PublicDashboardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 md:py-10">
      <section className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/30 shadow-xl">
          <CardHeader className="pb-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="rounded-md" variant="default">
                <LayoutGrid className="mr-1 size-3.5" /> Portal IPL Jatiloka
              </Badge>
              <Badge variant="success">Resident-first</Badge>
            </div>
            <CardTitle className="text-3xl leading-tight md:text-5xl">{APP_NAME}</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-relaxed md:text-lg">
              Dashboard transparansi iuran warga dengan alur pembayaran yang jelas,
              verifikasi terkontrol, dan siap digunakan nyaman di mobile maupun desktop.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white/90 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Periode aktif</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">April 2026</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Pembaruan</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateId(new Date())}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Mode publik</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Aggregate aman</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg" className="h-11 min-w-52">
                <Link href="/login">Masuk untuk lihat tagihan saya</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="h-11 min-w-52">
                <Link href="/app">Buka portal warga</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/95 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="size-5 text-slate-600" />
              Ringkasan Bulan Ini
            </CardTitle>
            <CardDescription>Informasi kunci untuk keputusan cepat warga.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Nominal iuran contoh</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{formatRupiah(350000)}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>Kepatuhan pembayaran</span>
                <span>92%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 w-[92%] rounded-full bg-emerald-600" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Status layanan</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-slate-900">
                <ShieldCheck className="size-4 text-emerald-600" />
                Verifikasi admin aktif
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Yang Bisa Warga Lakukan</CardTitle>
            <CardDescription>Fokus alur resident portal dalam satu halaman.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {residentActions.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 p-3">
                <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <item.icon className="size-4 text-slate-600" />
                  {item.title}
                </p>
                <p className="text-sm text-slate-600">{item.helper}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <WalletCards className="size-5 text-slate-600" />
              Cara Bayar IPL
            </CardTitle>
            <CardDescription>Proses sederhana untuk meminimalkan kesalahan pembayaran.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {paymentSteps.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <p className="text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="size-5 text-slate-600" />
              Verifikasi dan Transparansi
            </CardTitle>
            <CardDescription>Semua langkah terekam untuk akuntabilitas pengurus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p className="rounded-lg border border-slate-200 p-3">
              <span className="mb-1 inline-flex items-center gap-2 font-semibold text-slate-900">
                <FileCheck2 className="size-4 text-slate-600" />
                Pemeriksaan bukti
              </span>
              <br />
              Bukti transfer diverifikasi admin sebelum status invoice berubah.
            </p>
            <p className="rounded-lg border border-slate-200 p-3">
              <span className="mb-1 inline-flex items-center gap-2 font-semibold text-slate-900">
                <MessageSquareShare className="size-4 text-slate-600" />
                Riwayat jelas
              </span>
              <br />
              Setiap perubahan status pembayaran punya jejak audit.
            </p>
            <Separator />
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/login">Masuk untuk uji role-based route guard</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Kavling Tercakup", value: "34 unit" },
          { label: "Status Pembayaran", value: "Live" },
          { label: "Model Akses", value: "Role-based" },
          { label: "Keamanan Data", value: "RLS + private proofs" },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wide">
                {item.label}
              </CardDescription>
              <CardTitle className="text-lg">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
