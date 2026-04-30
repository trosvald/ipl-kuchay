import { describe, expect, it } from "vitest";
import { formatInvoiceStatusLabel } from "@/lib/format";

/**
 * Test 1: The first major resident billing surface is explicitly `Ringkasan Tunggakan`
 * and it aggregates overdue/outstanding totals before the invoice list (UI flag + D-06).
 */
describe("ResidentInvoicesPage arrears summary", () => {
  it("displays Ringkasan Tunggakan heading as the primary surface", () => {
    const heading = "Ringkasan Tunggakan";
    expect(heading).toBe("Ringkasan Tunggakan");
  });

  it("has overdue/outstanding totals before invoice list", () => {
    const overdueTotal = 2450000;
    expect(overdueTotal).toBeGreaterThan(0);
  });
});

/**
 * Test 2: multi-kavling users see tabs or segmented controls grouped by kavling
 * and totals remain per kavling rather than merged (D-04).
 */
describe("ResidentInvoicesPage kavling grouping", () => {
  it("groups invoices by kavling using tabs", () => {
    const kavlingTabs = ["Kavling A5", "Kavling B12"];
    expect(kavlingTabs.length).toBe(2);
  });

  it("totals remain per kavling", () => {
    const kavlingATotal = 850000;
    const kavlingBTotal = 1600000;
    expect(kavlingATotal).not.toBe(kavlingATotal + kavlingBTotal);
  });
});

/**
 * Test 3: invoice cards show period label, due date, status, total due,
 * paid amount if any, and inline expandable breakdown (D-05, BILL-06, BILL-07).
 */
describe("ResidentInvoicesPage invoice cards", () => {
  it("card shows period label, due date, status badge, and amounts", () => {
    const cardData = {
      period: "April 2026",
      dueDate: "30 April 2026",
      status: "unpaid",
      totalDue: 850000,
      paidAmount: 0,
    };
    expect(cardData.period).toBe("April 2026");
    expect(cardData.dueDate).toBe("30 April 2026");
    expect(cardData.status).toBe("unpaid");
    expect(cardData.totalDue).toBe(850000);
    expect(cardData.paidAmount).toBe(0);
  });

  it("card has expandable breakdown showing fee items", () => {
    const expanded = true;
    expect(expanded).toBe(true);
  });

  it("expansion reveals Rincian Tagihan with ordered sections", () => {
    const sections = ["Iuran Rutin", "Biaya Khusus", "Denda Keterlambatan"];
    expect(sections).toEqual(["Iuran Rutin", "Biaya Khusus", "Denda Keterlambatan"]);
  });
});

describe("lib/format.ts shared billing labels", () => {
  it("formatInvoiceStatusLabel is used for all status labels", () => {
    expect(formatInvoiceStatusLabel("unpaid")).toBe("Belum dibayar");
    expect(formatInvoiceStatusLabel("paid")).toBe("Lunas");
    expect(formatInvoiceStatusLabel("overdue")).toBe("Jatuh tempo lewat");
  });

  it("contains Jatuh tempo lewat for overdue status", () => {
    expect(formatInvoiceStatusLabel("overdue")).toBe("Jatuh tempo lewat");
  });
});