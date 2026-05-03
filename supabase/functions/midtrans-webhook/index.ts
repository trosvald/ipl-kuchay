// @ts-expect-error Node TypeScript cannot resolve Deno URL imports in editor mode.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { verifyMidtransSignature } from "../_shared/midtrans.ts";
import { HttpError, jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

interface MidtransWebhookPayload {
  order_id?: string;
  transaction_id?: string;
  transaction_status?: string;
  status_code?: string;
  gross_amount?: string;
  payment_type?: string;
  signature_key?: string;
  [key: string]: unknown;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} is required`);
  }
  return value.trim();
}

async function parseRequest(request: Request): Promise<MidtransWebhookPayload> {
  try {
    return (await request.json()) as MidtransWebhookPayload;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

async function handleWebhook(request: Request): Promise<Response> {
  const serviceClient = createServiceRoleClient();
  const payload = await parseRequest(request);

  const orderId = requireText(payload.order_id, "order_id");
  const statusCode = requireText(payload.status_code, "status_code");
  const grossAmount = requireText(payload.gross_amount, "gross_amount");
  const transactionStatus = requireText(payload.transaction_status, "transaction_status");
  const signatureKey = requireText(payload.signature_key, "signature_key");
  const transactionId = typeof payload.transaction_id === "string" ? payload.transaction_id : "";
  const paymentType = typeof payload.payment_type === "string" ? payload.payment_type : "qris";

  const signatureValid = verifyMidtransSignature({
    orderId,
    statusCode,
    grossAmount,
    signatureKey,
  });

  if (!signatureValid) {
    await serviceClient
      .from("payment_gateway_transactions")
      .update({ raw_last_notification: payload })
      .eq("provider_order_id", orderId);

    throw new HttpError(403, "Invalid signature");
  }

  const { data: reconcileResult, error: reconcileError } = await serviceClient.rpc(
    "reconcile_midtrans_qris_notification",
    {
      input_order_id: orderId,
      input_transaction_id: transactionId,
      input_transaction_status: transactionStatus,
      input_status_code: statusCode,
      input_gross_amount: grossAmount,
      input_payment_type: paymentType,
      input_raw_notification: payload,
    },
  );

  if (reconcileError) {
    throw new HttpError(400, reconcileError.message);
  }

  return jsonResponse(200, {
    success: true,
    orderId,
    status: reconcileResult,
  });
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    return await handleWebhook(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
