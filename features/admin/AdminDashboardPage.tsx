"use client";

import { LayoutDashboard, ShieldCheck, Users, Wallet, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { useAuth } from "../auth/authHooks";

export function AdminDashboardPage() {
  const { profile, signOut } = useAuth();

  const handleSignOut = () => {
    signOut().catch(() => undefined);
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Admin Console
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">{APP_NAME}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">{profile?.role}</Badge>
          <Button variant="secondary" onClick={handleSignOut}>
            <LogOut className="size-4" /> Keluar
          </Button>
        </div>
      </header>

      <section className="mb-4 grid gap-4 md:grid-cols-4">
        {[
          { title: "Residents", value: "Ready", icon: Users },
          { title: "Kavlings", value: "Ready", icon: LayoutDashboard },
          { title: "Billing", value: "In Progress", icon: Wallet },
          { title: "Security", value: "RLS Active", icon: ShieldCheck },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wide">
                <item.icon className="size-4" /> {item.title}
              </CardDescription>
              <CardTitle className="text-xl">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
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
            <CardTitle>Roadmap Admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p className="rounded-lg border border-slate-200 p-3">M03: Kavling & Resident Management</p>
            <p className="rounded-lg border border-slate-200 p-3">M04: Billing & Invoice Generation</p>
            <p className="rounded-lg border border-slate-200 p-3">M06: Verification + Audit Workflow</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
