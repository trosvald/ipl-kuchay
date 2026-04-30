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

  // Load owner names via kavling_residents join
  if (kavlingMap.size > 0) {
    const kavlingIds = Array.from(kavlingMap.keys());
    const { data: residentData } = await client
      .from("kavling_residents")
      .select(`kavling_id, profiles(full_name, display_name)`)
      .in("kavling_id", kavlingIds)
      .eq("active", true)
      .limit(1);

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

  // Load owner names
  if (arrears.length > 0) {
    const kavlingIds = arrears.map((a) => a.kavling_id);

    const { data: residentData } = await client
      .from("kavling_residents")
      .select(`kavling_id, profiles(full_name, display_name)`)
      .in("kavling_id", kavlingIds)
      .eq("active", true)
      .limit(1);

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
 * Generate and persist a report output record in public.reports.
 * Returns the generated report record with file_path for download link.
 */
export async function generateReportOutput(
  reportType: "monthly_summary" | "receipt" | "arrears" | "kavling_history",
  billingPeriodId: string,
  title: string,
  metadata: Record<string, unknown>,
): Promise<{ id: string; file_path: string | null }> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const userResult = await client.auth.getUser();
  const userId =
    userResult.data.user?.id ?? "00000000-0000-0000-0000-000000000000";

  const { data, error } = await client
    .from("reports")
    .insert({
      report_type: reportType,
      billing_period_id: billingPeriodId,
      title,
      metadata,
      generated_by: userId,
    })
    .select("id, file_path")
    .single();

  if (error) {
    throw new Error(`Failed to generate report output: ${error.message}`);
  }

  return { id: data.id, file_path: data.file_path };
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