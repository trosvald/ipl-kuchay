"use client";

import { type ReactNode, useEffect } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "./authHooks";

function AuthGate({
  title,
  description,
  loading,
}: Readonly<{ title: string; description: string; loading?: boolean }>) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center px-4 py-10">
      <Card className="w-full max-w-xl border-slate-200 bg-white/90 shadow-xl backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-slate-900">
            <span className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
            </span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">{description}</CardContent>
      </Card>
    </main>
  );
}

export function RequireAuth({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!session) {
      const target = `/login?from=${encodeURIComponent(pathname || "/app")}`;
      router.replace(target);
      return;
    }

    if (profile && !profile.is_active) {
      const target = `/login?reason=inactive_profile&from=${encodeURIComponent(pathname || "/app")}`;
      router.replace(target);
    }
  }, [loading, pathname, profile, router, session]);

  if (loading) {
    return (
      <AuthGate
        title="Memuat sesi"
        description="Sedang memeriksa sesi login Anda."
        loading
      />
    );
  }

  if (!session) {
    return (
      <AuthGate
        title="Perlu autentikasi"
        description="Anda diarahkan ke halaman login."
      />
    );
  }

  if (!profile) {
    return (
      <AuthGate
        title="Profil belum siap"
        description="Akun Anda sudah login, tetapi profil belum tersedia. Hubungi admin jika kondisi ini berlanjut."
      />
    );
  }

  if (!profile.is_active) {
    return (
      <AuthGate
        title="Akun nonaktif"
        description="Profil Anda nonaktif. Hubungi pengurus untuk aktivasi ulang akun."
      />
    );
  }

  return <>{children}</>;
}
