"use client";

import { type ReactNode, useEffect } from "react";
import { ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequireAuth } from "./RequireAuth";
import { useIsAdminLike } from "./authHooks";

function AdminGate({ children }: Readonly<{ children: ReactNode }>) {
  const isAdminLike = useIsAdminLike();
  const router = useRouter();

  useEffect(() => {
    if (!isAdminLike) {
      router.replace("/app");
    }
  }, [isAdminLike, router]);

  if (!isAdminLike) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center px-4 py-10">
        <Card className="w-full max-w-xl border-slate-200 bg-white/90 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-slate-900">
              <span className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
                <ShieldX className="size-4" />
              </span>
              <span>Akses admin diperlukan</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Akun Anda tidak memiliki izin ke area admin.
          </CardContent>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}

export function RequireAdminLike({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <RequireAuth>
      <AdminGate>{children}</AdminGate>
    </RequireAuth>
  );
}
