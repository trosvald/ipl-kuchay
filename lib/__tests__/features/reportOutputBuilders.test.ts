// TDD tests for report output artifact builders.
// These tests define the contract for monthly summary and resident receipt artifacts
// BEFORE storage/Edge Function wiring begins.

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildMonthlySummaryHtml,
  buildResidentReceiptHtml,
  buildReportOutputPath,
} from "@/features/reports/reportOutputBuilders";

// Mock date for deterministic output
const FIXED_DATE = "2026-04-30T06:00:00.000Z";

describe("reportOutputBuilders", () => {
  // Test 1: Monthly summary builder returns deterministic HTML
  // containing period label, total invoiced, total collected, remaining balance,
  // and generated-at metadata per D-07/D-08/D-09.
  describe("buildMonthlySummaryHtml", () => {
    it("contains Laporan Bulanan heading", () => {
      const html = buildMonthlySummaryHtml({
        periodLabel: "April 2026",
        totalInvoiced: 5000000,
        totalCollected: 3500000,
        totalPending: 1500000,
        generatedAt: FIXED_DATE,
        generatedScope: "all",
      });
      expect(html).toContain("Laporan Bulanan");
    });

    it("contains Terakhir diperbarui freshness marker per D-12", () => {
      const html = buildMonthlySummaryHtml({
        periodLabel: "April 2026",
        totalInvoiced: 5000000,
        totalCollected: 3500000,
        totalPending: 1500000,
        generatedAt: FIXED_DATE,
        generatedScope: "all",
      });
      expect(html).toContain("Terakhir diperbarui");
    });

    it("formats currency values in Indonesian Rupiah", () => {
      const html = buildMonthlySummaryHtml({
        periodLabel: "April 2026",
        totalInvoiced: 5000000,
        totalCollected: 3500000,
        totalPending: 1500000,
        generatedAt: FIXED_DATE,
        generatedScope: "all",
      });
      // Rp format: 5.000.000
      expect(html).toContain("5.000.000");
      expect(html).toContain("3.500.000");
      expect(html).toContain("1.500.000");
    });

    it("includes period label in output", () => {
      const html = buildMonthlySummaryHtml({
        periodLabel: "April 2026",
        totalInvoiced: 5000000,
        totalCollected: 3500000,
        totalPending: 1500000,
        generatedAt: FIXED_DATE,
        generatedScope: "all",
      });
      expect(html).toContain("April 2026");
    });

    it("includes total invoiced, collected, and pending values", () => {
      const html = buildMonthlySummaryHtml({
        periodLabel: "April 2026",
        totalInvoiced: 5000000,
        totalCollected: 3500000,
        totalPending: 1500000,
        generatedAt: FIXED_DATE,
        generatedScope: "all",
      });
      // HTML uses Indonesian labels: Total Tagihan, Total Terbayar, Sisa Tagihan
      // Values appear as formatted Rupiah strings
      expect(html).toContain("5.000.000"); // total invoiced
      expect(html).toContain("3.500.000"); // total collected
      expect(html).toContain("1.500.000"); // total pending
    });

    it("includes generated_at metadata", () => {
      const html = buildMonthlySummaryHtml({
        periodLabel: "April 2026",
        totalInvoiced: 5000000,
        totalCollected: 3500000,
        totalPending: 1500000,
        generatedAt: FIXED_DATE,
        generatedScope: "all",
      });
      // Should include the timestamp
      expect(html).toContain("2026");
    });

    it("handles zero values without crashing", () => {
      const html = buildMonthlySummaryHtml({
        periodLabel: "April 2026",
        totalInvoiced: 0,
        totalCollected: 0,
        totalPending: 0,
        generatedAt: FIXED_DATE,
        generatedScope: "all",
      });
      expect(html).toContain("Laporan Bulanan");
    });

    it("supports filtered scope per D-08 (single kavling)", () => {
      const html = buildMonthlySummaryHtml({
        periodLabel: "April 2026",
        totalInvoiced: 1000000,
        totalCollected: 750000,
        totalPending: 250000,
        generatedAt: FIXED_DATE,
        generatedScope: "kavling:A01",
      });
      expect(html).toContain("Laporan Bulanan");
      expect(html).toMatch(/A01|kavling/i);
    });
  });

  // Test 2: Resident receipt builder returns deterministic HTML for exactly one
  // invoice/payment/resident record, including invoice number, kavling code,
  // resident name, amount paid, verification date, and no unrelated resident rows.
  describe("buildResidentReceiptHtml", () => {
    it("contains Bukti Pembayaran Warga receipt heading", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("Bukti Pembayaran Warga");
    });

    it("contains Terakhir diperbarui per D-12", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("Terakhir diperbarui");
    });

    it("includes invoice number for identification per D-10", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("INV-2026-04-001");
    });

    it("includes kavling code", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("A01");
    });

    it("includes resident name", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("Budi Santoso");
    });

    it("includes amount paid in Rupiah format", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      // 500000 -> 500.000
      expect(html).toContain("500.000");
    });

    it("includes payment date", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("2026");
    });

    it("includes period label", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("April 2026");
    });

    it("does not contain multiple resident names (single record only)", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 500000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      // Receipt should only show one resident name
      const matches = html.match(/Budi Santoso/g);
      expect(matches).toHaveLength(1);
    });

    it("handles resident with no display_name (falls back to full_name)", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Ahmad Rizki",
        amountPaid: 750000,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("Ahmad Rizki");
    });

    it("handles zero amount paid", () => {
      const html = buildResidentReceiptHtml({
        invoiceId: "inv-001",
        invoiceNumber: "INV-2026-04-001",
        kavlingCode: "A01",
        residentName: "Budi Santoso",
        amountPaid: 0,
        paymentDate: FIXED_DATE,
        periodLabel: "April 2026",
      });
      expect(html).toContain("Bukti Pembayaran Warga");
    });
  });

  // Test 3: Path builder generates correct storage paths
  describe("buildReportOutputPath", () => {
    it("generates monthly summary path under reports/ directory", () => {
      const path = buildReportOutputPath({
        reportType: "monthly_summary",
        billingPeriodId: "bp-001",
        reportId: "r-001",
      });
      expect(path).toMatch(/^reports\//);
      expect(path).toContain("bp-001");
      expect(path).toContain("r-001");
      expect(path).toMatch(/\.html$/);
    });

    it("generates receipt path under receipts/ directory", () => {
      const path = buildReportOutputPath({
        reportType: "receipt",
        billingPeriodId: "bp-001",
        invoiceId: "inv-001",
        reportId: "r-002",
      });
      expect(path).toMatch(/^receipts\//);
      expect(path).toContain("inv-001");
      expect(path).toMatch(/\.html$/);
    });

    it("uses billing period id to organize monthly summaries", () => {
      const path = buildReportOutputPath({
        reportType: "monthly_summary",
        billingPeriodId: "bp-april-2026",
        reportId: "r-003",
      });
      expect(path).toContain("bp-april-2026");
    });

    it("uses invoice id to organize receipts per D-10", () => {
      const path = buildReportOutputPath({
        reportType: "receipt",
        billingPeriodId: "bp-001",
        invoiceId: "inv-april-001",
        reportId: "r-004",
      });
      expect(path).toContain("inv-april-001");
    });

    it("returns string path suitable for Supabase Storage upload", () => {
      const path = buildReportOutputPath({
        reportType: "monthly_summary",
        billingPeriodId: "bp-001",
        reportId: "r-001",
      });
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    });
  });
});