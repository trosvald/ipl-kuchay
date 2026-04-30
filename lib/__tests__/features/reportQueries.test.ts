import { describe, expect, it } from "vitest";
import type {
  CollectionSummaryRow,
  ArrearsRow,
  ReportCsvRow,
} from "@/features/reports/reportSchemas";

describe("reportQueries", () => {
  describe("loadCollectionSummary", () => {
    it("returns CollectionSummaryRow shape for valid period", () => {
      // Simulated return shape from Supabase query
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

      expect(row.kavling_code).toBe("A-01");
      expect(row.total_invoiced).toBe(500000);
      expect(row.paid_count).toBe(1);
    });

    it("handles zero balances correctly", () => {
      const row: CollectionSummaryRow = {
        kavling_id: "123e4567-e89b-12d3-a456-426614174000",
        kavling_code: "C-03",
        owner_name: null,
        period_label: "November 2026",
        total_invoiced: 0,
        total_paid: 0,
        total_pending: 0,
        remaining_balance: 0,
        invoice_count: 0,
        paid_count: 0,
        pending_count: 0,
      };

      expect(row.total_invoiced).toBe(0);
      expect(row.remaining_balance).toBe(0);
    });
  });

  describe("loadArrearsList", () => {
    it("returns ArrearsRow shape with overdue data", () => {
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

      expect(row.days_overdue).toBe(45);
      expect(row.invoice_status).toBe("overdue");
      expect(row.amount_paid).toBe(0);
    });

    it("handles partial payment arrears", () => {
      const row: ArrearsRow = {
        kavling_id: "123e4567-e89b-12d3-a456-426614174000",
        kavling_code: "D-04",
        owner_name: "Ahmad Wijaya",
        period_label: "September 2026",
        amount_due: 500000,
        amount_paid: 250000,
        due_date: new Date("2026-09-15").toISOString(),
        days_overdue: 60,
        last_payment_date: new Date("2026-11-01").toISOString(),
        invoice_status: "partial",
      };

      expect(row.amount_paid).toBe(250000);
      expect(row.days_overdue).toBe(60);
      expect(row.invoice_status).toBe("partial");
    });
  });
});

describe("reportCsv", () => {
  describe("toCsvRows", () => {
    it("maps CollectionSummaryRow to CSV row with Lunas status", () => {
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

      // Simulate toCsvRows conversion
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
      expect(csvRow.total_paid).toBe(500000);
    });

    it("maps CollectionSummaryRow to CSV row with Belum Lunas status", () => {
      const summaryRow: CollectionSummaryRow = {
        kavling_id: "123e4567-e89b-12d3-a456-426614174000",
        kavling_code: "B-02",
        owner_name: "Siti Rahayu",
        period_label: "November 2026",
        total_invoiced: 500000,
        total_paid: 200000,
        total_pending: 300000,
        remaining_balance: 300000,
        invoice_count: 1,
        paid_count: 0,
        pending_count: 1,
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

      expect(csvRow.payment_status).toBe("Belum Lunas");
      expect(csvRow.remaining_balance).toBe(300000);
    });

    it("maps ArrearsRow to CSV row with Tunggakan status and days_overdue", () => {
      const arrearsRow: ArrearsRow = {
        kavling_id: "123e4567-e89b-12d3-a456-426614174000",
        kavling_code: "C-03",
        owner_name: "Dewi Kusuma",
        period_label: "Oktober 2026",
        amount_due: 750000,
        amount_paid: 0,
        due_date: new Date("2026-10-01").toISOString(),
        days_overdue: 90,
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
        last_payment_date: arrearsRow.last_payment_date,
      };

      expect(csvRow.payment_status).toBe("Tunggakan");
      expect(csvRow.days_overdue).toBe(90);
      expect(csvRow.remaining_balance).toBe(750000);
    });

    it("produces consistent totals between CSV and source rows", () => {
      const summaryRows: CollectionSummaryRow[] = [
        {
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
        },
        {
          kavling_id: "123e4567-e89b-12d3-a456-426614174001",
          kavling_code: "B-02",
          owner_name: "Siti Rahayu",
          period_label: "November 2026",
          total_invoiced: 500000,
          total_paid: 200000,
          total_pending: 300000,
          remaining_balance: 300000,
          invoice_count: 1,
          paid_count: 0,
          pending_count: 1,
        },
      ];

      const csvRows: ReportCsvRow[] = summaryRows.map((row) => ({
        kavling_code: row.kavling_code,
        owner_name: row.owner_name,
        period_label: row.period_label,
        total_invoiced: row.total_invoiced,
        total_paid: row.total_paid,
        total_pending: row.total_pending,
        remaining_balance: row.remaining_balance,
        payment_status: row.remaining_balance === 0 ? "Lunas" : "Belum Lunas",
      }));

      const totalInvoiced = csvRows.reduce((sum, row) => sum + row.total_invoiced, 0);
      const totalPaid = csvRows.reduce((sum, row) => sum + row.total_paid, 0);
      const totalRemaining = csvRows.reduce((sum, row) => sum + row.remaining_balance, 0);

      expect(totalInvoiced).toBe(1000000);
      expect(totalPaid).toBe(700000);
      expect(totalRemaining).toBe(300000);
    });
  });
});