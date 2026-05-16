"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateId } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { loadResidentReceiptHistory } from "@/features/reports/reportQueries";
import { openReportOutputArtifact } from "@/features/reports/reportOutputClient";
import type { ResidentReceiptHistoryRow } from "@/features/reports/reportQueries";

interface ResidentReceiptHistoryProps {
  invoiceId: string;
  reloadToken?: number;
}

export function ResidentReceiptHistory({ invoiceId, reloadToken = 0 }: Readonly<ResidentReceiptHistoryProps>) {
  const client = getSupabaseBrowserClient();

  const [items, setItems] = useState<ResidentReceiptHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const loadReceipts = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await loadResidentReceiptHistory(invoiceId);
      setItems(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal memuat riwayat bukti bayar.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [client, invoiceId]);

  useEffect(() => {
    loadReceipts().catch(() => {
      setErrorMessage("Gagal memuat riwayat bukti bayar.");
      setLoading(false);
    });
  }, [loadReceipts, reloadToken]);

  const handleOpenReceipt = useCallback(async (reportId: string) => {
    if (!client) return;

    setOpeningId(reportId);
    try {
      await openReportOutputArtifact({ reportId });
    } catch (err) {
      setErrorMessage("Gagal membuka bukti bayar. Coba lagi beberapa saat.");
    } finally {
      setOpeningId(null);
    }
  }, [client]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Riwayat Bukti Bayar</CardTitle>
        <Button variant="secondary" size="sm" onClick={() => loadReceipts()} disabled={loading}>
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
          <p className="text-sm text-slate-600">Memuat riwayat bukti bayar...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-600">
            Belum ada bukti bayar untuk invoice ini.
          </p>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {items.map((item) => (
                <div key={item.report_id} className="rounded-lg border bg-background px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateId(item.generated_at)}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => handleOpenReceipt(item.report_id)}
                    disabled={openingId === item.report_id}
                  >
                    <ExternalLink className="size-3 mr-1" />
                    {openingId === item.report_id ? "Membuka..." : "Buka Bukti Bayar"}
                  </Button>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                    <TableHead>Judul</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.report_id}>
                      <TableCell className="text-slate-700 font-medium">
                        {item.title}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {formatDateId(item.generated_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReceipt(item.report_id)}
                          disabled={openingId === item.report_id}
                        >
                          <ExternalLink className="size-3 mr-1" />
                          {openingId === item.report_id ? "Membuka..." : "Buka Bukti Bayar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
