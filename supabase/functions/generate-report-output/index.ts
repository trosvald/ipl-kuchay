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
import {
  generateMonthlySummaryArtifact,
  generateResidentReceiptArtifact,
} from "../_shared/report-output.ts";

interface GenerateReportOutputRequest {
  reportType: "monthly_summary" | "receipt";
  billingPeriodId: string;
  invoiceId?: string;
  paymentId?: string;
  kavlingId?: string;
  title: string;
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function parseRequest(request: Request): Promise<GenerateReportOutputRequest> {
  let body: GenerateReportOutputRequest;

  try {
    body = (await request.json()) as GenerateReportOutputRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!body.reportType || !["monthly_summary", "receipt"].includes(body.reportType)) {
    throw new HttpError(400, "Invalid or missing reportType");
  }

  if (!isUuid(body.billingPeriodId)) {
    throw new HttpError(400, "Invalid billingPeriodId");
  }

  if (body.reportType === "receipt") {
    if (!body.invoiceId || !isUuid(body.invoiceId)) {
      throw new HttpError(400, "Invalid or missing invoiceId for receipt");
    }
  }

  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
    throw new HttpError(400, "Invalid or missing title");
  }

  return body;
}

async function handleGenerateReportOutput(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const serviceClient = createServiceRoleClient();

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["treasurer", "admin", "super_admin"]);

  const input = await parseRequest(request);

  let filePath: string;
  let metadata: Record<string, unknown>;

  if (input.reportType === "monthly_summary") {
    const result = await generateMonthlySummaryArtifact(
      input.billingPeriodId,
      input.kavlingId,
    );

    filePath = result.filePath;
    metadata = {
      total_invoiced: result.data.totalInvoiced,
      total_collected: result.data.totalCollected,
      total_pending: result.data.totalPending,
      period_label: result.data.periodLabel,
      generated_scope: result.data.generatedScope,
      invoice_count: 0, // calculated separately if needed
    };
  } else {
    // receipt
    const result = await generateResidentReceiptArtifact(
      input.invoiceId!,
      input.paymentId,
    );

    filePath = result.filePath;
    metadata = {
      invoice_id: result.data.invoiceId,
      invoice_number: result.data.invoiceNumber,
      kavling_code: result.data.kavlingCode,
      resident_name: result.data.residentName,
      amount_paid: result.data.amountPaid,
      payment_date: result.data.paymentDate,
      period_label: result.data.periodLabel,
    };
  }

  // Insert/upsert report row in public.reports
  const { data: report, error: reportError } = await serviceClient
    .from("reports")
    .insert({
      report_type: input.reportType,
      billing_period_id: input.billingPeriodId,
      title: input.title.trim(),
      file_path: filePath,
      metadata,
      generated_by: caller.id,
    })
    .select("id, file_path")
    .single();

  if (reportError) {
    throw new HttpError(500, `Failed to persist report record: ${reportError.message}`);
  }

  return jsonResponse(200, {
    id: report.id,
    filePath: report.file_path,
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
    return await handleGenerateReportOutput(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});