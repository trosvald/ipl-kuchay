import { describe, expect, it } from "vitest";

import { formatInvoiceStatusLabel, statusToBadgeVariant } from "@/lib/format";

describe("format status mappings", () => {
  it("maps invoice statuses to readable Indonesian labels", () => {
    expect(formatInvoiceStatusLabel("pending_verification")).toBe("Menunggu verifikasi");
    expect(formatInvoiceStatusLabel("partial")).toBe("Dibayar sebagian");
    expect(formatInvoiceStatusLabel("paid")).toBe("Lunas");
    expect(formatInvoiceStatusLabel("rejected")).toBe("Ditolak");
  });

  it("maps statuses to expected badge variants", () => {
    expect(statusToBadgeVariant("paid")).toBe("success");
    expect(statusToBadgeVariant("pending_verification")).toBe("outline");
    expect(statusToBadgeVariant("rejected")).toBe("destructive");
    expect(statusToBadgeVariant("unknown")).toBe("secondary");
  });
});
