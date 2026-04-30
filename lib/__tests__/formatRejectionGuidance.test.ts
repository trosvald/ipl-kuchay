import { describe, expect, it } from "vitest";

import {
  buildRejectionGuidance,
  formatPaymentSubmissionStatus,
  formatSubmissionNextStep,
} from "@/lib/format";

describe("rejection guidance", () => {
  it("returns resubmission hint for rejected status with empty reason", () => {
    const guidance = buildRejectionGuidance("rejected", "");
    expect(guidance).toContain("submission baru");
  });

  it("includes reason when provided", () => {
    const reason = "Bukti transfer tidak terbaca";
    const guidance = buildRejectionGuidance("rejected", reason);
    expect(guidance).toContain(reason);
  });

  it("returns null for non-rejected status", () => {
    expect(buildRejectionGuidance("submitted", "")).toBeNull();
    expect(buildRejectionGuidance("verified", "")).toBeNull();
    expect(buildRejectionGuidance("cancelled", "")).toBeNull();
  });
});

describe("next step guidance", () => {
  it("returns correct steps for submitted status", () => {
    const step = formatSubmissionNextStep("submitted");
    expect(step).toBe("Menunggu verifikasi oleh tim kami.");
  });

  it("returns correct steps for verified status", () => {
    const step = formatSubmissionNextStep("verified");
    expect(step).toBe("Pembayaran sudah diverifikasi. Invoice telah dilunasi.");
  });

  it("returns correct steps for rejected status", () => {
    const step = formatSubmissionNextStep("rejected");
    expect(step).toBe("Silakan kirim submission baru dengan bukti yang benar.");
  });

  it("returns null for cancelled status", () => {
    const step = formatSubmissionNextStep("cancelled");
    expect(step).toBeNull();
  });
});
