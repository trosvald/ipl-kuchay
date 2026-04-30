import { describe, expect, it } from "vitest";

import { formatPaymentSubmissionStatus } from "@/lib/format";

describe("payment submission status formatting", () => {
  it("maps all submission statuses to Indonesian labels", () => {
    expect(formatPaymentSubmissionStatus("submitted")).toBe("Menunggu verifikasi");
    expect(formatPaymentSubmissionStatus("verified")).toBe("Terverifikasi");
    expect(formatPaymentSubmissionStatus("rejected")).toBe("Ditolak");
    expect(formatPaymentSubmissionStatus("cancelled")).toBe("Dibatalkan");
  });

  it("returns unknown status as-is", () => {
    expect(formatPaymentSubmissionStatus("unknown_status")).toBe("unknown_status");
  });
});
