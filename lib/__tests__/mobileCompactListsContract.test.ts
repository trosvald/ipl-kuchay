import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("mobile compact list layout contract", () => {
  it("keeps primary list pages as mobile cards with desktop tables", () => {
    const files = [
      "features/kavlings/KavlingListPage.tsx",
      "features/residents/ResidentListPage.tsx",
      "features/residents/KavlingResidentMapping.tsx",
      "features/settings/FeeTypesPage.tsx",
      "features/settings/FeeOverridesPage.tsx",
      "features/billing/BillingPeriodsPage.tsx",
      "features/billing/BillingPeriodDetailPage.tsx",
      "features/dashboard/PublicDashboardPage.tsx",
      "features/payments/AdminSubmissionsPage.tsx",
      "features/reports/ReportsPage.tsx",
      "features/audit/AuditLogPage.tsx",
      "features/events/AdminEventsPage.tsx",
      "features/announcements/AdminAnnouncementsPage.tsx",
      "features/telegram/AdminTelegramPage.tsx",
      "features/imports/ImportJobsPage.tsx",
      "features/payments/SubmissionHistory.tsx",
      "features/payments/ResidentPaymentHistory.tsx",
      "features/payments/ResidentReceiptHistory.tsx",
    ];

    for (const file of files) {
      const source = readRepoFile(file);
      expect(source, file).toContain('className="space-y-2 md:hidden"');
      expect(source, file).toContain('className="hidden overflow-x-auto md:block"');
    }
  });

  it("defaults paginated admin and public lists to 5 rows", () => {
    const files = [
      "features/kavlings/KavlingListPage.tsx",
      "features/residents/ResidentListPage.tsx",
      "features/residents/KavlingResidentMapping.tsx",
      "features/settings/FeeTypesPage.tsx",
      "features/settings/FeeOverridesPage.tsx",
      "features/billing/BillingPeriodsPage.tsx",
      "features/billing/BillingPeriodDetailPage.tsx",
      "features/billing/InvoiceDetailPage.tsx",
      "features/dashboard/PublicDashboardPage.tsx",
      "features/payments/AdminSubmissionsPage.tsx",
      "features/audit/AuditLogPage.tsx",
      "features/events/AdminEventsPage.tsx",
      "features/announcements/AdminAnnouncementsPage.tsx",
      "features/telegram/AdminTelegramPage.tsx",
    ];

    for (const file of files) {
      const source = readRepoFile(file);
      expect(source, file).toContain("useState(5)");
    }

    const reportsSource = readRepoFile("features/reports/ReportsPage.tsx");
    expect(reportsSource).toContain("const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;");
    expect(reportsSource).toContain("useState<number>(5)");
  });
});
