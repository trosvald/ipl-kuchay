import Link from "next/link";
import { ArrowRight, Building2, ChartNoAxesColumn, Lock, MessageSquare, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

const features = [
  {
    icon: Wallet,
    title: "Kas & Iuran Lebih Rapi",
    description: "Pengurus mencatat pemasukan dan pengeluaran dalam satu alur kerja yang jelas.",
  },
  {
    icon: Building2,
    title: "Data Kavling Terkelola",
    description: "Kavling dan warga terhubung dengan akses per pengguna berbasis role.",
  },
  {
    icon: MessageSquare,
    title: "Komunikasi Terarah",
    description: "Notifikasi dan status pembayaran disampaikan lebih transparan ke warga.",
  },
] as const;

const portalBenefits = [
  "Akses via browser HP tanpa instalasi",
  "RLS untuk batasi data antar warga",
  "Jejak audit untuk aksi penting admin",
  "Siap lanjut ke modul tagihan & pembayaran",
] as const;

export function PublicDashboardPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.09),transparent_35%)]" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Badge variant="outline" className="mb-4">
              Portal Warga Publik
            </Badge>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Administrasi IPL lebih rapi, cepat, dan transparan
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              {APP_NAME} membantu pengurus dan warga memantau data kavling, iuran, dan proses pembayaran
              dalam satu sistem yang jelas alurnya.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-10 px-5">
                <Link href="/login">
                  Masuk ke User Portal <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-10 px-5">
                <Link href="/app">Lihat Demo User Portal</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
            <p className="mb-4 text-sm font-semibold text-foreground">Sekilas Status Layanan</p>
            <div className="space-y-3">
              <div className="rounded-xl border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode Publik</p>
                <p className="mt-1 text-sm font-semibold">Aman & ringkas</p>
              </div>
              <div className="rounded-xl border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Akses Internal</p>
                <p className="mt-1 text-sm font-semibold">User Portal + Admin Panel</p>
              </div>
              <div className="rounded-xl border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Fondasi Keamanan</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold">
                  <Lock className="size-4 text-muted-foreground" /> RLS aktif
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mb-8 flex items-center gap-2">
          <ChartNoAxesColumn className="size-5 text-muted-foreground" />
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Kenapa pakai platform ini</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((item) => (
            <article key={item.title} className="rounded-xl border bg-card p-5">
              <item.icon className="mb-3 size-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Siap dipakai warga & pengurus</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {portalBenefits.map((item) => (
              <div key={item} className="rounded-lg border bg-background px-4 py-3 text-sm text-foreground">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 text-center md:px-6 md:py-20">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Mulai kelola IPL dengan alur yang jelas</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Gunakan User Portal untuk warga dan Admin Panel untuk pengurus dalam satu sistem terpadu.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild size="lg" className="h-10 px-5">
            <Link href="/login">Masuk Sekarang</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-10 px-5">
            <Link href="/admin">Buka Admin Panel</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
