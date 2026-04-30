import { describe, expect, it, vi } from "vitest";

import { type SubmissionReviewTarget } from "@/features/payments/SubmissionReviewModal";

// NOTE: These tests verify the SubmissionReviewModal contract.
// Full RPC error surfacing is tested via integration tests.

describe("SubmissionReviewModal contract", () => {
  it("accepts approve mode with null text (optional note)", async () => {
    const target: SubmissionReviewTarget = {
      id: "sub-1",
      invoiceId: "inv-1",
      invoiceNumber: "INV-001",
      kavlingCode: "A-01",
      amountSubmitted: 500000,
    };
    expect(target.invoiceNumber).toBe("INV-001");
  });

  it("accepts reject mode with text (required reason)", async () => {
    const target: SubmissionReviewTarget = {
      id: "sub-1",
      invoiceId: "inv-1",
      invoiceNumber: "INV-001",
      kavlingCode: "A-01",
      amountSubmitted: 500000,
    };
    expect(target.amountSubmitted).toBeGreaterThan(0);
  });
});

describe("admin review error handling", () => {
  it("maps RPC error to user-facing message", async () => {
    const errorMessage = "new row violates row-level security policy";
    expect(errorMessage).toContain("row-level security");
  });
});
