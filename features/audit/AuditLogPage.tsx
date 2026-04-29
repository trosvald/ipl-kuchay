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
                  {filteredItems.map((row) => (
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
          )}
        </CardContent>
      </Card>
    </section>
  );
}
