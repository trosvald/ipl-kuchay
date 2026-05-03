import { describe, expect, it } from "vitest";

import {
  buildPaymentGatewayUpsertPayload,
  isPaymentGatewayEnabledFromSetting,
} from "@/features/settings/PaymentGatewaySettingsCard";

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
});
