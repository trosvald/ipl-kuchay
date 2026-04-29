"use client";

import { Bell, Home, LogOut, UserRound } from "lucide-react";

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

export function ResidentHomePage() {
  const { profile, signOut } = useAuth();

  const handleSignOut = () => {
    signOut().catch(() => undefined);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Portal Warga
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">{APP_NAME}</h1>
        </div>
        <Button variant="secondary" onClick={handleSignOut}>
          <LogOut className="size-4" /> Keluar
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-slate-600" />
              Halo, {profile?.display_name ?? profile?.full_name}
            </CardTitle>
            <CardDescription>
              Data kavling, tagihan, dan pembayaran akan dihubungkan penuh pada
              milestone berikutnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
              <p className="mt-2 font-semibold text-slate-900">{profile?.role ?? "resident"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-2">
                <Badge variant={profile?.is_active ? "success" : "default"}>
                  {profile?.is_active ? "Aktif" : "Nonaktif"}
                </Badge>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="size-4 text-slate-600" />
              Ringkasan Cepat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p className="rounded-lg border border-slate-200 p-3">Tagihan terbuka: segera hadir.</p>
            <p className="rounded-lg border border-slate-200 p-3">Status Telegram: siap diaktifkan milestone M08.</p>
            <Button variant="ghost" className="w-full justify-start" disabled>
              <Home className="size-4" /> Detail kavling menyusul
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
