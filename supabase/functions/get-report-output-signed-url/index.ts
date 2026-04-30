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

interface GetReportOutputSignedUrlRequest {
  reportId: string;
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function parseRequest(request: Request): Promise<GetReportOutputSignedUrlRequest> {
  let body: GetReportOutputSignedUrlRequest;

  try {
    body = (await request.json()) as GetReportOutputSignedUrlRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isUuid(body.reportId)) {
    throw new HttpError(400, "Invalid reportId");
  }

  return { reportId: body.reportId };
}

async function handleGetReportOutputSignedUrl(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const serviceClient = createServiceRoleClient();

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["resident", "treasurer", "admin", "super_admin"]);

  const input = await parseRequest(request);

  // Check the target report row through the caller-scoped client (RLS-applied)
  const { data: accessibleReport, error: accessError } = await userClient
    .from("reports")
    .select("id, file_path, report_type")
    .eq("id", input.reportId)
    .maybeSingle();

  if (accessError) {
    throw new HttpError(400, accessError.message);
  }

  if (!accessibleReport) {
    throw new HttpError(404, "Report not found or not accessible");
  }

  const report = accessibleReport as { id: string; file_path: string | null; report_type: string };

  if (!report.file_path) {
    throw new HttpError(404, "Report file path is not set — artifact not yet generated");
  }

  // Use service-role client to create signed URL
  const expiresInSeconds = 300; // 5 minutes short-lived per D-05

  const { data: signed, error: signedUrlError } = await serviceClient.storage
    .from("report-outputs")
    .createSignedUrl(report.file_path, expiresInSeconds);

  if (signedUrlError || !signed?.signedUrl) {
    throw new HttpError(500, signedUrlError?.message ?? "Failed to create signed URL");
  }

  // Audit finance downloads (treasurer/admin/super_admin) per T-03-16
  if (caller.role === "treasurer" || caller.role === "admin" || caller.role === "super_admin") {
    const { error: auditError } = await serviceClient.from("audit_logs").insert({
      actor_id: caller.id,
      actor_role: caller.role,
      action: "report_output.signed_url",
      entity_table: "reports",
      entity_id: report.id,
      before_data: null,
      after_data: {
        report_id: report.id,
        file_path: report.file_path,
        report_type: report.report_type,
        expires_in_seconds: expiresInSeconds,
      },
      request_id: request.headers.get("x-request-id"),
    });

    if (auditError) {
      throw new HttpError(500, auditError.message);
    }
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
    return await handleGetReportOutputSignedUrl(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});