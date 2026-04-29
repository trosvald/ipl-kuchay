"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateId, formatInvoiceStatusLabel, formatMonthYearId, formatRupiah, statusToBadgeVariant } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface ResidentInvoiceRow {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: string;
  billing_period_id: string;
  billing_periods:
    | {
        year: number;
        month: number;
        label: string;
      }
    | {
        year: number;
        month: number;
        label: string;
      }[]
    | null;
  kavlings:
    | {
        code: string;
      }
    | {
        code: string;
      }[]
    | null;
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export function ResidentInvoicesPage() {
  const client = getSupabaseBrowserClient();

  const [items, setItems] = useState<ResidentInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadInvoices = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("invoices")
      .select("id, invoice_number, amount_due, amount_paid, due_date, status, billing_period_id, billing_periods(year, month, label), kavlings(code)")
      .order("due_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as ResidentInvoiceRow[]);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadInvoices().catch(() => {
      setLoading(false);
      setErrorMessage("Gagal memuat daftar invoice.");
    });
  }, [loadInvoices]);

  const periodOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of items) {
      const period = normalizeOne(row.billing_periods);
      if (!period) {
        continue;
      }
      const key = `${period.year}-${String(period.month).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, `${formatMonthYearId(period.year, period.month)} (${period.label})`);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  const statusOptions = useMemo(() => {
    const next = new Set<string>();
    for (const row of items) {
      next.add(row.status);
    }
    return Array.from(next.values());
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      if (periodFilter !== "all") {
        const period = normalizeOne(row.billing_periods);
        if (!period) {
          return false;
        }
        const key = `${period.year}-${String(period.month).padStart(2, "0")}`;
        if (key !== periodFilter) {
          return false;
        }
      }

      return true;
    });
  }, [items, periodFilter, statusFilter]);
  const totalRows = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedItems = useMemo(
    () => filteredItems.slice((page - 1) * pageSize, page * pageSize),
    [filteredItems, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  const totalDue = useMemo(() => filteredItems.reduce((sum, item) => sum + item.amount_due, 0), [filteredItems]);
  const totalPaid = useMemo(() => filteredItems.reduce((sum, item) => sum + item.amount_paid, 0), [filteredItems]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, periodFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">User Portal</p>
          <h1 className="text-2xl font-semibold text-slate-900">Daftar Invoice</h1>
          <p className="text-sm text-slate-600">Tampilkan hanya invoice kavling yang terhubung ke akun Anda.</p>
        </div>
        <Button variant="secondary" onClick={() => loadInvoices()} disabled={loading}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
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
          <CardContent className="text-2xl font-semibold text-slate-900">{filteredItems.length}</CardContent>
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
            <CardTitle>Riwayat Tagihan</CardTitle>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <span>Status</span>
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">Semua</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatInvoiceStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <span>Periode</span>
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  value={periodFilter}
                  onChange={(event) => setPeriodFilter(event.target.value)}
                >
                  <option value="all">Semua</option>
                  {periodOptions.map((period) => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat invoice...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>No Invoice</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Kavling</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tagihan</TableHead>
                    <TableHead>Dibayar</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((item) => {
                    const period = normalizeOne(item.billing_periods);
                    const kavling = normalizeOne(item.kavlings);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-slate-900">{item.invoice_number}</TableCell>
                        <TableCell className="text-slate-700">
                          {period ? `${formatMonthYearId(period.year, period.month)} (${period.label})` : "-"}
                        </TableCell>
                        <TableCell className="text-slate-700">{kavling?.code ?? "-"}</TableCell>
                        <TableCell className="text-slate-700">{formatDateId(item.due_date)}</TableCell>
                        <TableCell>
                          <Badge variant={statusToBadgeVariant(item.status)}>{formatInvoiceStatusLabel(item.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-slate-700">{formatRupiah(item.amount_due)}</TableCell>
                        <TableCell className="text-slate-700">{formatRupiah(item.amount_paid)}</TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/app/invoices/${item.id}`}>
                              Lihat <ArrowUpRight className="size-4" />
                            </Link>
                          </Button>
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
    </section>
  );
}
