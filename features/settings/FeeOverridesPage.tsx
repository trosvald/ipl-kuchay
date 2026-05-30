"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, SquarePen, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { writeAuditLog } from "@/features/audit/writeAuditLog";
import { useAuth } from "@/features/auth/authHooks";
import { formatDateId, formatRupiah } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { feeOverrideFormSchema } from "@/lib/validation";

interface KavlingOption {
  id: string;
  code: string;
  active: boolean;
}

interface FeeTypeOption {
  id: string;
  code: string;
  name: string;
  is_recurring: boolean;
  is_penalty: boolean;
  active: boolean;
}

interface OverrideRow {
  id: string;
  kavling_id: string;
  fee_type_id: string;
  amount: number;
  active_from: string | null;
  active_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  kavlings: { code: string } | { code: string }[] | null;
  fee_types: { code: string; name: string } | { code: string; name: string }[] | null;
}

interface OverridePayload {
  kavling_id: string;
  fee_type_id: string;
  amount: number;
  active_from: string | null;
  active_until: string | null;
  notes: string | null;
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function collectFormErrors(issues: Array<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const nextErrors: Record<string, string> = {};
  for (const issue of issues) {
    if (issue.path.length > 0) {
      nextErrors[String(issue.path[0])] = issue.message;
    }
  }
  return nextErrors;
}

function toDateInput(value: string | null): string {
  if (!value) {
    return "";
  }
  return value;
}

function toLocalDateOnlyString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toOverridePayload(input: {
  kavling_id: string;
  fee_type_id: string;
  amount: number;
  active_from?: string;
  active_until?: string;
  notes?: string;
}): OverridePayload {
  return {
    kavling_id: input.kavling_id,
    fee_type_id: input.fee_type_id,
    amount: input.amount,
    active_from: input.active_from || null,
    active_until: input.active_until || null,
    notes: input.notes?.trim() || null,
  };
}

function isOverrideEnded(activeUntil: string | null): boolean {
  if (!activeUntil) {
    return false;
  }
  const activeUntilDate = activeUntil.split("T")[0];
  const today = toLocalDateOnlyString(new Date());
  return activeUntilDate < today;
}

export function FeeOverridesPage() {
  const client = getSupabaseBrowserClient();
  const { profile } = useAuth();

  const [kavlingOptions, setKavlingOptions] = useState<KavlingOption[]>([]);
  const [feeTypeOptions, setFeeTypeOptions] = useState<FeeTypeOption[]>([]);
  const [items, setItems] = useState<OverrideRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OverrideRow | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [kavlingId, setKavlingId] = useState("");
  const [feeTypeId, setFeeTypeId] = useState("");
  const [amount, setAmount] = useState("0");
  const [activeFrom, setActiveFrom] = useState("");
  const [activeUntil, setActiveUntil] = useState("");
  const [notes, setNotes] = useState("");

  const currentEditing = useMemo(() => items.find((item) => item.id === editingId) ?? null, [editingId, items]);
  const totalRows = items.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);
  let submitLabel = "Simpan Override";
  if (editingId) {
    submitLabel = "Perbarui Override";
  }
  if (saving) {
    submitLabel = "Menyimpan...";
  }

  const resetForm = useCallback(() => {
    const firstKavling = kavlingOptions[0]?.id ?? "";
    const firstFeeType = feeTypeOptions[0]?.id ?? "";

    setKavlingId(firstKavling);
    setFeeTypeId(firstFeeType);
    setAmount("0");
    setActiveFrom("");
    setActiveUntil("");
    setNotes("");
    setFormErrors({});
  }, [feeTypeOptions, kavlingOptions]);

  const fillFromEditing = useCallback((row: OverrideRow) => {
    setKavlingId(row.kavling_id);
    setFeeTypeId(row.fee_type_id);
    setAmount(String(row.amount));
    setActiveFrom(toDateInput(row.active_from));
    setActiveUntil(toDateInput(row.active_until));
    setNotes(row.notes ?? "");
    setFormErrors({});
  }, []);

