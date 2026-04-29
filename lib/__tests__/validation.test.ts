import { describe, expect, it } from "vitest";

import { billingPeriodFormSchema, paymentSubmissionFormSchema } from "@/lib/validation";

describe("validation schemas", () => {
  it("accepts valid payment submission payload", () => {
    const result = paymentSubmissionFormSchema.safeParse({
      invoiceId: "11111111-1111-4111-8111-111111111111",
      amountSubmitted: 100000,
      bankAccountId: "22222222-2222-4222-8222-222222222222",
      note: "transfer pagi",
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-positive payment amount", () => {
    const result = paymentSubmissionFormSchema.safeParse({
      invoiceId: "11111111-1111-4111-8111-111111111111",
      amountSubmitted: 0,
      bankAccountId: "22222222-2222-4222-8222-222222222222",
      note: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid billing period payload", () => {
    const result = billingPeriodFormSchema.safeParse({
      year: 2026,
      month: 7,
      due_date: "2026-07-31",
      label: "Juli 2026",
    });

    expect(result.success).toBe(true);
  });

  it("rejects out-of-range billing month", () => {
    const result = billingPeriodFormSchema.safeParse({
      year: 2026,
      month: 13,
      due_date: "2026-07-31",
      label: "Invalid",
    });

    expect(result.success).toBe(false);
  });
});
