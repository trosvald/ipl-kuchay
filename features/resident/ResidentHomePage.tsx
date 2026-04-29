"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, CreditCard, FileText, Home } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useAuth } from "../auth/authHooks";

interface ResidentKavlingMapping {
  id: string;
  relation: string;
  is_primary: boolean;
  active: boolean;
  kavlings: {
    id: string;
    code: string;
    block: string | null;
    active: boolean;
  } | null;
}

function normalizeJoinedKavling(
  value:
    | ResidentKavlingMapping["kavlings"]
    | ResidentKavlingMapping["kavlings"][]
    | null,
): ResidentKavlingMapping["kavlings"] {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export function ResidentHomePage() {
  const { profile } = useAuth();
  const client = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkedKavlings, setLinkedKavlings] = useState<ResidentKavlingMapping[]>([]);
  const [historicalInvoiceCount, setHistoricalInvoiceCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const groupedKavlings = useMemo(() => {
    const map = new Map<string, { kavlingCode: string; block: string | null; isActive: boolean; mappings: ResidentKavlingMapping[] }>();
    for (const mapping of linkedKavlings) {
      const kavlingId = mapping.kavlings?.id ?? `unknown-${mapping.id}`;
      const existing = map.get(kavlingId);
      if (existing) {
        existing.mappings.push(mapping);
        continue;
      }

      map.set(kavlingId, {
        kavlingCode: mapping.kavlings?.code ?? "-",
        block: mapping.kavlings?.block ?? null,
        isActive: Boolean(mapping.kavlings?.active),
        mappings: [mapping],
      });
    }

    return Array.from(map.values());
  }, [linkedKavlings]);

  const totalRows = groupedKavlings.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedKavlings = useMemo(
    () => groupedKavlings.slice((page - 1) * pageSize, page * pageSize),
    [groupedKavlings, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const loadResidentKavlings = useCallback(async () => {
    if (!client || !profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const [mappingRes, historicalRes] = await Promise.all([
      client
      .from("kavling_residents")
      .select("id, relation, is_primary, active, kavlings(id, code, block, active)")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
      client
        .from("invoices")
        .select("id", { head: true, count: "exact" })
        .limit(1),
    ]);

    if (mappingRes.error || historicalRes.error) {
      setErrorMessage(mappingRes.error?.message ?? historicalRes.error?.message ?? "Gagal memuat data portal.");
      setLoading(false);
      return;
    }

    const normalized = ((mappingRes.data ?? []) as Array<
      ResidentKavlingMapping & {
        kavlings:
          | ResidentKavlingMapping["kavlings"]
          | ResidentKavlingMapping["kavlings"][];
      }
    >).map((item) => ({
      ...item,
      kavlings: normalizeJoinedKavling(item.kavlings),
    }));

    setHistoricalInvoiceCount(historicalRes.count ?? 0);
    setLinkedKavlings(normalized);
    setLoading(false);
  }, [client, profile]);

  useEffect(() => {
    loadResidentKavlings().catch(() => {
      setErrorMessage("Gagal memuat data portal.");
      setLoading(false);
    });
  }, [loadResidentKavlings]);

  let kavlingWorkspace: ReactNode;
  if (loading) {
    kavlingWorkspace = <p className="px-4 py-5 text-sm text-muted-foreground">Memuat kavling...</p>;
  } else if (errorMessage) {
    kavlingWorkspace = <p className="px-4 py-5 text-sm text-red-600">{errorMessage}</p>;
  } else if (groupedKavlings.length === 0) {
    kavlingWorkspace = (
      <div className="space-y-3 px-4 py-5 text-sm">
        <p className="font-medium text-foreground">Data kavling aktif belum terhubung.</p>
        {historicalInvoiceCount > 0 ? (
          <p className="text-muted-foreground">
            Anda tetap dapat membuka riwayat tagihan lama (read-only) tanpa melihat data penghuni baru untuk kavling yang sudah tidak aktif.
          </p>
        ) : (
          <p className="text-muted-foreground">Hubungi pengurus untuk sinkronisasi pemetaan kavling akun Anda.</p>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href="/app/invoices">Buka Riwayat Tagihan</Link>
        </Button>
      </div>
    );
  } else {
    kavlingWorkspace = (
      <Table>
        <TableHeader>
          <TableRow className="text-xs uppercase tracking-wide text-muted-foreground">
            <TableHead>Kavling</TableHead>
            <TableHead>Blok</TableHead>
            <TableHead>Relasi Terdaftar</TableHead>
            <TableHead>Primary</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedKavlings.map((group, index) => {
            const primaryMapping = group.mappings.find((mapping) => mapping.is_primary);
            return (
              <TableRow key={`${group.kavlingCode}-${index}`}>
                <TableCell className="font-medium text-foreground">{group.kavlingCode}</TableCell>
                <TableCell className="text-muted-foreground">{group.block ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {group.mappings.map((mapping) => (
                      <Badge key={mapping.id} variant="outline">
                        {mapping.relation}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={primaryMapping ? "success" : "secondary"}>{primaryMapping ? "Primary" : "Tambahan"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={group.isActive ? "success" : "secondary"}>{group.isActive ? "Aktif" : "Nonaktif"}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">User Portal</p>
          <h2 className="text-xl font-semibold text-foreground">Layanan IPL Jatiloka</h2>
        </div>
        <Badge variant={profile?.is_active ? "success" : "destructive"}>
          {profile?.is_active ? "Akun aktif" : "Akun nonaktif"}
        </Badge>
      </header>

      <nav className="overflow-x-auto rounded-lg border border-border bg-background p-2">
        <div className="flex w-max min-w-full gap-2 whitespace-nowrap">
          <Button size="sm" className="shrink-0 justify-start">
          <Home className="size-4" /> Ringkasan
          </Button>
          <Button asChild size="sm" variant="outline" className="shrink-0 justify-start">
            <Link href="/app/invoices">
              <FileText className="size-4" /> Tagihan
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="shrink-0 justify-start" disabled>
            <CreditCard className="size-4" /> Pembayaran
          </Button>
        </div>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Kavling Terdaftar</p>
            <Badge variant="outline">{groupedKavlings.length} kavling</Badge>
          </div>
          <div>{kavlingWorkspace}</div>
          {loading ? null : (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
              <p>
                Menampilkan {pageStart}-{pageEnd} dari {totalRows} data
              </p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1">
                  <span>Rows</span>
                  <select
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    value={String(pageSize)}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setPageSize(next);
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
                <span className="text-xs">Page {page}/{totalPages}</span>
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
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Antrian Layanan</p>
          </div>
          <div className="divide-y">
            <div className="flex items-start gap-3 px-4 py-3 text-sm">
              <Clock3 className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Tagihan Periode Aktif</p>
                <p className="text-muted-foreground">Tersedia di menu Invoice pada portal warga.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 text-sm">
              <Clock3 className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Pembayaran & Upload Bukti</p>
                <p className="text-muted-foreground">Modul dibuka pada milestone M05.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 text-sm">
              <Clock3 className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Riwayat Pembayaran</p>
                <p className="text-muted-foreground">Modul dibuka pada milestone M07.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
