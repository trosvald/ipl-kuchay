import { describe, expect, it, vi } from "vitest";

import { downloadAuditedFinanceCsv } from "@/features/reports/reportCsvAudit";

describe("downloadAuditedFinanceCsv", () => {
  it("writes an audit log before downloading collection CSV exports", async () => {
    const writeAuditLog = vi.fn(async () => undefined);
    const downloadCsv = vi.fn();

    await downloadAuditedFinanceCsv(
      {
        csvContent: "Kode Kavling,Total Tagihan\nA-01,150000",
        filename: "Laporan_Keuangan_April_2026.csv",
        exportType: "collection_summary",
        billingPeriodId: "period-1",
        billingPeriodLabel: "April 2026",
        rowCount: 1,
      },
      { writeAuditLog, downloadCsv },
    );

    expect(writeAuditLog).toHaveBeenCalledWith({
      action: "report.export_csv",
      entityTable: "reports",
      entityId: "period-1",
      afterData: {
        export_type: "collection_summary",
        billing_period_id: "period-1",
        billing_period_label: "April 2026",
        filename: "Laporan_Keuangan_April_2026.csv",
        row_count: 1,
      },
    });
    expect(downloadCsv).toHaveBeenCalledWith(
      "Kode Kavling,Total Tagihan\nA-01,150000",
      "Laporan_Keuangan_April_2026.csv",
    );
    expect(writeAuditLog.mock.invocationCallOrder[0]).toBeLessThan(downloadCsv.mock.invocationCallOrder[0]);
  });

  it("writes export type metadata for arrears CSV exports", async () => {
    const writeAuditLog = vi.fn(async () => undefined);
    const downloadCsv = vi.fn();

    await downloadAuditedFinanceCsv(
      {
        csvContent: "Kode Kavling,Sisa Bayar\nB-02,250000",
        filename: "Daftar_Tunggakan_April_2026.csv",
        exportType: "arrears",
        billingPeriodId: "period-2",
        billingPeriodLabel: "April 2026",
        rowCount: 1,
      },
      { writeAuditLog, downloadCsv },
    );

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "report.export_csv",
        entityTable: "reports",
        entityId: "period-2",
        afterData: expect.objectContaining({
          export_type: "arrears",
          filename: "Daftar_Tunggakan_April_2026.csv",
          row_count: 1,
        }),
      }),
    );
  });
});
