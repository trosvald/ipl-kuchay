"use client";

import { type ReactNode, useEffect } from "react";
import { ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequireAuth } from "./RequireAuth";
import { useIsOperatorRole } from "./authHooks";

function OperatorGate({ children }: Readonly<{ children: ReactNode }>) {
  const isOperator = useIsOperatorRole();
  const router = useRouter();

  useEffect(() => {
    if (!isOperator) {
      router.replace("/admin");
    }
  }, [isOperator, router]);

  if (!isOperator) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center px-4 py-10">
        <Card className="w-full max-w-xl border-slate-200 bg-white/90 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-slate-900">
              <span className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
                <ShieldX className="size-4" />
              </span>
              <span>Akses operator diperlukan</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Area ini hanya untuk akun admin dan super_admin.
          </CardContent>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}

export function RequireOperatorRole({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <RequireAuth>
      <OperatorGate>{children}</OperatorGate>
    </RequireAuth>
  );
}
