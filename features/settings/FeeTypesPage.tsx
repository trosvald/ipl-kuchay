"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, SquarePen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { writeAuditLog } from "@/features/audit/writeAuditLog";
import { useAuth } from "@/features/auth/authHooks";
import { formatRupiah } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { FeeTypeFormInput } from "@/lib/validation";
import { FeeTypeForm } from "./FeeTypeForm";

interface FeeTypeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_amount: number;
  is_recurring: boolean;
  billing_cycle: "monthly" | "yearly";
  charge_month: number | null;
  is_penalty: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function FeeTypesPage() {
  const client = getSupabaseBrowserClient();
  const { profile } = useAuth();
  const [items, setItems] = useState<FeeTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const currentEditing = useMemo(() => items.find((item) => item.id === editingId) ?? null, [editingId, items]);
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

  const loadFeeTypes = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("fee_types")
      .select("id, code, name, description, default_amount, is_recurring, billing_cycle, charge_month, is_penalty, active, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as FeeTypeRow[]);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadFeeTypes().catch(() => {
      setErrorMessage("Gagal memuat data jenis biaya.");
      setLoading(false);
    });
  }, [loadFeeTypes]);

  const handleCreate = async (values: FeeTypeFormInput) => {
    if (!client || !profile) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      code: values.code,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      default_amount: values.default_amount,
      is_recurring: values.is_recurring,
      billing_cycle: values.billing_cycle,
      charge_month: values.charge_month,
      is_penalty: values.is_penalty,
      active: values.active,
      sort_order: values.sort_order,
    };

    const { data, error } = await client
      .from("fee_types")
      .insert(payload)
      .select("id, code, name, description, default_amount, is_recurring, billing_cycle, charge_month, is_penalty, active, sort_order, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal menambah jenis biaya.");
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: "fee_type.create",
      entityTable: "fee_types",
      entityId: data.id,
      beforeData: null,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setCreating(false);
    setSaving(false);
    await loadFeeTypes();
  };

  const handleUpdate = async (values: FeeTypeFormInput) => {
    if (!client || !profile || !currentEditing) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      code: values.code,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      default_amount: values.default_amount,
      is_recurring: values.is_recurring,
      billing_cycle: values.billing_cycle,
      charge_month: values.charge_month,
      is_penalty: values.is_penalty,
      active: values.active,
      sort_order: values.sort_order,
    };

    const { data, error } = await client
      .from("fee_types")
      .update(payload)
      .eq("id", currentEditing.id)
      .select("id, code, name, description, default_amount, is_recurring, billing_cycle, charge_month, is_penalty, active, sort_order, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal memperbarui jenis biaya.");
      setSaving(false);
      return;
    }

    const action = data.active ? "fee_type.update" : "fee_type.deactivate";
    await writeAuditLog({
      action,
      entityTable: "fee_types",
      entityId: data.id,
      beforeData: currentEditing,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setEditingId(null);
    setSaving(false);
    await loadFeeTypes();
  };

  const handleToggleActive = async (row: FeeTypeRow) => {
    if (!client || !profile) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("fee_types")
      .update({ active: !row.active })
      .eq("id", row.id)
      .select("id, code, name, description, default_amount, is_recurring, billing_cycle, charge_month, is_penalty, active, sort_order, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal mengubah status jenis biaya.");
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: data.active ? "fee_type.activate" : "fee_type.deactivate",
      entityTable: "fee_types",
      entityId: data.id,
      beforeData: row,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setSaving(false);
    await loadFeeTypes();
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Jenis Biaya</h2>
          <p className="text-sm text-slate-600">Kelola recurring, penalty, dan nominal default per item biaya.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => loadFeeTypes()} disabled={loading || saving}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button
            onClick={() => {
              setCreating((value) => !value);
              setEditingId(null);
            }}
          >
            <Plus className="size-4" /> {creating ? "Tutup Form" : "Tambah Jenis Biaya"}
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
            <CardTitle>Jenis Biaya Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <FeeTypeForm submitLabel="Simpan Jenis Biaya" saving={saving} onSubmit={handleCreate} />
          </CardContent>
        </Card>
      ) : null}

      {editingId && currentEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit {currentEditing.code}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeeTypeForm
              initialValues={{
                ...currentEditing,
                description: currentEditing.description ?? "",
              }}
              submitLabel="Perbarui Jenis Biaya"
              saving={saving}
              onSubmit={handleUpdate}
            />
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              Batal Edit
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Jenis Biaya</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat data...</p>
          ) : (
            <>
              <div className="space-y-2 lg:hidden">
                {pagedItems.map((row) => (
                  <div key={row.id} className="rounded-lg border bg-background px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{row.name}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">{row.code}</p>
                      </div>
                      <Badge variant={row.active ? "success" : "secondary"} className="shrink-0">
                        {row.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">{formatRupiah(row.default_amount)}</p>
                    {row.description ? <p className="mt-1 break-words text-sm text-slate-700">{row.description}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant={row.is_recurring ? "success" : "secondary"}>
                        {row.is_recurring ? "Recurring" : "One-off"}
                      </Badge>
                      {row.is_recurring ? (
                        <Badge variant="outline">
                          {row.billing_cycle === "yearly" ? `Yearly bulan ${row.charge_month ?? "-"}` : "Monthly"}
                        </Badge>
                      ) : null}
                      <Badge variant={row.is_penalty ? "outline" : "secondary"}>{row.is_penalty ? "Penalty" : "Reguler"}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={saving}
                        onClick={() => {
                          setEditingId(row.id);
                          setCreating(false);
                        }}
                      >
                        <SquarePen className="size-4" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="w-full" disabled={saving} onClick={() => handleToggleActive(row)}>
                        {row.active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-[840px]">
                  <TableHeader>
                    <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Nominal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedItems.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-slate-900">{row.code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{row.name}</p>
                            {row.description ? <p className="text-xs text-slate-500">{row.description}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">{formatRupiah(row.default_amount)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant={row.is_recurring ? "success" : "secondary"}>
                              {row.is_recurring ? "Recurring" : "One-off"}
                            </Badge>
                            {row.is_recurring ? (
                              <Badge variant="outline">
                                {row.billing_cycle === "yearly"
                                  ? `Yearly (bulan ${row.charge_month ?? "-"})`
                                  : "Monthly"}
                              </Badge>
                            ) : null}
                            <Badge variant={row.is_penalty ? "outline" : "secondary"}>{row.is_penalty ? "Penalty" : "Reguler"}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.active ? "success" : "secondary"}>{row.active ? "Aktif" : "Nonaktif"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() => {
                                setEditingId(row.id);
                                setCreating(false);
                              }}
                            >
                              <SquarePen className="size-4" /> Edit
                            </Button>
                            <Button size="sm" variant="ghost" disabled={saving} onClick={() => handleToggleActive(row)}>
                              {row.active ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          {!loading ? (
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
