"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Home, LogOut, Menu, Shield, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/authHooks";
import { getAdminNavigationByRole } from "@/features/layout/adminNavigation";

export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { profile, role, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navGroups = useMemo(() => getAdminNavigationByRole(role), [role]);

  const isNavItemActive = useCallback(
    (href: string) => pathname === href || (href !== "/admin" && href !== "/app" && pathname.startsWith(`${href}/`)),
    [pathname],
  );

  const currentPageTitle = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isNavItemActive(item.href)) {
          return item.title;
        }
      }
    }
    return "Admin";
  }, [isNavItemActive, navGroups]);

  const handleSignOut = () => {
    signOut().catch(() => undefined);
  };

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const navLinkClass = useCallback(
    (active: boolean, collapsed: boolean) =>
      cn(
        "flex items-center rounded-lg text-sm font-medium transition-all duration-150",
        active
          ? "bg-indigo-600/15 text-indigo-300 shadow-sm"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
        collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2.5",
      ),
    [],
  );

  const navLinkIconClass = useCallback(
    (active: boolean) =>
      cn("size-4.5 shrink-0", active ? "text-indigo-300" : "text-slate-500"),
    [],
  );

  const navLinkTitleClass = (active: boolean) =>
    cn("truncate font-medium", active ? "text-indigo-200" : "text-slate-200");

  const navContent = (
    <>
      {/* Logo area */}
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Shield className="size-4.5" />
          </div>
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white tracking-tight">{APP_NAME}</p>
              <p className="text-[11px] text-indigo-300/70 font-medium">Panel Admin</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden md:inline-flex text-slate-500 hover:text-slate-300 hover:bg-slate-800"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            {collapsed ? null : (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={cn(
                      navLinkClass(active, collapsed),
                      active && !collapsed ? "relative" : "",
                    )}
                  >
                    {active && !collapsed ? (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-indigo-400" />
                    ) : null}
                    <item.icon className={navLinkIconClass(active)} />
                    {collapsed ? null : (
                      <div className="min-w-0 flex-1">
                        <span className={navLinkTitleClass(active)}>{item.title}</span>
                        {item.description ? (
                          <p className="truncate text-[11px] leading-tight text-slate-500">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="border-t border-slate-700/50 px-4 py-4 space-y-3">
        <div className={cn(collapsed && "hidden")}>
          <p className="truncate text-sm font-medium text-slate-200">
            {profile?.display_name ?? profile?.full_name}
          </p>
          <Badge variant="outline" className="mt-1.5 border-slate-600 text-slate-400 bg-slate-800/50 text-[11px]">
            {profile?.role}
          </Badge>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
            collapsed && "justify-center",
          )}
        >
          <LogOut className="size-4.5 shrink-0" />
          {collapsed ? null : <span>Keluar</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* ── Desktop sidebar — dark navy ── */}
        <aside
          className={cn(
            "hidden md:flex md:flex-col bg-slate-900 text-slate-300",
            collapsed ? "md:w-16" : "md:w-64",
          )}
        >
          {navContent}
        </aside>

        {/* ── Mobile drawer overlay ── */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Tutup menu"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={closeMobile}
            />
            <aside className="relative flex h-full w-[min(20rem,85vw)] flex-col bg-slate-900 text-slate-300 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                    <Shield className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{APP_NAME}</p>
                    <p className="text-xs text-indigo-300/70">Panel Admin</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Tutup menu admin"
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  onClick={closeMobile}
                >
                  <X className="size-5" />
                </Button>
              </div>

              {/* Scrollable nav */}
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                {navGroups.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = isNavItemActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeMobile}
                            className={cn(
                              navLinkClass(active, false),
                              "min-h-[2.75rem]",
                              active && "relative",
                            )}
                          >
                            {active ? (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-indigo-400" />
                            ) : null}
                            <item.icon className={navLinkIconClass(active)} />
                            <div className="min-w-0 flex-1">
                              <span className={navLinkTitleClass(active)}>{item.title}</span>
                              {item.description ? (
                                <p className="truncate text-[11px] leading-tight text-slate-500">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* User footer */}
              <div className="border-t border-slate-700/50 px-4 py-4 space-y-3">
                <p className="truncate text-sm font-medium text-slate-200">
                  {profile?.display_name ?? profile?.full_name}
                </p>
                <Badge variant="outline" className="border-slate-600 text-slate-400 bg-slate-800/50 text-[11px]">
                  {profile?.role}
                </Badge>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                >
                  <LogOut className="size-4.5" />
                  <span>Keluar</span>
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        {/* ── Main content area ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile header — matches dark sidebar theme */}
          <header className="sticky top-0 z-30 flex h-13 items-center justify-between border-b border-slate-200/60 bg-white/95 backdrop-blur-md px-4 md:hidden">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                aria-label="Buka menu admin"
                onClick={() => setMobileOpen(true)}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Menu className="size-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600">{APP_NAME}</p>
                <p className="truncate text-sm font-bold text-slate-900">{currentPageTitle}</p>
              </div>
            </div>
            <Link
              href="/app"
              className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Ke portal warga"
            >
              <Home className="size-4.5" />
            </Link>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 pb-safe md:p-6 lg:p-8">
            <div className="page-container">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
