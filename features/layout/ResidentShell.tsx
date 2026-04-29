"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Home, ReceiptText, Settings, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/authHooks";

export function ResidentShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-foreground">User Portal</p>
            <p className="hidden text-xs text-muted-foreground md:block">
              {profile?.display_name ?? profile?.full_name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pathname === "/app" ? null : (
              <Button asChild variant="secondary" size="sm">
                <Link href="/app">
                  <ArrowLeft className="size-4" /> Kembali
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/invoices">
                <ReceiptText className="size-4" /> Invoice
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/settings">
                <Settings className="size-4" /> Pengaturan
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <Home className="size-4" /> Publik
              </Link>
            </Button>
            {profile?.role === "admin" || profile?.role === "super_admin" || profile?.role === "treasurer" ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin">
                  <Shield className="size-4" /> Admin
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        {children}
      </div>
    </div>
  );
}
