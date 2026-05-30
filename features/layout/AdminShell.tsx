"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Menu, Search, Shield, X } from "lucide-react";

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

  const navContent = (
    <>
      <div className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}> 
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="size-4" />
            </div>
            {collapsed ? null : <span className="font-semibold text-sm">{APP_NAME}</span>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((value) => !value)} className="hidden md:inline-flex">
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {collapsed ? null : (
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isNavItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      collapsed && "justify-center",
                    )}
                  >
                    <item.icon className="size-4" />
                    {collapsed ? null : <span>{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-sidebar-border px-3 py-3">
        <div className={cn("mb-2", collapsed && "hidden")}> 
          <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.display_name ?? profile?.full_name}</p>
          <Badge variant="secondary" className="mt-1">{profile?.role}</Badge>
        </div>
        <Button variant="ghost" className={cn("w-full", collapsed ? "justify-center" : "justify-start")} onClick={handleSignOut}>
          <LogOut className="size-4" />
          {collapsed ? null : <span>Sign out</span>}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col",
            collapsed ? "md:w-16" : "md:w-64",
          )}
        >
          {navContent}
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Tutup menu"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative h-full w-[min(20rem,85vw)] bg-sidebar text-sidebar-foreground">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Tutup menu admin"
                className="absolute right-3 top-3 z-10 md:hidden"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
              </Button>
              {navContent}
            </aside>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu admin" onClick={() => setMobileOpen(true)}>
                <Menu className="size-5" />
              </Button>
              <Button variant="ghost" size="sm" className="hidden justify-start text-muted-foreground md:inline-flex">
                <Search className="size-4" />
                Search
              </Button>
              <p className="max-w-[60vw] truncate text-sm font-medium text-foreground md:hidden">{currentPageTitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="hidden text-sm text-muted-foreground md:block">{currentPageTitle}</p>
              <Badge variant="outline" className="hidden sm:inline-flex">Admin Shell</Badge>
            </div>
          </header>

          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
