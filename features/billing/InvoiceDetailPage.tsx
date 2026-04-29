"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentSubmissionForm } from "@/features/payments/PaymentSubmissionForm";
import { SubmissionHistory } from "@/features/payments/SubmissionHistory";
import {
  formatDateId,
  formatInvoiceStatusLabel,
  formatMonthYearId,
  formatRupiah,
  statusToBadgeVariant,
} from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/authHooks";

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  billing_period_id: string;
  kavling_id: string;
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
        block: string | null;
      }
    | {
        code: string;
        block: string | null;
      }[]
    | null;
}

interface InvoiceItemRow {
  id: string;
  fee_type_id: string;
  description: string;
  amount: number;
  sort_order: number;
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

interface InvoiceDetailPageProps {
  invoiceId: string;
  backHref?: string;
  backLabel?: string;
}

export function InvoiceDetailPage({ invoiceId, backHref = "/app/invoices", backLabel = "Kembali" }: Readonly<InvoiceDetailPageProps>) {
  const { profile } = useAuth();
  const client = getSupabaseBrowserClient();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [submissionReloadToken, setSubmissionReloadToken] = useState(0);
  const [hasActiveKavlingAccess, setHasActiveKavlingAccess] = useState(true);

  const loadInvoice = useCallback(async () => {
    if (!client) {
      setErrorMessage("Supabase client tidak tersedia.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const [invoiceRes, itemsRes] = await Promise.all([
      client
        .from("invoices")
        .select(
          "id, invoice_number, amount_due, amount_paid, status, due_date, paid_at, notes, billing_period_id, kavling_id, billing_periods(year, month, label), kavlings(code, block)",
        )
        .eq("id", invoiceId)
        .maybeSingle(),
      client
        .from("invoice_items")
        .select("id, fee_type_id, description, amount, sort_order")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true })
        .order("description", { ascending: true }),
    ]);

    if (invoiceRes.error || itemsRes.error) {
      setErrorMessage(invoiceRes.error?.message ?? itemsRes.error?.message ?? "Gagal memuat detail invoice.");
      setLoading(false);
      return;
    }

    setInvoice((invoiceRes.data ?? null) as InvoiceDetail | null);
    setItems((itemsRes.data ?? []) as InvoiceItemRow[]);

    const invoiceData = invoiceRes.data as InvoiceDetail | null;
    if (!profile || !invoiceData?.kavling_id) {
      setHasActiveKavlingAccess(true);
      setLoading(false);
      return;
    }

    const { count, error: mappingError } = await client
      .from("kavling_residents")
      .select("id", { head: true, count: "exact" })
      .eq("profile_id", profile.id)
      .eq("kavling_id", invoiceData.kavling_id)
      .eq("active", true)
      .limit(1);

    if (mappingError) {
      setErrorMessage(mappingError.message);
      setLoading(false);
      return;
    }

    setHasActiveKavlingAccess((count ?? 0) > 0);
    setLoading(false);
  }, [client, invoiceId, profile]);

  useEffect(() => {
    loadInvoice().catch(() => {
      setErrorMessage("Gagal memuat detail invoice.");
      setLoading(false);
    });
  }, [loadInvoice]);

  const period = normalizeOne(invoice?.billing_periods ?? null);
  const kavling = normalizeOne(invoice?.kavlings ?? null);
  const kavlingLabel = (() => {
    if (!kavling) {
      return "-";
    }

    const blockLabel = kavling.block ? ` / Blok ${kavling.block}` : "";
    return `${kavling.code}${blockLabel}`;
  })();
  const itemsTotal = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);
  const outstanding = invoice ? Math.max(invoice.amount_due - invoice.amount_paid, 0) : 0;
  const totalRows = items.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={backHref}>
              <ArrowLeft className="size-4" /> {backLabel}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">Detail Invoice</h1>
          <p className="text-sm text-slate-600">Nomor invoice dan rincian item tagihan per periode.</p>
        </div>

        <Button variant="secondary" onClick={() => loadInvoice()} disabled={loading}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </header>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>
              <span className="text-slate-500">No Invoice:</span>{" "}
              <span className="font-semibold text-slate-900">{invoice?.invoice_number ?? "-"}</span>
            </p>
            <p>
              <span className="text-slate-500">Periode:</span>{" "}
              <span className="font-medium text-slate-900">
                {period ? `${formatMonthYearId(period.year, period.month)} (${period.label})` : "-"}
              </span>
            </p>
            <p>
              <span className="text-slate-500">Kavling:</span>{" "}
              <span className="font-medium text-slate-900">{kavlingLabel}</span>
            </p>
            <p>
              <span className="text-slate-500">Due date:</span>{" "}
              <span className="font-medium text-slate-900">{invoice?.due_date ? formatDateId(invoice.due_date) : "-"}</span>
            </p>
            <p>
              <span className="text-slate-500">Status:</span>{" "}
              {invoice ? (
                <Badge variant={statusToBadgeVariant(invoice.status)}>{formatInvoiceStatusLabel(invoice.status)}</Badge>
              ) : (
                "-"
              )}
            </p>
            {invoice?.notes ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Catatan: {invoice.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ringkasan Nominal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p className="flex items-center justify-between gap-2">
              <span>Total item</span>
              <span className="font-semibold text-slate-900">{formatRupiah(itemsTotal)}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span>Total tagihan</span>
              <span className="font-semibold text-slate-900">{formatRupiah(invoice?.amount_due ?? 0)}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span>Sudah dibayar</span>
              <span className="font-semibold text-slate-900">{formatRupiah(invoice?.amount_paid ?? 0)}</span>
            </p>
            <p className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
              <span>Sisa</span>
              <span className="font-semibold text-slate-900">{formatRupiah(outstanding)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {!hasActiveKavlingAccess ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800">
            Invoice ini berasal dari riwayat kavling yang sudah tidak aktif di akun Anda. Detail tetap bisa dibaca, tetapi pengiriman pembayaran baru dinonaktifkan.
          </CardContent>
        </Card>
      ) : null}

      {invoice && hasActiveKavlingAccess ? (
        <PaymentSubmissionForm
          invoiceId={invoice.id}
          invoiceStatus={invoice.status}
          outstandingAmount={outstanding}
          onSubmitted={async () => {
            await loadInvoice();
            setSubmissionReloadToken((value) => value + 1);
          }}
        />
      ) : null}

      <SubmissionHistory invoiceId={invoiceId} reloadToken={submissionReloadToken} />

      <Card>
        <CardHeader>
          <CardTitle>Rincian Item</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat item invoice...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-slate-700">{item.description}</TableCell>
                      <TableCell className="font-medium text-slate-900">{formatRupiah(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {loading ? null : (
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
          )}
        </CardContent>
      </Card>
    </section>
  );
}
