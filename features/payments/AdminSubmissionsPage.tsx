"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProofPreviewButton } from "@/features/payments/ProofPreviewButton";
import { SubmissionReviewModal, type SubmissionReviewTarget } from "@/features/payments/SubmissionReviewModal";
import { notifySubmissionReviewed } from "@/features/payments/submissionNotificationPlaceholder";
import { formatDateId, formatInvoiceStatusLabel, formatPaymentSubmissionStatus, formatRupiah, statusToBadgeVariant } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type SubmissionTab = "pending" | "verified" | "rejected";

interface BankAccountSummary {
  label: string;
  bank_name: string;
  account_number: string;
}

interface KavlingSummary {
  code: string;
  block: string | null;
}

interface BillingPeriodSummary {
  year: number;
  month: number;
  label: string;
}

interface InvoiceSummary {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  due_date: string;
  kavlings: KavlingSummary | KavlingSummary[] | null;
  billing_periods: BillingPeriodSummary | BillingPeriodSummary[] | null;
}

interface SubmissionRow {
  id: string;
  invoice_id: string;
  submitted_by: string;
  amount_submitted: number;
  status: "submitted" | "verified" | "rejected" | "cancelled";
  note: string | null;
  rejection_reason: string | null;
  proof_path: string | null;
  created_at: string;
  verified_at: string | null;
  rejected_at: string | null;
  verified_by: string | null;
  rejected_by: string | null;
  bank_accounts: BankAccountSummary | BankAccountSummary[] | null;
  invoices: InvoiceSummary | InvoiceSummary[] | null;
}

interface ProfileSummary {
  id: string;
  full_name: string;
  display_name: string | null;
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function parseTab(value: string | null): SubmissionTab {
  if (value === "verified" || value === "rejected") {
    return value;
  }
  return "pending";
}

function tabLabel(tab: SubmissionTab): string {
  if (tab === "pending") {
    return "Pending";
  }
  if (tab === "verified") {
    return "Verified";
  }
  return "Rejected";
}

function formatSubmissionStatus(status: SubmissionRow["status"]): string {
  return formatPaymentSubmissionStatus(status);
}

function profileDisplayName(profile: ProfileSummary | undefined): string {
  if (!profile) {
    return "-";
  }
  return profile.display_name?.trim() || profile.full_name;
}

export function AdminSubmissionsPage() {
  const client = getSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = parseTab(searchParams.get("tab"));
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileSummary>>({});
  const [pendingByInvoice, setPendingByInvoice] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject">("approve");
  const [reviewTarget, setReviewTarget] = useState<SubmissionReviewTarget | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadSubmissions = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const status = activeTab === "pending" ? "submitted" : activeTab;
    const { data, error } = await client
      .from("payment_submissions")
      .select(
        "id, invoice_id, submitted_by, amount_submitted, status, note, rejection_reason, proof_path, created_at, verified_at, rejected_at, verified_by, rejected_by, bank_accounts(label, bank_name, account_number), invoices(id, invoice_number, amount_due, amount_paid, status, due_date, kavlings(code, block), billing_periods(year, month, label))",
      )
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      setItems([]);
      setProfileMap({});
      setPendingByInvoice({});
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as SubmissionRow[];
    setItems(rows);

    const actorIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [row.submitted_by, row.verified_by, row.rejected_by])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (actorIds.length > 0) {
      const { data: profileRows, error: profileError } = await client
        .from("profiles")
        .select("id, full_name, display_name")
        .in("id", actorIds);

      if (profileError) {
        setErrorMessage(profileError.message);
      } else {
        const map: Record<string, ProfileSummary> = {};
        for (const profile of (profileRows ?? []) as ProfileSummary[]) {
          map[profile.id] = profile;
        }
        setProfileMap(map);
      }
    } else {
      setProfileMap({});
    }

    const invoiceIds = Array.from(new Set(rows.map((row) => row.invoice_id)));
    if (invoiceIds.length > 0) {
      const { data: pendingRows, error: pendingError } = await client
        .from("payment_submissions")
        .select("invoice_id")
        .in("invoice_id", invoiceIds)
        .eq("status", "submitted");

      if (pendingError) {
        setErrorMessage(pendingError.message);
        setPendingByInvoice({});
      } else {
        const countMap: Record<string, number> = {};
        for (const row of pendingRows ?? []) {
          const invoiceId = (row as { invoice_id: string }).invoice_id;
          countMap[invoiceId] = (countMap[invoiceId] ?? 0) + 1;
        }
        setPendingByInvoice(countMap);
      }
    } else {
      setPendingByInvoice({});
    }

