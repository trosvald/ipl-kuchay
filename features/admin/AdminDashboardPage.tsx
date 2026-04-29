"use client";

import { Building2, LayoutDashboard, ReceiptText, ShieldCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "../auth/authHooks";

export function AdminDashboardPage() {
  const { profile } = useAuth();

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <span>Role aktif:</span> <Badge variant="success">{profile?.role}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
          {[
            { title: "Residents", value: "Ready", icon: Users },
            { title: "Kavlings", value: "Ready", icon: LayoutDashboard },
            { title: "Billing", value: "Ready", icon: Wallet },
            { title: "Security", value: "RLS Active", icon: ShieldCheck },
          ].map((item) => (
          <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <item.icon className="size-4" /> {item.title}
            </p>
            <p className="text-lg font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Admin</CardTitle>
            <CardDescription>
              Akses admin berhasil diverifikasi. Modul manajemen lengkap dilanjutkan
              pada milestone berikutnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p className="rounded-lg border border-slate-200 p-3">
              Pengguna aktif: <strong className="text-slate-900">{profile?.display_name ?? profile?.full_name}</strong>
            </p>
            <p className="rounded-lg border border-slate-200 p-3">
              Role saat ini: <strong className="text-slate-900">{profile?.role}</strong>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Menu Admin</CardTitle>
            <CardDescription>Akses cepat ke layanan utama pengurus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-between">
              <Link href="/admin/kavlings">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="size-4" />
                  Kelola Kavling
                </span>
                <Badge variant="secondary">Aktif</Badge>
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full justify-between">
              <Link href="/admin/residents">
                <span className="inline-flex items-center gap-2">
                  <Users className="size-4" />
                  Kelola Warga
                </span>
                <Badge variant="secondary">Aktif</Badge>
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full justify-between">
              <Link href="/admin/settings">
                <span className="inline-flex items-center gap-2">
                  <ReceiptText className="size-4" />
                  Pengaturan Biaya
                </span>
                <Badge variant="secondary">Aktif</Badge>
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full justify-between">
              <Link href="/admin/billing">
                <span className="inline-flex items-center gap-2">
                  <Wallet className="size-4" />
                  Billing & Tagihan
                </span>
                <Badge variant="secondary">Aktif</Badge>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
