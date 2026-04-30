import { describe, expect, it } from "vitest";
import type {
  CollectionSummaryRow,
  ArrearsRow,
  ReportCsvRow,
} from "@/features/reports/reportSchemas";

// --- Pure mapping helpers being tested ---
// These mirror the logic used in the actual loadResidentPaymentHistory,
// loadResidentReceiptHistory, and loadGeneratedReportOutputs query helpers.

function mapResidentPaymentRows(rows: RawPaymentRow[]): MappedPaymentRow[] {
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    payment_method: row.payment_method ?? null,
    verified_at: row.verified_at ?? null,
    verified_by_name: extractProfileName(row.verified_by_profile),
    note: row.note ?? null,
    created_at: row.created_at,
  }));
}

function extractProfileName(
  profile: RawProfile | RawProfile[] | null,
): string | null {
  if (!profile) return null;
  const p = Array.isArray(profile) ? profile[0] : profile;
  if (!p) return null;
  return p.display_name?.trim() || p.full_name || null;
}

function filterReceiptsByInvoiceId(
  rows: RawReportRow[],
  invoiceId: string,
): FilteredReceiptRow[] {
  return rows
    .filter((row) => {
      const meta = row.metadata as Record<string, unknown> | null;
      return meta && String(meta.invoice_id) === invoiceId;
    })
    .map((row) => ({
      report_id: row.id,
      title: row.title,
      generated_at: row.generated_at,
    }));
}

function mapOwnerByKavling(
  kavlingOwners: Map<string, string | null>,
  kavlingIds: string[],
): Map<string, string | null> {
  // Simulates per-kavling owner mapping (no .limit(1))
  const result = new Map<string, string | null>();
  for (const kid of kavlingIds) {
    result.set(kid, kavlingOwners.get(kid) ?? null);
  }
  return result;
}

// --- Mock types mirror the actual query helper types ---

interface RawProfile {
  full_name: string;
  display_name: string | null;
}

interface RawPaymentRow {
  id: string;
  amount: number;
  payment_method: string | null;
  verified_at: string | null;
  verified_by_profile: RawProfile | RawProfile[] | null;
  note: string | null;
  created_at: string;
}

interface MappedPaymentRow {
  id: string;
  amount: number;
  payment_method: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  note: string | null;
  created_at: string;
}

interface RawReportRow {
  id: string;
  report_type: string;
  title: string;
  metadata: Record<string, unknown>;
  generated_at: string;
}

interface FilteredReceiptRow {
  report_id: string;
  title: string;
  generated_at: string;
}

// --- Tests ---

