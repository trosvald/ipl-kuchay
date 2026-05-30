"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Home,
  LogOut,
  Megaphone,
  Menu,
  ReceiptText,
  Settings,
  Shield,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/authHooks";
import { cn } from "@/lib/utils";

interface ResidentNavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
}

const primaryNavItems: ResidentNavItem[] = [
  {
    href: "/app",
    label: "Beranda",
    shortLabel: "Beranda",
    icon: Home,
    match: (pathname) => pathname === "/app",
  },
  {
    href: "/app/invoices",
    label: "Invoice",
    shortLabel: "Invoice",
    icon: ReceiptText,
    match: (pathname) => pathname.startsWith("/app/invoices"),
  },
  {
    href: "/app/announcements",
    label: "Pengumuman",
    shortLabel: "Info",
    icon: Megaphone,
    match: (pathname) => pathname.startsWith("/app/announcements"),
  },
  {
    href: "/app/events",
    label: "Acara",
    shortLabel: "Acara",
    icon: Calendar,
    match: (pathname) => pathname.startsWith("/app/events"),
  },
  {
    href: "/app/settings",
    label: "Pengaturan",
    shortLabel: "Setelan",
    icon: Settings,
    match: (pathname) => pathname.startsWith("/app/settings"),
  },
];

export function ResidentShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle = useMemo(() => {
    const matched = primaryNavItems.find((item) => item.match(pathname));
    return matched?.label ?? "Portal Warga";
  }, [pathname]);

  const canAccessAdmin = profile?.role === "admin" || profile?.role === "super_admin" || profile?.role === "treasurer";

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto hidden w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 md:flex md:px-6">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-foreground">User Portal</p>
            <p className="hidden text-xs text-muted-foreground lg:block">{profile?.display_name ?? profile?.full_name}</p>
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
              <Link href="/app/announcements">
                <Megaphone className="size-4" /> Pengumuman
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/events">
                <Calendar className="size-4" /> Acara
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/settings">
                <Settings className="size-4" /> Pengaturan
              </Link>
            </Button>
            {canAccessAdmin ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin">
                  <Shield className="size-4" /> Admin
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" /> Keluar
            </Button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:hidden">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portal Warga</p>
            <p className="truncate text-sm font-semibold text-foreground">{pageTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {pathname === "/app" ? null : (
              <Button asChild variant="secondary" size="icon-sm" aria-label="Kembali ke beranda warga">
                <Link href="/app">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={mobileMenuOpen ? "Tutup menu warga" : "Buka menu warga"}
              onClick={() => setMobileMenuOpen((value) => !value)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Tutup menu warga"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-l bg-background shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{profile?.display_name ?? profile?.full_name ?? "Warga"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Akses cepat portal warga</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Tutup menu" onClick={() => setMobileMenuOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Navigasi utama</p>
                <div className="grid gap-2">
                  {primaryNavItems.map((item) => {
                    const active = item.match(pathname);

                    return (
                      <Button key={item.href} asChild variant={active ? "default" : "ghost"} className="h-11 justify-start">
                        <Link href={item.href} onClick={() => setMobileMenuOpen(false)}>
                          <item.icon className="size-4" />
                          {item.label}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lainnya</p>
                <div className="grid gap-2">
                  {canAccessAdmin ? (
                    <Button asChild variant="ghost" className="h-11 justify-start">
                      <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                        <Shield className="size-4" /> Admin
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-t px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button variant="outline" className="h-11 w-full justify-start" onClick={handleSignOut}>
                <LogOut className="size-4" /> Keluar
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden" aria-label="Navigasi utama warga">
        <div className="grid grid-cols-5 gap-1 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {primaryNavItems.map((item) => {
            const active = item.match(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
