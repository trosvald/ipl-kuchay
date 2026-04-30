import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => createElement("a", { href }, children),
}));

vi.mock("@/features/auth/authHooks", () => ({
  useAuth: () => ({
    hasActiveKavlingMapping: false,
    profile: { id: "resident-1", role: "admin" },
  }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: () => null,
}));

import { PublicDashboardPage } from "@/features/dashboard/PublicDashboardPage";
import { ResidentInvoicesPage } from "@/features/billing/ResidentInvoicesPage";
import { KavlingResidentMapping } from "@/features/residents/KavlingResidentMapping";

describe("phase 01 nyquist automation gaps", () => {
  it("keeps public dashboard aggregate-only privacy messaging", () => {
    const html = renderToStaticMarkup(createElement(PublicDashboardPage));

    expect(html).toContain("Ringkasan Aggregate Publik");
    expect(html).toContain("Dashboard publik hanya memakai fungsi agregat aman");
    expect(html).toContain("detail pembayaran per kavling tidak ditampilkan");
  });

  it("shows resident invoice kavling-scoped and history-only guidance", () => {
    const html = renderToStaticMarkup(createElement(ResidentInvoicesPage));

    expect(html).toContain("sesuai periode hunian sebelumnya");
    expect(html).toContain("histori tagihan Anda (read-only)");
  });

  it("shows mapping relation choices and explicit primary constraint guidance", () => {
    const html = renderToStaticMarkup(createElement(KavlingResidentMapping, { residentId: "resident-1" }));

    expect(html).toContain("Relasi");
    expect(html).toContain("Pemilik");
    expect(html).toContain("Lainnya");
    expect(html).toContain("Satu kavling hanya boleh punya satu resident primary aktif");
  });
});
