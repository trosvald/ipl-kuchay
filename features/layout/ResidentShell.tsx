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
import { APP_NAME } from "@/lib/constants";
import { useAuth } from "@/features/auth/authHooks";
import { cn } from "@/lib/utils";

interface ResidentNavItem {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
}

const primaryNavItems: ResidentNavItem[] = [
  {
    href: "/app",
    label: "Beranda",
    shortLabel: "Beranda",
    description: "Ringkasan tagihan, pengumuman, dan acara",
    icon: Home,
    match: (pathname) => pathname === "/app",
  },
  {
    href: "/app/invoices",
    label: "Tagihan",
    shortLabel: "Tagihan",
    description: "Cek status tagihan dan riwayat pembayaran",
    icon: ReceiptText,
    match: (pathname) => pathname.startsWith("/app/invoices"),
  },
  {
    href: "/app/announcements",
    label: "Pengumuman",
    shortLabel: "Info",
    description: "Informasi terkini dari pengurus lingkungan",
    icon: Megaphone,
    match: (pathname) => pathname.startsWith("/app/announcements"),
  },
  {
    href: "/app/events",
    label: "Acara",
    shortLabel: "Acara",
    description: "Kegiatan dan agenda warga mendatang",
    icon: Calendar,
    match: (pathname) => pathname.startsWith("/app/events"),
  },
  {
    href: "/app/settings",
    label: "Pengaturan",
    shortLabel: "Setelan",
    description: "Profil, notifikasi, dan koneksi Telegram",
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
        <div className="mx-auto hidden w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 md:flex md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Home className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">{APP_NAME}</p>
              <p className="truncate text-sm font-bold text-foreground leading-tight">{pageTitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-2 hidden text-xs text-muted-foreground lg:inline">{profile?.display_name ?? profile?.full_name}</span>
            {pathname === "/app" ? null : (
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href="/app">
                  <ArrowLeft className="size-3.5" /> Beranda
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/app/invoices">
                <ReceiptText className="size-3.5" /> Tagihan
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/app/announcements">
                <Megaphone className="size-3.5" /> Info
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/app/events">
                <Calendar className="size-3.5" /> Acara
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/app/settings">
                <Settings className="size-3.5" /> Setelan
              </Link>
            </Button>
            {canAccessAdmin ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5 border-slate-300">
                <Link href="/admin">
                  <Shield className="size-3.5" /> Admin
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleSignOut}>
              <LogOut className="size-3.5" /> Keluar
            </Button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
              <Home className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">Portal Warga</p>
              <p className="truncate text-sm font-bold text-foreground leading-tight">{pageTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {pathname === "/app" ? null : (
              <Button asChild variant="ghost" size="icon-sm" aria-label="Kembali ke beranda warga">
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Menu utama</p>
                <div className="grid gap-1">
                  {primaryNavItems.map((item) => {
                    const active = item.match(pathname);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl px-3 py-3 transition-colors",
                          active
                            ? "bg-emerald-50 text-emerald-900"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl",
                            active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <item.icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug">{item.label}</p>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{item.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {canAccessAdmin ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lainnya</p>
                  <div className="grid gap-1">
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-start gap-3 rounded-xl px-3 py-3 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Shield className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">Panel Admin</p>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">Kelola data, billing, komunikasi, dan laporan</p>
                      </div>
                    </Link>
                  </div>
                </div>
              ) : null}
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
        <div className="grid grid-cols-5 items-stretch px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
          {primaryNavItems.map((item) => {
            const active = item.match(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center text-[10px] font-medium transition-colors",
                  active
                    ? "bg-emerald-100 text-emerald-800"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className={cn("size-4", active ? "text-emerald-700" : "")} />
                <span className="leading-tight">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
