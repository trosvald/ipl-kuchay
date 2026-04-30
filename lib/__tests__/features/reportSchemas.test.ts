import { describe, expect, it } from "vitest";
import type {
  CollectionSummaryRow,
  ArrearsRow,
  ReportOutputPayload,
  ReportCsvRow,
} from "@/features/reports/reportSchemas";

describe("reportSchemas", () => {
  describe("CollectionSummaryRow", () => {
    it("has required fields for collection summary", () => {
      const row: CollectionSummaryRow = {
        kavling_id: "123e4567-e89b-12d3-a456-426614174000",
        kavling_code: "A-01",
        owner_name: "Budi Santoso",
        period_label: "November 2026",
        total_invoiced: 500000,
        total_paid: 500000,
        total_pending: 0,
        remaining_balance: 0,
        invoice_count: 1,
        paid_count: 1,
        pending_count: 0,
      };

      expect(row.kavling_id).toBeDefined();
      expect(row.kavling_code).toBe("A-01");
      expect(row.owner_name).toBe("Budi Santoso");
      expect(row.total_invoiced).toBe(500000);
      expect(row.total_paid).toBe(500000);
      expect(row.remaining_balance).toBe(0);
    });
  });

  describe("ArrearsRow", () => {
    it("has required fields for arrears list", () => {
      const row: ArrearsRow = {
        kavling_id: "123e4567-e89b-12d3-a456-426614174000",
        kavling_code: "B-02",
        owner_name: "Siti Rahayu",
        period_label: "Oktober 2026",
        amount_due: 500000,
        amount_paid: 0,
        due_date: new Date("2026-10-15").toISOString(),
        days_overdue: 45,
        last_payment_date: null,
        invoice_status: "overdue",
      };

      expect(row.kavling_id).toBeDefined();
      expect(row.kavling_code).toBe("B-02");
      expect(row.owner_name).toBe("Siti Rahayu");
      expect(row.amount_due).toBe(500000);
      expect(row.amount_paid).toBe(0);
      expect(row.days_overdue).toBe(45);
      expect(row.invoice_status).toBe("overdue");
    });
  });

  describe("ReportOutputPayload", () => {
    it("captures monthly report metadata", () => {
      const payload: ReportOutputPayload = {
        report_type: "monthly_summary",
        billing_period_id: "123e4567-e89b-12d3-a456-426614174000",
        generated_by: "123e4567-e89b-12d3-a456-426614174001",
        title: "Laporan Bulanan November 2026",
        metadata: {
          total_invoiced: 15000000,
          total_collected: 12000000,
          total_pending: 3000000,
          invoice_count: 50,
          period_label: "November 2026",
        },
      };

      expect(payload.report_type).toBe("monthly_summary");
      expect(payload.title).toContain("November 2026");
      expect(payload.metadata.total_invoiced).toBe(15000000);
    });

    it("captures resident receipt output metadata", () => {
      const payload: ReportOutputPayload = {
        report_type: "receipt",
        billing_period_id: "123e4567-e89b-12d3-a456-426614174000",
        generated_by: "123e4567-e89b-12d3-a456-426614174001",
        title: "Bukti Bayar - A-01 - November 2026",
        metadata: {
          kavling_code: "A-01",
          owner_name: "Budi Santoso",
          amount_paid: 500000,
          payment_date: "2026-11-20",
        },
      };

      expect(payload.report_type).toBe("receipt");
      expect(payload.title).toContain("A-01");
    });
  });

  describe("ReportCsvRow", () => {
    it("maps collection summary to CSV row", () => {
      const summaryRow: CollectionSummaryRow = {
        kavling_id: "123e4567-e89b-12d3-a456-426614174000",
        kavling_code: "A-01",
        owner_name: "Budi Santoso",
        period_label: "November 2026",
        total_invoiced: 500000,
        total_paid: 500000,
        total_pending: 0,
        remaining_balance: 0,
        invoice_count: 1,
        paid_count: 1,
        pending_count: 0,
      };

      const csvRow: ReportCsvRow = {
        kavling_code: summaryRow.kavling_code,
        owner_name: summaryRow.owner_name,
        period_label: summaryRow.period_label,
        total_invoiced: summaryRow.total_invoiced,
        total_paid: summaryRow.total_paid,
        total_pending: summaryRow.total_pending,
        remaining_balance: summaryRow.remaining_balance,
        payment_status: summaryRow.remaining_balance === 0 ? "Lunas" : "Belum Lunas",
      };

      expect(csvRow.kavling_code).toBe("A-01");
      expect(csvRow.payment_status).toBe("Lunas");
      expect(csvRow.total_invoiced).toBe(500000);
    });

    it("maps arrears to CSV row with overdue status", () => {
      const arrearsRow: ArrearsRow = {
        kavling_id: "123e4567-e89b-12d3-a456-426614174000",
        kavling_code: "B-02",
        owner_name: "Siti Rahayu",
        period_label: "Oktober 2026",
        amount_due: 500000,
        amount_paid: 0,
        due_date: new Date("2026-10-15").toISOString(),
        days_overdue: 45,
        last_payment_date: null,
        invoice_status: "overdue",
      };

      const csvRow: ReportCsvRow = {
        kavling_code: arrearsRow.kavling_code,
        owner_name: arrearsRow.owner_name,
        period_label: arrearsRow.period_label,
        total_invoiced: arrearsRow.amount_due,
        total_paid: arrearsRow.amount_paid,
        total_pending: arrearsRow.amount_due - arrearsRow.amount_paid,
        remaining_balance: arrearsRow.amount_due - arrearsRow.amount_paid,
        payment_status: "Tunggakan",
        days_overdue: arrearsRow.days_overdue,
        last_payment_date: null,
      };

      expect(csvRow.payment_status).toBe("Tunggakan");
      expect(csvRow.days_overdue).toBe(45);
      expect(csvRow.remaining_balance).toBe(500000);
    });
  });
});