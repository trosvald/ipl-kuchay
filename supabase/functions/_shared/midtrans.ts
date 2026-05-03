import { createHash } from "node:crypto";

import { HttpError } from "./responses.ts";
import { getOptionalEnv } from "./supabase.ts";

export interface MidtransChargeResponse {
  status_code?: string;
  status_message?: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  transaction_status?: string;
  payment_type?: string;
  qr_string?: string;
  actions?: Array<{ name?: string; url?: string }>;
  [key: string]: unknown;
}

interface MidtransChargeRequest {
  orderId: string;
  grossAmount: number;
}

function getMidtransConfig() {
  const serverKey = getOptionalEnv("MIDTRANS_SERVER_KEY");
  if (!serverKey) {
    throw new HttpError(500, "Missing MIDTRANS_SERVER_KEY");
  }

  const isProduction = getOptionalEnv("MIDTRANS_IS_PRODUCTION") === "true";
  const baseUrl = isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";

  return { serverKey, baseUrl };
}

export function computeMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey?: string;
}): string {
  const secret = input.serverKey ?? getMidtransConfig().serverKey;
  const raw = `${input.orderId}${input.statusCode}${input.grossAmount}${secret}`;
  return createHash("sha512").update(raw).digest("hex");
}

export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const expected = computeMidtransSignature({
    orderId: input.orderId,
    statusCode: input.statusCode,
    grossAmount: input.grossAmount,
  });

  return expected.toLowerCase() === input.signatureKey.toLowerCase();
}

export async function createQrisCharge(input: MidtransChargeRequest): Promise<MidtransChargeResponse> {
  if (!Number.isInteger(input.grossAmount) || input.grossAmount <= 0) {
    throw new HttpError(400, "grossAmount must be positive integer");
  }

  const { serverKey, baseUrl } = getMidtransConfig();

  const payload = {
    payment_type: "qris",
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.grossAmount,
    },
  };

  const authToken = btoa(`${serverKey}:`);
  const response = await fetch(`${baseUrl}/v2/charge`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as MidtransChargeResponse;
  if (!response.ok) {
    throw new HttpError(400, `Midtrans charge failed: ${data.status_message ?? "unknown error"}`);
  }

  return data;
}
