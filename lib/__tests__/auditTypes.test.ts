import { describe, expect, it } from "vitest";

import { resolveBillingPeriodStatusAuditAction } from "@/features/audit/auditTypes";

describe("auditTypes billing-period status actions", () => {
  it("maps billing-period lifecycle status changes to distinct audit actions", () => {
    expect(resolveBillingPeriodStatusAuditAction("open")).toBe("billing_period.status_open");
    expect(resolveBillingPeriodStatusAuditAction("closed")).toBe("billing_period.status_closed");
    expect(resolveBillingPeriodStatusAuditAction("archived")).toBe("billing_period.status_archived");
  });

  it("rejects statuses without lifecycle audit actions", () => {
    expect(() => resolveBillingPeriodStatusAuditAction("draft")).toThrow("Unsupported billing period status action");
  });
});
