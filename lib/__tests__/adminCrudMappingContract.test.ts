import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => createElement("a", { href }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/residents",
}));

vi.mock("@/features/auth/authHooks", () => ({
  useAuth: () => ({
    session: { access_token: "token", user: { id: "admin-1" } },
    profile: { id: "admin-1", role: "admin", is_active: true },
    accessState: "active-mapped",
    loading: false,
  }),
  useIsOperatorRole: () => true,
}));

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: () => null,
}));

import AdminKavlingsPage from "@/app/admin/kavlings/page";
import AdminResidentsPage from "@/app/admin/residents/page";
import { KavlingResidentMapping } from "@/features/residents/KavlingResidentMapping";

describe("phase 01 task 1-06-02 admin CRUD + mapping contract", () => {
  it("compiles admin residents CRUD route and exposes core controls", () => {
    const html = renderToStaticMarkup(createElement(AdminResidentsPage));

    expect(html).toContain("Manajemen Resident");
    expect(html).toContain("Tambah/Invite Resident");
    expect(html).toContain("Daftar Resident");
  });

  it("compiles admin kavlings CRUD route and exposes core controls", () => {
    const html = renderToStaticMarkup(createElement(AdminKavlingsPage));

    expect(html).toContain("Manajemen Kavling");
    expect(html).toContain("Tambah Kavling");
    expect(html).toContain("Daftar Kavling");
  });

  it("shows mapping constraints aligned with one-primary DB contract", () => {
    const html = renderToStaticMarkup(createElement(KavlingResidentMapping, { residentId: "resident-1" }));

    expect(html).toContain("Satu kavling hanya boleh punya satu resident primary aktif");
    expect(html).toContain("Lainnya");
    expect(html).toContain("Relasi");
  });
});
