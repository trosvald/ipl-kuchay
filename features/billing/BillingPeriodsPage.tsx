"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, FilePlus2, RefreshCw } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { writeAuditLog } from "@/features/audit/writeAuditLog";
import { useAuth } from "@/features/auth/authHooks";
import { formatMonthYearId, formatBillingPeriodStatusLabel, formatDateId, formatRupiah, statusToBadgeVariant } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { billingPeriodFormSchema } from "@/lib/validation";

interface BillingPeriodRow {
  id: string;
  year: number;
  month: number;
  label: string;
  due_date: string;
  status: "draft" | "open" | "closed" | "archived";
  opened_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface InvoiceCountRow {
  billing_period_id: string;
}

interface PreviewInvoiceRow {
  kavling_id: string;
  kavling_code: string;
  fee_type_id: string;
  fee_code: string;
  fee_name: string;
  default_amount: number;
  resolved_amount: number;
  amount_source: string;
  period_total: number;
}

interface PreviewPenaltyRow {
  invoice_id: string;
  kavling_id: string;
  kavling_code: string;
  penalty_rule_id: string;
  fee_type_id: string;
  fee_name: string;
  penalty_amount: number;
  penalty_cycle_key: string;
}

function currentYearMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
    label: formatMonthYearId(now.getFullYear(), now.getMonth() + 1),
  };
}