  const loadAll = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const [kavlingsRes, feeTypesRes, overridesRes] = await Promise.all([
      client.from("kavlings").select("id, code, active").order("sort_order", { ascending: true }).order("code", { ascending: true }),
      client
        .from("fee_types")
        .select("id, code, name, is_recurring, is_penalty, active")
        .eq("is_recurring", true)
        .eq("is_penalty", false)
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true }),
      client
        .from("kavling_fee_overrides")
        .select("id, kavling_id, fee_type_id, amount, active_from, active_until, notes, created_at, updated_at, kavlings(code), fee_types(code, name)")
        .order("created_at", { ascending: false }),
    ]);

    if (kavlingsRes.error || feeTypesRes.error || overridesRes.error) {
      setErrorMessage(kavlingsRes.error?.message ?? feeTypesRes.error?.message ?? overridesRes.error?.message ?? "Gagal memuat override.");
      setLoading(false);
      return;
    }

    const nextKavlings = (kavlingsRes.data ?? []) as KavlingOption[];
    const nextFeeTypes = (feeTypesRes.data ?? []) as FeeTypeOption[];
    const nextOverrides = (overridesRes.data ?? []) as OverrideRow[];

    setKavlingOptions(nextKavlings);
    setFeeTypeOptions(nextFeeTypes);
    setItems(nextOverrides);
    setLoading(false);

    if (!editingId) {
      setKavlingId((prev) => prev || nextKavlings[0]?.id || "");
      setFeeTypeId((prev) => prev || nextFeeTypes[0]?.id || "");
    }
  }, [client, editingId]);

  useEffect(() => {
    loadAll().catch(() => {
      setErrorMessage("Gagal memuat data fee override.");
      setLoading(false);
    });
  }, [loadAll]);

  useEffect(() => {
    if (editingId && currentEditing) {
      fillFromEditing(currentEditing);
    }
  }, [currentEditing, editingId, fillFromEditing]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const updateOverride = useCallback(
    async (payload: OverridePayload, row: OverrideRow) => {
      if (!client || !profile) {
        return false;
      }

      const { data, error } = await client
        .from("kavling_fee_overrides")
        .update(payload)
        .eq("id", row.id)
        .select("id, kavling_id, fee_type_id, amount, active_from, active_until, notes, created_at, updated_at, kavlings(code), fee_types(code, name)")
        .single();

      if (error || !data) {
        setErrorMessage(error?.message ?? "Gagal memperbarui override.");
        return false;
      }

      await writeAuditLog({
        action: "fee_override.update",
        entityTable: "kavling_fee_overrides",
        entityId: data.id,
        beforeData: row,
        afterData: data,
        actorId: profile.id,
        actorRole: profile.role,
      });

      setEditingId(null);
      await loadAll();
      return true;
    },
    [client, loadAll, profile],
  );

  const createOverride = useCallback(
    async (payload: OverridePayload) => {
      if (!client || !profile) {
        return false;
      }

      const { data, error } = await client
        .from("kavling_fee_overrides")
        .insert(payload)
        .select("id, kavling_id, fee_type_id, amount, active_from, active_until, notes, created_at, updated_at, kavlings(code), fee_types(code, name)")
        .single();

      if (error || !data) {
        setErrorMessage(error?.message ?? "Gagal menambah override.");
        return false;
      }

      await writeAuditLog({
        action: "fee_override.create",
        entityTable: "kavling_fee_overrides",
        entityId: data.id,
        beforeData: null,
        afterData: data,
        actorId: profile.id,
        actorRole: profile.role,
      });

      setCreating(false);
      await loadAll();
      resetForm();
      return true;
    },
    [client, loadAll, profile, resetForm],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!client || !profile) {
      return;
    }

    const parsed = feeOverrideFormSchema.safeParse({
      kavling_id: kavlingId,
      fee_type_id: feeTypeId,
      amount: Number(amount),
      active_from: activeFrom,
      active_until: activeUntil,
      notes,
    });

    if (!parsed.success) {
      setFormErrors(collectFormErrors(parsed.error.issues));
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setFormErrors({});
    const payload = toOverridePayload(parsed.data);
    const editingRow = editingId && currentEditing ? currentEditing : null;

    if (editingRow) {
      await updateOverride(payload, editingRow);
      setSaving(false);
      return;
    }

    await createOverride(payload);
    setSaving(false);
  };

  const handleEndOverrideNow = async (row: OverrideRow) => {
    if (!client || !profile) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await client
      .from("kavling_fee_overrides")
      .update({ active_until: today })
      .eq("id", row.id)
      .select("id, kavling_id, fee_type_id, amount, active_from, active_until, notes, created_at, updated_at, kavlings(code), fee_types(code, name)")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal mengakhiri override.");
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: "fee_override.end",
      entityTable: "kavling_fee_overrides",
      entityId: row.id,
      beforeData: row,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setSaving(false);
    await loadAll();
  };

  const handleDeleteOverride = async () => {
    if (!client || !profile || !confirmDelete) {
      return;
    }

    const row = confirmDelete;

    setSaving(true);
    setErrorMessage(null);

    const { error } = await client
      .from("kavling_fee_overrides")
      .delete()
      .eq("id", row.id);

    if (error) {
      setErrorMessage(error.message || "Gagal menghapus override.");
      setSaving(false);
      return;
    }

    try {
      await writeAuditLog({
        action: "fee_override.delete",
        entityTable: "kavling_fee_overrides",
        entityId: row.id,
        beforeData: row,
        afterData: null,
        actorId: profile.id,
        actorRole: profile.role,
      });
    } catch (auditError) {
      setErrorMessage(
        auditError instanceof Error
          ? `Override terhapus, tetapi audit gagal: ${auditError.message}`
          : "Override terhapus, tetapi audit gagal.",
      );
    }

    setConfirmDelete(null);
    if (editingId === row.id) {
      setEditingId(null);
      resetForm();
    }
    setSaving(false);
    await loadAll();
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Fee Override Per Kavling</h2>
          <p className="text-sm text-slate-600">Override dipilih berdasarkan rentang aktif saat periode ditagihkan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => loadAll()} disabled={loading || saving}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button
            onClick={() => {
              setCreating((value) => !value);
              setEditingId(null);
              if (!creating) {
                resetForm();
              }
            }}
          >
            <Plus className="size-4" /> {creating ? "Tutup Form" : "Tambah Override"}
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {(creating || editingId) ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Override" : "Override Baru"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label htmlFor="feeOverrideKavling" className="space-y-2 text-sm text-slate-700">
                  <span>Kavling</span>
                  <select
                    id="feeOverrideKavling"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    value={kavlingId}
                    onChange={(event) => setKavlingId(event.target.value)}
                    disabled={Boolean(editingId)}
                  >
                    {kavlingOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} {item.active ? "" : "(nonaktif)"}
                      </option>
                    ))}
                  </select>
                  {formErrors.kavling_id ? <p className="text-xs text-red-600">{formErrors.kavling_id}</p> : null}
                </label>

                <label htmlFor="feeOverrideType" className="space-y-2 text-sm text-slate-700">
                  <span>Jenis biaya</span>
                  <select
                    id="feeOverrideType"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                    value={feeTypeId}
                    onChange={(event) => setFeeTypeId(event.target.value)}
                    disabled={Boolean(editingId)}
                  >
                    {feeTypeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.fee_type_id ? <p className="text-xs text-red-600">{formErrors.fee_type_id}</p> : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label htmlFor="feeOverrideAmount" className="space-y-2 text-sm text-slate-700">
                  <span>Nominal override</span>
                  <Input id="feeOverrideAmount" type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} />
                  {formErrors.amount ? <p className="text-xs text-red-600">{formErrors.amount}</p> : null}
                </label>

                <label htmlFor="feeOverrideActiveFrom" className="space-y-2 text-sm text-slate-700">
                  <span>Aktif dari</span>
                  <Input id="feeOverrideActiveFrom" type="date" value={activeFrom} onChange={(event) => setActiveFrom(event.target.value)} />
                  {formErrors.active_from ? <p className="text-xs text-red-600">{formErrors.active_from}</p> : null}
                </label>

                <label htmlFor="feeOverrideActiveUntil" className="space-y-2 text-sm text-slate-700">
                  <span>Aktif sampai</span>
                  <Input id="feeOverrideActiveUntil" type="date" value={activeUntil} onChange={(event) => setActiveUntil(event.target.value)} />
                  {formErrors.active_until ? <p className="text-xs text-red-600">{formErrors.active_until}</p> : null}
                </label>
              </div>

              <label htmlFor="feeOverrideNotes" className="space-y-2 text-sm text-slate-700">
                <span>Catatan</span>
                <textarea
                  id="feeOverrideNotes"
                  className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Opsional"
                />
                {formErrors.notes ? <p className="text-xs text-red-600">{formErrors.notes}</p> : null}
              </label>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {submitLabel}
                </Button>
                {editingId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      setCreating(false);
                      resetForm();
                    }}
                  >
                    Batal
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Override</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat data...</p>
          ) : (
            <>
              <div className="space-y-2 lg:hidden">
                {pagedItems.map((row) => {
                  const kavling = normalizeOne(row.kavlings);
                  const feeType = normalizeOne(row.fee_types);
                  const ended = isOverrideEnded(row.active_until);

                  return (
                    <div key={row.id} className="rounded-lg border bg-background px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">{kavling?.code ?? "-"}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {feeType?.name ?? "-"} ({feeType?.code ?? "-"})
                          </p>
                        </div>
                        <Badge variant={ended ? "secondary" : "success"} className="shrink-0">
                          {ended ? "Berakhir" : "Aktif"}
                        </Badge>
                      </div>

                      <p className="mt-2 text-lg font-semibold text-foreground">{formatRupiah(row.amount)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.active_from ? formatDateId(row.active_from) : "-"} - {row.active_until ? formatDateId(row.active_until) : "terbuka"}
                      </p>
                      {row.notes ? <p className="mt-2 break-words text-sm text-slate-700">{row.notes}</p> : null}

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={saving}
                          onClick={() => {
                            setCreating(false);
                            setEditingId(row.id);
                          }}
                        >
                          <SquarePen className="size-4" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full"
                          disabled={saving || Boolean(row.active_until)}
                          onClick={() => handleEndOverrideNow(row)}
                        >
                          Akhiri
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          disabled={saving}
                          onClick={() => setConfirmDelete(row)}
                        >
                          <Trash2 className="size-4" /> Hapus
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                      <TableHead>Kavling</TableHead>
                      <TableHead>Jenis Biaya</TableHead>
                      <TableHead>Nominal</TableHead>
                      <TableHead>Rentang Aktif</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedItems.map((row) => {
                      const kavling = normalizeOne(row.kavlings);
                      const feeType = normalizeOne(row.fee_types);
                      const ended = isOverrideEnded(row.active_until);

                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-slate-900">{kavling?.code ?? "-"}</TableCell>
                          <TableCell>
                            <p className="font-medium text-slate-900">{feeType?.name ?? "-"}</p>
                            <p className="text-xs text-slate-500">{feeType?.code ?? "-"}</p>
                          </TableCell>
                          <TableCell className="text-slate-700">{formatRupiah(row.amount)}</TableCell>
                          <TableCell className="text-sm text-slate-700">
                            {row.active_from ? formatDateId(row.active_from) : "-"} - {row.active_until ? formatDateId(row.active_until) : "terbuka"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={ended ? "secondary" : "success"}>{ended ? "Berakhir" : "Aktif"}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={saving}
                                onClick={() => {
                                  setCreating(false);
                                  setEditingId(row.id);
                                }}
                              >
                                <SquarePen className="size-4" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={saving || Boolean(row.active_until)}
                                onClick={() => handleEndOverrideNow(row)}
                              >
                                Akhiri Hari Ini
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={saving}
                                onClick={() => setConfirmDelete(row)}
                              >
                                <Trash2 className="size-4" /> Hapus
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus override?</AlertDialogTitle>
            <AlertDialogDescription>
              Override ini akan dihapus dari daftar dan tidak dipakai untuk tagihan berikutnya. Gunakan Akhiri Hari Ini jika ingin menyimpan riwayat rentang aktif.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteOverride} disabled={saving}>
              {saving ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
