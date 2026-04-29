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

interface CancelSubmissionRequest {
  submissionId?: string;
  reason?: string;
}

interface SubmissionRow {
  id: string;
  invoice_id: string;
  submitted_by: string;
  status: "submitted" | "verified" | "rejected" | "cancelled";
  proof_path: string | null;
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function parseRequest(request: Request): Promise<{
  submissionId: string;
  reason: string;
}> {
  let body: CancelSubmissionRequest;

  try {
    body = (await request.json()) as CancelSubmissionRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isUuid(body.submissionId)) {
    throw new HttpError(400, "Invalid submissionId");
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "upload_failed";

  return {
    submissionId: body.submissionId,
    reason: reason || "upload_failed",
  };
}

async function handleCancelSubmission(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const serviceClient = createServiceRoleClient();

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["resident", "treasurer", "admin", "super_admin"]);

  const input = await parseRequest(request);

  const { data: submission, error: submissionError } = await serviceClient
    .from("payment_submissions")
    .select("id, invoice_id, submitted_by, status, proof_path")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (submissionError) {
    throw new HttpError(500, submissionError.message);
  }

  if (!submission) {
    return jsonResponse(200, { success: true, skipped: true });
  }

  const row = submission as SubmissionRow;

  if (row.submitted_by !== caller.id) {
    throw new HttpError(403, "Forbidden");
  }

  if (row.status !== "submitted") {
    return jsonResponse(200, { success: true, skipped: true });
  }

  if (row.proof_path) {
    await serviceClient.from("payment_submissions").update({
      status: "cancelled",
      note: `Cancelled: ${input.reason}`,
    }).eq("id", row.id);
  } else {
    const { error: deleteError } = await serviceClient
      .from("payment_submissions")
      .delete()
      .eq("id", row.id);

    if (deleteError) {
      throw new HttpError(500, deleteError.message);
    }
  }

  const { error: recalcError } = await serviceClient.rpc("recalculate_invoice_status", {
    target_invoice_id: row.invoice_id,
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
    return await handleCancelSubmission(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
