import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let authState = {
  session: null as null | { user: { id: string } },
  profile: null as null | { role?: string; display_name?: string; full_name?: string },
  accessState: "anonymous" as "anonymous" | "missing-profile" | "inactive" | "active-mapped" | "active-unmapped",
  loading: false,
  signOut: vi.fn(async () => {}),
};

let pathname = "/app";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => pathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => createElement("a", { href }, children),
}));

vi.mock("@/features/auth/authHooks", () => ({
  useAuth: () => authState,
}));

import { RequireAuth } from "@/features/auth/RequireAuth";
import { ResidentShell } from "@/features/layout/ResidentShell";

describe("RequireAuth route-gate behavior", () => {
  it("shows blocked message for inactive authenticated resident", () => {
    authState = {
      ...authState,
      session: { user: { id: "resident-1" } },
      profile: { full_name: "Resident 1", role: "resident" },
      accessState: "inactive",
      loading: false,
    };

    const html = renderToStaticMarkup(createElement(RequireAuth, null, createElement("div", null, "Portal Aktif")));

    expect(html).toContain("Akun nonaktif");
    expect(html).not.toContain("Portal Aktif");
  });

  it("allows active-unmapped resident through with limited portal guidance", () => {
    authState = {
      ...authState,
      session: { user: { id: "resident-2" } },
      profile: { full_name: "Resident 2", role: "resident" },
      accessState: "active-unmapped",
      loading: false,
    };

    const html = renderToStaticMarkup(createElement(RequireAuth, null, createElement("div", null, "Portal Terbatas")));

    expect(html).toContain("portal terbatas");
    expect(html).toContain("Portal Terbatas");
  });
});

describe("ResidentShell settings navigation behavior", () => {
  it("shows settings route for resident portal shell", () => {
    pathname = "/app/invoices";
    authState = {
      ...authState,
      profile: { full_name: "Resident 3", role: "resident" },
    };

    const html = renderToStaticMarkup(createElement(ResidentShell, null, createElement("div", null, "Konten")));

    expect(html).toContain('href="/app/settings"');
    expect(html).toContain("Pengaturan");
    expect(html).not.toContain('href="/admin"');
  });
});
