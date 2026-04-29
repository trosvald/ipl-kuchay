import { describe, expect, it } from "vitest";

import {
  buildPaymentProofPath,
  extensionFromPaymentProofMimeType,
  isAllowedPaymentProofMimeType,
} from "@/lib/storage";

describe("storage helpers", () => {
  it("accepts only supported mime types", () => {
    expect(isAllowedPaymentProofMimeType("image/jpeg")).toBe(true);
    expect(isAllowedPaymentProofMimeType("image/png")).toBe(true);
    expect(isAllowedPaymentProofMimeType("image/webp")).toBe(true);
    expect(isAllowedPaymentProofMimeType("application/pdf")).toBe(true);
    expect(isAllowedPaymentProofMimeType("text/plain")).toBe(false);
  });

  it("maps mime type to extension", () => {
    expect(extensionFromPaymentProofMimeType("image/jpeg")).toBe("jpg");
    expect(extensionFromPaymentProofMimeType("image/png")).toBe("png");
    expect(extensionFromPaymentProofMimeType("image/webp")).toBe("webp");
    expect(extensionFromPaymentProofMimeType("application/pdf")).toBe("pdf");
  });

  it("builds proof path consistently", () => {
    expect(
      buildPaymentProofPath({
        authUserId: "user-1",
        invoiceId: "inv-2",
        submissionId: "sub-3",
        mimeType: "application/pdf",
      }),
    ).toBe("proofs/user-1/inv-2/sub-3.pdf");
  });
});
