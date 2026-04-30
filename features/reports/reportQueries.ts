// Typed Supabase data readers for collection summary and arrears datasets.
// loadCollectionSummary and loadArrearsList are the single source of truth for
// report data — shared between UI rendering and CSV export to avoid divergent finance truth.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type {
  CollectionSummaryRow,
  ArrearsRow,
  BillingPeriodSummary,
} from "@/features/reports/reportSchemas";

interface KavlingSummary {
  code: string;
}

interface ProfileSummary {
  full_name: string;
  display_name: string | null;
}

interface InvoiceSummary {
  id: string;
  kavling_id: string;
  kavlings: KavlingSummary | KavlingSummary[] | null;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  billing_period_id: string;
}

interface PeriodSummary {
  id: string;
  year: number;
  month: number;
  label: string;
  status: string;
  invoices: InvoiceSummary[] | unknown[];
}

/**
 * Load per-kavling collection summary for a billing period.
 * Returns aggregated invoice/payment totals per kavling with owner names.
 */
export async function loadCollectionSummary(
  billingPeriodId: string,
): Promise<CollectionSummaryRow[]> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

const { data, error } = await client
    .from("invoices")
    .select(
      `
      id,
      kavling_id,
      kavlings!inner(code),
      amount_due,
      amount_paid,
      due_date,
      status,
      paid_at,
      billing_period_id,
      invoice_items(amount)
    `,
    )
    .eq("billing_period_id", billingPeriodId);

  if (error) {
    throw new Error(`Failed to load collection summary: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Aggregate per kavling
  const kavlingMap = new Map<string, {
    kavling_id: string;
    kavling_code: string;
    owner_name: string | null;
    period_label: string;
    total_invoiced: number;
    total_paid: number;
    total_pending: number;
    remaining_balance: number;
    invoice_count: number;
    paid_count: number;
    pending_count: number;
  }>();

  for (const raw of data) {
    const invoice = raw as unknown as InvoiceSummary;
    const kavlingId = invoice.kavling_id;
    const kavlingCode = getKavlingCode(invoice.kavlings);

    if (!kavlingMap.has(kavlingId)) {
      kavlingMap.set(kavlingId, {
        kavling_id: kavlingId,
        kavling_code: kavlingCode,
        owner_name: null,
        period_label: "",
        total_invoiced: 0,
        total_paid: 0,
        total_pending: 0,
        remaining_balance: 0,
        invoice_count: 0,
        paid_count: 0,
        pending_count: 0,
      });
    }

    const entry = kavlingMap.get(kavlingId)!;
    const remainingBalance = invoice.amount_due - invoice.amount_paid;

    entry.total_invoiced += invoice.amount_due;
    entry.total_paid += invoice.amount_paid;
    entry.remaining_balance += remainingBalance;
    entry.invoice_count += 1;

    if (invoice.status === "paid") {
      entry.paid_count += 1;
    } else if (
      invoice.status === "pending_verification" ||
      invoice.status === "partial"
    ) {
      entry.pending_count += 1;
      entry.total_pending += remainingBalance;
    }
  }

// Load owner names per kavling — map all active residents by kavling_id
    // so every summary row gets its own owner (no global .limit(1) which drops multi-kavling names)
    if (kavlingMap.size > 0) {
      const kavlingIds = Array.from(kavlingMap.keys());
      const { data: residentData } = await client
        .from("kavling_residents")
        .select(`kavling_id, profiles(full_name, display_name)`)
        .in("kavling_id", kavlingIds)
        .eq("active", true);

      if (residentData && Array.isArray(residentData)) {
        for (const kr of residentData) {
          const krTyped = kr as { kavling_id: string; profiles: ProfileSummary | ProfileSummary[] | null };
          const entry = kavlingMap.get(krTyped.kavling_id);
          if (entry && krTyped.profiles) {
            const profile = getFirstProfile(krTyped.profiles);
            if (profile) {
              entry.owner_name = profile.display_name?.trim() || profile.full_name;
            }
          }
        }
      }
    }

  // Load period label
  const { data: periodData } = await client
    .from("billing_periods")
    .select("label")
    .eq("id", billingPeriodId)
    .single();

  const periodLabel = periodData?.label ?? "";

  return Array.from(kavlingMap.values()).map((entry) => ({
    ...entry,
    period_label: periodLabel,
  }));
}

/**
 * Load arrears list — kavlings with outstanding (non-zero remaining) balance.
 * Ordered by days overdue descending for follow-up prioritization.
 */
export async function loadArrearsList(
  billingPeriodId: string,
): Promise<ArrearsRow[]> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await client
    .from("invoices")
    .select(
      `
      id,
      kavling_id,
      kavlings!inner(code),
      amount_due,
      amount_paid,
      due_date,
      status,
      paid_at,
      billing_period_id
    `,
    )
    .eq("billing_period_id", billingPeriodId)
    .neq("status", "paid")
    .neq("status", "waived")
    .neq("status", "cancelled");

  if (error) {
    throw new Error(`Failed to load arrears list: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const arrears: ArrearsRow[] = [];
  const now = new Date();

  for (const raw of data) {
    const invoice = raw as unknown as InvoiceSummary;
    const remainingBalance = invoice.amount_due - invoice.amount_paid;
    if (remainingBalance <= 0) {
      continue; // skip fully-paid or overpaid
    }

    const dueDate = new Date(invoice.due_date);
    const daysOverdue = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    arrears.push({
      kavling_id: invoice.kavling_id,
      kavling_code: getKavlingCode(invoice.kavlings),
      owner_name: null,
      period_label: "",
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      due_date: invoice.due_date,
      days_overdue: daysOverdue > 0 ? daysOverdue : 0,
      last_payment_date: invoice.paid_at ?? null,
      invoice_status: invoice.status,
    });
  }

// Load owner names per kavling — map all active residents by kavling_id
    // so every arrears row gets its own owner (no global .limit(1) which drops multi-kavling names)
    if (arrears.length > 0) {
      const kavlingIds = arrears.map((a) => a.kavling_id);
      const { data: residentData } = await client
        .from("kavling_residents")
        .select(`kavling_id, profiles(full_name, display_name)`)
        .in("kavling_id", kavlingIds)
        .eq("active", true);

      if (residentData && Array.isArray(residentData)) {
        for (const kr of residentData) {
          const krTyped = kr as { kavling_id: string; profiles: ProfileSummary | ProfileSummary[] | null };
          const entry = arrears.find((a) => a.kavling_id === krTyped.kavling_id);
          if (entry && krTyped.profiles) {
            const profile = getFirstProfile(krTyped.profiles);
            if (profile) {
              entry.owner_name = profile.display_name?.trim() || profile.full_name;
            }
          }
        }
      }
    }

  // Load period label
  const { data: periodData } = await client
    .from("billing_periods")
    .select("label")
    .eq("id", billingPeriodId)
    .single();

  const periodLabel = periodData?.label ?? "";

  return arrears
    .map((entry) => ({ ...entry, period_label: periodLabel }))
    .sort((a, b) => b.days_overdue - a.days_overdue);
}

/**
 * Load billing period summaries for the period filter dropdown.
 * Returns all periods with collection stats for quick overview.
 */
export async function loadBillingPeriodSummaries(): Promise<BillingPeriodSummary[]> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await client
    .from("billing_periods")
    .select(
      `
      id,
      year,
      month,
      label,
      status,
      invoices(id, amount_due, amount_paid, status)
    `,
    )
    .in("status", ["open", "closed", "archived"])
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    throw new Error(`Failed to load billing period summaries: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return (data as PeriodSummary[]).map((period) => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let arrearsCount = 0;

    const invoices = (period.invoices as InvoiceSummary[]) ?? [];

    for (const inv of invoices) {
      totalInvoiced += inv.amount_due;
      totalCollected += inv.amount_paid;
      if (
        inv.status !== "paid" &&
        inv.status !== "waived" &&
        inv.status !== "cancelled" &&
        inv.amount_paid < inv.amount_due
      ) {
        arrearsCount += 1;
      }
    }

    return {
      id: period.id,
      year: period.year,
      month: period.month,
      label: period.label,
      status: period.status,
      total_invoiced: totalInvoiced,
      total_collected: totalCollected,
      invoice_count: invoices.length,
      arrears_count: arrearsCount,
    };
  });
}

/**
 * Load resident visible verified payment history for one invoice.
 * Maps payments rows into deterministic labels, dates, and amounts (PAY-06).
 */
export async function loadResidentPaymentHistory(
  invoiceId: string,
): Promise<ResidentPaymentHistoryRow[]> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await client
    .from("payments")
    .select(
      `
      id,
      amount,
      payment_method,
      verified_at,
      verified_by_profile:profiles!verified_by(full_name, display_name),
      note,
      created_at
    `,
    )
    .eq("invoice_id", invoiceId)
    .order("verified_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load resident payment history: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return (data as unknown as ResidentPaymentRaw[]).map((row) => ({
    id: row.id,
    amount: row.amount,
    payment_method: row.payment_method ?? null,
    verified_at: row.verified_at ?? null,
    verified_by_name: extractProfileName(row.verified_by_profile),
    note: row.note ?? null,
    created_at: row.created_at,
  }));
}

/**
 * Load resident visible receipt history entries for one invoice (D-10).
 * Only returns receipt rows from public.reports whose metadata contains the given invoice_id.
 * Never exposes raw file_path — only provides report_id for signed-URL access.
 */
export async function loadResidentReceiptHistory(
  invoiceId: string,
): Promise<ResidentReceiptHistoryRow[]> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await client
    .from("reports")
    .select(`id, title, metadata, generated_at`)
    .eq("report_type", "receipt")
    .order("generated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load resident receipt history: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Filter to receipts whose metadata includes the given invoice_id
  return (data as ReportRow[])
    .filter((row) => {
      const meta = row.metadata as Record<string, unknown> | null;
      return meta && String(meta.invoice_id) === invoiceId;
    })
    .map((row) => ({
      report_id: row.id,
      title: row.title,
      generated_at: row.generated_at,
    }));
}

/**
 * Load generated output history for a billing period.
 * Used by /admin/reports to surface created artifacts with download actions (D-12).
 */
export async function loadGeneratedReportOutputs(
  billingPeriodId: string,
): Promise<GeneratedReportOutputRow[]> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await client
    .from("reports")
    .select(`id, report_type, title, metadata, generated_at, generated_by, file_path`)
    .eq("billing_period_id", billingPeriodId)
    .order("generated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load generated report outputs: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return (data as ReportRow[]).map((row) => ({
    id: row.id,
    report_type: row.report_type,
    title: row.title,
    metadata: row.metadata as Record<string, unknown>,
    generated_at: row.generated_at,
    generated_by: row.generated_by,
    file_path: row.file_path,
  }));
}

/**
 * Load receipt candidate rows — invoices with at least one verified payment
 * for a billing period, so operators can generate resident-specific receipts.
 */
export async function loadReceiptCandidates(
  billingPeriodId: string,
): Promise<ReceiptCandidateRow[]> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  // Get invoices that have verified payments for the billing period
  const { data: paymentsData, error: paymentsError } = await client
    .from("payments")
    .select(
      `
      id,
      amount,
      verified_at,
      invoice_id,
      invoices(
        id,
        invoice_number,
        kavling_id,
        kavlings(code),
        billing_period_id
      )
    `,
    )
    .not("verified_at", "is", null);

  if (paymentsError) {
    throw new Error(`Failed to load receipt candidates: ${paymentsError.message}`);
  }

  if (!paymentsData || paymentsData.length === 0) {
    return [];
  }

  // Group by invoice, filter to billing period
  const invoiceMap = new Map<string, ReceiptCandidateRow>();
  for (const row of paymentsData as unknown as PaymentWithInvoice[]) {
    const inv = row.invoices;
    if (!inv || String(inv.billing_period_id) !== billingPeriodId) continue;

    if (!invoiceMap.has(inv.id)) {
      invoiceMap.set(inv.id, {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        kavling_id: inv.kavling_id,
        kavling_code: getKavlingCode(inv.kavlings),
        payment_id: row.id,
        amount_paid: row.amount,
        payment_date: row.verified_at ?? row.created_at,
      });
    }
  }

  return Array.from(invoiceMap.values());
}

// --- Helper functions ---

function getKavlingCode(
  kavlings: KavlingSummary | KavlingSummary[] | null,
): string {
  if (!kavlings) {
    return "";
  }
  if (Array.isArray(kavlings)) {
    return kavlings[0]?.code ?? "";
  }
  return kavlings.code;
}

function getFirstProfile(
  profiles: ProfileSummary | ProfileSummary[] | null,
): ProfileSummary | null {
  if (!profiles) {
    return null;
  }
  if (Array.isArray(profiles)) {
    return profiles[0] ?? null;
  }
  return profiles;
}

function extractProfileName(
  profile: ProfileSummary | ProfileSummary[] | null,
): string | null {
  if (!profile) {
    return null;
  }
  const p = Array.isArray(profile) ? profile[0] : profile;
  if (!p) return null;
  if (p.display_name && p.display_name.trim().length > 0) {
    return p.display_name.trim();
  }
  return p.full_name || null;
}

// --- Types for new helpers ---

interface ResidentPaymentRaw {
  id: string;
  amount: number;
  payment_method: string | null;
  verified_at: string | null;
  verified_by_profile: ProfileSummary | ProfileSummary[] | null;
  note: string | null;
  created_at: string;
}

interface ReportRow {
  id: string;
  report_type: string;
  title: string;
  metadata: Record<string, unknown>;
  generated_at: string;
  generated_by: string;
  file_path: string | null;
}

interface PaymentWithInvoice {
  id: string;
  amount: number;
  verified_at: string | null;
  created_at: string;
  invoice_id: string;
  invoices: {
    id: string;
    invoice_number: string;
    kavling_id: string;
    billing_period_id: string;
    kavlings: KavlingSummary | KavlingSummary[] | null;
  } | null;
}

export interface ResidentPaymentHistoryRow {
  id: string;
  amount: number;
  payment_method: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  note: string | null;
  created_at: string;
}

export interface ResidentReceiptHistoryRow {
  report_id: string;
  title: string;
  generated_at: string;
}

export interface GeneratedReportOutputRow {
  id: string;
  report_type: string;
  title: string;
  metadata: Record<string, unknown>;
  generated_at: string;
  generated_by: string;
  file_path: string | null;
}

export interface ReceiptCandidateRow {
  invoice_id: string;
  invoice_number: string;
  kavling_id: string;
  kavling_code: string;
  payment_id: string;
  amount_paid: number;
  payment_date: string;
}