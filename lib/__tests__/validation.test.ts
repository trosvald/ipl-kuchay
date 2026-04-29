import { describe, expect, it } from "vitest";

import {
  billingPeriodFormSchema,
  paymentSubmissionFormSchema,
  residentNotificationPreferencesSchema,
  residentSettingsProfileSchema,
} from "@/lib/validation";

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

  it("accepts resident settings editable fields and rejects protected identity fields", () => {
    const valid = residentSettingsProfileSchema.safeParse({
      display_name: "Budi",
      phone: "08123456789",
    });
    expect(valid.success).toBe(true);

    const invalid = residentSettingsProfileSchema.safeParse({
      display_name: "Budi",
      phone: "08123456789",
      full_name: "Budi Santoso",
      email: "budi@example.com",
      role: "resident",
      is_active: true,
    });
    expect(invalid.success).toBe(false);
  });

  it("requires category-based notification preference rows and rejects global toggle payload", () => {
    const valid = residentNotificationPreferencesSchema.safeParse({
      rows: [
        { category: "billing_reminders", in_app_enabled: true, telegram_enabled: false },
        { category: "payment_status", in_app_enabled: true, telegram_enabled: false },
        { category: "announcements", in_app_enabled: true, telegram_enabled: true },
        { category: "events", in_app_enabled: false, telegram_enabled: false },
      ],
    });
    expect(valid.success).toBe(true);

    const invalid = residentNotificationPreferencesSchema.safeParse({
      enabled: true,
    });
    expect(invalid.success).toBe(false);
  });
});
