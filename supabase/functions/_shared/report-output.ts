// Shared helpers for report output artifact generation.
// Loads invoice/payment data and uploads HTML artifacts to the private report-outputs bucket.

import { createServiceRoleClient } from "./supabase.ts";
import {
  buildMonthlySummaryHtml,
  buildResidentReceiptHtml,
  buildReportOutputPath,
} from "../../../features/reports/reportOutputBuilders.ts";

// --- Kavling lookup for Edge Function report-row insertion ---

export interface KavlingLookupResult {
  kavlingId: string;
}

/**
 * Resolve kavling_id for a receipt by loading the payment's invoice kavling.
 * Used by generate-report-output to set reports.kavling_id without regenerating HTML.
 */
export async function loadResidentReceiptDataForKavling(
  invoiceId: string,
  paymentId: string,
): Promise<KavlingLookupResult> {
  const client = createServiceRoleClient();

  // Verify payment exists and matches invoice
  const { data: payment } = await client
    .from("payments")
    .select("id, invoice_id")
    .eq("id", paymentId)
    .eq("invoice_id", invoiceId)
    .single();

  if (!payment) {
    throw new Error(`Payment ${paymentId} not found for invoice ${invoiceId}`);
  }

  // Get kavling from invoice
  const { data: invoice } = await client
    .from("invoices")
    .select("kavling_id")
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  return { kavlingId: (invoice as { kavling_id: string }).kavling_id };
}

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
 * Loads the exact payments row matched by paymentId and invoiceId, then
 * resolves related kavling/invoice/billing-period context for the receipt.
 */
export async function loadResidentReceiptData(
  invoiceId: string,
  paymentId?: string,
): Promise<ResidentReceiptData & { kavlingId: string }> {
  const client = createServiceRoleClient();

  // Load the specific payment row when paymentId is provided
  // Falls back to first verified payment for the invoice if no paymentId given
  let paymentRow: {
    id: string;
    amount: number;
    method: string;
    paid_at: string;
    notes: string | null;
    verified_by: string | null;
    invoice_id: string;
    payment_submission_id: string | null;
  } | null = null;

  if (paymentId) {
    // Load exact payment row by id + invoice_id pair
    const { data } = await client
      .from("payments")
      .select("id, amount, method, paid_at, notes, verified_by, invoice_id, payment_submission_id")
      .eq("id", paymentId)
      .eq("invoice_id", invoiceId)
      .single();
    paymentRow = data;
  } else {
    // Fallback: load first verified payment for this invoice
    const { data } = await client
      .from("payments")
      .select("id, amount, method, paid_at, notes, verified_by, invoice_id, payment_submission_id")
      .eq("invoice_id", invoiceId)
      .not("verified_by", "is", null)
      .order("paid_at", { ascending: false })
      .limit(1)
      .single();
    paymentRow = data;
  }

  if (!paymentRow) {
    throw new Error(`No verified payment found for invoice: ${invoiceId}`);
  }

  // Load invoice with kavling and billing period info
  const { data: invoice } = await client
    .from("invoices")
    .select(`
      id,
      invoice_number,
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
    .eq("id", (invoice as { billing_period_id?: string }).billing_period_id ?? "")
    .single();

  const periodLabel = period?.label ?? "Unknown Period";

  const kavlingId = (invoice as { kavling_id: string }).kavling_id;
  const kavlingCode = ((invoice as { kavlings?: { code?: string } }).kavlings as { code?: string })?.code || "UNKNOWN";

  function displayNameFromProfile(profile?: { full_name?: string | null; display_name?: string | null }): string | null {
    if (!profile) {
      return null;
    }

    const displayName = profile.display_name?.trim();
    if (displayName) {
      return displayName;
    }

    const fullName = profile.full_name?.trim();
    return fullName || null;
  }

  async function loadSubmitterName(paymentSubmissionId: string): Promise<string | null> {
    const { data } = await client
      .from("payment_submissions")
      .select("submitted_by, profiles!inner(full_name, display_name)")
      .eq("id", paymentSubmissionId)
      .maybeSingle();

    const profile = (data as { profiles?: { full_name?: string | null; display_name?: string | null } } | null)?.profiles;
    return displayNameFromProfile(profile);
  }

  async function loadOccupantNameAtPaymentTime(): Promise<string | null> {
    const paidDate = paymentRow.paid_at.slice(0, 10);
    const baseSelection = "profile_id, is_primary, started_at, profiles!inner(full_name, display_name)";

    const { data: datedResident } = await client
      .from("kavling_residents")
      .select(baseSelection)
      .eq("kavling_id", kavlingId)
      .lte("started_at", paidDate)
      .or(`ended_at.is.null,ended_at.gte.${paidDate}`)
      .order("is_primary", { ascending: false })
      .order("started_at", { ascending: false })
      .order("profile_id", { ascending: true })
      .limit(1)
      .maybeSingle();

    const datedProfile = (datedResident as { profiles?: { full_name?: string | null; display_name?: string | null } } | null)?.profiles;
    const datedName = displayNameFromProfile(datedProfile);
    if (datedName) {
      return datedName;
    }

    const { data: activeResident } = await client
      .from("kavling_residents")
      .select(baseSelection)
      .eq("kavling_id", kavlingId)
      .eq("active", true)
      .order("is_primary", { ascending: false })
      .order("started_at", { ascending: false })
      .order("profile_id", { ascending: true })
      .limit(1)
      .maybeSingle();

    const activeProfile = (activeResident as { profiles?: { full_name?: string | null; display_name?: string | null } } | null)?.profiles;
    return displayNameFromProfile(activeProfile);
  }

  let residentName = "Unknown Resident";
  const submitterName = paymentRow.payment_submission_id
    ? await loadSubmitterName(paymentRow.payment_submission_id)
    : null;
  residentName = submitterName ?? await loadOccupantNameAtPaymentTime() ?? residentName;

  return {
    invoiceId: invoice.id,
    invoiceNumber: (invoice as { invoice_number?: string }).invoice_number || invoice.id,
    kavlingId,
    kavlingCode,
    residentName,
    amountPaid: paymentRow.amount,
    paymentDate: paymentRow.paid_at,
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
): Promise<{ filePath: string; data: ResidentReceiptData & { kavlingId: string } }> {
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
