"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditLogInput } from "@/features/audit/auditTypes";
import { useAuth } from "@/features/auth/authHooks";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { kavlingResidentMappingSchema } from "@/lib/validation";

interface KavlingOption {
  id: string;
  code: string;
  active: boolean;
}

interface MappingRow {
  id: string;
  kavling_id: string;
  profile_id: string;
  relation: string;
  is_primary: boolean;
  active: boolean;
  kavlings: {
    code: string;
    active: boolean;
  } | null;
}

function normalizeJoinedKavling(
  value: MappingRow["kavlings"] | MappingRow["kavlings"][] | null,
): MappingRow["kavlings"] {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

interface KavlingResidentMappingProps {
  residentId: string;
}

async function writeAuditLog(payload: AuditLogInput) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return;
  }

  await client.rpc("log_admin_action", {
    action_name: payload.action,
    target_entity_table: payload.entityTable,
    target_entity_id: payload.entityId,
    previous_data: payload.beforeData ?? null,
    next_data: payload.afterData ?? null,
    source_request_id: payload.requestId ?? null,
  });
}

export function KavlingResidentMapping({ residentId }: Readonly<KavlingResidentMappingProps>) {
  const { profile } = useAuth();
  const client = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [kavlingOptions, setKavlingOptions] = useState<KavlingOption[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [kavlingId, setKavlingId] = useState("");
  const [relation, setRelation] = useState("owner");
  const [isPrimary, setIsPrimary] = useState(false);
  const totalRows = mappings.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedMappings = useMemo(
    () => mappings.slice((page - 1) * pageSize, page * pageSize),
    [mappings, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const loadAll = useCallback(async () => {
    if (!client) {
      setErrorMessage("Supabase client tidak tersedia.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const [{ data: kavlingsData, error: kavlingsError }, { data: mappingData, error: mappingError }] =
      await Promise.all([
        client
          .from("kavlings")
          .select("id, code, active")
          .order("sort_order", { ascending: true })
          .order("code", { ascending: true }),
        client
          .from("kavling_residents")
          .select("id, kavling_id, profile_id, relation, is_primary, active, kavlings(code, active)")
          .eq("profile_id", residentId)
          .order("created_at", { ascending: false }),
      ]);

    if (kavlingsError || mappingError) {
      setErrorMessage(kavlingsError?.message ?? mappingError?.message ?? "Gagal memuat mapping.");
      setLoading(false);
      return;
    }

    setKavlingOptions((kavlingsData ?? []) as KavlingOption[]);
    const normalizedMappings = ((mappingData ?? []) as Array<MappingRow & { kavlings: MappingRow["kavlings"] | MappingRow["kavlings"][] }>).map(
      (item) => ({
        ...item,
        kavlings: normalizeJoinedKavling(item.kavlings),
      }),
    );
    setMappings(normalizedMappings);
    setLoading(false);

    if (!kavlingId && kavlingsData && kavlingsData.length > 0) {
      setKavlingId(kavlingsData[0].id);
    }
  }, [client, kavlingId, residentId]);

  useEffect(() => {
    loadAll().catch(() => {
      setErrorMessage("Gagal memuat mapping resident.");
      setLoading(false);
    });
  }, [loadAll]);

  const handleCreateOrUpdateMapping = async () => {
    if (!client || !profile || !kavlingId) {
      return;
    }

    const parsed = kavlingResidentMappingSchema.safeParse({
      kavling_id: kavlingId,
      profile_id: residentId,
      relation,
      is_primary: isPrimary,
      active: true,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Data mapping tidak valid.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const existing = mappings.find((item) => item.kavling_id === kavlingId);

    const { data, error } = await client
      .from("kavling_residents")
      .upsert(
        {
          kavling_id: parsed.data.kavling_id,
          profile_id: parsed.data.profile_id,
          relation: parsed.data.relation,
          is_primary: parsed.data.is_primary,
          active: true,
        },
        { onConflict: "kavling_id,profile_id" },
      )
      .select("id, kavling_id, profile_id, relation, is_primary, active, kavlings(code, active)")
      .single();

    if (error || !data) {
      const duplicatePrimary = error?.message.includes("idx_kavling_residents_one_primary_active");
      setErrorMessage(
        duplicatePrimary
          ? "Kavling ini sudah memiliki resident primary aktif. Nonaktifkan atau ubah primary terlebih dahulu."
          : error?.message ?? "Gagal menyimpan mapping resident.",
      );
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: existing ? "mapping.update" : "mapping.create",
      entityTable: "kavling_residents",
      entityId: data.id,
      beforeData: existing ?? null,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setSaving(false);
    await loadAll();
  };

  const handleDeactivate = async (mapping: MappingRow) => {
    if (!client || !profile) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("kavling_residents")
      .update({ active: false, is_primary: false })
      .eq("id", mapping.id)
      .select("id, kavling_id, profile_id, relation, is_primary, active, kavlings(code, active)")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal menonaktifkan mapping.");
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: "mapping.deactivate",
      entityTable: "kavling_residents",
      entityId: mapping.id,
      beforeData: mapping,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setSaving(false);
    await loadAll();
  };

  let mappingContent: ReactNode;
  if (loading) {
    mappingContent = <p className="text-sm text-slate-600">Memuat mapping...</p>;
  } else if (mappings.length === 0) {
    mappingContent = (
      <p className="text-sm text-slate-600">Belum ada mapping kavling untuk resident ini.</p>
    );
  } else {
    mappingContent = (
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="text-xs uppercase tracking-wide text-slate-500">
            <TableHead>Kavling</TableHead>
            <TableHead>Relasi</TableHead>
            <TableHead>Primary</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedMappings.map((mapping) => (
            <TableRow key={mapping.id}>
              <TableCell className="font-medium text-slate-900">{mapping.kavlings?.code ?? "-"}</TableCell>
              <TableCell className="text-slate-700">{mapping.relation}</TableCell>
              <TableCell className="text-slate-700">{mapping.is_primary ? "Ya" : "Tidak"}</TableCell>
              <TableCell>
                <Badge variant={mapping.active ? "success" : "default"}>
                  {mapping.active ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!mapping.active || saving}
                  onClick={() => handleDeactivate(mapping)}
                >
                  Unlink
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">Mapping Resident ke Kavling</h3>
        <p className="text-xs text-slate-600">Satu kavling hanya boleh punya satu resident primary aktif.</p>
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <label className="space-y-1 text-xs text-slate-600">
          <span>Kavling</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            value={kavlingId}
            onChange={(event) => setKavlingId(event.target.value)}
          >
            {kavlingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.code} {option.active ? "" : "(nonaktif)"}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-slate-600">
          <span>Relasi</span>
          <Input value={relation} onChange={(event) => setRelation(event.target.value)} placeholder="owner / tenant" />
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          <span>Primary</span>
        </label>

        <Button onClick={() => handleCreateOrUpdateMapping()} disabled={saving || loading}>
          {saving ? "Menyimpan..." : "Simpan Mapping"}
        </Button>
      </div>

      {mappingContent}

      {!loading ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
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
      ) : null}
    </div>
  );
}
