import { describe, expect, it } from "vitest";

import {
  buildPaymentGatewayUpsertPayload,
  isPaymentGatewayEnabledFromSetting,
} from "@/features/settings/PaymentGatewaySettingsCard";
import { canShowQrisPaymentAction } from "@/features/payments/QrisPaymentPanel";
import { canSubmitManualTransfer } from "@/features/payments/PaymentSubmissionForm";

describe("qris feature flag flow", () => {
  it("defaults to disabled when setting is missing or malformed", () => {
    expect(isPaymentGatewayEnabledFromSetting(null)).toBe(false);
    expect(isPaymentGatewayEnabledFromSetting({})).toBe(false);
    expect(isPaymentGatewayEnabledFromSetting({ enabled: "yes" })).toBe(false);
  });

  it("reads enabled state from payment_gateway setting", () => {
    expect(isPaymentGatewayEnabledFromSetting({ enabled: true })).toBe(true);
    expect(isPaymentGatewayEnabledFromSetting({ enabled: false })).toBe(false);
  });

  it("builds upsert payload for app_settings", () => {
    expect(buildPaymentGatewayUpsertPayload(true, "actor-1")).toEqual({
      key: "payment_gateway",
      value: { enabled: true },
      description: "Konfigurasi fitur gateway pembayaran QRIS untuk peluncuran bertahap.",
      updated_by: "actor-1",
    });
  });

  it("keeps manual transfer path functional when QRIS flag is disabled", () => {
    expect(
      canShowQrisPaymentAction({
        gatewayEnabled: false,
        invoiceStatus: "unpaid",
        outstandingAmount: 150000,
      }),
    ).toBe(false);

    expect(canSubmitManualTransfer("unpaid", 150000)).toBe(true);
  });

  it("shows QRIS action only for eligible statuses when enabled", () => {
    expect(
      canShowQrisPaymentAction({
        gatewayEnabled: true,
        invoiceStatus: "unpaid",
        outstandingAmount: 120000,
      }),
    ).toBe(true);

    expect(
      canShowQrisPaymentAction({
        gatewayEnabled: true,
        invoiceStatus: "partial",
        outstandingAmount: 120000,
      }),
    ).toBe(true);
  });

  it("never shows QRIS action for ineligible statuses", () => {
    expect(
      canShowQrisPaymentAction({
        gatewayEnabled: true,
        invoiceStatus: "paid",
        outstandingAmount: 120000,
      }),
    ).toBe(false);

    expect(
      canShowQrisPaymentAction({
        gatewayEnabled: true,
        invoiceStatus: "cancelled",
        outstandingAmount: 120000,
      }),
    ).toBe(false);
  });
});