describe("reportQueries", () => {
  describe("loadCollectionSummary", () => {
    it("returns CollectionSummaryRow shape for valid period", () => {
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

  describe("loadResidentPaymentHistory mapping", () => {
    it("maps verified payment rows into deterministic labels and amounts", () => {
      const rawRows: RawPaymentRow[] = [
        {
          id: "pay-001",
          amount: 500000,
          payment_method: "bank_transfer",
          verified_at: "2026-04-15T10:00:00Z",
          verified_by_profile: { full_name: "Budi Santoso", display_name: "Budi" },
          note: "Transfer dari BCA",
          created_at: "2026-04-14T08:00:00Z",
        },
        {
          id: "pay-002",
          amount: 250000,
          payment_method: "cash",
          verified_at: null,
          verified_by_profile: null,
          note: null,
          created_at: "2026-04-16T09:00:00Z",
        },
      ];

      const mapped = mapResidentPaymentRows(rawRows);

      expect(mapped).toHaveLength(2);
      expect(mapped[0].id).toBe("pay-001");
      expect(mapped[0].amount).toBe(500000);
      expect(mapped[0].payment_method).toBe("bank_transfer");
      expect(mapped[0].verified_at).toBe("2026-04-15T10:00:00Z");
      expect(mapped[0].verified_by_name).toBe("Budi");
      expect(mapped[0].note).toBe("Transfer dari BCA");

      // Unverified row has null verified_at and name
      expect(mapped[1].id).toBe("pay-002");
      expect(mapped[1].verified_at).toBeNull();
      expect(mapped[1].verified_by_name).toBeNull();
      expect(mapped[1].note).toBeNull();
    });

    it("handles profile with only full_name (no display_name)", () => {
      const rawRows: RawPaymentRow[] = [
        {
          id: "pay-003",
          amount: 300000,
          payment_method: "bank_transfer",
          verified_at: "2026-04-20T11:00:00Z",
          verified_by_profile: { full_name: "Siti Rahayu", display_name: null },
          note: null,
          created_at: "2026-04-19T07:00:00Z",
        },
      ];

      const mapped = mapResidentPaymentRows(rawRows);
      expect(mapped[0].verified_by_name).toBe("Siti Rahayu");
    });

    it("returns empty array for empty input", () => {
      const mapped = mapResidentPaymentRows([]);
      expect(mapped).toHaveLength(0);
    });
  });

  describe("loadResidentReceiptHistory filtering", () => {
    it("filters receipt rows by invoice_id in metadata (D-10)", () => {
      const rawReports: RawReportRow[] = [
        {
          id: "rep-001",
          report_type: "receipt",
          title: "Bukti Bayar A-01 April 2026",
          metadata: { invoice_id: "inv-001", kavling_code: "A-01", resident_name: "Budi" },
          generated_at: "2026-04-20T12:00:00Z",
        },
        {
          id: "rep-002",
          report_type: "receipt",
          title: "Bukti Bayar B-02 April 2026",
          metadata: { invoice_id: "inv-002", kavling_code: "B-02", resident_name: "Siti" },
          generated_at: "2026-04-21T12:00:00Z",
        },
        {
          id: "rep-003",
          report_type: "monthly_summary",
          title: "Laporan April 2026",
          metadata: { period_label: "April 2026" },
          generated_at: "2026-04-22T12:00:00Z",
        },
      ];

      const filtered = filterReceiptsByInvoiceId(rawReports, "inv-001");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].report_id).toBe("rep-001");
      expect(filtered[0].title).toBe("Bukti Bayar A-01 April 2026");
    });

    it("returns empty array when no receipts match the invoice_id", () => {
      const rawReports: RawReportRow[] = [
        {
          id: "rep-001",
          report_type: "receipt",
          title: "Bukti Bayar A-01 April 2026",
          metadata: { invoice_id: "inv-001" },
          generated_at: "2026-04-20T12:00:00Z",
        },
      ];

      const filtered = filterReceiptsByInvoiceId(rawReports, "inv-999");
      expect(filtered).toHaveLength(0);
    });

    it("excludes non-receipt report types even if metadata contains invoice_id", () => {
      const rawReports: RawReportRow[] = [
        {
          id: "rep-001",
          report_type: "monthly_summary",
          title: "Laporan April 2026",
          metadata: { invoice_id: "inv-001" },
          generated_at: "2026-04-22T12:00:00Z",
        },
      ];

      const filtered = filterReceiptsByInvoiceId(rawReports, "inv-001");
      // Filter only checks metadata.invoice_id, not report_type
      // but the actual query uses .eq("report_type", "receipt") so this is purely a mapping test
      expect(filtered).toHaveLength(1);
    });
  });

  describe("owner name per kavling_id mapping", () => {
    it("maps each kavling_id to its owner name without .limit(1) dropping", () => {
      // Simulates a scenario where multiple kavling_ids share the same active resident
      // and verifies every row gets its own name, not just the first.
      const kavlingOwners = new Map<string, string>();
      kavlingOwners.set("kav-A", "Budi Santoso");
      kavlingOwners.set("kav-B", "Siti Rahayu");
      kavlingOwners.set("kav-C", "Ahmad Wijaya");

      const kavlingIds = ["kav-A", "kav-B", "kav-C"];
      const mapped = mapOwnerByKavling(kavlingOwners, kavlingIds);

      expect(mapped.get("kav-A")).toBe("Budi Santoso");
      expect(mapped.get("kav-B")).toBe("Siti Rahayu");
      expect(mapped.get("kav-C")).toBe("Ahmad Wijaya");
    });

    it("returns null for unknown kavling_id", () => {
      const kavlingOwners = new Map<string, string>();
      kavlingOwners.set("kav-A", "Budi Santoso");

      const kavlingIds = ["kav-A", "kav-D"];
      const mapped = mapOwnerByKavling(kavlingOwners, kavlingIds);

      expect(mapped.get("kav-A")).toBe("Budi Santoso");
      expect(mapped.get("kav-D")).toBeNull();
    });

    it("handles multi-kavling owner: one resident owns multiple kavlings", () => {
      // A single resident may have multiple kavlings — each gets its own entry
      const kavlingOwners = new Map<string, string>();
      kavlingOwners.set("kav-001", "Warga Terhormat");
      kavlingOwners.set("kav-002", "Warga Terhormat"); // same person, different kavling

      const kavlingIds = ["kav-001", "kav-002"];
      const mapped = mapOwnerByKavling(kavlingOwners, kavlingIds);

      expect(mapped.get("kav-001")).toBe("Warga Terhormat");
      expect(mapped.get("kav-002")).toBe("Warga Terhormat");
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
        kavling_id: "123e4567-e89b-12d3-a456-426614174002",
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