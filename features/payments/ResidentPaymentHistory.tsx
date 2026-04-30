"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatDateId,
  formatRupiah,
  statusToBadgeVariant,
} from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { loadResidentPaymentHistory } from "@/features/reports/reportQueries";
import type { ResidentPaymentHistoryRow } from "@/features/reports/reportQueries";

interface ResidentPaymentHistoryProps {
  invoiceId: string;
  reloadToken?: number;
}

export function ResidentPaymentHistory({ invoiceId, reloadToken = 0 }: Readonly<ResidentPaymentHistoryProps>) {
  const client = getSupabaseBrowserClient();

  const [items, setItems] = useState<ResidentPaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await loadResidentPaymentHistory(invoiceId);
      setItems(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal memuat riwayat pembayaran.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [client, invoiceId]);

  useEffect(() => {
    loadPayments().catch(() => {
      setErrorMessage("Gagal memuat riwayat pembayaran.");
      setLoading(false);
    });
  }, [loadPayments, reloadToken]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Riwayat Pembayaran Terverifikasi</CardTitle>
        <Button variant="secondary" size="sm" onClick={() => loadPayments()} disabled={loading}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {errorMessage ? (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-600">Memuat riwayat pembayaran...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-600">
            Belum ada pembayaran terverifikasi untuk invoice ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                  <TableHead>Tanggal Verifikasi</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Diverifikasi Oleh</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-slate-700">
                      {item.verified_at ? formatDateId(item.verified_at) : "-"}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {formatRupiah(item.amount)}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {item.payment_method ?? "-"}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {item.verified_by_name ?? "-"}
                    </TableCell>
                    <TableCell className="text-slate-700 text-xs max-w-[200px] truncate">
                      {item.note ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}