export function BillingPeriodsPage() {
  const client = getSupabaseBrowserClient();
  const { profile } = useAuth();

  const initial = useMemo(() => currentYearMonth(), []);
  const [year, setYear] = useState(String(initial.year));
  const [month, setMonth] = useState(String(initial.month));
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [label, setLabel] = useState(initial.label);

  const [items, setItems] = useState<BillingPeriodRow[]>([]);
  const [invoiceCounts, setInvoiceCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Invoice preview dialog
  const [previewPeriod, setPreviewPeriod] = useState<BillingPeriodRow | null>(null);
  const [previewInvoices, setPreviewInvoices] = useState<PreviewInvoiceRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(1);

  // Penalty preview dialog
  const [penaltyPeriod, setPenaltyPeriod] = useState<BillingPeriodRow | null>(null);
  const [penaltyPreview, setPenaltyPreview] = useState<PreviewPenaltyRow[]>([]);
  const [penaltyLoading, setPenaltyLoading] = useState(false);
  const [penaltyError, setPenaltyError] = useState<string | null>(null);
  const [penaltyCycleKey, setPenaltyCycleKey] = useState<string>("");
  const [penaltyPage, setPenaltyPage] = useState(1);

  // Confirm dialog for generate
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const canReopenClosed = profile?.role === "admin" || profile?.role === "super_admin";
  const PREVIEW_PAGE_SIZE = 10;
  const previewTotalPages = Math.max(1, Math.ceil(previewInvoices.length / PREVIEW_PAGE_SIZE));
  const pagedPreviewInvoices = useMemo(
    () => previewInvoices.slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE),
    [previewInvoices, previewPage],
  );
  const PENALTY_PAGE_SIZE = 10;
  const penaltyTotalPages = Math.max(1, Math.ceil(penaltyPreview.length / PENALTY_PAGE_SIZE));
  const pagedPenalties = useMemo(
    () => penaltyPreview.slice((penaltyPage - 1) * PENALTY_PAGE_SIZE, penaltyPage * PENALTY_PAGE_SIZE),
    [penaltyPreview, penaltyPage],
  );
  const totalRows = items.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  const loadPeriods = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const [periodsRes, invoicesRes] = await Promise.all([
      client
        .from("billing_periods")
        .select("id, year, month, label, due_date, status, opened_at, closed_at, created_by, created_at, updated_at")
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
      client.from("invoices").select("billing_period_id"),
    ]);

    if (periodsRes.error || invoicesRes.error) {
      setErrorMessage(periodsRes.error?.message ?? invoicesRes.error?.message ?? "Gagal memuat periode billing.");
      setLoading(false);
      return;
    }

    const countMap: Record<string, number> = {};
    for (const row of (invoicesRes.data ?? []) as InvoiceCountRow[]) {
      countMap[row.billing_period_id] = (countMap[row.billing_period_id] ?? 0) + 1;
    }

    setItems((periodsRes.data ?? []) as BillingPeriodRow[]);
    setInvoiceCounts(countMap);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadPeriods().catch(() => {
      setErrorMessage("Gagal memuat periode billing.");
      setLoading(false);
    });
  }, [loadPeriods]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!client || !profile) {
      return;
    }

    const parsed = billingPeriodFormSchema.safeParse({
      year: Number(year),
      month: Number(month),
      due_date: dueDate,
      label,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path.length > 0) {
          nextErrors[String(issue.path[0])] = issue.message;
        }
      }
      setFormErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setFormErrors({});

    const payload = {
      year: parsed.data.year,
      month: parsed.data.month,
      due_date: parsed.data.due_date,
      label: parsed.data.label.trim(),
      status: "draft" as const,
      created_by: profile.id,
    };

    const { data, error } = await client
      .from("billing_periods")
      .insert(payload)
      .select("id, year, month, label, due_date, status, opened_at, closed_at, created_by, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal membuat periode billing.");
      setSaving(false);
      return;
    }

    setCreating(false);
    setSaving(false);
    await loadPeriods();
  };

  const handleGenerateInvoices = async (row: BillingPeriodRow) => {
    if (!client || !profile) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { error } = await client.rpc("generate_invoices_for_period", {
      target_period_id: row.id,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadPeriods();
  };

  const handleStatusChange = async (row: BillingPeriodRow, nextStatus: BillingPeriodRow["status"]) => {
    if (!client || !profile) {
      return;
    }

    if (row.status === "closed" && nextStatus === "open" && !canReopenClosed) {
      setErrorMessage("Periode closed hanya dapat dibuka lagi oleh admin/super_admin.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const payload: Partial<BillingPeriodRow> & Record<string, unknown> = {
      status: nextStatus,
    };

    if (nextStatus === "open") {
      payload.opened_at = row.opened_at ?? new Date().toISOString();
      if (row.status === "closed") {
        payload.closed_at = null;
      }
    }

    if (nextStatus === "closed") {
      payload.closed_at = new Date().toISOString();
    }

    const { data, error } = await client
      .from("billing_periods")
      .update(payload)
      .eq("id", row.id)
      .select("id, year, month, label, due_date, status, opened_at, closed_at, created_by, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal mengubah status periode.");
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadPeriods();
  };

  const handlePreviewInvoices = async (row: BillingPeriodRow) => {
    if (!client) return;

    setPreviewPeriod(row);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewInvoices([]);
    setPreviewPage(1);

    const { data, error } = await client.rpc("preview_invoices_for_period", {
      target_period_id: row.id,
    });

    setPreviewLoading(false);

    if (error || !data) {
      setPreviewError(error?.message ?? "Gagal memuat pratinjau tagihan.");
      return;
    }

    setPreviewInvoices((data as PreviewInvoiceRow[]) ?? []);
  };

  const handleConfirmGenerate = async () => {
    if (!client || !profile || !previewPeriod) return;

    setSaving(true);

    const { error } = await client.rpc("generate_invoices_for_period", {
      target_period_id: previewPeriod.id,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setConfirmGenerate(false);
    setPreviewPeriod(null);
    await loadPeriods();
  };

  const handlePreviewPenalties = async (row: BillingPeriodRow) => {
    if (!client) return;

    const cycle = `${row.year}-${String(row.month).padStart(2, "0")}`;
    setPenaltyCycleKey(cycle);
    setPenaltyPeriod(row);
    setPenaltyLoading(true);
    setPenaltyError(null);
    setPenaltyPreview([]);
    setPenaltyPage(1);

    const { data, error } = await client.rpc("preview_penalties_for_period", {
      target_period_id: row.id,
      cycle_key: cycle,
    });

    setPenaltyLoading(false);

    if (error || !data) {
      setPenaltyError(error?.message ?? "Gagal memuat pratinjau denda.");
      return;
    }

    setPenaltyPreview((data as PreviewPenaltyRow[]) ?? []);
  };

  const handleConfirmApplyPenalty = async () => {
    if (!client || !profile || !penaltyPeriod) return;

    setSaving(true);

    const { data, error } = await client.rpc("apply_penalties_for_period", {
      target_period_id: penaltyPeriod.id,
      cycle_key: penaltyCycleKey,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: "billing_period.apply_penalties",
      entityTable: "billing_periods",
      entityId: penaltyPeriod.id,
      beforeData: penaltyPeriod,
      afterData: { applied_count: data },
      actorId: profile.id,
      actorRole: profile.role,
    });

    setSaving(false);
    setPenaltyPeriod(null);
    await loadPeriods();
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Billing</p>
          <h1 className="text-2xl font-semibold text-slate-900">Periode Billing & Generate Tagihan</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => loadPeriods()} disabled={loading || saving}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button
            onClick={() => {
              setCreating((value) => !value);
              setFormErrors({});
            }}
          >
            <FilePlus2 className="size-4" /> {creating ? "Tutup Form" : "Periode Baru"}
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {creating ? (
        <Card>
          <CardHeader>
            <CardTitle>Buat Periode Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Tahun</span>
                  <Input type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(event.target.value)} />
                  {formErrors.year ? <p className="text-xs text-red-600">{formErrors.year}</p> : null}
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span>Bulan</span>
                  <Input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(event.target.value)} />
                  {formErrors.month ? <p className="text-xs text-red-600">{formErrors.month}</p> : null}
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span>Due date</span>
                  <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  {formErrors.due_date ? <p className="text-xs text-red-600">{formErrors.due_date}</p> : null}
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span>Label</span>
                  <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="April 2026" />
                  {formErrors.label ? <p className="text-xs text-red-600">{formErrors.label}</p> : null}
                </label>
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Periode"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Periode</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat data...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>Periode</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((row) => {
                    const count = invoiceCounts[row.id] ?? 0;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-slate-900">{formatMonthYearId(row.year, row.month)}</TableCell>
                        <TableCell className="text-slate-700">{row.label}</TableCell>
                        <TableCell className="text-slate-700">{formatDateId(row.due_date)}</TableCell>
                        <TableCell>
                          <Badge variant={statusToBadgeVariant(row.status)}>{formatBillingPeriodStatusLabel(row.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-slate-700">{count}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/billing/${row.id}`}>
                                Detail <ArrowUpRight className="size-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant={count > 0 ? "ghost" : "secondary"}
                              disabled={saving || count > 0 || row.status === "closed" || row.status === "archived"}
                              onClick={() => handlePreviewInvoices(row)}
                            >
                              {count > 0 ? "Tagihan Sudah Ada" : "Pratinjau Tagihan"}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={saving || row.status === "draft" || row.status === "archived"}
                              onClick={() => handlePreviewPenalties(row)}
                            >
                              Pratinjau Denda
                            </Button>
                            {row.status === "draft" ? (
                              <Button size="sm" variant="ghost" disabled={saving} onClick={() => handleStatusChange(row, "open")}>
                                Buka Periode
                              </Button>
                            ) : null}
                            {row.status === "open" ? (
                              <Button size="sm" variant="ghost" disabled={saving} onClick={() => handleStatusChange(row, "closed")}>
                                Tutup Periode
                              </Button>
                            ) : null}
                            {row.status === "closed" ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={saving}
                                onClick={() => handleStatusChange(row, "archived")}
                              >
                                Arsipkan Periode
                              </Button>
                            ) : null}
                            {row.status === "closed" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={saving || !canReopenClosed}
                                onClick={() => handleStatusChange(row, "open")}
                                title={canReopenClosed ? "Buka ulang periode" : "Hanya admin/super_admin"}
                              >
                                Buka Ulang Periode
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <p>
                Menampilkan {pageStart}-{pageEnd} dari {totalRows} data
              </p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1">
                  <span>Rows</span>
                  <select
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
                    value={String(pageSize)}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                  </select>
                </label>
                <Button size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
                  Prev
                </Button>
                <span className="text-xs">
                  Page {page}/{totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Invoice Preview Dialog */}
      <Dialog open={previewPeriod !== null} onOpenChange={(open: boolean) => !open && setPreviewPeriod(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pratinjau Tagihan — {previewPeriod ? formatMonthYearId(previewPeriod.year, previewPeriod.month) : ""}</DialogTitle>
            <DialogDescription>
              Pratinjau tagihan per kavling sebelum diterbitkan. Klik &ldquo;Buat Tagihan&rdquo; untuk mengkonfirmasi.
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <p className="text-sm text-slate-600 py-4">Memuat pratinjau...</p>
          ) : previewError ? (
            <p className="text-sm text-red-600 py-4">{previewError}</p>
          ) : previewInvoices.length === 0 ? (
            <p className="text-sm text-slate-600 py-4">Tidak ada kavling aktif untuk periode ini.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border divide-y">
                {pagedPreviewInvoices.map((row, idx) => (
                  <div key={`${row.kavling_id}-${row.fee_type_id}`} className="flex items-center justify-between gap-2 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{row.kavling_code}</p>
                      <p className="text-xs text-slate-500">{row.fee_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-slate-700">
                        {row.amount_source === "override" ? (
                          <span>
                            <span className="text-xs text-slate-400 line-through mr-1">{formatRupiah(row.default_amount)}</span>
                            {formatRupiah(row.resolved_amount)}
                          </span>
                        ) : (
                          formatRupiah(row.resolved_amount)
                        )}
                      </p>
                      <Badge variant={row.amount_source === "override" ? "warning" : "secondary"} className="text-xs">
                        {row.amount_source === "override" ? "Override" : "Default"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {previewInvoices.length > PREVIEW_PAGE_SIZE ? (
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <p className="text-xs">
                    {PREVIEW_PAGE_SIZE * (previewPage - 1) + 1}&ndash;{Math.min(PREVIEW_PAGE_SIZE * previewPage, previewInvoices.length)} dari {previewInvoices.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setPreviewPage((v) => Math.max(1, v - 1))} disabled={previewPage <= 1}>
                      Prev
                    </Button>
                    <span className="text-xs tabular-nums">{previewPage}/{previewTotalPages}</span>
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setPreviewPage((v) => Math.min(previewTotalPages, v + 1))} disabled={previewPage >= previewTotalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setPreviewPeriod(null)}>
                  Batal
                </Button>
                <Button
                  onClick={() => setConfirmGenerate(true)}
                  disabled={saving}
                >
                  Buat Tagihan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Generate Dialog */}
      <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terbitkan Tagihan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tagihan akan dibuat untuk semua kavling aktif pada periode ini. Kavling yang sudah memiliki tagihan tidak akan diduplikasi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGenerate} disabled={saving}>
              {saving ? "Menyimpan..." : "Konfirmasi dan Terbitkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Penalty Preview Dialog */}
      <Dialog open={penaltyPeriod !== null} onOpenChange={(open: boolean) => !open && setPenaltyPeriod(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pratinjau Denda — {penaltyPeriod ? formatMonthYearId(penaltyPeriod.year, penaltyPeriod.month) : ""}</DialogTitle>
            <DialogDescription>
              Denda akan ditambahkan ke invoice yang belum lunas. Siklus: {penaltyCycleKey}
            </DialogDescription>
          </DialogHeader>

          {penaltyLoading ? (
            <p className="text-sm text-slate-600 py-4">Memuat pratinjau...</p>
          ) : penaltyError ? (
            <p className="text-sm text-red-600 py-4">{penaltyError}</p>
          ) : penaltyPreview.length === 0 ? (
            <p className="text-sm text-slate-600 py-4">Tidak ada invoice yang memenuhi syarat untuk denda.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border divide-y">
                {pagedPenalties.map((row, idx) => (
                  <div key={`${row.invoice_id}-${row.penalty_rule_id}`} className="flex items-center justify-between gap-2 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{row.kavling_code}</p>
                      <p className="text-xs text-slate-500">{row.fee_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatRupiah(row.penalty_amount)}
                      </p>
                      <Badge variant="destructive" className="text-xs">{row.penalty_cycle_key}</Badge>
                    </div>
                  </div>
                ))}
              </div>

              {penaltyPreview.length > PENALTY_PAGE_SIZE ? (
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <p className="text-xs">
                    {PENALTY_PAGE_SIZE * (penaltyPage - 1) + 1}&ndash;{Math.min(PENALTY_PAGE_SIZE * penaltyPage, penaltyPreview.length)} dari {penaltyPreview.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setPenaltyPage((v) => Math.max(1, v - 1))} disabled={penaltyPage <= 1}>
                      Prev
                    </Button>
                    <span className="text-xs tabular-nums">{penaltyPage}/{penaltyTotalPages}</span>
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setPenaltyPage((v) => Math.min(penaltyTotalPages, v + 1))} disabled={penaltyPage >= penaltyTotalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setPenaltyPeriod(null)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmApplyPenalty}
                  disabled={saving}
                >
                  Terapkan Denda
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
