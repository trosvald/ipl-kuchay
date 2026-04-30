"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Receipt, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/authHooks";
import {
  formatDateId,
  formatRupiah,
  formatInvoiceStatusLabel,
  statusToBadgeVariant,
} from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  loadArrearsList,
  loadBillingPeriodSummaries,
  loadCollectionSummary,
  loadGeneratedReportOutputs,
  loadReceiptCandidates,
  type GeneratedReportOutputRow,
  type ReceiptCandidateRow,
} from "@/features/reports/reportQueries";
import { generateReportOutputArtifact, openReportOutputArtifact } from "@/features/reports/reportOutputClient";
import { toCsvRows, toArrearsCsvRows, serializeCsv, downloadCsv } from "@/features/reports/reportCsv";
import type {
  CollectionSummaryRow,
  ArrearsRow,
  BillingPeriodSummary,
} from "@/features/reports/reportSchemas";

export function ReportsPage() {
  const client = getSupabaseBrowserClient();
  const { role } = useAuth();

  const [periodSummaries, setPeriodSummaries] = useState<BillingPeriodSummary[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [summaryRows, setSummaryRows] = useState<CollectionSummaryRow[]>([]);
  const [arrearsRows, setArrearsRows] = useState<ArrearsRow[]>([]);
  const [outputRows, setOutputRows] = useState<GeneratedReportOutputRow[]>([]);
  const [receiptCandidates, setReceiptCandidates] = useState<ReceiptCandidateRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [outputLoading, setOutputLoading] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [generatingReceiptId, setGeneratingReceiptId] = useState<string | null>(null);

  // Period summaries for dropdown
  const loadPeriodSummaries = useCallback(async () => {
    if (!client) return;
    try {
      const summaries = await loadBillingPeriodSummaries();
      setPeriodSummaries(summaries);
      if (summaries.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(summaries[0].id);
      }
    } catch (err) {
      setErrorMessage("Gagal memuat daftar periode.");
    }
  }, [client, selectedPeriodId]);

  // Collection summary and arrears — primary report truth for RPRT-01/RPRT-02/RPRT-03.
  // Loaded together; partial failure keeps whichever succeeded so summary/arrears/CSV
  // remain usable even when output/candidate helpers have a temporary fault (T-03-30).
  const loadReportData = useCallback(async () => {
    if (!client || !selectedPeriodId) return;

    setLoading(true);
    setErrorMessage(null);
    setActionSuccess(null);
    setOutputError(null);

    try {
      // Primary report data — kept independent of output/candidate loads per T-03-30
      const [summaryResult, arrearsResult] = await Promise.allSettled([
        loadCollectionSummary(selectedPeriodId),
        loadArrearsList(selectedPeriodId),
      ]);

      const summary = summaryResult.status === "fulfilled" ? summaryResult.value : [];
      const arrears = arrearsResult.status === "fulfilled" ? arrearsResult.value : [];
      setSummaryRows(summary);
      setArrearsRows(arrears);

      // Keep lastRefreshed tied to primary data success so freshness indicator
      // remains trustworthy (T-03-29 / D-12). Only update if summary or arrears
      // at least partially loaded.
      if (summary.length > 0 || arrears.length > 0) {
        setLastRefreshed(new Date().toISOString());
      }

      // Reconcile primary load issues
      if (summaryResult.status === "rejected") {
        setErrorMessage("Gagal memuat ringkasan tagihan. Coba refresh lagi.");
      }
      if (arrearsResult.status === "rejected") {
        setErrorMessage((prev) =>
          prev ? `${prev} Gagal memuat daftar tunggakan.` : "Gagal memuat daftar tunggakan.",
        );
      }

      // Secondary data — output history and receipt candidates.
      // Loaded independently; failures surface via outputError (D-13) rather
      // than blanking the primary reporting tables.
      const [outputsResult, candidatesResult] = await Promise.allSettled([
        loadGeneratedReportOutputs(selectedPeriodId),
        loadReceiptCandidates(selectedPeriodId),
      ]);

      setOutputRows(outputsResult.status === "fulfilled" ? outputsResult.value : []);
      setReceiptCandidates(candidatesResult.status === "fulfilled" ? candidatesResult.value : []);

      if (outputsResult.status === "rejected" || candidatesResult.status === "rejected") {
        setOutputError(
          "Data output atau kandidat bukti bayar belum berhasil dimuat. Ringkasan dan ekspor CSV tetap dapat digunakan. Coba refresh untuk memperbarui data yang hilang.",
        );
      }
    } catch (err) {
      setErrorMessage("Gagal memuat data laporan.");
    } finally {
      setLoading(false);
    }
  }, [client, selectedPeriodId]);

  useEffect(() => {
    loadPeriodSummaries();
  }, [loadPeriodSummaries]);

  useEffect(() => {
    if (selectedPeriodId) {
      loadReportData();
    }
  }, [selectedPeriodId, loadReportData]);

  const selectedPeriod = useMemo(
    () => periodSummaries.find((p) => p.id === selectedPeriodId),
    [periodSummaries, selectedPeriodId],
  );

  const totalInvoiced = useMemo(
    () => summaryRows.reduce((sum, row) => sum + row.total_invoiced, 0),
    [summaryRows],
  );

  const totalCollected = useMemo(
    () => summaryRows.reduce((sum, row) => sum + row.total_paid, 0),
    [summaryRows],
  );

  const totalRemaining = useMemo(
    () => summaryRows.reduce((sum, row) => sum + row.remaining_balance, 0),
    [summaryRows],
  );

  const handleExportCsv = useCallback(async () => {
    if (!selectedPeriodId || summaryRows.length === 0) return;

    setActionLoading("export");
    try {
      const csvContent = serializeCsv(toCsvRows(summaryRows));
      const periodLabel = selectedPeriod?.label ?? "laporan";
      const filename = `Laporan_Keuangan_${periodLabel.replace(/\s+/g, "_")}.csv`;
      downloadCsv(csvContent, filename);
      setActionSuccess("CSV berhasil diunduh.");
    } catch (err) {
      setErrorMessage("Gagal mengekspor CSV.");
    } finally {
      setActionLoading(null);
    }
  }, [selectedPeriodId, summaryRows, selectedPeriod]);

  const handleExportArrearsCsv = useCallback(async () => {
    if (!selectedPeriodId || arrearsRows.length === 0) return;

    setActionLoading("arrears-export");
    try {
      const csvContent = serializeCsv(toArrearsCsvRows(arrearsRows));
      const periodLabel = selectedPeriod?.label ?? "laporan";
      const filename = `Daftar_Tunggakan_${periodLabel.replace(/\s+/g, "_")}.csv`;
      downloadCsv(csvContent, filename);
      setActionSuccess("Daftar tunggakan berhasil diunduh.");
    } catch (err) {
      setErrorMessage("Gagal mengekspor daftar tunggakan.");
    } finally {
      setActionLoading(null);
    }
  }, [selectedPeriodId, arrearsRows, selectedPeriod]);

  const handleGenerateMonthlyReport = useCallback(async () => {
    if (!selectedPeriodId) return;

    setActionLoading("monthly");
    try {
      const period = selectedPeriod;
      await generateReportOutputArtifact({
        reportType: "monthly_summary",
        billingPeriodId: selectedPeriodId,
        title: `Laporan Bulanan ${period?.label ?? ""}`,
        metadata: {
          totalInvoiced: totalInvoiced,
          totalCollected: totalCollected,
          totalPending: totalRemaining,
          periodLabel: period?.label ?? "",
          generatedScope: "all",
        },
      });
      await loadReportData();
      setActionSuccess("Laporan bulanan berhasil dibuat.");
    } catch (err) {
      setErrorMessage("Gagal membuat laporan bulanan.");
    } finally {
      setActionLoading(null);
    }
  }, [selectedPeriodId, selectedPeriod, totalInvoiced, totalCollected, totalRemaining, summaryRows, loadReportData]);

  const handleDownloadOutput = useCallback(async (reportId: string) => {
    if (!client) return;
    try {
      await openReportOutputArtifact({ reportId });
    } catch {
      setErrorMessage("Gagal mengunduh output. Coba lagi beberapa saat.");
    }
  }, [client]);

  const handleGenerateResidentReceipt = useCallback(async (candidate: ReceiptCandidateRow) => {
    setGeneratingReceiptId(candidate.invoice_id);
    try {
      const period = selectedPeriod;
      await generateReportOutputArtifact({
        reportType: "receipt",
        billingPeriodId: selectedPeriodId,
        invoiceId: candidate.invoice_id,
        paymentId: candidate.payment_id,
        title: `Bukti Bayar ${candidate.kavling_code} - ${period?.label ?? ""}`,
        metadata: {
          invoiceNumber: candidate.invoice_number,
          kavlingCode: candidate.kavling_code,
          residentName: "",
          amountPaid: candidate.amount_paid,
          paymentDate: candidate.payment_date,
          periodLabel: period?.label ?? "",
        },
      });
      await loadReportData();
      setActionSuccess(`Bukti bayar untuk ${candidate.kavling_code} berhasil dibuat.`);
    } catch {
      setErrorMessage(`Gagal membuat bukti bayar untuk ${candidate.kavling_code}.`);
    } finally {
      setGeneratingReceiptId(null);
    }
  }, [selectedPeriodId, selectedPeriod, loadReportData]);

  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Keuangan</p>
          <h1 className="text-2xl font-semibold text-slate-900">Laporan Keuangan</h1>
          <p className="text-sm text-slate-600">
            Ringkasan tagihan, daftar tunggakan, dan output laporan keuangan.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadReportData()}
          disabled={loading || !selectedPeriodId}
        >
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </header>

      {/* Period Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter Periode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue>{selectedPeriod?.label || "Pilih periode..."}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periodSummaries.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.label} ({period.invoice_count} invoice)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPeriod && (
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusToBadgeVariant(selectedPeriod.status)}>
                  {selectedPeriod.status}
                </Badge>
                <span className="text-sm text-slate-600">
                  {selectedPeriod.invoice_count} invoice |
                 {" "}
                  <span className="text-green-600">
                    {formatRupiah(selectedPeriod.total_collected)} terkumpul
                  </span>
                  {" "}|{" "}
                  <span className="text-orange-600">
                    {formatRupiah(selectedPeriod.total_invoiced - selectedPeriod.total_collected)} sisa
                  </span>
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error/Success Messages */}
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {actionSuccess}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Tagihan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">{formatRupiah(totalInvoiced)}</p>
            <p className="text-xs text-slate-500">{summaryRows.length} kavling</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Sudah Dibayar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">{formatRupiah(totalCollected)}</p>
            <p className="text-xs text-slate-500">
              {totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0}% terkumpul
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Sisa Bayar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-orange-600">{formatRupiah(totalRemaining)}</p>
            <p className="text-xs text-slate-500">{arrearsRows.length} kavling tertunda</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          onClick={handleGenerateMonthlyReport}
          disabled={actionLoading !== null || !selectedPeriodId}
        >
          <FileText className="size-4" />
          {actionLoading === "monthly" ? "Membuat..." : "Buat Laporan Bulanan"}
        </Button>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={actionLoading !== null || summaryRows.length === 0}
        >
          <Download className="size-4" />
          {actionLoading === "export" ? "Mengekspor..." : "Export CSV Ringkasan"}
        </Button>
        <Button
          variant="outline"
          onClick={handleExportArrearsCsv}
          disabled={actionLoading !== null || arrearsRows.length === 0}
        >
          <Download className="size-4" />
          {actionLoading === "arrears-export" ? "Mengekspor..." : "Export CSV Tunggakan"}
        </Button>
      </div>

      {/* Collection Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ringkasan Tagihan per Kavling</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat data...</p>
          ) : summaryRows.length === 0 ? (
            <p className="text-sm text-slate-600">Belum ada data untuk periode ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>Kode Kavling</TableHead>
                    <TableHead>Pemilik</TableHead>
                    <TableHead className="text-right">Total Tagihan</TableHead>
                    <TableHead className="text-right">Sudah Dibayar</TableHead>
                    <TableHead className="text-right">Menunggu</TableHead>
                    <TableHead className="text-right">Sisa Bayar</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryRows.map((row) => (
                    <TableRow key={row.kavling_id}>
                      <TableCell className="font-medium text-slate-900">{row.kavling_code}</TableCell>
                      <TableCell className="text-slate-700">{row.owner_name ?? "-"}</TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatRupiah(row.total_invoiced)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatRupiah(row.total_paid)}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatRupiah(row.total_pending)}
                      </TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatRupiah(row.remaining_balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusToBadgeVariant(row.remaining_balance === 0 ? "paid" : "partial")}>
                          {row.remaining_balance === 0 ? "Lunas" : "Belum"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Arrears List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Tunggakan</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat data...</p>
          ) : arrearsRows.length === 0 ? (
            <p className="text-sm text-slate-600">Tidak ada tunggakan untuk periode ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>Kode Kavling</TableHead>
                    <TableHead>Pemilik</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-right">Sudah Bayar</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead className="text-center">Hari Tertunda</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arrearsRows.map((row) => (
                    <TableRow key={row.kavling_id}>
                      <TableCell className="font-medium text-slate-900">{row.kavling_code}</TableCell>
                      <TableCell className="text-slate-700">{row.owner_name ?? "-"}</TableCell>
                      <TableCell className="text-slate-700">{row.period_label}</TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatRupiah(row.amount_due)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatRupiah(row.amount_paid)}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatRupiah(row.amount_due - row.amount_paid)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={row.days_overdue > 30 ? "destructive" : "outline"}>
                          {row.days_overdue} hari
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusToBadgeVariant(row.invoice_status)}>
                          {formatInvoiceStatusLabel(row.invoice_status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation warning for stale/failed output loads (D-13) */}
      {outputError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Data mungkin tidak lengkap:</strong> {outputError}{" "}
          <Button variant="link" size="sm" className="h-auto p-0 text-amber-700 underline" onClick={() => loadReportData()}>
            Coba refresh lagi
          </Button>
        </div>
      )}

      {/* Output History — shows generated artifacts with download actions (D-12) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Output Laporan yang Dibuat</CardTitle>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {lastRefreshed && (
              <span>Terakhir diperbarui: {formatDateId(lastRefreshed)}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {outputLoading ? (
            <p className="text-sm text-slate-600">Memuat output...</p>
          ) : outputRows.length === 0 ? (
            <p className="text-sm text-slate-600">
              Belum ada output laporan untuk periode ini.
            </p>
          ) : (
            <div className="space-y-3">
              {outputRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-slate-900">{row.title}</span>
                    <span className="text-xs text-slate-500">
                      {formatDateId(row.generated_at)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadOutput(row.id)}
                    disabled={!row.file_path}
                  >
                    <Download className="size-3 mr-1" />
                    Unduh
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Candidates — resident-specific receipt generation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bukti Bayar per Warga</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat kandidat...</p>
          ) : receiptCandidates.length === 0 ? (
            <p className="text-sm text-slate-600">
              Belum ada kandidat bukti bayar untuk periode ini.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>Kavling</TableHead>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead className="text-right">Jumlah Bayar</TableHead>
                    <TableHead>Tanggal Bayar</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptCandidates.map((candidate) => (
                    <TableRow key={candidate.invoice_id}>
                      <TableCell className="font-medium text-slate-900">{candidate.kavling_code}</TableCell>
                      <TableCell className="text-slate-700">{candidate.invoice_number}</TableCell>
                      <TableCell className="text-right text-green-600">{formatRupiah(candidate.amount_paid)}</TableCell>
                      <TableCell className="text-slate-700">{formatDateId(candidate.payment_date)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateResidentReceipt(candidate)}
                          disabled={generatingReceiptId === candidate.invoice_id}
                        >
                          <Receipt className="size-3 mr-1" />
                          {generatingReceiptId === candidate.invoice_id ? "Membuat..." : "Buat Bukti"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