    setLoading(false);
  }, [activeTab, client]);

  useEffect(() => {
    loadSubmissions().catch(() => {
      setLoading(false);
      setErrorMessage("Gagal memuat data submission.");
    });
  }, [loadSubmissions]);

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (keyword.length === 0) {
      return items;
    }

    return items.filter((item) => {
      const invoice = normalizeOne(item.invoices);
      const kavling = normalizeOne(invoice?.kavlings ?? null);
      const submittedBy = profileDisplayName(profileMap[item.submitted_by]);
      const haystack = [
        item.id,
        invoice?.invoice_number ?? "",
        kavling?.code ?? "",
        submittedBy,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, profileMap, searchText]);
  const totalRows = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedItems = useMemo(
    () => filteredItems.slice((page - 1) * pageSize, page * pageSize),
    [filteredItems, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchText, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const switchTab = (tab: SubmissionTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const openReview = (mode: "approve" | "reject", row: SubmissionRow) => {
    const invoice = normalizeOne(row.invoices);
    const kavling = normalizeOne(invoice?.kavlings ?? null);
    setReviewMode(mode);
    setReviewError(null);
    setReviewTarget({
      id: row.id,
      invoiceId: row.invoice_id,
      invoiceNumber: invoice?.invoice_number ?? "-",
      kavlingCode: kavling?.code ?? "-",
      amountSubmitted: row.amount_submitted,
    });
    setModalOpen(true);
  };

  const closeReview = () => {
    if (working) {
      return;
    }
    setModalOpen(false);
    setReviewError(null);
    setReviewTarget(null);
  };

  const handleReviewConfirm = async (text: string | null) => {
    if (!client || !reviewTarget) {
      return;
    }

    setWorking(true);
    setReviewError(null);

    if (reviewMode === "approve") {
      const { error } = await client.rpc("verify_payment_submission", {
        target_submission_id: reviewTarget.id,
        admin_note: text,
      });

      if (error) {
        setReviewError(error.message);
        setWorking(false);
        return;
      }
    } else {
      const { error } = await client.rpc("reject_payment_submission", {
        target_submission_id: reviewTarget.id,
        reason: text ?? "",
      });

      if (error) {
        setReviewError(error.message);
        setWorking(false);
        return;
      }
    }

    await notifySubmissionReviewed({
      submissionId: reviewTarget.id,
      invoiceId: reviewTarget.invoiceId,
      outcome: reviewMode === "approve" ? "approved" : "rejected",
    });

    setWorking(false);
    setModalOpen(false);
    setReviewTarget(null);
    await loadSubmissions();
  };

  const renderReviewActions = (item: SubmissionRow, layout: "desktop" | "mobile" = "desktop") => {
    if (item.status !== "submitted") {
      return <span className="text-xs text-slate-500">Selesai</span>;
    }

    return (
      <div className={layout === "mobile" ? "grid grid-cols-2 gap-2" : "flex gap-2"}>
        <Button size="sm" variant="default" className={layout === "mobile" ? "w-full" : undefined} onClick={() => openReview("approve", item)} disabled={working}>
          Approve
        </Button>
        <Button size="sm" variant="destructive" className={layout === "mobile" ? "w-full" : undefined} onClick={() => openReview("reject", item)} disabled={working}>
          Reject
        </Button>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Payments</p>
          <h1 className="text-2xl font-semibold text-slate-900">Verifikasi Submission</h1>
          <p className="text-sm text-slate-600">Approve/reject bukti transfer manual dengan audit trail.</p>
        </div>
        <Button variant="secondary" onClick={() => loadSubmissions()} disabled={loading || working}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "verified", "rejected"] as SubmissionTab[]).map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={tab === activeTab ? "default" : "secondary"}
            onClick={() => switchTab(tab)}
            disabled={loading || working}
          >
            {tabLabel(tab)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Daftar Submission {tabLabel(activeTab)}</CardTitle>
          <Input
            placeholder="Cari invoice, kavling, atau nama pengirim..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-600">Memuat submission...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-slate-600">Tidak ada submission pada tab ini.</p>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {pagedItems.map((item) => {
                  const invoice = normalizeOne(item.invoices);
                  const kavling = normalizeOne(invoice?.kavlings ?? null);
                  const period = normalizeOne(invoice?.billing_periods ?? null);
                  const bankAccount = normalizeOne(item.bank_accounts);
                  const reviewerId = item.verified_by ?? item.rejected_by;
                  const reviewTime = item.verified_at ?? item.rejected_at;
                  const pendingDuplicates = pendingByInvoice[item.invoice_id] ?? 0;

                  return (
                    <div key={item.id} className="rounded-lg border bg-background px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{invoice?.invoice_number ?? "-"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {kavling ? `${kavling.code}${kavling.block ? ` / Blok ${kavling.block}` : ""}` : "-"} - {period ? period.label : "-"}
                          </p>
                        </div>
                        <Badge variant={statusToBadgeVariant(item.status === "verified" ? "paid" : item.status)} className="shrink-0">
                          {formatSubmissionStatus(item.status)}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Nominal</p>
                          <p className="font-semibold text-foreground">{formatRupiah(item.amount_submitted)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Invoice</p>
                          <Badge variant={statusToBadgeVariant(invoice?.status ?? "unpaid")} className="mt-1">
                            {formatInvoiceStatusLabel(invoice?.status ?? "unpaid")}
                          </Badge>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Pengirim</p>
                          <p className="font-medium text-foreground">{profileDisplayName(profileMap[item.submitted_by])}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                          <p className="text-muted-foreground">Duplikat</p>
                          <Badge variant={pendingDuplicates > 1 ? "destructive" : "secondary"} className="mt-1">
                            {pendingDuplicates > 1 ? `${pendingDuplicates} pending` : pendingDuplicates}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 text-xs text-slate-600">
                        <p>Waktu: {formatDateId(item.created_at)}</p>
                        <p>Rekening: {bankAccount ? `${bankAccount.label} - ${bankAccount.bank_name}` : "-"}</p>
                        {reviewTime ? <p>Review: {formatDateId(reviewTime)}</p> : null}
                        {reviewerId ? <p>Reviewer: {profileDisplayName(profileMap[reviewerId])}</p> : null}
                        {(item.rejection_reason ?? item.note) ? (
                          <p className="break-words">Catatan: {item.status === "rejected" ? item.rejection_reason ?? item.note : item.note}</p>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {item.proof_path ? <ProofPreviewButton submissionId={item.id} disabled={working} /> : <span className="text-xs text-slate-500">Belum ada bukti</span>}
                      </div>
                      <div className="mt-3">{renderReviewActions(item, "mobile")}</div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-[1320px]">
                  <TableHeader>
                    <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                      <TableHead>Waktu</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Kavling</TableHead>
                      <TableHead>Nominal</TableHead>
                      <TableHead>Status Submission</TableHead>
                      <TableHead>Status Invoice</TableHead>
                      <TableHead>Pengirim</TableHead>
                      <TableHead>Rekening Tujuan</TableHead>
                      <TableHead>Duplikat Pending</TableHead>
                      <TableHead>Bukti</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedItems.map((item) => {
                    const invoice = normalizeOne(item.invoices);
                    const kavling = normalizeOne(invoice?.kavlings ?? null);
                    const period = normalizeOne(invoice?.billing_periods ?? null);
                    const bankAccount = normalizeOne(item.bank_accounts);
                    const reviewerId = item.verified_by ?? item.rejected_by;
                    const reviewTime = item.verified_at ?? item.rejected_at;
                    const pendingDuplicates = pendingByInvoice[item.invoice_id] ?? 0;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-slate-700">
                          <div>
                            <p>{formatDateId(item.created_at)}</p>
                            {reviewTime ? <p className="text-xs text-slate-500">Review: {formatDateId(reviewTime)}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          <p className="font-medium text-slate-900">{invoice?.invoice_number ?? "-"}</p>
                          <p className="text-xs text-slate-500">{period ? `${period.label} (${period.month}/${period.year})` : "-"}</p>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {kavling ? `${kavling.code}${kavling.block ? ` / Blok ${kavling.block}` : ""}` : "-"}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">{formatRupiah(item.amount_submitted)}</TableCell>
                        <TableCell>
                          <Badge variant={statusToBadgeVariant(item.status === "verified" ? "paid" : item.status)}>
                            {formatSubmissionStatus(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusToBadgeVariant(invoice?.status ?? "unpaid")}>
                            {formatInvoiceStatusLabel(invoice?.status ?? "unpaid")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          <p>{profileDisplayName(profileMap[item.submitted_by])}</p>
                          {reviewerId ? <p className="text-xs text-slate-500">Reviewer: {profileDisplayName(profileMap[reviewerId])}</p> : null}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {bankAccount ? `${bankAccount.label} - ${bankAccount.bank_name} ${bankAccount.account_number}` : "-"}
                        </TableCell>
                        <TableCell>
                          {pendingDuplicates > 1 ? (
                            <Badge variant="destructive">{pendingDuplicates} pending</Badge>
                          ) : (
                            <Badge variant="secondary">{pendingDuplicates}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.proof_path ? <ProofPreviewButton submissionId={item.id} disabled={working} /> : <span className="text-xs text-slate-500">Belum ada</span>}</TableCell>
                        <TableCell className="max-w-xs text-slate-700">
                          <p className="line-clamp-3 text-sm">
                            {item.status === "rejected" ? item.rejection_reason ?? item.note ?? "-" : item.note ?? "-"}
                          </p>
                        </TableCell>
                        <TableCell>
                          {renderReviewActions(item)}
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {!loading && filteredItems.length > 0 ? (
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

      <SubmissionReviewModal
        open={modalOpen}
        mode={reviewMode}
        target={reviewTarget}
        saving={working}
        errorMessage={reviewError}
        onClose={closeReview}
        onConfirm={handleReviewConfirm}
      />
    </section>
  );
}
