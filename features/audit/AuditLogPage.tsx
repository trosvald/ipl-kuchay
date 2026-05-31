"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { DataList } from "@/features/layout/DataList";
import { FilterBar, FilterGroup } from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/input";
import { ListContainer } from "@/components/ui/ListContainer";
import { PageHeader } from "@/features/layout/PageHeader";
import { PaginationBar } from "@/components/ui/PaginationBar";
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
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
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
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin Security"
        title="Audit Log"
        subtitle="Riwayat aksi sensitif pengurus."
        actions={
          <Button variant="secondary" onClick={() => loadAuditLogs()} disabled={loading}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />
      <p className="-mt-4 text-xs text-muted-foreground">
        {isFinanceOnlyScope
          ? "Cakupan audit: Keuangan (billing, verifikasi, pembayaran, laporan)."
          : "Cakupan audit: Operasional penuh untuk admin/super admin."}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter Audit</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterBar>
            <FilterGroup label="Action">
              <Input
                placeholder={
                  isFinanceOnlyScope
                    ? "Filter action (contoh: payment, verification, billing, report)"
                    : "Filter action (contoh: payment_submission)"
                }
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value);
                  setPage(1);
                }}
              />
            </FilterGroup>
            <FilterGroup label="Entity">
              <Input
                placeholder="Filter entity table/id"
                value={entityFilter}
                onChange={(event) => {
                  setEntityFilter(event.target.value);
                  setPage(1);
                }}
              />
            </FilterGroup>
          </FilterBar>
          <DataList
            loading={loading}
            error={errorMessage}
            onRetry={loadAuditLogs}
            empty={{ title: "Belum ada data audit yang cocok." }}
            mobile={filteredItems.length > 0 ? (
              <ListContainer>
                {pagedItems.map((row) => (
                  <CompactListRow
                    key={row.id}
                    primary={<span className="font-mono text-xs">{row.action}</span>}
                    secondary={
                      <span className="flex items-center gap-1.5">
                        <span>{formatDateId(row.created_at)}</span>
                        <span className="text-slate-300">·</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{row.actor_role ?? "-"}</Badge>
                      </span>
                    }
                    trailing={null}
                    expandedOpen={expandedAuditId === row.id}
                    onToggle={() => setExpandedAuditId(expandedAuditId === row.id ? null : row.id)}
                    expanded={
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <p>
                          <span className="text-slate-400">Aktor: </span>
                          <span className="font-medium text-slate-800">{profileName(row.actor_id ? profileMap[row.actor_id] : undefined)}</span>
                        </p>
                        {row.actor_id ? (
                          <p className="break-all font-mono bg-slate-50 px-2 py-1 rounded text-slate-500">{row.actor_id}</p>
                        ) : null}
                        <p>
                          <span className="text-slate-400">Entity: </span>
                          <span className="font-medium text-slate-800">{row.entity_table}</span>
                        </p>
                        <p className="break-all font-mono bg-slate-50 px-2 py-1 rounded text-slate-500">{row.entity_id}</p>
                        <p className="break-all font-mono text-slate-500">Request: {row.request_id ?? "-"}</p>
                      </div>
                    }
                  />
                ))}
              </ListContainer>
            ) : undefined}
            desktop={filteredItems.length > 0 ? (
              <div className="overflow-x-auto">
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
            ) : undefined}
          />

          {!loading && !errorMessage && filteredItems.length > 0 ? (
            <PaginationBar
              page={page}
              pageSize={pageSize}
              totalRows={totalRows}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              className="mt-3"
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
