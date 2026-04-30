"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildRejectionGuidance,
  formatDateId,
  formatPaymentSubmissionStatus,
  formatRupiah,
  formatSubmissionNextStep,
  statusToBadgeVariant,
} from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface SubmissionRow {
  id: string;
  amount_submitted: number;
  status: "submitted" | "verified" | "rejected" | "cancelled";
  note: string | null;
  rejection_reason: string | null;
  proof_path: string | null;
  created_at: string;
  bank_accounts:
    | {
        label: string;
        bank_name: string;
        account_number: string;
      }
    | {
        label: string;
        bank_name: string;
        account_number: string;
      }[]
    | null;
}

interface SubmissionHistoryProps {
  invoiceId: string;
  reloadToken?: number;
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function formatSubmissionStatus(status: SubmissionRow["status"]): string {
  return formatPaymentSubmissionStatus(status);
}

export function SubmissionHistory({ invoiceId, reloadToken = 0 }: Readonly<SubmissionHistoryProps>) {
  const client = getSupabaseBrowserClient();

  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("payment_submissions")
      .select("id, amount_submitted, status, note, rejection_reason, proof_path, created_at, bank_accounts(label, bank_name, account_number)")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as SubmissionRow[]);
    setLoading(false);
  }, [client, invoiceId]);

  useEffect(() => {
    loadSubmissions().catch(() => {
      setLoading(false);
      setErrorMessage("Gagal memuat riwayat submission.");
    });
  }, [loadSubmissions, reloadToken]);

  const visibleItems = useMemo(() => items.filter((item) => item.status !== "cancelled"), [items]);
  let content: React.ReactNode;

  if (loading) {
    content = <p className="text-sm text-slate-600">Memuat submission...</p>;
  } else if (visibleItems.length === 0) {
    content = <p className="text-sm text-slate-600">Belum ada submission untuk invoice ini.</p>;
  } else {
    content = (
      <div className="overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader>
              <TableRow className="text-xs uppercase tracking-wide text-slate-500">
              <TableHead>Tanggal</TableHead>
              <TableHead>Nominal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rekening Tujuan</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead>Bukti</TableHead>
              <TableHead>Langkah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => {
              const bankAccount = normalizeOne(item.bank_accounts);
              return (
                <TableRow key={item.id}>
                  <TableCell className="text-slate-700">{formatDateId(item.created_at)}</TableCell>
                  <TableCell className="font-medium text-slate-900">{formatRupiah(item.amount_submitted)}</TableCell>
                  <TableCell>
                    <Badge variant={statusToBadgeVariant(item.status === "verified" ? "paid" : item.status)}>
                      {formatSubmissionStatus(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-700">
                    {bankAccount ? `${bankAccount.label} - ${bankAccount.bank_name} ${bankAccount.account_number}` : "-"}
                  </TableCell>
                  <TableCell className="text-slate-700">
                    {item.status === "rejected"
                      ? item.rejection_reason ?? item.note ?? "-"
                      : item.note ?? "-"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {item.proof_path
                      ? "Tersimpan privat"
                      : "Belum ada"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {item.status === "rejected"
                      ? buildRejectionGuidance(item.status, item.rejection_reason ?? "") ??
                        formatSubmissionNextStep(item.status) ??
                        "-"
                      : item.status === "submitted"
                        ? formatSubmissionNextStep(item.status) ?? "-"
                        : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Riwayat Submission Bukti</CardTitle>
        <Button variant="secondary" size="sm" onClick={() => loadSubmissions()} disabled={loading}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {errorMessage ? <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
        {content}
      </CardContent>
    </Card>
  );
}
