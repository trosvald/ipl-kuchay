// @ts-expect-error Node TypeScript cannot resolve Deno URL imports in editor mode.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getCallerProfile, requireRole } from "../_shared/auth.ts";
import {
  HttpError,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/responses.ts";
import { createUserClient } from "../_shared/supabase.ts";

interface CreateSubmissionRequest {
  invoiceId?: string;
  amountSubmitted?: number;
  bankAccountId?: string;
  note?: string;
}

interface InvoiceRow {
  id: string;
  amount_due: number;
  amount_paid: number;
  status: string;
}

interface BankAccountRow {
  id: string;
  is_active: boolean;
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeNote(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > 500) {
    throw new HttpError(400, "note max length is 500");
  }

  return trimmed;
}

async function parseRequest(request: Request): Promise<{
  invoiceId: string;
  amountSubmitted: number;
  bankAccountId: string;
  note: string | null;
}> {
  let body: CreateSubmissionRequest;

  try {
    body = (await request.json()) as CreateSubmissionRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isUuid(body.invoiceId)) {
    throw new HttpError(400, "Invalid invoiceId");
  }

  if (!Number.isInteger(body.amountSubmitted) || (body.amountSubmitted ?? 0) <= 0) {
    throw new HttpError(400, "amountSubmitted must be a positive integer");
  }

  if (!isUuid(body.bankAccountId)) {
    throw new HttpError(400, "Invalid bankAccountId");
  }

  const amountSubmitted = body.amountSubmitted;
  if (amountSubmitted === undefined) {
    throw new HttpError(400, "amountSubmitted is required");
  }

  const note = normalizeNote(body.note);

  return {
    invoiceId: body.invoiceId,
    amountSubmitted,
    bankAccountId: body.bankAccountId,
    note,
  };
}

async function handleCreateSubmission(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["resident", "treasurer", "admin", "super_admin"]);

  const input = await parseRequest(request);

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

  if (input.amountSubmitted > outstandingAmount) {
    throw new HttpError(400, "amountSubmitted exceeds outstanding invoice balance");
  }

  const { data: bankAccount, error: bankError } = await userClient
    .from("bank_accounts")
    .select("id, is_active")
    .eq("id", input.bankAccountId)
    .maybeSingle();

  if (bankError) {
    throw new HttpError(400, bankError.message);
  }

  if (!bankAccount || !(bankAccount as BankAccountRow).is_active) {
    throw new HttpError(400, "Bank account not found or inactive");
  }

  const { data: submission, error: insertError } = await userClient
    .from("payment_submissions")
    .insert({
      invoice_id: input.invoiceId,
      submitted_by: caller.id,
      amount_submitted: input.amountSubmitted,
      bank_account_id: input.bankAccountId,
      note: input.note,
      status: "submitted",
    })
    .select("id")
    .single();

  if (insertError || !submission?.id) {
    throw new HttpError(400, insertError?.message ?? "Failed to create payment submission");
  }

  const { error: recalcError } = await userClient.rpc("recalculate_invoice_status", {
    target_invoice_id: input.invoiceId,
  });

  if (recalcError) {
    throw new HttpError(400, recalcError.message);
  }

  return jsonResponse(200, {
    submissionId: submission.id,
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
    return await handleCreateSubmission(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
