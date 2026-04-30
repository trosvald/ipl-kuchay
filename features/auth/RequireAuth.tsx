"use client";

import { type ReactNode, useEffect, useState } from "react";
import { LoaderCircle, ShieldAlert, X } from "lucide-react";
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
  const { session, profile, accessState, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showLimitedToast, setShowLimitedToast] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!session) {
      const target = `/login?from=${encodeURIComponent(pathname || "/app")}`;
      router.replace(target);
      return;
    }

  }, [loading, pathname, router, session]);

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

  if (accessState === "missing-profile" || !profile) {
    return (
      <AuthGate
        title="Profil belum siap"
        description="Akun Anda sudah login, tetapi profil belum tersedia. Hubungi admin jika kondisi ini berlanjut."
      />
    );
  }

  if (accessState === "inactive") {
    return (
      <AuthGate
        title="Akun nonaktif"
        description="Akun Anda berhasil masuk, tetapi status profil saat ini nonaktif. Hubungi pengurus untuk aktivasi ulang sebelum mengakses layanan warga."
      />
    );
  }

  if (accessState === "active-unmapped") {
    return (
      <>
        {showLimitedToast ? (
          <div className="pointer-events-none fixed right-4 top-20 z-50 w-[min(92vw,420px)]">
            <div className="pointer-events-auto rounded-xl border border-amber-200 bg-amber-50/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-amber-950">Profil aktif, pemetaan kavling sedang diproses</p>
                  <p className="mt-1 text-xs text-amber-900">
                    Anda tetap bisa memakai portal terbatas (profil dan pengaturan) sambil menunggu pengurus.
                  </p>
                </div>
                <button
                  aria-label="Tutup notifikasi"
                  className="rounded-md p-1 text-amber-900 transition hover:bg-amber-100"
                  onClick={() => setShowLimitedToast(false)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {children}
      </>
    );
  }

  return <>{children}</>;
}
