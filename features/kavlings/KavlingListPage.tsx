"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, SquarePen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

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

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin</p>
          <h1 className="text-2xl font-semibold text-slate-900">Manajemen Kavling</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => loadKavlings()} disabled={loading || saving}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button
            onClick={() => {
              setCreating((value) => !value);
              setEditingId(null);
            }}
          >
            <Plus className="size-4" /> {creating ? "Tutup Form" : "Tambah Kavling"}
          </Button>
        </div>
      </header>

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

      <Card>
        <CardHeader>
          <CardTitle>Daftar Kavling</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat data kavling...</p>
          ) : (
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
          )}

          {!loading ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
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
        </CardContent>
      </Card>
    </section>
  );
}
