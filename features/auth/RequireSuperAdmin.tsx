"use client";

import { type ReactNode, useEffect } from "react";
import { Crown } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequireAuth } from "./RequireAuth";
import { useIsSuperAdmin } from "./authHooks";

function SuperAdminGate({ children }: Readonly<{ children: ReactNode }>) {
  const isSuperAdmin = useIsSuperAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) {
      router.replace("/admin");
    }
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center px-4 py-10">
        <Card className="w-full max-w-xl border-slate-200 bg-white/90 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-slate-900">
              <span className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
                <Crown className="size-4" />
              </span>
              <span>Super admin diperlukan</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Halaman ini hanya untuk super admin.
          </CardContent>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}

export function RequireSuperAdmin({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <RequireAuth>
      <SuperAdminGate>{children}</SuperAdminGate>
    </RequireAuth>
  );
}
