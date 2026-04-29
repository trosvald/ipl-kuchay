export const PAYMENT_PROOF_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type PaymentProofMimeType = (typeof PAYMENT_PROOF_ALLOWED_MIME_TYPES)[number];

export const PAYMENT_PROOF_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const mimeToExtension: Record<PaymentProofMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function isAllowedPaymentProofMimeType(value: string): value is PaymentProofMimeType {
  return PAYMENT_PROOF_ALLOWED_MIME_TYPES.includes(value as PaymentProofMimeType);
}

export function validatePaymentProofFile(file: File): string | null {
  if (!isAllowedPaymentProofMimeType(file.type)) {
    return "Format bukti harus JPG, PNG, WEBP, atau PDF.";
  }

  if (file.size > PAYMENT_PROOF_MAX_SIZE_BYTES) {
    return "Ukuran bukti maksimal 5 MB.";
  }

  if (file.size <= 0) {
    return "File bukti tidak valid.";
  }

  return null;
}

export function extensionFromPaymentProofMimeType(mimeType: PaymentProofMimeType): string {
  return mimeToExtension[mimeType];
}

export function buildPaymentProofPath(input: {
  authUserId: string;
  invoiceId: string;
  submissionId: string;
  mimeType: PaymentProofMimeType;
}): string {
  const ext = extensionFromPaymentProofMimeType(input.mimeType);
  return `proofs/${input.authUserId}/${input.invoiceId}/${input.submissionId}.${ext}`;
}
