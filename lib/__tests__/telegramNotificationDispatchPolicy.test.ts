import { describe, expect, it } from "vitest";

import {
  acceptsClientTemplateVars,
  canDispatchTelegramTemplate,
  isPaymentEventTemplate,
} from "@/lib/telegramNotificationDispatchPolicy";

describe("telegram notification dispatch policy", () => {
  it("rejects residents for admin and payment review templates", () => {
    expect(canDispatchTelegramTemplate("resident", "admin_pending_submission")).toBe(false);
    expect(canDispatchTelegramTemplate("resident", "resident_payment_verified")).toBe(false);
    expect(canDispatchTelegramTemplate("resident", "resident_payment_rejected")).toBe(false);
  });

  it("allows finance roles to dispatch contextual payment event templates", () => {
    expect(canDispatchTelegramTemplate("treasurer", "resident_payment_verified")).toBe(true);
    expect(canDispatchTelegramTemplate("admin", "resident_payment_rejected")).toBe(true);
    expect(canDispatchTelegramTemplate("super_admin", "admin_pending_submission")).toBe(true);
  });

  it("keeps announcement broadcast restricted to admins", () => {
    expect(canDispatchTelegramTemplate("resident", "resident_announcement")).toBe(false);
    expect(canDispatchTelegramTemplate("treasurer", "resident_announcement")).toBe(false);
    expect(canDispatchTelegramTemplate("admin", "resident_announcement")).toBe(true);
    expect(canDispatchTelegramTemplate("super_admin", "resident_announcement")).toBe(true);
  });

  it("rejects arbitrary client variables for payment event templates", () => {
    expect(isPaymentEventTemplate("resident_payment_verified")).toBe(true);
    expect(acceptsClientTemplateVars("resident_payment_verified")).toBe(false);
    expect(acceptsClientTemplateVars("resident_announcement")).toBe(true);
  });

  it("keeps scheduled/internal templates out of generic browser dispatch", () => {
    expect(canDispatchTelegramTemplate("super_admin", "admin_monthly_summary")).toBe(false);
    expect(canDispatchTelegramTemplate("admin", "resident_payment_reminder")).toBe(false);
  });
});
