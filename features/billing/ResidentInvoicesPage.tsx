"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDateId,
  formatInvoiceStatusLabel,
  formatMonthYearId,
  formatRupiah,
  statusToBadgeVariant,
} from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/authHooks";

interface InvoiceItemRow {
  id: string;
  description: string;
  amount: number;
  sort_order: number;
}

interface ResidentInvoiceRow {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: string;
  billing_period_id: string;
  billing_periods: {
    year: number;
    month: number;
    label: string;
  } | null;
  kavlings: {
    id: string;
    code: string;
    block: string | null;
  } | null;
  invoice_items: InvoiceItemRow[] | null;
}

interface KavlingGroup {
  code: string;
  block: string | null;
  kavling_id: string;
  invoices: ResidentInvoiceRow[];
  overdueTotal: number;
  outstandingTotal: number;
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function groupInvoicesByKavling(invoices: ResidentInvoiceRow[]): KavlingGroup[] {
  const map = new Map<string, ResidentInvoiceRow[]>();

  for (const inv of invoices) {
    const kavling = normalizeOne(inv.kavlings);
    if (!kavling) continue;
    const key = kavling.code;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(inv);
  }

  const groups: KavlingGroup[] = [];
  for (const [code, invs] of map.entries()) {
    const first = normalizeOne(invs[0]?.kavlings);
    const overdueTotal = invs
      .filter((i) => i.status === "overdue" || i.status === "unpaid")
      .reduce((sum, i) => sum + Math.max(i.amount_due - i.amount_paid, 0), 0);
    const outstandingTotal = invs.reduce(
      (sum, i) => sum + Math.max(i.amount_due - i.amount_paid, 0),
      0,
    );
    const firstKavling = invs[0]?.kavlings;
    groups.push({
      code,
      block: firstKavling?.block ?? null,
      kavling_id: firstKavling?.id ?? "",
      invoices: invs,
      overdueTotal,
      outstandingTotal,
    });
  }

  return groups.sort((a, b) => a.code.localeCompare(b.code));
}

function ArrearsSummaryCard({
  totalOverdue,
  overdueCount,
}: {
  totalOverdue: number;
  overdueCount: number;
}) {
  const hasArrears = totalOverdue > 0;

  return (
    <Card
      className={`rounded-xl border ${
        hasArrears
          ? "border-red-200 bg-red-50"
          : "border-green-200 bg-green-50"
      }`}
    >
      <CardContent className="p-6">
        <div className="space-y-1">
          <p
            className={`text-sm font-medium ${
              hasArrears ? "text-red-700" : "text-green-700"
            }`}
          >
            Ringkasan Tunggakan
          </p>
          <p
            className={`text-3xl font-semibold ${
              hasArrears ? "text-red-700" : "text-green-700"
            }`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatRupiah(totalOverdue)}
          </p>
          <p
            className={`text-sm ${
              hasArrears ? "text-red-600" : "text-green-600"
            }`}
          >
            {hasArrears
              ? `${overdueCount} tagihan belum dibayar`
              : "Semua tagihan Anda sudah lunas."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceCard({
  invoice,
  kavlingCode,
}: {
  invoice: ResidentInvoiceRow;
  kavlingCode: string;
}) {
  const period = normalizeOne(invoice.billing_periods);
  const periodLabel = period
    ? `${formatMonthYearId(period.year, period.month)} (${period.label})`
    : "-";
  const statusVariant = statusToBadgeVariant(invoice.status);
  const statusLabel = formatInvoiceStatusLabel(invoice.status);
  const amountDue = formatRupiah(invoice.amount_due);
  const amountPaid = invoice.amount_paid > 0 ? formatRupiah(invoice.amount_paid) : null;
  const outstanding = Math.max(invoice.amount_due - invoice.amount_paid, 0);
  const dueDateFormatted = invoice.due_date ? formatDateId(invoice.due_date) : "-";

  const items = invoice.invoice_items ?? [];
  const recurringItems = items.filter((i) => !i.description.includes("Override") && !i.description.includes("Denda"));
  const overrideItems = items.filter((i) => i.description.includes("Override"));
  const penaltyItems = items.filter((i) => i.description.includes("Denda"));

  const isHistorical =
    invoice.status === "paid" ||
    invoice.status === "closed" ||
    invoice.status === "waived" ||
    invoice.status === "cancelled";

  return (
    <Card
      className={`rounded-xl ${
        isHistorical ? "border-muted bg-muted/30" : "border-border"
      }`}
    >
      <Accordion type="single" collapsible defaultValue={undefined}>
        <AccordionItem value="invoice" className="px-4 py-0 border-none">
          <div className="flex items-start justify-between gap-3 py-4">
            <div className="flex-1 space-y-1">
              <p
                className={`text-base font-semibold ${
                  isHistorical ? "text-muted-foreground" : "text-slate-900"
                }`}
              >
                {periodLabel}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant}>{statusLabel}</Badge>
                {isHistorical && (
                  <span className="text-xs text-muted-foreground">Riwayat</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p
                className={`text-base font-semibold ${
                  isHistorical ? "text-muted-foreground" : "text-slate-900"
                }`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {amountDue}
              </p>
              {amountPaid && (
                <p className="text-xs text-muted-foreground">
                  Dibayar: {amountPaid}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Jatuh tempo: {dueDateFormatted}
              </p>
            </div>
            <AccordionTrigger className="p-0 hover:no-underline">
              <ChevronDown className="size-5 text-muted-foreground" />
            </AccordionTrigger>
          </div>

          <AccordionContent className="pb-4">
            <div className="space-y-3">
              {recurringItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Iuran Rutin
                  </p>
                  <div className="space-y-1">
                    {recurringItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-700">{item.description}</span>
                        <span
                          className="font-medium text-slate-900"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {formatRupiah(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {overrideItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Biaya Khusus
                  </p>
                  <div className="space-y-1">
                    {overrideItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-700">{item.description}</span>
                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                            Override
                          </Badge>
                        </div>
                        <span
                          className="font-medium text-slate-900"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {formatRupiah(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {penaltyItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Denda Keterlambatan
                  </p>
                  <div className="space-y-1">
                    {penaltyItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-700">{item.description}</span>
                        <span
                          className="font-medium text-red-600"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {formatRupiah(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isHistorical && outstanding > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-2">
                  <span className="text-sm font-medium text-slate-700">Sisa tagihan</span>
                  <span
                    className="text-sm font-semibold text-red-600"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatRupiah(outstanding)}
                  </span>
                </div>
              )}

              <div className="flex justify-end">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/invoices/${invoice.id}`}>Lihat Detail</Link>
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function InvoiceListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-1 text-right">
                <Skeleton className="h-5 w-24 ml-auto" />
                <Skeleton className="h-3 w-32 ml-auto" />
              </div>
              <Skeleton className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ResidentInvoicesPage() {
  const { hasActiveKavlingMapping } = useAuth();
  const client = getSupabaseBrowserClient();

  const [invoices, setInvoices] = useState<ResidentInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeKavling, setActiveKavling] = useState<string | null>(null);

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
      .select(
        `id, invoice_number, amount_due, amount_paid, due_date, status,
         billing_period_id, billing_periods(year, month, label),
         kavlings(code, block, id),
         invoice_items(id, description, amount, sort_order)`,
      )
      .order("due_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setInvoices([]);
      setLoading(false);
      return;
    }

    setInvoices((data ?? []) as unknown as ResidentInvoiceRow[]);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadInvoices().catch(() => {
      setLoading(false);
      setErrorMessage("Gagal memuat daftar tagihan.");
    });
  }, [loadInvoices]);

  // Group invoices by kavling
  const kavlingGroups = useMemo(
    () => groupInvoicesByKavling(invoices),
    [invoices],
  );

  // Set default active kavling
  useEffect(() => {
    if (kavlingGroups.length > 0 && !activeKavling) {
      setActiveKavling(kavlingGroups[0].code);
    }
  }, [kavlingGroups, activeKavling]);

  // Compute totals across all kavlings
  const totalOverdue = useMemo(
    () => kavlingGroups.reduce((sum, g) => sum + g.overdueTotal, 0),
    [kavlingGroups],
  );
  const overdueCount = useMemo(
    () =>
      kavlingGroups.reduce(
        (sum, g) => sum + g.invoices.filter((i) => i.status === "overdue" || i.status === "unpaid").length,
        0,
      ),
    [kavlingGroups],
  );

  const currentGroup = useMemo(
    () => kavlingGroups.find((g) => g.code === activeKavling) ?? null,
    [kavlingGroups, activeKavling],
  );

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            User Portal
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Tagihan Saya
          </h1>
          <p className="text-sm text-slate-600">
            Ringkasan tunggakan dan histori tagihan per kavling.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => loadInvoices()}
          disabled={loading}
        >
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </header>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">
            {errorMessage}
          </CardContent>
        </Card>
      ) : null}

      {!hasActiveKavlingMapping ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800">
            Anda tidak punya kavling aktif saat ini. Halaman ini tetap
            menampilkan histori tagihan Anda (read-only) sesuai periode hunian
            sebelumnya.
          </CardContent>
        </Card>
      ) : null}

      {/* Arrears Summary */}
      <ArrearsSummaryCard
        totalOverdue={totalOverdue}
        overdueCount={overdueCount}
      />

      {/* Kavling grouping via tabs for multi-kavling residents */}
      {loading ? (
        <InvoiceListSkeleton />
      ) : kavlingGroups.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-8 text-center">
            <p className="text-base font-semibold text-slate-900">
              Belum Ada Tagihan
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Tagihan untuk periode ini belum diterbitkan atau belum ada kavling
              aktif yang dikenai biaya. Cek periode lain atau hubungi pengurus
              bila Anda merasa data ini belum sesuai.
            </p>
          </CardContent>
        </Card>
      ) : kavlingGroups.length === 1 ? (
        /* Single kavling - no tabs needed */
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground mb-2">
            Kavling {kavlingGroups[0].code}
          </p>
          <div className="space-y-3">
            {kavlingGroups[0].invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                kavlingCode={kavlingGroups[0].code}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Multi-kavling - show tabs */
        <Tabs
          value={activeKavling ?? undefined}
          onValueChange={(value) => setActiveKavling(value)}
        >
          <TabsList className="h-11 w-full justify-start overflow-x-auto">
            {kavlingGroups.map((group) => (
              <TabsTrigger
                key={group.code}
                value={group.code}
                className="min-h-[44px]"
              >
                Kavling {group.code}
              </TabsTrigger>
            ))}
          </TabsList>

          {kavlingGroups.map((group) => (
            <TabsContent key={group.code} value={group.code} className="mt-4 space-y-3">
              {group.invoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  kavlingCode={group.code}
                />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  );
}