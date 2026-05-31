import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("mobile compact list layout contract", () => {
  it("keeps primary list pages on a mobile-first list pattern with desktop fallback", () => {
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

      const hasSharedListPattern =
        source.includes("DataList") ||
        source.includes("CompactListRow") ||
        source.includes("MobileEntityCard") ||
        source.includes("lg:hidden") ||
        source.includes("md:hidden");
      const hasDesktopFallback =
        source.includes("overflow-x-auto") ||
        source.includes("desktopContent") ||
        source.includes("desktop={");

      expect(hasSharedListPattern, file).toBe(true);
      expect(hasDesktopFallback, file).toBe(true);
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
      expect(source, file).toMatch(/useState(?:<number>)?\(5\)/);
    }

    const reportsSource = readRepoFile("features/reports/ReportsPage.tsx");
    expect(reportsSource).toContain("const [summaryPageSize, setSummaryPageSize] = useState<number>(5);");
    expect(reportsSource).toContain("const [arrearsPageSize, setArrearsPageSize] = useState<number>(5);");
  });
});
