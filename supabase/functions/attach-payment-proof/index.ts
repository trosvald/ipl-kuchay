// @ts-expect-error Node TypeScript cannot resolve Deno URL imports in editor mode.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getCallerProfile, requireRole } from "../_shared/auth.ts";
import {
  HttpError,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/responses.ts";
import {
  createServiceRoleClient,
  createUserClient,
} from "../_shared/supabase.ts";

interface AttachProofRequest {
  submissionId?: string;
  proofPath?: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface SubmissionRow {
  id: string;
  invoice_id: string;
  submitted_by: string;
  status: "submitted" | "verified" | "rejected" | "cancelled";
  proof_path: string | null;
}

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const maxSizeBytes = 5 * 1024 * 1024;

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function parseRequest(request: Request): Promise<{
  submissionId: string;
  proofPath: string;
  mimeType: string;
  sizeBytes: number;
}> {
  let body: AttachProofRequest;

  try {
    body = (await request.json()) as AttachProofRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isUuid(body.submissionId)) {
    throw new HttpError(400, "Invalid submissionId");
  }

  if (typeof body.proofPath !== "string" || body.proofPath.trim().length === 0) {
    throw new HttpError(400, "Invalid proofPath");
  }

  if (typeof body.mimeType !== "string" || !allowedMimeTypes.has(body.mimeType)) {
    throw new HttpError(400, "Unsupported proof MIME type");
  }

  if (!Number.isInteger(body.sizeBytes) || (body.sizeBytes ?? 0) <= 0) {
    throw new HttpError(400, "sizeBytes must be a positive integer");
  }

  if ((body.sizeBytes ?? 0) > maxSizeBytes) {
    throw new HttpError(400, "Proof file exceeds 5 MB limit");
  }

  const sizeBytes = body.sizeBytes;
  if (sizeBytes === undefined) {
    throw new HttpError(400, "sizeBytes is required");
  }

  return {
    submissionId: body.submissionId,
    proofPath: body.proofPath.trim(),
    mimeType: body.mimeType,
    sizeBytes,
  };
}

function buildExpectedProofPath(callerId: string, invoiceId: string, submissionId: string): RegExp {
  return new RegExp(String.raw`^proofs/${callerId}/${invoiceId}/${submissionId}\.(jpg|png|webp|pdf)$`, "i");
}

async function handleAttachProof(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const serviceClient = createServiceRoleClient();

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["resident", "treasurer", "admin", "super_admin"]);

  const input = await parseRequest(request);

  const { data: accessibleSubmission, error: userReadError } = await userClient
    .from("payment_submissions")
    .select("id")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (userReadError) {
    throw new HttpError(400, userReadError.message);
  }

  if (!accessibleSubmission) {
    throw new HttpError(404, "Submission not found or not accessible");
  }

  const { data: submission, error: submissionError } = await serviceClient
    .from("payment_submissions")
    .select("id, invoice_id, submitted_by, status, proof_path")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (submissionError) {
    throw new HttpError(500, submissionError.message);
  }

  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }

  const submissionRow = submission as SubmissionRow;

  if (submissionRow.submitted_by !== caller.id) {
    throw new HttpError(403, "Only submission owner can attach proof");
  }

  if (submissionRow.status !== "submitted") {
    throw new HttpError(400, "Submission is not in submitted status");
  }

  if (submissionRow.proof_path) {
    throw new HttpError(400, "Proof metadata already attached");
  }

  const expectedPattern = buildExpectedProofPath(caller.id, submissionRow.invoice_id, submissionRow.id);
  if (!expectedPattern.test(input.proofPath)) {
    throw new HttpError(400, "proofPath does not match expected pattern");
  }

  const { error: updateError } = await serviceClient
    .from("payment_submissions")
    .update({
      proof_path: input.proofPath,
      proof_mime_type: input.mimeType,
      proof_size_bytes: input.sizeBytes,
    })
    .eq("id", input.submissionId);

  if (updateError) {
    throw new HttpError(500, updateError.message);
  }

  const { error: recalcError } = await serviceClient.rpc("recalculate_invoice_status", {
    target_invoice_id: submissionRow.invoice_id,
  });

  if (recalcError) {
    throw new HttpError(500, recalcError.message);
  }

  return jsonResponse(200, {
    success: true,
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
    return await handleAttachProof(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
