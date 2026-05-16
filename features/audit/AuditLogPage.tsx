"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateId } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useAuth } from "@/features/auth/authHooks";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_table: string;
  entity_id: string;
  request_id: string | null;
  created_at: string;
}

interface ProfileSummary {
  id: string;
  full_name: string;
  display_name: string | null;
}

function profileName(profile: ProfileSummary | undefined): string {
  if (!profile) {
    return "-";
  }
  return profile.display_name?.trim() || profile.full_name;
}

export function AuditLogPage() {
  const client = getSupabaseBrowserClient();
  const { role } = useAuth();

  const [items, setItems] = useState<AuditRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileSummary>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const isFinanceOnlyScope = role === "treasurer";

  const loadAuditLogs = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("audit_logs")
      .select("id, actor_id, actor_role, action, entity_table, entity_id, request_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      setItems([]);
      setProfileMap({});
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as AuditRow[];
    setItems(rows);

    const actorIds = Array.from(new Set(rows.map((row) => row.actor_id).filter((value): value is string => Boolean(value))));
    if (actorIds.length > 0) {
      const { data: profiles, error: profileError } = await client
        .from("profiles")
        .select("id, full_name, display_name")
        .in("id", actorIds);

      if (profileError) {
        setErrorMessage(profileError.message);
      } else {
        const map: Record<string, ProfileSummary> = {};
        for (const row of (profiles ?? []) as ProfileSummary[]) {
          map[row.id] = row;
        }
        setProfileMap(map);
      }
    } else {
      setProfileMap({});
    }

    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadAuditLogs().catch(() => {
      setLoading(false);
      setErrorMessage("Gagal memuat audit log.");
    });
  }, [loadAuditLogs]);

  const filteredItems = useMemo(() => {
    const actionQuery = actionFilter.trim().toLowerCase();
    const entityQuery = entityFilter.trim().toLowerCase();

    return items.filter((row) => {
      if (actionQuery.length > 0 && !row.action.toLowerCase().includes(actionQuery)) {
        return false;
      }
      if (entityQuery.length > 0) {
        const entityText = `${row.entity_table} ${row.entity_id}`.toLowerCase();
        if (!entityText.includes(entityQuery)) {
          return false;
        }
      }
      return true;
    });
  }, [actionFilter, entityFilter, items]);
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
  }, [actionFilter, entityFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Security</p>
          <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-600">Riwayat aksi sensitif pengurus.</p>
          <p className="text-xs text-slate-500">
            {isFinanceOnlyScope
              ? "Cakupan audit: Keuangan (billing, verifikasi, pembayaran, laporan)."
              : "Cakupan audit: Operasional penuh untuk admin/super admin."}
          </p>
        </div>
        <Button variant="secondary" onClick={() => loadAuditLogs()} disabled={loading}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </header>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Filter Audit</CardTitle>
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder={
                isFinanceOnlyScope
                  ? "Filter action (contoh: payment, verification, billing, report)"
                  : "Filter action (contoh: payment_submission)"
              }
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            />
            <Input
              placeholder="Filter entity table/id"
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-600">Memuat audit log...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-slate-600">Belum ada data audit yang cocok.</p>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {pagedItems.map((row) => (
                  <div key={row.id} className="rounded-lg border bg-background px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-foreground">{row.action}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateId(row.created_at)}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{row.actor_role ?? "-"}</Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <p>
                        Aktor: {profileName(row.actor_id ? profileMap[row.actor_id] : undefined)}
                        {row.actor_id ? <span className="block break-all font-mono text-slate-500">{row.actor_id}</span> : null}
                      </p>
                      <p>
                        Entity: <span className="font-medium text-slate-900">{row.entity_table}</span>
                        <span className="block break-all font-mono text-slate-500">{row.entity_id}</span>
                      </p>
                      <p className="break-all font-mono">Request: {row.request_id ?? "-"}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                      <TableHead>Waktu</TableHead>
                      <TableHead>Aktor</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Request ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedItems.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-slate-700">{formatDateId(row.created_at)}</TableCell>
                        <TableCell className="text-slate-700">
                          <p>{profileName(row.actor_id ? profileMap[row.actor_id] : undefined)}</p>
                          {row.actor_id ? <p className="text-xs text-slate-500">{row.actor_id}</p> : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.actor_role ?? "-"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-800">{row.action}</TableCell>
                        <TableCell className="text-slate-700">
                          <p className="font-medium text-slate-900">{row.entity_table}</p>
                          <p className="font-mono text-xs text-slate-500">{row.entity_id}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">{row.request_id ?? "-"}</TableCell>
                      </TableRow>
                    ))}
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
    </section>
  );
}
