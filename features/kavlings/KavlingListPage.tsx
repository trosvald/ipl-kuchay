"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Inbox, Plus, Power, RefreshCw, SquarePen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListContainer } from "@/components/ui/ListContainer";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { StatusDot } from "@/components/ui/StatusDot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataList } from "@/features/layout/DataList";
import { PageHeader } from "@/features/layout/PageHeader";
import { useAuth } from "@/features/auth/authHooks";
import type { AuditLogInput } from "@/features/audit/auditTypes";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { KavlingFormInput } from "@/lib/validation";
import { KavlingForm } from "./KavlingForm";

interface KavlingRow {
  id: string;
  code: string;
  block: string | null;
  sort_order: number;
  active: boolean;
  notes: string | null;
  created_at: string;
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

export function KavlingListPage() {
  const { profile } = useAuth();
  const client = getSupabaseBrowserClient();
  const [items, setItems] = useState<KavlingRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentEditing = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items],
  );
  const totalRows = items.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const loadKavlings = useCallback(async () => {
    if (!client) {
      setErrorMessage("Supabase client tidak tersedia.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("kavlings")
      .select("id, code, block, sort_order, active, notes, created_at")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as KavlingRow[]);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadKavlings().catch(() => {
      setErrorMessage("Gagal memuat data kavling.");
      setLoading(false);
    });
  }, [loadKavlings]);

  const handleCreate = async (values: KavlingFormInput) => {
    if (!client || !profile) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      code: values.code.trim(),
      block: values.block?.trim() || null,
      sort_order: values.sort_order,
      active: values.active,
      notes: values.notes?.trim() || null,
    };

    const { data, error } = await client
      .from("kavlings")
      .insert(payload)
      .select("id, code, block, sort_order, active, notes, created_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal membuat kavling.");
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: "kavling.create",
      entityTable: "kavlings",
      entityId: data.id,
      beforeData: null,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setCreating(false);
    setSaving(false);
    await loadKavlings();
  };

  const handleUpdate = async (values: KavlingFormInput) => {
    if (!client || !profile || !currentEditing) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      code: values.code.trim(),
      block: values.block?.trim() || null,
      sort_order: values.sort_order,
      active: values.active,
      notes: values.notes?.trim() || null,
    };

    const { data, error } = await client
      .from("kavlings")
      .update(payload)
      .eq("id", currentEditing.id)
      .select("id, code, block, sort_order, active, notes, created_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal memperbarui kavling.");
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: values.active ? "kavling.update" : "kavling.deactivate",
      entityTable: "kavlings",
      entityId: data.id,
      beforeData: currentEditing,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setEditingId(null);
    setSaving(false);
    await loadKavlings();
  };

  const handleDeactivate = async (row: KavlingRow) => {
    if (!client || !profile) {
      return;
    }

    if (!row.active) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("kavlings")
      .update({ active: false })
      .eq("id", row.id)
      .select("id, code, block, sort_order, active, notes, created_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal menonaktifkan kavling.");
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: "kavling.deactivate",
      entityTable: "kavlings",
      entityId: row.id,
      beforeData: row,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setSaving(false);
    await loadKavlings();
  };

  const hasNoContent = !loading && !errorMessage && items.length === 0;

  const mobileContent = hasNoContent ? (
    <EmptyState icon={Inbox} title="Belum ada data kavling." />
  ) : (
    <ListContainer>
      {pagedItems.map((item) => {
        const isExpanded = expandedId === item.id;
        return (
          <CompactListRow
            key={item.id}
            primary={item.code}
            trailing={
              <Badge variant={item.active ? "success" : "default"} className="text-[10px] h-4 px-1.5">
                {item.active ? "Aktif" : "Nonaktif"}
              </Badge>
            }
            secondary={
              <span className="flex items-center gap-1.5">
                <StatusDot variant={item.active ? "success" : "muted"} />
                <span>{item.block ? `Blok ${item.block}` : "Tanpa blok"}</span>
                <span className="text-slate-300">·</span>
                <span>Urutan {item.sort_order}</span>
              </span>
            }
            accentColor={item.active ? "border-l-emerald-500" : "border-l-slate-300"}
            expandedOpen={isExpanded}
            onToggle={() => setExpandedId(isExpanded ? null : item.id)}
            expanded={
              <div className="space-y-2">
                {item.notes ? (
                  <div className="text-xs">
                    <span className="text-slate-400">Catatan</span>
                    <p className="mt-0.5 text-slate-700">{item.notes}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(item.id);
                    }}
                  >
                    <SquarePen className="size-3" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    disabled={!item.active || saving}
                    onClick={() => handleDeactivate(item)}
                  >
                    <Power className="size-3" /> Nonaktifkan
                  </Button>
                </div>
              </div>
            }
          />
        );
      })}
    </ListContainer>
  );

  const desktopContent = hasNoContent ? (
    <EmptyState icon={Inbox} title="Belum ada data kavling." />
  ) : (
    <div className="overflow-x-auto">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="text-xs uppercase tracking-wide text-slate-500">
            <TableHead>Kode</TableHead>
            <TableHead>Blok</TableHead>
            <TableHead>Urutan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Catatan</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedItems.map((item) => (
            <TableRow key={item.id} className="align-top">
              <TableCell className="font-medium text-slate-900">{item.code}</TableCell>
              <TableCell className="text-slate-700">{item.block ?? "-"}</TableCell>
              <TableCell className="text-slate-700">{item.sort_order}</TableCell>
              <TableCell>
                <Badge variant={item.active ? "success" : "default"}>
                  {item.active ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-700">{item.notes ?? "-"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(item.id);
                    }}
                  >
                    <SquarePen className="size-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!item.active || saving}
                    onClick={() => handleDeactivate(item)}
                  >
                    Nonaktifkan
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="Admin"
        title="Manajemen Kavling"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => loadKavlings()} disabled={loading || saving}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreating((value) => !value);
                setEditingId(null);
              }}
            >
              <Plus className="size-4" /> {creating ? "Tutup Form" : "Tambah Kavling"}
            </Button>
          </>
        }
      />

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {creating ? (
        <Card>
          <CardHeader>
            <CardTitle>Kavling Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <KavlingForm submitLabel="Simpan Kavling" saving={saving} onSubmit={handleCreate} />
          </CardContent>
        </Card>
      ) : null}

      {editingId && currentEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit {currentEditing.code}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <KavlingForm
              submitLabel="Perbarui Kavling"
              saving={saving}
              onSubmit={handleUpdate}
              initialValues={{
                code: currentEditing.code,
                block: currentEditing.block ?? "",
                sort_order: currentEditing.sort_order,
                active: currentEditing.active,
                notes: currentEditing.notes ?? "",
              }}
            />
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              Batal Edit
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <DataList
        loading={loading}
        error={errorMessage}
        onRetry={loadKavlings}
        mobile={mobileContent}
        desktop={desktopContent}
      />

      {!loading && !errorMessage && items.length > 0 ? (
        <div className="mt-3">
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
        </div>
      ) : null}
    </section>
  );
}
