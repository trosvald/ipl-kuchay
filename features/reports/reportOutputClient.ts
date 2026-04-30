// Client wrappers for report output Edge Functions.
// These expose concrete invoke contracts so UI can call generate-report-output
// and get-report-output-signed-url without re-deciding payload shapes.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { openSignedArtifactUrl } from "@/lib/privateArtifact";

/**
 * Invoke the generate-report-output Edge Function.
 * Creates a real HTML artifact file and persists the file_path in public.reports.
 *
 * @param payload - report output generation parameters
 * @returns the generated report record with file_path
 */
export async function generateReportOutputArtifact(
  payload: GenerateReportOutputPayload,
): Promise<ReportOutputResult> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await client.functions.invoke<GenerateReportOutputResponse>(
    "generate-report-output",
    { body: payload },
  );

  if (error || !data) {
    throw new Error(`Failed to generate report output: ${error?.message ?? "unknown"}`);
  }

  return data;
}

/**
 * Invoke the get-report-output-signed-url Edge Function.
 * Returns a short-lived signed URL for downloading a private report artifact.
 *
 * @param payload - report identification and access parameters
 * @returns signed URL and expiry information
 */
export async function getReportOutputSignedUrl(
  payload: GetReportOutputSignedUrlPayload,
): Promise<ReportOutputSignedUrlResult> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await client.functions.invoke<GetReportOutputSignedUrlResponse>(
    "get-report-output-signed-url",
    { body: payload },
  );

  if (error || !data) {
    throw new Error(`Failed to get report output signed URL: ${error?.message ?? "unknown"}`);
  }

  return data;
}

export async function openReportOutputArtifact(
  payload: GetReportOutputSignedUrlPayload,
): Promise<void> {
  const result = await getReportOutputSignedUrl(payload);
  await openSignedArtifactUrl(result.signedUrl);
}

// --- Payload and response types ---

export type GenerateReportOutputPayload =
  | {
      reportType: "monthly_summary";
      billingPeriodId: string;
      title: string;
      metadata: MonthlySummaryMetadata;
    }
  | {
      reportType: "receipt";
      billingPeriodId: string;
      invoiceId: string;
      paymentId?: string;
      title: string;
      metadata: ResidentReceiptMetadata;
    };

export interface MonthlySummaryMetadata {
  totalInvoiced: number;
  totalCollected: number;
  totalPending: number;
  periodLabel: string;
  generatedScope: string; // e.g. "all" or "kavling:A01"
  [key: string]: unknown;
}

export interface ResidentReceiptMetadata {
  invoiceNumber: string;
  kavlingCode: string;
  residentName: string;
  amountPaid: number;
  paymentDate: string;
  periodLabel: string;
  [key: string]: unknown;
}

export interface GetReportOutputSignedUrlPayload {
  reportId: string;
}

export interface ReportOutputResult {
  id: string;
  filePath: string;
}

export interface ReportOutputSignedUrlResult {
  signedUrl: string;
  expiresInSeconds: number;
}

export interface GenerateReportOutputResponse {
  id: string;
  filePath: string;
}

export interface GetReportOutputSignedUrlResponse {
  signedUrl: string;
  expiresInSeconds: number;
}
