// CSV export mappers that align report columns to invoice/payment truth.
// toCsvRows() and toArrearsCsvRows() produce flattened rows for spreadsheet export
// that are consistent with the on-screen report data from loadCollectionSummary/loadArrearsList.

import type {
  CollectionSummaryRow,
  ArrearsRow,
  ReportCsvRow,
} from "@/features/reports/reportSchemas";

/**
 * Convert collection summary rows to CSV-exportable rows.
 * Payment status is derived from remaining_balance: 0 → "Lunas", else "Belum Lunas".
 */
export function toCsvRows(summaryRows: CollectionSummaryRow[]): ReportCsvRow[] {
  return summaryRows.map((row) => ({
    kavling_code: row.kavling_code,
    owner_name: row.owner_name,
    period_label: row.period_label,
    total_invoiced: row.total_invoiced,
    total_paid: row.total_paid,
    total_pending: row.total_pending,
    remaining_balance: row.remaining_balance,
    payment_status: row.remaining_balance === 0 ? "Lunas" : "Belum Lunas",
  }));
}

/**
 * Convert arrears rows to CSV-exportable rows.
 * Payment status is always "Tunggakan" for arrears, with days_overdue included.
 */
export function toArrearsCsvRows(arrearsRows: ArrearsRow[]): ReportCsvRow[] {
  return arrearsRows.map((row) => ({
    kavling_code: row.kavling_code,
    owner_name: row.owner_name,
    period_label: row.period_label,
    total_invoiced: row.amount_due,
    total_paid: row.amount_paid,
    total_pending: row.amount_due - row.amount_paid,
    remaining_balance: row.amount_due - row.amount_paid,
    payment_status: "Tunggakan",
    days_overdue: row.days_overdue,
    last_payment_date: row.last_payment_date,
  }));
}

/**
 * Serialize CSV rows to RFC-4180 compliant CSV string.
 * Handles escaping of fields containing commas, quotes, or newlines.
 */
export function serializeCsv(rows: ReportCsvRow[]): string {
  const headers = [
    "Kode Kavling",
    "Nama Pemilik",
    "Periode",
    "Total Tagihan",
    "Sudah Dibayar",
    "Menunggu Verifikasi",
    "Sisa Bayar",
    "Status Pembayaran",
    "Hari Tertunda",
    "Tanggal Bayar Terakhir",
  ];

  const escapeField = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.join(",");
  const dataRows = rows.map((row) =>
    [
      escapeField(row.kavling_code),
      escapeField(row.owner_name),
      escapeField(row.period_label),
      escapeField(row.total_invoiced),
      escapeField(row.total_paid),
      escapeField(row.total_pending),
      escapeField(row.remaining_balance),
      escapeField(row.payment_status),
      escapeField(row.days_overdue),
      escapeField(row.last_payment_date),
    ].join(","),
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Trigger browser CSV download from serialized CSV string.
 * Creates a temporary anchor element and clicks it to trigger the download.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}