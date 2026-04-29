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

interface SignedUrlRequest {
  submissionId?: string;
}

interface SubmissionRow {
  id: string;
  proof_path: string | null;
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function parseRequest(request: Request): Promise<{ submissionId: string }> {
  let body: SignedUrlRequest;

  try {
    body = (await request.json()) as SignedUrlRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isUuid(body.submissionId)) {
    throw new HttpError(400, "Invalid submissionId");
  }

  return {
    submissionId: body.submissionId,
  };
}

async function handleGetProofSignedUrl(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const serviceClient = createServiceRoleClient();

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["resident", "treasurer", "admin", "super_admin"]);

  const input = await parseRequest(request);

  const { data: accessibleSubmission, error: accessError } = await userClient
    .from("payment_submissions")
    .select("id")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (accessError) {
    throw new HttpError(400, accessError.message);
  }

  if (!accessibleSubmission) {
    throw new HttpError(404, "Submission not found or not accessible");
  }

  const { data: submission, error: submissionError } = await serviceClient
    .from("payment_submissions")
    .select("id, proof_path")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (submissionError) {
    throw new HttpError(500, submissionError.message);
  }

  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }

  const row = submission as SubmissionRow;

  if (!row.proof_path) {
    throw new HttpError(404, "Proof path is not attached");
  }

  const expiresInSeconds = 300;
  const { data: signed, error: signedUrlError } = await serviceClient.storage
    .from("payment-proofs")
    .createSignedUrl(row.proof_path, expiresInSeconds);

  if (signedUrlError || !signed?.signedUrl) {
    throw new HttpError(500, signedUrlError?.message ?? "Failed to create signed URL");
  }

  return jsonResponse(200, {
    signedUrl: signed.signedUrl,
    expiresInSeconds,
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
    return await handleGetProofSignedUrl(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
