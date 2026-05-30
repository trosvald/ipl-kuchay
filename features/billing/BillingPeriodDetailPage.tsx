"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBillingPeriodStatusLabel, formatDateId, formatInvoiceStatusLabel, formatMonthYearId, formatRupiah, statusToBadgeVariant } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface BillingPeriodDetail {
  id: string;
  year: number;
  month: number;
  label: string;
  due_date: string;
  status: "draft" | "open" | "closed" | "archived";
  opened_at: string | null;
  closed_at: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  due_date: string;
  kavling_id: string;
  kavlings: { code: string } | { code: string }[] | null;
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

const statusFilterOptions = ["all", "unpaid", "overdue", "partial", "pending_verification", "paid", "rejected", "waived", "cancelled"] as const;

type StatusFilter = (typeof statusFilterOptions)[number];

interface BillingPeriodDetailPageProps {
  periodId: string;
}

export function BillingPeriodDetailPage({ periodId }: Readonly<BillingPeriodDetailPageProps>) {
  const client = getSupabaseBrowserClient();

  const [period, setPeriod] = useState<BillingPeriodDetail | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadPeriodDetail = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const [periodRes, invoicesRes] = await Promise.all([
      client
        .from("billing_periods")
        .select("id, year, month, label, due_date, status, opened_at, closed_at")
        .eq("id", periodId)
        .maybeSingle(),
      client
        .from("invoices")
        .select("id, invoice_number, amount_due, amount_paid, status, due_date, kavling_id, kavlings(code)")
        .eq("billing_period_id", periodId)
        .order("invoice_number", { ascending: true }),
    ]);

    if (periodRes.error || invoicesRes.error) {
      setErrorMessage(periodRes.error?.message ?? invoicesRes.error?.message ?? "Gagal memuat detail periode.");
      setLoading(false);
      return;
    }

    setPeriod((periodRes.data ?? null) as BillingPeriodDetail | null);
    setInvoices((invoicesRes.data ?? []) as InvoiceRow[]);
    setLoading(false);
  }, [client, periodId]);

  useEffect(() => {
    loadPeriodDetail().catch(() => {
      setErrorMessage("Gagal memuat detail periode.");
      setLoading(false);
    });
  }, [loadPeriodDetail]);

  const filteredInvoices = useMemo(() => {
    if (statusFilter === "all") {
      return invoices;
    }
    return invoices.filter((item) => item.status === statusFilter);
  }, [invoices, statusFilter]);
  const totalRows = filteredInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedInvoices = useMemo(
    () => filteredInvoices.slice((page - 1) * pageSize, page * pageSize),
    [filteredInvoices, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  const totalDue = useMemo(() => filteredInvoices.reduce((sum, item) => sum + item.amount_due, 0), [filteredInvoices]);
  const totalPaid = useMemo(() => filteredInvoices.reduce((sum, item) => sum + item.amount_paid, 0), [filteredInvoices]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (!client) {
    return <p className="text-sm text-red-600">Supabase client belum tersedia.</p>;
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/billing">
              <ArrowLeft className="size-4" /> Kembali ke Billing
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">Detail Periode Billing</h1>
          {period ? (
            <p className="text-sm text-slate-600">
              {formatMonthYearId(period.year, period.month)} - due {formatDateId(period.due_date)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {period ? <Badge variant={statusToBadgeVariant(period.status)}>{formatBillingPeriodStatusLabel(period.status)}</Badge> : null}
          <Button variant="secondary" onClick={() => loadPeriodDetail()} disabled={loading}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Jumlah Invoice</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">{filteredInvoices.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Tagihan</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">{formatRupiah(totalDue)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Terbayar</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">{formatRupiah(totalPaid)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Daftar Invoice</CardTitle>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <span>Status</span>
              <select
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter);
                  setPage(1);
                }}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "Semua" : formatInvoiceStatusLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat invoice...</p>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {pagedInvoices.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    Tidak ada invoice pada filter ini.
                  </p>
                ) : null}
                {pagedInvoices.map((item) => {
                  const kavling = normalizeOne(item.kavlings);
                  const outstanding = Math.max(item.amount_due - item.amount_paid, 0);

                  return (
                    <div key={item.id} className="rounded-lg border bg-background px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{item.invoice_number}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Kavling {kavling?.code ?? "-"} - due {formatDateId(item.due_date)}
                          </p>
                        </div>
                        <Badge variant={statusToBadgeVariant(item.status)} className="shrink-0">
                          {formatInvoiceStatusLabel(item.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Tagihan</p>
                          <p className="font-semibold text-foreground">{formatRupiah(item.amount_due)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Dibayar</p>
                          <p className="font-semibold text-green-700">{formatRupiah(item.amount_paid)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Sisa</p>
                          <p className="font-semibold text-orange-700">{formatRupiah(outstanding)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                      <TableHead>No Invoice</TableHead>
                      <TableHead>Kavling</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tagihan</TableHead>
                      <TableHead>Dibayar</TableHead>
                      <TableHead>Sisa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedInvoices.map((item) => {
                    const kavling = normalizeOne(item.kavlings);
                    const outstanding = Math.max(item.amount_due - item.amount_paid, 0);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-slate-900">{item.invoice_number}</TableCell>
                        <TableCell className="text-slate-700">{kavling?.code ?? "-"}</TableCell>
                        <TableCell className="text-slate-700">{formatDateId(item.due_date)}</TableCell>
                        <TableCell>
                          <Badge variant={statusToBadgeVariant(item.status)}>{formatInvoiceStatusLabel(item.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-slate-700">{formatRupiah(item.amount_due)}</TableCell>
                        <TableCell className="text-slate-700">{formatRupiah(item.amount_paid)}</TableCell>
                        <TableCell className="text-slate-700">{formatRupiah(outstanding)}</TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          {!loading ? (
            <div className="mt-3 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p>
                Menampilkan {pageStart}-{pageEnd} dari {totalRows} data
              </p>
              <div className="flex flex-wrap items-center gap-2">
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
    </section>
  );
}
