import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getAdminNavigationByRole } from "@/features/layout/adminNavigation";
import { canShowQrisPaymentAction } from "@/features/payments/QrisPaymentPanel";
import { canSubmitManualTransfer } from "@/features/payments/PaymentSubmissionForm";
import { serializeCsv, toCsvRows } from "@/features/reports/reportCsv";

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
      {
        path: "app/admin/settings/page.tsx",
        importText: 'import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";',
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

  it("keeps deployment guidance aligned with private storage and Next.js env vars", () => {
    const guide = readRepoFile("PANDUAN-DEPLOY.md");

    expect(guide).toContain("Jangan memakai `supabase-setup.sql`");
    expect(guide).toContain("`payment-proofs` dan `report-outputs`");
    expect(guide).toContain("public = false");
    expect(guide).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(guide).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(guide).toContain("APP_INTERNAL_CRON_SECRET");
    expect(guide).toContain("QRIS tetap nonaktif");
    expect(guide).not.toContain("VITE_SUPABASE");
    expect(guide).not.toContain("bukti-transfer");
    expect(guide).not.toContain("Public bucket");
  });

  it("keeps in-app report export able to represent launch billing truth without spreadsheet formulas", () => {
    const csv = serializeCsv(
      toCsvRows([
        {
          kavling_id: "k-1",
          kavling_code: "A-01",
          owner_name: "Budi",
          period_label: "April 2026",
          total_invoiced: 150000,
          total_paid: 150000,
          total_pending: 0,
          remaining_balance: 0,
          invoice_count: 1,
          paid_count: 1,
          pending_count: 0,
        },
        {
          kavling_id: "k-2",
          kavling_code: "A-02",
          owner_name: "Siti",
          period_label: "April 2026",
          total_invoiced: 150000,
          total_paid: 0,
          total_pending: 150000,
          remaining_balance: 150000,
          invoice_count: 1,
          paid_count: 0,
          pending_count: 1,
        },
      ]),
    );

    expect(csv).toContain("Kode Kavling,Nama Pemilik,Periode,Total Tagihan,Sudah Dibayar,Menunggu Verifikasi,Sisa Bayar,Status Pembayaran,Hari Tertunda,Tanggal Bayar Terakhir");
    expect(csv).toContain("A-01,Budi,April 2026,150000,150000,0,0,Lunas,,");
    expect(csv).toContain("A-02,Siti,April 2026,150000,0,150000,150000,Belum Lunas,,");
  });
});
