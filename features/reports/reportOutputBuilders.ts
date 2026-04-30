// Report artifact builders — generate deterministic HTML for monthly summaries and resident receipts.
// Output paths follow the contract: reports/{billingPeriodId}/{reportId}.html and
// receipts/{invoiceId}/{reportId}.html per D-08/D-10.

/**
 * Monthly summary artifact metadata.
 */
export interface MonthlySummaryInput {
  periodLabel: string;
  totalInvoiced: number;
  totalCollected: number;
  totalPending: number;
  generatedAt: string;
  generatedScope: string; // e.g. "all" or "kavling:A01"
}

/**
 * Resident receipt artifact metadata.
 */
export interface ResidentReceiptInput {
  invoiceId: string;
  invoiceNumber: string;
  kavlingCode: string;
  residentName: string;
  amountPaid: number;
  paymentDate: string;
  periodLabel: string;
}

/**
 * Path builder input — discriminated by reportType.
 */
export interface ReportOutputPathInput {
  reportType: "monthly_summary" | "receipt" | "arrears" | "kavling_history";
  billingPeriodId: string;
  invoiceId?: string;
  reportId: string;
}

/**
 * Format a number as Indonesian Rupiah: 500000 → "500.000".
 */
function formatRupiah(value: number): string {
  return value.toLocaleString("id-ID");
}

/**
 * Build a UTF-8 HTML artifact for a monthly collection summary.
 * Contains period label, total invoiced/collected/pending, and generated-at metadata.
 * Deterministic output — same inputs produce identical HTML string.
 */
export function buildMonthlySummaryHtml(input: MonthlySummaryInput): string {
  const {
    periodLabel,
    totalInvoiced,
    totalCollected,
    totalPending,
    generatedAt,
    generatedScope,
  } = input;

  const scopeLabel =
    generatedScope === "all"
      ? "Seluruh Periode"
      : `Kavling ${generatedScope.replace("kavling:", "")}`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan Bulanan — ${periodLabel}</title>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-weight: 600; }
    .total-row td { font-weight: 600; }
    .footer { color: #666; font-size: 12px; margin-top: 32px; }
    .scope { background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Laporan Bulanan</h1>
  <p class="meta">Periode: <strong>${periodLabel}</strong> <span class="scope">${scopeLabel}</span></p>

  <table>
    <thead>
      <tr>
        <th>Deskripsi</th>
        <th style="text-align:right">Jumlah</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Total Tagihan</td>
        <td style="text-align:right">Rp ${formatRupiah(totalInvoiced)}</td>
      </tr>
      <tr>
        <td>Total Terbayar</td>
        <td style="text-align:right">Rp ${formatRupiah(totalCollected)}</td>
      </tr>
      <tr>
        <td>Sisa Tagihan</td>
        <td style="text-align:right">Rp ${formatRupiah(totalPending)}</td>
      </tr>
      <tr class="total-row">
        <td>Tingkat Penerimaan</td>
        <td style="text-align:right">${totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0}%</td>
      </tr>
    </tbody>
  </table>

  <p class="footer">
    Terakhir diperbarui: ${new Date(generatedAt).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    })}<br>
   Scope: ${generatedScope}
  </p>
</body>
</html>`;
}

/**
 * Build a UTF-8 HTML artifact for a resident payment receipt.
 * Contains exactly one invoice/payment/resident record per D-10 — no unrelated rows.
 * Deterministic output — same inputs produce identical HTML string.
 */
export function buildResidentReceiptHtml(input: ResidentReceiptInput): string {
  const {
    invoiceId,
    invoiceNumber,
    kavlingCode,
    residentName,
    amountPaid,
    paymentDate,
    periodLabel,
  } = input;

  const formattedDate = new Date(paymentDate).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bukti Pembayaran — ${invoiceNumber}</title>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    .receipt-box { border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
    .row:last-child { border-bottom: none; }
    .label { color: #666; font-size: 14px; }
    .value { font-weight: 600; font-size: 14px; }
    .amount { color: #166534; font-size: 18px; font-weight: 700; }
    .footer { color: #666; font-size: 12px; margin-top: 32px; text-align: center; }
    .verified-badge { background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>Bukti Pembayaran Warga</h1>
  <p class="meta">Periode: ${periodLabel}</p>

  <div class="verified-badge">✓ Lunas</div>

  <div class="receipt-box">
    <div class="row">
      <span class="label">Invoice</span>
      <span class="value">${invoiceNumber}</span>
    </div>
    <div class="row">
      <span class="label">Kavling</span>
      <span class="value">${kavlingCode}</span>
    </div>
    <div class="row">
      <span class="label">Nama Warga</span>
      <span class="value">${residentName}</span>
    </div>
    <div class="row">
      <span class="label">Jumlah Bayar</span>
      <span class="value amount">Rp ${formatRupiah(amountPaid)}</span>
    </div>
    <div class="row">
      <span class="label">Tanggal Bayar</span>
      <span class="value">${formattedDate}</span>
    </div>
  </div>

  <p class="footer">
    Terakhir diperbarui: ${new Date(paymentDate).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    })}<br>
    Invoice ID: ${invoiceId}
  </p>
</body>
</html>`;
}

/**
 * Build a storage path for a report artifact.
 * Monthly summaries: reports/{billingPeriodId}/{reportId}.html
 * Receipts: receipts/{invoiceId}/{reportId}.html
 */
export function buildReportOutputPath(input: ReportOutputPathInput): string {
  const { reportType, billingPeriodId, invoiceId, reportId } = input;

  if (reportType === "receipt") {
    if (!invoiceId) {
      throw new Error("invoiceId is required for receipt report type");
    }
    return `receipts/${invoiceId}/${reportId}.html`;
  }

  // monthly_summary, arrears, kavling_history
  return `reports/${billingPeriodId}/${reportId}.html`;
}