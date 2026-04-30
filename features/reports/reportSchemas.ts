// Report schema contracts for finance reporting surface.
// These types are shared between query helpers, CSV mappers, and UI rendering
// to ensure consistent column definitions and status mapping across the reporting flow.

/**
 * Collection summary row — per-kavling aggregation for a billing period.
 * Produced by loadCollectionSummary() query helper.
 */
export interface CollectionSummaryRow {
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
}

/**
 * Arrears row — kavlings with outstanding balance for follow-up.
 * Produced by loadArrearsList() query helper.
 */
export interface ArrearsRow {
  kavling_id: string;
  kavling_code: string;
  owner_name: string | null;
  period_label: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  days_overdue: number;
  last_payment_date: string | null;
  invoice_status: string;
}

/**
 * Monthly report output and resident receipt output payload shape.
 * Used when persisting report generation metadata in public.reports.
 */
export interface ReportOutputPayload {
  report_type: "monthly_summary" | "receipt" | "arrears" | "kavling_history" | "export_csv";
  billing_period_id: string;
  generated_by: string;
  title: string;
  metadata: ReportMetadataFields;
}

/**
 * Typed metadata fields for report output artifacts.
 * Includes invoice_id, payment_id, resident_name, kavling_code, and generated_scope
 * as required by the artifact generation contract.
 */
export interface ReportMetadataFields {
  // Monthly summary fields
  total_invoiced?: number;
  total_collected?: number;
  total_pending?: number;
  invoice_count?: number;
  period_label?: string;
  generated_scope?: string; // e.g. "all" or "kavling:A01"
  // Receipt/resident fields
  invoice_id?: string;
  invoice_number?: string;
  payment_id?: string;
  resident_name?: string;
  kavling_code?: string;
  amount_paid?: number;
  payment_date?: string;
  // Legacy/common fields
  kavling_id?: string;
  owner_name?: string;
  [key: string]: unknown;
}

/**
 * CSV export row — flattened representation for spreadsheet export.
 * Produced by toCsvRows() in reportCsv.ts.
 */
export interface ReportCsvRow {
  kavling_code: string;
  owner_name: string | null;
  period_label: string;
  total_invoiced: number;
  total_paid: number;
  total_pending: number;
  remaining_balance: number;
  payment_status: string;
  days_overdue?: number;
  last_payment_date?: string | null;
}

/**
 * Billing period selection with summary stats.
 * Used for the period filter dropdown on the reports page.
 */
export interface BillingPeriodSummary {
  id: string;
  year: number;
  month: number;
  label: string;
  status: string;
  total_invoiced: number;
  total_collected: number;
  invoice_count: number;
  arrears_count: number;
}