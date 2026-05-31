"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Plus, RefreshCw, SquarePen } from "lucide-react";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const currentEditing = useMemo(() => items.find((item) => item.id === editingId) ?? null, [editingId, items]);
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

  const hasNoContent = !loading && !errorMessage && items.length === 0;

  const mobileContent = hasNoContent ? (
    <EmptyState icon={Inbox} title="Belum ada jenis biaya." />
  ) : (
    <ListContainer>
      {pagedItems.map((row) => {
        const isExpanded = expandedId === row.id;
        const typeLabel = row.is_recurring
          ? row.billing_cycle === "yearly"
            ? `Yearly (bln ${row.charge_month ?? "-"})`
            : "Monthly"
          : "One-off";
        return (
          <CompactListRow
            key={row.id}
            primary={row.name}
            trailing={
              <Badge variant={row.active ? "success" : "secondary"} className="text-[10px] h-4 px-1.5">
                {row.active ? "Aktif" : "Nonaktif"}
              </Badge>
            }
            secondary={
              <span className="flex items-center gap-1.5">
                <StatusDot variant={row.active ? "success" : "muted"} />
                <span>{row.code}</span>
                <span className="text-slate-300">·</span>
                <span>{formatRupiah(row.default_amount)}</span>
                <span className="text-slate-300">·</span>
                <span>{typeLabel}{row.is_penalty ? " · Penalty" : ""}</span>
              </span>
            }
            accentColor={row.active ? "border-l-emerald-500" : "border-l-slate-300"}
            expandedOpen={isExpanded}
            onToggle={() => setExpandedId(isExpanded ? null : row.id)}
            expanded={
              <div className="space-y-2">
                {row.description ? (
                  <div className="text-xs">
                    <span className="text-slate-400">Keterangan</span>
                    <p className="mt-0.5 text-slate-700">{row.description}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={saving}
                    onClick={() => {
                      setEditingId(row.id);
                      setCreating(false);
                    }}
                  >
                    <SquarePen className="size-3" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={saving} onClick={() => handleToggleActive(row)}>
                    {row.active ? "Nonaktifkan" : "Aktifkan"}
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
    <EmptyState icon={Inbox} title="Belum ada jenis biaya." />
  ) : (
    <div className="overflow-x-auto">
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
  );

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="Admin"
        title="Jenis Biaya"
        subtitle="Kelola recurring, penalty, dan nominal default per item biaya."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => loadFeeTypes()} disabled={loading || saving}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreating((value) => !value);
                setEditingId(null);
              }}
            >
              <Plus className="size-4" /> {creating ? "Tutup Form" : "Tambah Jenis Biaya"}
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

      <DataList
        loading={loading}
        error={errorMessage}
        onRetry={loadFeeTypes}
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
