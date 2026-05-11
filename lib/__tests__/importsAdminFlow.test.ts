import { describe, expect, it } from "vitest";

import { getAdminNavigationByRole } from "@/features/layout/adminNavigation";

describe("imports admin flow", () => {
  it("adds Imports menu for admin and super_admin only", () => {
    const adminHrefs = getAdminNavigationByRole("admin").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    const superAdminHrefs = getAdminNavigationByRole("super_admin").flatMap((group) =>
      group.items.map((item) => item.href),
    );
    const treasurerHrefs = getAdminNavigationByRole("treasurer").flatMap((group) =>
      group.items.map((item) => item.href),
    );

    expect(adminHrefs).toContain("/admin/imports");
    expect(superAdminHrefs).toContain("/admin/imports");
    expect(treasurerHrefs).not.toContain("/admin/imports");
  });

  it("expects preview-before-apply guard message in imports page", async () => {
    const importJobsModule = await import("@/features/imports/ImportJobsPage");
    const sourceHint = String(importJobsModule.ImportJobsPage);
    expect(sourceHint).toContain("Masih ada baris tidak valid. Perbaiki CSV sebelum apply.");
  });
});
