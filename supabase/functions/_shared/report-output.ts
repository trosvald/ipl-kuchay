// Shared helpers for report output artifact generation.
// Loads invoice/payment data and uploads HTML artifacts to the private report-outputs bucket.

import { createServiceRoleClient } from "./supabase.ts";
import {
  buildMonthlySummaryHtml,
  buildResidentReceiptHtml,
  buildReportOutputPath,
} from "@/features/reports/reportOutputBuilders.ts";

// --- Data loading helpers ---

export interface MonthlySummaryData {
  periodLabel: string;
  totalInvoiced: number;
  totalCollected: number;
  totalPending: number;
  generatedScope: string;
}

export interface ResidentReceiptData {
  invoiceId: string;
  invoiceNumber: string;
  kavlingCode: string;
  residentName: string;
  amountPaid: number;
  paymentDate: string;
  periodLabel: string;
}

export interface GenerateReportContext {
  billingPeriodId: string;
  kavlingId?: string;
  invoiceId?: string;
  paymentId?: string;
}

/**
 * Load monthly summary data for a billing period (optionally filtered to a kavling).
 */
export async function loadMonthlySummaryData(
  billingPeriodId: string,
  kavlingId?: string,
): Promise<MonthlySummaryData> {
  const client = createServiceRoleClient();

  // Load billing period label
  const { data: period } = await client
    .from("billing_periods")
    .select("label")
    .eq("id", billingPeriodId)
    .single();

  const periodLabel = period?.label ?? "Unknown Period";

  // Load invoice aggregation
  let query = client
    .from("invoices")
    .select(`
      id,
      amount_due,
      amount_paid,
      status,
      kavling_id,
      kavlings!inner(code)
    `)
    .eq("billing_period_id", billingPeriodId);

  if (kavlingId) {
    query = query.eq("kavling_id", kavlingId);
  }

  const { data: invoices } = await query;

  let totalInvoiced = 0;
  let totalCollected = 0;

  if (invoices && invoices.length > 0) {
    for (const inv of invoices) {
      totalInvoiced += inv.amount_due;
      totalCollected += inv.amount_paid;
    }
  }

  const totalPending = totalInvoiced - totalCollected;
  const generatedScope = kavlingId ? `kavling:${kavlingId}` : "all";

  return {
    periodLabel,
    totalInvoiced,
    totalCollected,
    totalPending,
    generatedScope,
  };
}

/**
 * Load resident receipt data for a specific invoice/payment pair.
 */
export async function loadResidentReceiptData(
  invoiceId: string,
  paymentId?: string,
): Promise<ResidentReceiptData> {
  const client = createServiceRoleClient();

  // Load invoice with kavling info
  const { data: invoice } = await client
    .from("invoices")
    .select(`
      id,
      invoice_number,
      amount_paid,
      paid_at,
      billing_period_id,
      kavling_id,
      kavlings!inner(code)
    `)
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  // Load billing period label
  const { data: period } = await client
    .from("billing_periods")
    .select("label")
    .eq("id", invoice.billing_period_id)
    .single();

  const periodLabel = period?.label ?? "Unknown Period";

  // Load resident name from kavling_residents
  const { data: resident } = await client
    .from("kavling_residents")
    .select(`profile_id, profiles!inner(full_name, display_name)`)
    .eq("kavling_id", invoice.kavling_id)
    .eq("active", true)
    .limit(1)
    .single();

  let residentName = "Unknown Resident";
  if (resident && (resident as { profiles?: { full_name?: string; display_name?: string } }).profiles) {
    const profile = (resident as { profiles: { full_name?: string; display_name?: string } }).profiles;
    residentName = profile.display_name?.trim() || profile.full_name || "Unknown Resident";
  }

  const paymentDate = invoice.paid_at || new Date().toISOString();

  return {
    invoiceId: invoice.id,
    invoiceNumber: (invoice as { invoice_number?: string }).invoice_number || invoice.id,
    kavlingCode: ((invoice as { kavlings?: { code?: string } }).kavlings as { code?: string })?.code || "UNKNOWN",
    residentName,
    amountPaid: invoice.amount_paid,
    paymentDate,
    periodLabel,
  };
}

/**
 * Upload an HTML artifact to the report-outputs bucket using service role.
 * Returns the storage path.
 */
export async function uploadReportArtifact(
  htmlContent: string,
  storagePath: string,
): Promise<string> {
  const client = createServiceRoleClient();

  const { error } = await client.storage
    .from("report-outputs")
    .upload(storagePath, new TextEncoder().encode(htmlContent), {
      contentType: "text/html;charset=utf-8",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload report artifact: ${error.message}`);
  }

  return storagePath;
}

/**
 * Build and upload a monthly summary artifact.
 */
export async function generateMonthlySummaryArtifact(
  billingPeriodId: string,
  kavlingId?: string,
): Promise<{ filePath: string; data: MonthlySummaryData }> {
  const data = await loadMonthlySummaryData(billingPeriodId, kavlingId);

  const reportId = crypto.randomUUID();
  const storagePath = buildReportOutputPath({
    reportType: "monthly_summary",
    billingPeriodId,
    reportId,
  });

  const html = buildMonthlySummaryHtml({
    periodLabel: data.periodLabel,
    totalInvoiced: data.totalInvoiced,
    totalCollected: data.totalCollected,
    totalPending: data.totalPending,
    generatedAt: new Date().toISOString(),
    generatedScope: data.generatedScope,
  });

  await uploadReportArtifact(html, storagePath);

  return { filePath: storagePath, data };
}

/**
 * Build and upload a resident receipt artifact.
 */
export async function generateResidentReceiptArtifact(
  invoiceId: string,
  paymentId?: string,
): Promise<{ filePath: string; data: ResidentReceiptData }> {
  const data = await loadResidentReceiptData(invoiceId, paymentId);

  const reportId = crypto.randomUUID();
  const storagePath = buildReportOutputPath({
    reportType: "receipt",
    billingPeriodId: "", // not needed for receipt path
    invoiceId,
    reportId,
  });

  const html = buildResidentReceiptHtml({
    invoiceId: data.invoiceId,
    invoiceNumber: data.invoiceNumber,
    kavlingCode: data.kavlingCode,
    residentName: data.residentName,
    amountPaid: data.amountPaid,
    paymentDate: data.paymentDate,
    periodLabel: data.periodLabel,
  });

  await uploadReportArtifact(html, storagePath);

  return { filePath: storagePath, data };
}