"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Receipt, RefreshCw, Wallet } from "lucide-react";

import { ActionBar } from "@/components/ui/ActionBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { DataList } from "@/features/layout/DataList";
import { FilterBar, FilterGroup } from "@/components/ui/FilterBar";
import { ListContainer } from "@/components/ui/ListContainer";
import { PageHeader } from "@/features/layout/PageHeader";
import { StatusDot } from "@/components/ui/StatusDot";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Select, SelectItem } from "@/components/ui/select";
import { StatsGrid } from "@/components/ui/StatsGrid";
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
import { toCsvRows, toArrearsCsvRows, serializeCsv } from "@/features/reports/reportCsv";
import { downloadAuditedFinanceCsv } from "@/features/reports/reportCsvAudit";
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
  const [outputError, setOutputError] = useState<string | null>(null);
  const [generatingReceiptId, setGeneratingReceiptId] = useState<string | null>(null);
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize, setSummaryPageSize] = useState<number>(5);
  const [arrearsPage, setArrearsPage] = useState(1);
  const [arrearsPageSize, setArrearsPageSize] = useState<number>(5);
  const [outputPage, setOutputPage] = useState(1);
  const [receiptPage, setReceiptPage] = useState(1);
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);
  const [expandedArrearsId, setExpandedArrearsId] = useState<string | null>(null);

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

  const summaryTotalPages = useMemo(
    () => Math.max(1, Math.ceil(summaryRows.length / summaryPageSize)),
    [summaryRows.length, summaryPageSize],
  );

  const pagedSummaryRows = useMemo(() => {
    const start = (summaryPage - 1) * summaryPageSize;
    return summaryRows.slice(start, start + summaryPageSize);
  }, [summaryRows, summaryPage, summaryPageSize]);

  const arrearsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(arrearsRows.length / arrearsPageSize)),
    [arrearsRows.length, arrearsPageSize],
  );

  const pagedArrearsRows = useMemo(() => {
    const start = (arrearsPage - 1) * arrearsPageSize;
    return arrearsRows.slice(start, start + arrearsPageSize);
  }, [arrearsRows, arrearsPage, arrearsPageSize]);

  const outputPageSize = 5;
  const outputTotalPages = Math.max(1, Math.ceil(outputRows.length / outputPageSize));
  const pagedOutputRows = useMemo(() => {
    const start = (outputPage - 1) * outputPageSize;
    return outputRows.slice(start, start + outputPageSize);
  }, [outputPage, outputRows]);
  const receiptPageSize = 5;
  const receiptTotalPages = Math.max(1, Math.ceil(receiptCandidates.length / receiptPageSize));
  const pagedReceiptCandidates = useMemo(() => {
    const start = (receiptPage - 1) * receiptPageSize;
    return receiptCandidates.slice(start, start + receiptPageSize);
  }, [receiptCandidates, receiptPage]);
  useEffect(() => {
    if (summaryPage > summaryTotalPages) {
      setSummaryPage(summaryTotalPages);
    }
  }, [summaryPage, summaryTotalPages]);

  useEffect(() => {
    if (arrearsPage > arrearsTotalPages) {
      setArrearsPage(arrearsTotalPages);
    }
  }, [arrearsPage, arrearsTotalPages]);

  useEffect(() => {
    if (outputPage > outputTotalPages) {
      setOutputPage(outputTotalPages);
    }
  }, [outputPage, outputTotalPages]);

  useEffect(() => {
    if (receiptPage > receiptTotalPages) {
      setReceiptPage(receiptTotalPages);
    }
  }, [receiptPage, receiptTotalPages]);

  const handleExportCsv = useCallback(async () => {
    if (!selectedPeriodId || summaryRows.length === 0) return;

    setActionLoading("export");
    try {
      const csvContent = serializeCsv(toCsvRows(summaryRows));
      const periodLabel = selectedPeriod?.label ?? "laporan";
      const filename = `Laporan_Keuangan_${periodLabel.replace(/\s+/g, "_")}.csv`;
      await downloadAuditedFinanceCsv({
        csvContent,
        filename,
        exportType: "collection_summary",
        billingPeriodId: selectedPeriodId,
        billingPeriodLabel: periodLabel,
        rowCount: summaryRows.length,
      });
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
      await downloadAuditedFinanceCsv({
        csvContent,
        filename,
        exportType: "arrears",
        billingPeriodId: selectedPeriodId,
        billingPeriodLabel: periodLabel,
        rowCount: arrearsRows.length,
      });
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
  }, [selectedPeriodId, selectedPeriod, totalInvoiced, totalCollected, totalRemaining, loadReportData]);

  const handleDownloadOutput = useCallback(async (reportId: string) => {
    if (!client) return;
    try {
      await openReportOutputArtifact({ reportId });
    } catch {
      setErrorMessage("Gagal mengunduh output. Coba lagi beberapa saat.");
    }
  }, [client]);

  const handleGenerateResidentReceipt = useCallback(async (candidate: ReceiptCandidateRow) => {
    setGeneratingReceiptId(candidate.payment_id);
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
    <section className="page-section">
      {/* Header */}
      <PageHeader
        eyebrow="Keuangan"
        title="Laporan Keuangan"
        subtitle="Ringkasan tagihan, daftar tunggakan, dan output laporan keuangan."
        actions={
          <Button
            variant="outline"
            onClick={() => loadReportData()}
            disabled={loading || !selectedPeriodId}
          >
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />

      {/* Period Selector */}
      <div className="admin-card p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Filter Periode</h3>
        <FilterBar>
          <FilterGroup label="Periode">
            <Select
              value={selectedPeriodId}
              onChange={(e) => {
                setSelectedPeriodId(e.target.value);
                setSummaryPage(1);
                setArrearsPage(1);
                setOutputPage(1);
                setReceiptPage(1);
              }}
              className="w-[220px] rounded-lg border-slate-200"
            >
              <option value="">Pilih periode...</option>
              {periodSummaries.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {period.label} ({period.invoice_count} invoice)
                </SelectItem>
              ))}
            </Select>
          </FilterGroup>

          {selectedPeriod && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Badge variant={statusToBadgeVariant(selectedPeriod.status)}>
                {selectedPeriod.status}
              </Badge>
              <span>{selectedPeriod.invoice_count} invoice</span>
              <span className="text-emerald-600 font-medium">
                {formatRupiah(selectedPeriod.total_collected)} terkumpul
              </span>
              <span className="text-amber-600 font-medium">
                {formatRupiah(selectedPeriod.total_invoiced - selectedPeriod.total_collected)} sisa
              </span>
            </div>
          )}
        </FilterBar>
      </div>

      {/* Error/Success Messages */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-5 py-3.5 text-sm text-red-700 font-medium">
          {errorMessage}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-5 py-3.5 text-sm text-emerald-700 font-medium">
          {actionSuccess}
        </div>
      )}

      {/* Summary Stats */}
      <StatsGrid
        columns={3}
        items={[
          {
            label: "Total Tagihan",
            value: formatRupiah(totalInvoiced),
            icon: Wallet,
          },
          {
            label: "Sudah Dibayar",
            value: formatRupiah(totalCollected),
            icon: Wallet,
            variant: "success",
          },
          {
            label: "Sisa Bayar",
            value: formatRupiah(totalRemaining),
            icon: Wallet,
            variant: "warning",
          },
        ]}
      />

      {/* Action Buttons */}
      <ActionBar>
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
      </ActionBar>

      {/* Collection Summary Table */}
      <div className="admin-card p-5 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Ringkasan Tagihan per Kavling</h3>
        <DataList
          loading={loading}
          empty={{ title: "Belum ada data untuk periode ini." }}
          mobile={summaryRows.length > 0 ? (
            <ListContainer>
              {pagedSummaryRows.map((row) => {
                const isExpanded = expandedSummaryId === row.kavling_id;
                const isPaid = row.remaining_balance === 0;
                return (
                  <CompactListRow
                    key={row.kavling_id}
                    primary={row.kavling_code}
                    trailing={
                      <span className={isPaid ? "text-emerald-700" : "text-amber-700"}>{formatRupiah(row.remaining_balance)}</span>
                    }
                    secondary={
                      <span className="flex items-center gap-1.5">
                        <StatusDot variant={isPaid ? "success" : "warning"} />
                        <span>{row.owner_name ?? "-"}</span>
                        <span className="text-slate-300">·</span>
                        <span>{isPaid ? "Lunas" : "Belum"}</span>
                      </span>
                    }
                    accentColor={isPaid ? "border-l-emerald-500" : "border-l-amber-500"}
                    expandedOpen={isExpanded}
                    onToggle={() => setExpandedSummaryId(isExpanded ? null : row.kavling_id)}
                    expanded={
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div>
                          <span className="text-slate-400">Tagihan</span>
                          <p className="font-medium text-slate-800">{formatRupiah(row.total_invoiced)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Dibayar</span>
                          <p className="font-medium text-emerald-700">{formatRupiah(row.total_paid)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Menunggu</span>
                          <p className="font-medium text-amber-700">{formatRupiah(row.total_pending)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Sisa</span>
                          <p className="font-medium text-slate-800">{formatRupiah(row.remaining_balance)}</p>
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </ListContainer>
          ) : undefined}
          desktop={summaryRows.length > 0 ? (
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
                  {pagedSummaryRows.map((row) => (
                    <TableRow key={row.kavling_id}>
                      <TableCell className="font-medium text-slate-900">{row.kavling_code}</TableCell>
                      <TableCell className="text-slate-700">{row.owner_name ?? "-"}</TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatRupiah(row.total_invoiced)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatRupiah(row.total_paid)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
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
          ) : undefined}
        />
        {!loading && summaryRows.length > 0 ? (
          <PaginationBar
            page={summaryPage}
            pageSize={summaryPageSize}
            totalRows={summaryRows.length}
            onPageChange={setSummaryPage}
            onPageSizeChange={(size) => { setSummaryPageSize(size); setSummaryPage(1); }}
          />
        ) : null}
      </div>

      {/* Arrears List Table */}
      <div className="admin-card p-5 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Daftar Tunggakan</h3>
        <DataList
          loading={loading}
          empty={{ title: "Tidak ada tunggakan untuk periode ini." }}
          mobile={arrearsRows.length > 0 ? (
            <ListContainer>
              {pagedArrearsRows.map((row) => {
                const isExpanded = expandedArrearsId === row.kavling_id;
                const isOverdue = row.days_overdue > 30;
                const sisa = row.amount_due - row.amount_paid;
                return (
                  <CompactListRow
                    key={row.kavling_id}
                    primary={row.kavling_code}
                    trailing={
                      <span className={isOverdue ? "text-red-600" : "text-amber-700"}>{formatRupiah(sisa)}</span>
                    }
                    secondary={
                      <span className="flex items-center gap-1.5">
                        <StatusDot variant={isOverdue ? "destructive" : "warning"} />
                        <span>{row.owner_name ?? "-"}</span>
                        <span className="text-slate-300">·</span>
                        <span>{row.days_overdue} hari tertunda</span>
                      </span>
                    }
                    accentColor={isOverdue ? "border-l-red-500" : "border-l-amber-500"}
                    expandedOpen={isExpanded}
                    onToggle={() => setExpandedArrearsId(isExpanded ? null : row.kavling_id)}
                    expanded={
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div>
                          <span className="text-slate-400">Jumlah</span>
                          <p className="font-medium text-slate-800">{formatRupiah(row.amount_due)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Dibayar</span>
                          <p className="font-medium text-emerald-700">{formatRupiah(row.amount_paid)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Sisa</span>
                          <p className="font-medium text-slate-800">{formatRupiah(sisa)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Status</span>
                          <Badge variant={statusToBadgeVariant(row.invoice_status)} className="text-[10px] h-4 px-1.5">
                            {formatInvoiceStatusLabel(row.invoice_status)}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-slate-400">Tertunda</span>
                          <Badge variant={isOverdue ? "destructive" : "outline"} className="text-[10px] h-4 px-1.5">
                            {row.days_overdue} hari
                          </Badge>
                        </div>
                        <div>
                          <span className="text-slate-400">Periode</span>
                          <p className="font-medium text-slate-800">{row.period_label}</p>
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </ListContainer>
          ) : undefined}
          desktop={arrearsRows.length > 0 ? (
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
                  {pagedArrearsRows.map((row) => (
                    <TableRow key={row.kavling_id}>
                      <TableCell className="font-medium text-slate-900">{row.kavling_code}</TableCell>
                      <TableCell className="text-slate-700">{row.owner_name ?? "-"}</TableCell>
                      <TableCell className="text-slate-700">{row.period_label}</TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatRupiah(row.amount_due)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatRupiah(row.amount_paid)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
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
          ) : undefined}
        />
        {!loading && arrearsRows.length > 0 ? (
          <PaginationBar
            page={arrearsPage}
            pageSize={arrearsPageSize}
            totalRows={arrearsRows.length}
            onPageChange={setArrearsPage}
            onPageSizeChange={(size) => { setArrearsPageSize(size); setArrearsPage(1); }}
          />
        ) : null}
      </div>

      {/* Reconciliation warning for stale/failed output loads (D-13) */}
      {outputError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-3.5 text-sm text-amber-800">
          <strong>Data mungkin tidak lengkap:</strong> {outputError}{" "}
          <Button variant="link" size="sm" className="h-auto p-0 text-amber-700 underline font-semibold" onClick={() => loadReportData()}>
            Coba refresh lagi
          </Button>
        </div>
      )}

      {/* Output History */}
      <div className="admin-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Output Laporan yang Dibuat</h3>
          {lastRefreshed && (
            <p className="text-xs text-slate-500 mt-1">Terakhir diperbarui: {formatDateId(lastRefreshed)}</p>
          )}
        </div>
        <DataList
          loading={loading}
          empty={{ title: "Belum ada output laporan untuk periode ini." }}
          mobile={outputRows.length > 0 ? (
            <ListContainer>
              {pagedOutputRows.map((row) => (
                <CompactListRow
                  key={row.id}
                  primary={row.title}
                  secondary={
                    <span className="flex items-center gap-1.5">
                      <span>{formatDateId(row.generated_at)}</span>
                    </span>
                  }
                  trailing={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => handleDownloadOutput(row.id)}
                      disabled={!row.file_path}
                    >
                      <Download className="size-3" />
                    </Button>
                  }
                />
              ))}
            </ListContainer>
          ) : undefined}
          desktop={outputRows.length > 0 ? (
            <div className="space-y-2">
              {pagedOutputRows.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-slate-900">{row.title}</span>
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
                    <Download className="size-3.5 mr-1.5" />
                    Unduh
                  </Button>
                </div>
              ))}
            </div>
          ) : undefined}
        />
        {!loading && outputRows.length > 0 ? (
          <PaginationBar
            page={outputPage}
            pageSize={outputPageSize}
            totalRows={outputRows.length}
            onPageChange={setOutputPage}
            onPageSizeChange={() => {}}
          />
        ) : null}
      </div>

      {/* Receipt Candidates */}
      <div className="admin-card p-5 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Bukti Bayar per Warga</h3>
        <DataList
          loading={loading}
          empty={{ title: "Belum ada kandidat bukti bayar untuk periode ini." }}
          mobile={receiptCandidates.length > 0 ? (
            <ListContainer>
              {pagedReceiptCandidates.map((candidate) => (
                <CompactListRow
                  key={candidate.payment_id}
                  primary={candidate.kavling_code}
                  secondary={
                    <span className="flex items-center gap-1">
                      <span>{candidate.invoice_number}</span>
                      <span className="text-slate-300">·</span>
                      <span>{formatDateId(candidate.payment_date)}</span>
                    </span>
                  }
                  trailing={
                    <span className="text-emerald-700">{formatRupiah(candidate.amount_paid)}</span>
                  }
                  accentColor="border-l-emerald-500"
                  expanded={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs w-full"
                      onClick={() => handleGenerateResidentReceipt(candidate)}
                      disabled={generatingReceiptId === candidate.payment_id}
                    >
                      <Receipt className="size-3.5 mr-1.5" />
                      {generatingReceiptId === candidate.payment_id ? "Membuat..." : "Buat Bukti Bayar"}
                    </Button>
                  }
                />
              ))}
            </ListContainer>
          ) : undefined}
          desktop={receiptCandidates.length > 0 ? (
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
                  {pagedReceiptCandidates.map((candidate) => (
                    <TableRow key={candidate.payment_id}>
                      <TableCell className="font-medium text-slate-900">{candidate.kavling_code}</TableCell>
                      <TableCell className="text-slate-700">{candidate.invoice_number}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatRupiah(candidate.amount_paid)}</TableCell>
                      <TableCell className="text-slate-700">{formatDateId(candidate.payment_date)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateResidentReceipt(candidate)}
                          disabled={generatingReceiptId === candidate.payment_id}
                        >
                          <Receipt className="size-3.5 mr-1.5" />
                          {generatingReceiptId === candidate.payment_id ? "Membuat..." : "Buat Bukti"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : undefined}
        />
        {!loading && receiptCandidates.length > 0 ? (
          <PaginationBar
            page={receiptPage}
            pageSize={receiptPageSize}
            totalRows={receiptCandidates.length}
            onPageChange={setReceiptPage}
            onPageSizeChange={() => {}}
          />
        ) : null}
      </div>
    </section>
  );
}
