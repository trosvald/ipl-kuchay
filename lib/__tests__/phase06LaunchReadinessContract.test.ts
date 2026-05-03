import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getAdminNavigationByRole } from "@/features/layout/adminNavigation";
import { canShowQrisPaymentAction } from "@/features/payments/QrisPaymentPanel";
import { canSubmitManualTransfer } from "@/features/payments/PaymentSubmissionForm";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("phase 06 launch readiness contract", () => {
  it("keeps launch-critical admin workflows reachable from navigation", () => {
    const adminHrefs = getAdminNavigationByRole("admin").flatMap((group) =>
      group.items.map((item) => item.href),
    );

    expect(adminHrefs).toContain("/admin/billing");
    expect(adminHrefs).toContain("/admin/submissions");
    expect(adminHrefs).toContain("/admin/announcements");
    expect(adminHrefs).toContain("/admin/reports");
  });

  it("keeps core admin routes wired to their feature modules", () => {
    const routeContracts = [
      {
        path: "app/admin/billing/page.tsx",
        importText: 'import { BillingPeriodsPage } from "@/features/billing/BillingPeriodsPage";',
      },
      {
        path: "app/admin/submissions/page.tsx",
        importText: 'import { AdminSubmissionsPage } from "@/features/payments/AdminSubmissionsPage";',
      },
      {
        path: "app/admin/announcements/page.tsx",
        importText: 'import { AdminAnnouncementsPage } from "@/features/announcements/AdminAnnouncementsPage";',
      },
      {
        path: "app/admin/reports/page.tsx",
        importText: 'import { ReportsPage } from "@/features/reports/ReportsPage";',
      },
    ] as const;

    for (const contract of routeContracts) {
      const source = readRepoFile(contract.path);
      expect(source).toContain(contract.importText);
    }
  });

  it("preserves manual transfer when QRIS gateway flag is disabled", () => {
    expect(
      canShowQrisPaymentAction({
        gatewayEnabled: false,
        invoiceStatus: "unpaid",
        outstandingAmount: 125000,
      }),
    ).toBe(false);

    expect(canSubmitManualTransfer("unpaid", 125000)).toBe(true);
    expect(canSubmitManualTransfer("overdue", 125000)).toBe(true);
  });
});
