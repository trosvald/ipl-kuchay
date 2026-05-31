"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { ListContainer } from "@/components/ui/ListContainer";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { StatusDot } from "@/components/ui/StatusDot";
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
  relation_type: "owner" | "spouse" | "child" | "parent" | "tenant" | "family_other" | "staff" | "other";
  relation_label: string | null;
  is_primary: boolean;
  active: boolean;
  started_at: string;
  ended_at: string | null;
  kavlings: {
    code: string;
    active: boolean;
  } | null;
}

const relationOptions: Array<{ value: MappingRow["relation_type"]; label: string }> = [
  { value: "owner", label: "Pemilik" },
  { value: "spouse", label: "Pasangan" },
  { value: "child", label: "Anak" },
  { value: "parent", label: "Orang Tua" },
  { value: "tenant", label: "Penyewa" },
  { value: "family_other", label: "Keluarga Lain" },
  { value: "staff", label: "Staf" },
  { value: "other", label: "Lainnya" },
];

function formatRelationLabel(mapping: MappingRow) {
  if (mapping.relation_type === "other" && mapping.relation_label) {
    return `Lainnya: ${mapping.relation_label}`;
  }
  const matched = relationOptions.find((option) => option.value === mapping.relation_type);
  return matched?.label ?? mapping.relation;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [kavlingId, setKavlingId] = useState("");
  const [relationType, setRelationType] = useState<MappingRow["relation_type"]>("owner");
  const [relationLabel, setRelationLabel] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const totalRows = mappings.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedMappings = useMemo(
    () => mappings.slice((page - 1) * pageSize, page * pageSize),
    [mappings, page, pageSize],
  );
  const selectedKavlingPrimary = useMemo(
    () => mappings.find((item) => item.kavling_id === kavlingId && item.active && item.is_primary),
    [kavlingId, mappings],
  );

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
          .select("id, kavling_id, profile_id, relation, relation_type, relation_label, is_primary, active, started_at, ended_at, kavlings(code, active)")
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
      relation: relationType === "other" ? relationLabel : relationType,
      is_primary: isPrimary,
      active: true,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Data mapping tidak valid.");
      return;
    }

    if (relationType === "other" && relationLabel.trim().length < 2) {
      setErrorMessage("Detail relasi untuk opsi lainnya minimal 2 karakter.");
      return;
    }

    if (isPrimary && selectedKavlingPrimary && selectedKavlingPrimary.profile_id !== residentId) {
      setErrorMessage("Kavling ini sudah memiliki resident primary aktif. Lakukan handoff eksplisit dengan menonaktifkan mapping primary lama terlebih dahulu.");
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
          relation_type: relationType,
          relation_label: relationType === "other" ? relationLabel.trim() : null,
          is_primary: parsed.data.is_primary,
          active: true,
          started_at: existing?.started_at ?? new Date().toISOString().slice(0, 10),
          ended_at: null,
        },
        { onConflict: "kavling_id,profile_id" },
      )
      .select("id, kavling_id, profile_id, relation, relation_type, relation_label, is_primary, active, started_at, ended_at, kavlings(code, active)")
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
      .update({ active: false, is_primary: false, ended_at: new Date().toISOString().slice(0, 10) })
      .eq("id", mapping.id)
      .select("id, kavling_id, profile_id, relation, relation_type, relation_label, is_primary, active, started_at, ended_at, kavlings(code, active)")
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

  const mobileContent = mappings.length === 0 ? (
    <EmptyState icon={undefined} title="Belum ada mapping kavling untuk resident ini." />
  ) : (
    <ListContainer>
      {pagedMappings.map((mapping) => {
        const isExpanded = expandedId === mapping.id;
        return (
          <CompactListRow
            key={mapping.id}
            primary={mapping.kavlings?.code ?? "-"}
            trailing={
              <Badge variant={mapping.active ? "success" : "default"} className="text-[10px] h-4 px-1.5">
                {mapping.active ? "Aktif" : "Nonaktif"}
              </Badge>
            }
            secondary={
              <span className="flex items-center gap-1.5">
                <StatusDot variant={mapping.active ? "success" : "muted"} />
                <span>{formatRelationLabel(mapping)}</span>
                <span className="text-slate-300">·</span>
                <span>Primary: {mapping.is_primary ? "Ya" : "Tidak"}</span>
              </span>
            }
            accentColor={mapping.active ? "border-l-emerald-500" : "border-l-slate-300"}
            expandedOpen={isExpanded}
            onToggle={() => setExpandedId(isExpanded ? null : mapping.id)}
            expanded={
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  disabled={!mapping.active || saving}
                  onClick={() => handleDeactivate(mapping)}
                >
                  Unlink
                </Button>
              </div>
            }
          />
        );
      })}
    </ListContainer>
  );

  const desktopContent = mappings.length === 0 ? (
    <EmptyState icon={undefined} title="Belum ada mapping kavling untuk resident ini." />
  ) : (
    <div className="overflow-x-auto">
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
              <TableCell className="text-slate-700">{formatRelationLabel(mapping)}</TableCell>
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
    </div>
  );

  let mappingContent: ReactNode;

  if (loading) {
    mappingContent = <p className="text-sm text-slate-600">Memuat mapping...</p>;
  } else {
    mappingContent = (
      <>
        {mobileContent}
        {desktopContent}
      </>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">Mapping Resident ke Kavling</h3>
        <p className="text-xs text-slate-600">Satu kavling hanya boleh punya satu resident primary aktif.</p>
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
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
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            value={relationType}
            onChange={(event) => setRelationType(event.target.value as MappingRow["relation_type"])}
          >
            {relationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="mappingRelationLabel" className="space-y-1 text-xs text-slate-600">
          <span>Detail relasi</span>
          <Input
            id="mappingRelationLabel"
            value={relationLabel}
            onChange={(event) => setRelationLabel(event.target.value)}
            placeholder={relationType === "other" ? "Contoh: Kerabat" : "Opsional"}
            disabled={relationType !== "other"}
          />
        </label>

        <label htmlFor="mappingIsPrimary" className="flex items-center gap-2 text-xs text-slate-700">
          <input
            id="mappingIsPrimary"
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

      {!loading && mappings.length > 0 ? (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalRows={totalRows}
          onPageChange={setPage}
          onPageSizeChange={(size: number) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
