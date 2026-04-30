import { describe, expect, it } from "vitest";

import { getAdminNavigationByRole } from "@/features/layout/adminNavigation";

describe("getAdminNavigationByRole", () => {
  it("keeps treasurer navigation finance-only", () => {
    const groups = getAdminNavigationByRole("treasurer");
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

    expect(hrefs).toContain("/admin/billing");
    expect(hrefs).toContain("/admin/submissions");
    expect(hrefs).toContain("/admin/audit");

    expect(hrefs).not.toContain("/admin/residents");
    expect(hrefs).not.toContain("/admin/kavlings");
    expect(hrefs).not.toContain("/admin/settings");
  });

  it("keeps admin/super-admin operational routes available", () => {
    const adminHrefs = getAdminNavigationByRole("admin").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    const superAdminHrefs = getAdminNavigationByRole("super_admin").flatMap((group) =>
      group.items.map((item) => item.href),
    );

    expect(adminHrefs).toContain("/admin/residents");
    expect(adminHrefs).toContain("/admin/kavlings");
    expect(adminHrefs).toContain("/admin/settings");
    expect(superAdminHrefs).toContain("/admin/residents");
    expect(superAdminHrefs).toContain("/admin/kavlings");
    expect(superAdminHrefs).toContain("/admin/settings");
  });

  it("Pengumuman and Acara appear only for admin and super_admin, not treasurer", () => {
    const adminHrefs = getAdminNavigationByRole("admin").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    const superAdminHrefs = getAdminNavigationByRole("super_admin").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    const treasurerHrefs = getAdminNavigationByRole("treasurer").flatMap((group) =>
      group.items.map((item) => item.href),
    );

    // admin and super_admin have both entries
    expect(adminHrefs).toContain("/admin/announcements");
    expect(adminHrefs).toContain("/admin/events");
    expect(superAdminHrefs).toContain("/admin/announcements");
    expect(superAdminHrefs).toContain("/admin/events");

    // treasurer does NOT have these entries
    expect(treasurerHrefs).not.toContain("/admin/announcements");
    expect(treasurerHrefs).not.toContain("/admin/events");
  });

  it("returns shared pages only for resident/anonymous", () => {
    const residentHrefs = getAdminNavigationByRole("resident").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    const anonymousHrefs = getAdminNavigationByRole(null).flatMap((group) =>
      group.items.map((item) => item.href),
    );

    expect(residentHrefs).toEqual(["/app", "/app/invoices"]);
    expect(anonymousHrefs).toEqual(["/app", "/app/invoices"]);
  });
});
