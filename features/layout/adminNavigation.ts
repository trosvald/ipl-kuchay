import {
  Building2,
  Calendar,
  ClipboardCheck,
  Cog,
  FileSpreadsheet,
  Home,
  LayoutDashboard,
  Megaphone,
  ReceiptText,
  Send,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import type { AppRole } from "@/features/auth/AuthProvider";

type AdminRole = Extract<AppRole, "treasurer" | "admin" | "super_admin">;

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const SHARED_PAGES_GROUP: NavGroup = {
  label: "Pages",
  items: [
    { title: "User Portal", href: "/app", icon: Home },
    { title: "Resident Invoices", href: "/app/invoices", icon: ReceiptText },
  ],
};

const ADMIN_DASHBOARDS_GROUP: NavGroup = {
  label: "Dashboards",
  items: [
    { title: "Default", href: "/admin", icon: LayoutDashboard },
    { title: "Kavlings", href: "/admin/kavlings", icon: Building2 },
    { title: "Residents", href: "/admin/residents", icon: Users },
    { title: "Settings", href: "/admin/settings", icon: Cog },
    { title: "Billing", href: "/admin/billing", icon: Wallet },
    { title: "Submissions", href: "/admin/submissions", icon: ClipboardCheck },
    { title: "Imports", href: "/admin/imports", icon: FileSpreadsheet },
    { title: "Laporan", href: "/admin/reports", icon: ReceiptText },
    { title: "Audit Log", href: "/admin/audit", icon: ShieldCheck },
    { title: "Telegram", href: "/admin/telegram", icon: Send },
  ],
};

const COMMUNICATION_GROUP: NavGroup = {
  label: "Communication",
  items: [
    { title: "Pengumuman", href: "/admin/announcements", icon: Megaphone },
    { title: "Acara", href: "/admin/events", icon: Calendar },
  ],
};

const TREASURER_DASHBOARDS_GROUP: NavGroup = {
  label: "Keuangan",
  items: [
    { title: "Default", href: "/admin", icon: LayoutDashboard },
    { title: "Billing", href: "/admin/billing", icon: Wallet },
    { title: "Submissions", href: "/admin/submissions", icon: ClipboardCheck },
    { title: "Laporan", href: "/admin/reports", icon: ReceiptText },
    { title: "Audit Keuangan", href: "/admin/audit", icon: ShieldCheck },
  ],
};

const NAVIGATION_BY_ROLE: Record<AdminRole, NavGroup[]> = {
  treasurer: [TREASURER_DASHBOARDS_GROUP, SHARED_PAGES_GROUP],
  admin: [ADMIN_DASHBOARDS_GROUP, COMMUNICATION_GROUP, SHARED_PAGES_GROUP],
  super_admin: [ADMIN_DASHBOARDS_GROUP, COMMUNICATION_GROUP, SHARED_PAGES_GROUP],
};

export function getAdminNavigationByRole(role: AppRole | null): NavGroup[] {
  if (!role || role === "resident") {
    return [SHARED_PAGES_GROUP];
  }

  return NAVIGATION_BY_ROLE[role];
}
