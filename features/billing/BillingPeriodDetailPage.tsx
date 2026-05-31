"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Inbox, RefreshCw, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, FilterGroup } from "@/components/ui/FilterBar";
import { ListContainer } from "@/components/ui/ListContainer";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { StatusDot } from "@/components/ui/StatusDot";
import { StatsGrid } from "@/components/ui/StatsGrid";
import { DataList } from "@/features/layout/DataList";
import { PageHeader } from "@/features/layout/PageHeader";
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

  const totalDue = useMemo(() => filteredInvoices.reduce((sum, item) => sum + item.amount_due, 0), [filteredInvoices]);
  const totalPaid = useMemo(() => filteredInvoices.reduce((sum, item) => sum + item.amount_paid, 0), [filteredInvoices]);
  const totalCount = filteredInvoices.length;

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (!client) {
    return <p className="text-sm text-red-600">Supabase client belum tersedia.</p>;
  }

  const hasNoContent = !loading && !errorMessage && filteredInvoices.length === 0;

  const mobileContent = hasNoContent ? (
    <EmptyState
      icon={Inbox}
      title="Tidak ada invoice"
      description={statusFilter !== "all" ? "Tidak ada invoice dengan status filter ini." : "Belum ada invoice untuk periode ini."}
    />
  ) : (
    <ListContainer>
      {pagedInvoices.map((item) => {
        const kavling = normalizeOne(item.kavlings);
        const outstanding = Math.max(item.amount_due - item.amount_paid, 0);
        const accentColor =
          item.status === "paid" ? "border-l-emerald-500" :
          item.status === "overdue" ? "border-l-red-500" :
          item.status === "pending_verification" ? "border-l-amber-500" :
          "border-l-slate-400";
        const statusVariant = item.status === "paid" ? "success" : item.status === "overdue" ? "destructive" : item.status === "pending_verification" ? "warning" : "default";

        return (
          <CompactListRow
            key={item.id}
            primary={item.invoice_number}
            trailing={
              <Badge variant={statusToBadgeVariant(item.status)} className="text-[10px] h-4 px-1.5">
                {formatInvoiceStatusLabel(item.status)}
              </Badge>
            }
            secondary={
              <span className="flex items-center gap-1.5">
                <StatusDot variant={statusVariant} />
                <span>Kav {kavling?.code ?? "-"}</span>
                <span className="text-slate-300">·</span>
                <span>JT {formatDateId(item.due_date)}</span>
              </span>
            }
            accentColor={accentColor}
          >
            <div className="flex gap-3 text-xs">
              <span><span className="text-slate-400">Tagihan</span> <span className="font-semibold text-slate-800">{formatRupiah(item.amount_due)}</span></span>
              <span><span className="text-slate-400">Dibayar</span> <span className="font-semibold text-emerald-700">{formatRupiah(item.amount_paid)}</span></span>
              {outstanding > 0 ? (
                <span><span className="text-slate-400">Sisa</span> <span className="font-semibold text-amber-700">{formatRupiah(outstanding)}</span></span>
              ) : null}
            </div>
          </CompactListRow>
        );
      })}
    </ListContainer>
  );

  const desktopContent = hasNoContent ? (
    <EmptyState
      icon={Inbox}
      title="Tidak ada invoice"
      description={statusFilter !== "all" ? "Tidak ada invoice dengan status filter ini." : "Belum ada invoice untuk periode ini."}
    />
  ) : (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-sm">
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
  );

  return (
    <section className="page-section">
      <PageHeader
        title="Detail Periode"
        subtitle={
          period
            ? `${formatMonthYearId(period.year, period.month)} — jatuh tempo ${formatDateId(period.due_date)}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {period ? (
              <Badge variant={statusToBadgeVariant(period.status)}>
                {formatBillingPeriodStatusLabel(period.status)}
              </Badge>
            ) : null}
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/billing">
                <ArrowLeft className="size-4" /> Kembali
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => loadPeriodDetail()} disabled={loading}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-5 py-3.5 text-sm text-red-700 font-medium">
          {errorMessage}
        </div>
      ) : null}

      {/* Summary stats */}
      {!loading && !errorMessage && period ? (
        <StatsGrid
          columns={3}
          items={[
            {
              label: "Jumlah Invoice",
              value: totalCount,
              icon: FileText,
            },
            {
              label: "Total Tagihan",
              value: formatRupiah(totalDue),
              icon: Wallet,
            },
            {
              label: "Total Terbayar",
              value: formatRupiah(totalPaid),
              icon: Wallet,
              variant: "success",
            },
          ]}
        />
      ) : null}

      {/* Invoice list */}
      <div className="admin-card p-4 space-y-4">
        <FilterBar>
          <FilterGroup label="Status">
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
              }}
            >
              {statusFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "Semua" : formatInvoiceStatusLabel(option)}
                </option>
              ))}
            </select>
          </FilterGroup>
        </FilterBar>

        <DataList
          loading={loading}
          error={null}
          onRetry={loadPeriodDetail}
          mobile={mobileContent}
          desktop={desktopContent}
        />

        {!loading && !errorMessage && filteredInvoices.length > 0 ? (
          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </div>
    </section>
  );
}
