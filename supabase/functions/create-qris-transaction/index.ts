// @ts-expect-error Node TypeScript cannot resolve Deno URL imports in editor mode.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getCallerProfile, requireRole } from "../_shared/auth.ts";
import { createQrisCharge } from "../_shared/midtrans.ts";
import { HttpError, jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";
import { createServiceRoleClient, createUserClient } from "../_shared/supabase.ts";

interface CreateQrisRequest {
  invoiceId?: string;
}

interface InvoiceRow {
  id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
}

interface PaymentGatewayConfig {
  qris_enabled?: boolean;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function parseRequest(request: Request): Promise<{ invoiceId: string }> {
  let body: CreateQrisRequest;
  try {
    body = (await request.json()) as CreateQrisRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isUuid(body.invoiceId)) {
    throw new HttpError(400, "Invalid invoiceId");
  }

  return { invoiceId: body.invoiceId };
}

function buildProviderOrderId(invoiceId: string): string {
  const compactInvoice = invoiceId.replaceAll("-", "").slice(0, 16).toUpperCase();
  const timestamp = Date.now();
  return `IPL-QRIS-${compactInvoice}-${timestamp}`;
}

function resolveQrUrl(actions: Array<{ name?: string; url?: string }> | undefined): string | null {
  if (!actions) {
    return null;
  }

  const action = actions.find((item) => item.name === "generate-qr-code" && typeof item.url === "string");
  return action?.url ?? null;
}

async function requireQrisEnabled(serviceClient: ReturnType<typeof createServiceRoleClient>): Promise<void> {
  const { data, error } = await serviceClient.rpc("get_resident_payment_gateway_config");

  if (error) {
    throw new HttpError(500, error.message);
  }

  const config = data as PaymentGatewayConfig | null;
  if (config?.qris_enabled !== true) {
    throw new HttpError(403, "QRIS payment is disabled");
  }
}

async function handleCreateQris(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const serviceClient = createServiceRoleClient();

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["resident", "treasurer", "admin", "super_admin"]);

  const input = await parseRequest(request);
  await requireQrisEnabled(serviceClient);

  const { data: invoice, error: invoiceError } = await userClient
    .from("invoices")
    .select("id, amount_due, amount_paid, status")
    .eq("id", input.invoiceId)
    .maybeSingle();

  if (invoiceError) {
    throw new HttpError(400, invoiceError.message);
  }
  if (!invoice) {
    throw new HttpError(404, "Invoice not found or not accessible");
  }

  const invoiceRow = invoice as InvoiceRow;
  const outstandingAmount = Math.max(invoiceRow.amount_due - invoiceRow.amount_paid, 0);
  if (outstandingAmount <= 0) {
    throw new HttpError(400, "Invoice outstanding is already zero");
  }

  if (!["unpaid", "partial", "overdue", "pending_verification", "rejected"].includes(invoiceRow.status)) {
    throw new HttpError(400, "Invoice is not eligible for QRIS payment");
  }

  const { data: pendingTxn, error: pendingError } = await serviceClient
    .from("payment_gateway_transactions")
    .select("id")
    .eq("invoice_id", invoiceRow.id)
    .in("status", ["created", "pending"])
    .maybeSingle();

  if (pendingError) {
    throw new HttpError(500, pendingError.message);
  }
  if (pendingTxn?.id) {
    throw new HttpError(409, "Invoice already has an active QRIS transaction");
  }

  const providerOrderId = buildProviderOrderId(invoiceRow.id);
  const chargeResponse = await createQrisCharge({
    orderId: providerOrderId,
    grossAmount: outstandingAmount,
  });

  const gatewayStatus = (chargeResponse.transaction_status ?? "pending") as
    | "created"
    | "pending"
    | "settlement"
    | "capture"
    | "deny"
    | "cancel"
    | "expire"
    | "failure"
    | "refund"
    | "unknown";

  const qrImageUrl = resolveQrUrl(chargeResponse.actions);

  const { data: insertedRow, error: insertError } = await serviceClient
    .from("payment_gateway_transactions")
    .insert({
      invoice_id: invoiceRow.id,
      provider: "midtrans",
      provider_order_id: providerOrderId,
      provider_transaction_id: chargeResponse.transaction_id ?? null,
      amount: outstandingAmount,
      status: gatewayStatus,
      payment_type: chargeResponse.payment_type ?? "qris",
      qr_string: chargeResponse.qr_string ?? null,
      qr_image_url: qrImageUrl,
      raw_create_response: chargeResponse,
      created_by: caller.id,
    })
    .select("id, provider_order_id, status, payment_type, qr_string, qr_image_url")
    .single();

  if (insertError || !insertedRow) {
    throw new HttpError(500, insertError?.message ?? "Failed to persist QRIS transaction");
  }

  return jsonResponse(200, {
    transactionId: insertedRow.id,
    providerOrderId: insertedRow.provider_order_id,
    status: insertedRow.status,
    paymentType: insertedRow.payment_type,
    qrString: insertedRow.qr_string,
    qrImageUrl: insertedRow.qr_image_url,
    rawResponse: chargeResponse,
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
    return await handleCreateQris(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
