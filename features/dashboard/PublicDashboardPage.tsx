"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileText, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { APP_NAME } from "@/lib/constants";
import { formatDateId, formatMonthYearId, formatRupiah } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface PublicPeriodSummary {
  billing_period_id: string;
  year: number;
  month: number;
  label: string;
  due_date: string;
  total_invoices: number;
  paid_count: number;
  unpaid_count: number;
  total_amount_due: number;
  total_amount_paid: number;
}

export function PublicDashboardPage() {
  const client = getSupabaseBrowserClient();

  const [rows, setRows] = useState<PublicPeriodSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadPublicSummary = useCallback(async () => {
    if (!client) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client.rpc("get_public_period_summary");

    if (error) {
      setErrorMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as PublicPeriodSummary[]);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadPublicSummary().catch(() => {
      setErrorMessage("Gagal memuat ringkasan publik.");
      setLoading(false);
    });
  }, [loadPublicSummary]);

  const latest = rows[0] ?? null;
  const latestOutstanding = latest ? Math.max(latest.total_amount_due - latest.total_amount_paid, 0) : 0;
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  const coverageRatio = useMemo(() => {
    if (!latest || latest.total_invoices === 0) {
      return 0;
    }
    return Math.round((latest.paid_count / latest.total_invoices) * 100);
  }, [latest]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <main className="bg-background text-foreground">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.09),transparent_35%)]" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Badge variant="outline" className="mb-4">
              Portal Warga Publik
            </Badge>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Ringkasan pembayaran IPL publik berbasis data agregat aman
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              {APP_NAME} menampilkan ringkasan agregat periode billing yang aman untuk publik tanpa membuka data private warga.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-10 px-5">
                <Link href="/login">
                  Masuk ke User Portal <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-10 px-5">
                <Link href="/app">Buka User Portal</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
              <p className="mb-4 text-sm font-semibold text-foreground">Periode Publik Aktif</p>
            {loading ? <p className="text-sm text-muted-foreground">Memuat ringkasan...</p> : null}
            {!loading && latest ? (
              <div className="space-y-3">
                <div className="rounded-xl border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Periode</p>
                  <p className="mt-1 text-sm font-semibold">{formatMonthYearId(latest.year, latest.month)} ({latest.label})</p>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Due Date</p>
                  <p className="mt-1 text-sm font-semibold">{formatDateId(latest.due_date)}</p>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cakupan Pembayaran</p>
                  <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-muted-foreground" /> {coverageRatio}%
                  </p>
                </div>
              </div>
            ) : null}
            {!loading && !latest ? <p className="text-sm text-muted-foreground">Belum ada periode open/closed.</p> : null}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mb-6 flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ringkasan Aggregate Publik</h2>
        </div>

        {errorMessage ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Tagihan Terbaru</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">{formatRupiah(latest?.total_amount_due ?? 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Terbayar Terbaru</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">{formatRupiah(latest?.total_amount_paid ?? 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sisa Terbaru</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">{formatRupiah(latestOutstanding)}</CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Periode Billing Publik</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Memuat periode...</p>
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {pagedRows.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      Belum ada ringkasan periode.
                    </p>
                  ) : null}
                  {pagedRows.map((item) => (
                    <div key={item.billing_period_id} className="rounded-lg border bg-background px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">{formatMonthYearId(item.year, item.month)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.label} - due {formatDateId(item.due_date)}</p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">{item.total_invoices} invoice</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Paid</p>
                          <p className="font-semibold text-green-700">{item.paid_count}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Belum</p>
                          <p className="font-semibold text-orange-700">{item.unpaid_count}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Tagihan</p>
                          <p className="font-semibold text-foreground">{formatRupiah(item.total_amount_due)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Dibayar</p>
                          <p className="font-semibold text-foreground">{formatRupiah(item.total_amount_paid)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow className="text-xs uppercase tracking-wide text-muted-foreground">
                        <TableHead>Periode</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Belum Lunas</TableHead>
                        <TableHead>Total Tagihan</TableHead>
                        <TableHead>Total Dibayar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedRows.map((item) => (
                        <TableRow key={item.billing_period_id}>
                          <TableCell className="font-medium text-foreground">{formatMonthYearId(item.year, item.month)} ({item.label})</TableCell>
                          <TableCell>{formatDateId(item.due_date)}</TableCell>
                          <TableCell>{item.total_invoices}</TableCell>
                          <TableCell>{item.paid_count}</TableCell>
                          <TableCell>{item.unpaid_count}</TableCell>
                          <TableCell>{formatRupiah(item.total_amount_due)}</TableCell>
                          <TableCell>{formatRupiah(item.total_amount_paid)}</TableCell>
                        </TableRow>
                      ))}
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

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-background p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4" /> Catatan Privasi</p>
              <p className="text-sm text-muted-foreground">Dashboard publik hanya memakai fungsi agregat aman. Nama warga, saldo per rumah, bukti pembayaran, dan detail pembayaran per kavling tidak ditampilkan di sini.</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4" /> Akses Lengkap</p>
              <p className="text-sm text-muted-foreground">Pengurus dan warga login ke portal masing-masing untuk melihat detail invoice sesuai hak akses akun.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
