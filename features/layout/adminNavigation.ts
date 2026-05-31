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
  description?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const SHARED_PAGES_GROUP: NavGroup = {
  label: "Portal Warga",
  items: [
    { title: "Portal Warga", href: "/app", icon: Home, description: "Beranda dan akses cepat warga" },
    { title: "Tagihan Saya", href: "/app/invoices", icon: ReceiptText, description: "Cek tagihan dan riwayat pembayaran" },
  ],
};

const ADMIN_DASHBOARDS_GROUP: NavGroup = {
  label: "Operasional",
  items: [
    { title: "Beranda", href: "/admin", icon: LayoutDashboard, description: "Ringkasan dan akses cepat admin" },
    { title: "Data Kavling", href: "/admin/kavlings", icon: Building2, description: "Atur blok, nomor, dan status kavling" },
    { title: "Data Warga", href: "/admin/residents", icon: Users, description: "Kelola akun penghuni dan mapping kavling" },
    { title: "Pengaturan", href: "/admin/settings", icon: Cog, description: "Konfigurasi biaya dan gateway pembayaran" },
    { title: "Tagihan", href: "/admin/billing", icon: Wallet, description: "Buat periode dan kelola penagihan" },
    { title: "Verifikasi Pembayaran", href: "/admin/submissions", icon: ClipboardCheck, description: "Cek bukti transfer dan approval" },
    { title: "Impor Data", href: "/admin/imports", icon: FileSpreadsheet, description: "Unggah data massal kavling dan mapping" },
    { title: "Laporan", href: "/admin/reports", icon: ReceiptText, description: "Ringkasan pembayaran dan tunggakan" },
    { title: "Log Audit", href: "/admin/audit", icon: ShieldCheck, description: "Jejak perubahan operasional admin" },
    { title: "Telegram", href: "/admin/telegram", icon: Send, description: "Template pesan dan kirim notifikasi" },
  ],
};

const COMMUNICATION_GROUP: NavGroup = {
  label: "Komunikasi",
  items: [
    { title: "Pengumuman", href: "/admin/announcements", icon: Megaphone, description: "Publikasi informasi ke warga" },
    { title: "Acara", href: "/admin/events", icon: Calendar, description: "Kelola kegiatan dan RSVP warga" },
  ],
};

const TREASURER_DASHBOARDS_GROUP: NavGroup = {
  label: "Keuangan",
  items: [
    { title: "Beranda", href: "/admin", icon: LayoutDashboard, description: "Ringkasan dan akses cepat" },
    { title: "Tagihan", href: "/admin/billing", icon: Wallet, description: "Buat periode dan kelola penagihan" },
    { title: "Verifikasi Pembayaran", href: "/admin/submissions", icon: ClipboardCheck, description: "Cek bukti transfer dan approval" },
    { title: "Laporan", href: "/admin/reports", icon: ReceiptText, description: "Ringkasan pembayaran dan tunggakan" },
    { title: "Audit Keuangan", href: "/admin/audit", icon: ShieldCheck, description: "Jejak perubahan pembayaran" },
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
