"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Inbox, Plus, RefreshCw, SquarePen } from "lucide-react";

import { ActionBar } from "@/components/ui/ActionBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListContainer } from "@/components/ui/ListContainer";
import { StatusDot } from "@/components/ui/StatusDot";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataList } from "@/features/layout/DataList";
import { PageHeader } from "@/features/layout/PageHeader";
import type { AuditLogInput } from "@/features/audit/auditTypes";
import { useAuth } from "@/features/auth/authHooks";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { ResidentFormInput } from "@/lib/validation";
import { KavlingResidentMapping } from "./KavlingResidentMapping";
import { ResidentForm } from "./ResidentForm";

interface ResidentRow {
  id: string;
  full_name: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  role: "resident" | "treasurer" | "admin" | "super_admin";
  is_active: boolean;
  created_at: string;
}

interface MappingStatus {
  activeCount: number;
  historyOnlyCount: number;
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

export function ResidentListPage() {
  const { profile, session } = useAuth();
  const client = getSupabaseBrowserClient();
  const [items, setItems] = useState<ResidentRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedResidentId, setExpandedResidentId] = useState<string | null>(null);
  const [mappingStatusByResident, setMappingStatusByResident] = useState<Record<string, MappingStatus>>({});

  const canManageSuperAdmin = profile?.role === "super_admin";

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

  useEffect(() => {
    if (expandedResidentId && !pagedItems.some((item) => item.id === expandedResidentId)) {
      setExpandedResidentId(null);
    }
  }, [expandedResidentId, pagedItems]);

  const loadResidents = useCallback(async () => {
    if (!client) {
      setErrorMessage("Supabase client tidak tersedia.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, display_name, phone, email, role, is_active, created_at")
      .order("full_name", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const residents = (data ?? []) as ResidentRow[];
    const residentIds = residents.map((item) => item.id);

    const nextMappingStatus: Record<string, MappingStatus> = {};
    if (residentIds.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < residentIds.length; i += BATCH_SIZE) {
        const chunk = residentIds.slice(i, i + BATCH_SIZE);
        const { data: mappings, error: mappingsError } = await client
          .from("kavling_residents")
          .select("profile_id, active")
          .in("profile_id", chunk);

        if (mappingsError) {
          setErrorMessage(mappingsError.message);
          setLoading(false);
          return;
        }

        for (const mapping of mappings ?? []) {
          const existing = nextMappingStatus[mapping.profile_id] ?? { activeCount: 0, historyOnlyCount: 0 };
          if (mapping.active) {
            existing.activeCount += 1;
          } else {
            existing.historyOnlyCount += 1;
          }
          nextMappingStatus[mapping.profile_id] = existing;
        }
      }
    }

    setItems(residents);
    setMappingStatusByResident(nextMappingStatus);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadResidents().catch(() => {
      setErrorMessage("Gagal memuat data resident.");
      setLoading(false);
    });
  }, [loadResidents]);

  const handleInviteCreate = async (values: ResidentFormInput) => {
    if (!client || !session || !values.email) {
      setErrorMessage("Email wajib diisi untuk membuat/invite resident.");
      return;
    }

    if (!canManageSuperAdmin && values.role === "super_admin") {
      setErrorMessage("Hanya super admin yang dapat membuat akun super_admin.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { error } = await client.functions.invoke("admin-invite-user", {
      body: {
        email: values.email,
        fullName: values.full_name,
        displayName: values.display_name || values.full_name,
        phone: values.phone || null,
        role: values.role,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setCreating(false);
    setSaving(false);
    await loadResidents();
  };

  const handleUpdate = async (values: ResidentFormInput) => {
    if (!client || !profile || !currentEditing) {
      return;
    }

    if (!canManageSuperAdmin && (currentEditing.role === "super_admin" || values.role === "super_admin")) {
      setErrorMessage("Hanya super admin yang dapat mengubah role super_admin.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      full_name: values.full_name.trim(),
      display_name: values.display_name?.trim() || null,
      phone: values.phone?.trim() || null,
      email: values.email?.trim().toLowerCase() || null,
      role: values.role,
      is_active: values.is_active,
    };

    const { data, error } = await client
      .from("profiles")
      .update(payload)
      .eq("id", currentEditing.id)
      .select("id, full_name, display_name, phone, email, role, is_active, created_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal memperbarui resident.");
      setSaving(false);
      return;
    }

    let auditAction: "resident.role_change" | "resident.update" | "resident.deactivate";
    if (currentEditing.role === data.role) {
      auditAction = data.is_active ? "resident.update" : "resident.deactivate";
    } else {
      auditAction = "resident.role_change";
    }

    await writeAuditLog({
      action: auditAction,
      entityTable: "profiles",
      entityId: data.id,
      beforeData: currentEditing,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setEditingId(null);
    setSaving(false);
    await loadResidents();
  };

  const handleDeactivate = async (row: ResidentRow) => {
    if (!client || !profile) {
      return;
    }

    if (!canManageSuperAdmin && row.role === "super_admin") {
      setErrorMessage("Hanya super admin yang dapat menonaktifkan super_admin.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("profiles")
      .update({ is_active: false })
      .eq("id", row.id)
      .select("id, full_name, display_name, phone, email, role, is_active, created_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal menonaktifkan resident.");
      setSaving(false);
      return;
    }

    await writeAuditLog({
      action: "resident.deactivate",
      entityTable: "profiles",
      entityId: data.id,
      beforeData: row,
      afterData: data,
      actorId: profile.id,
      actorRole: profile.role,
    });

    setSaving(false);
    await loadResidents();
  };

  const getMappingStatusLabel = (residentId: string) => {
    const mappingStatus = mappingStatusByResident[residentId];
    if (!mappingStatus) {
      return { text: "Belum terhubung", variant: "default" as const };
    }
    if (mappingStatus.activeCount > 0) {
      return { text: `${mappingStatus.activeCount} kavling aktif`, variant: "success" as const };
    }
    if (mappingStatus.historyOnlyCount > 0) {
      return { text: "Riwayat saja", variant: "default" as const };
    }
    return { text: "Belum terhubung", variant: "default" as const };
  };

  const hasNoContent = !loading && !errorMessage && items.length === 0;

  const mobileContent = hasNoContent ? (
    <EmptyState icon={Inbox} title="Belum ada data resident." />
  ) : (
    <ListContainer>
      {pagedItems.length === 0 && !hasNoContent ? (
        <EmptyState icon={Inbox} title="Belum ada data resident." />
      ) : null}
      {pagedItems.map((item) => {
        const canEditSuperAdmin = canManageSuperAdmin || item.role !== "super_admin";
        const isExpanded = expandedResidentId === item.id;
        const status = getMappingStatusLabel(item.id);
        const accentColor = item.is_active ? "border-l-emerald-500" : "border-l-slate-400";

        return (
          <div key={item.id}>
            <CompactListRow
              primary={item.full_name}
              secondary={
                <span className="flex items-center gap-1.5">
                  <StatusDot variant={item.is_active ? "success" : "muted"} />
                  <span>{item.email ?? "Email belum diisi"}</span>
                  <span className="text-slate-300">·</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{item.role}</Badge>
                  <Badge variant={status.variant as "default" | "secondary" | "destructive" | "outline" | "success" | "warning"} className="text-[10px] h-4 px-1.5">{status.text}</Badge>
                </span>
              }
              trailing={
                <Badge variant={item.is_active ? "success" : "default"} className="text-[10px] h-4 px-1.5 shrink-0">
                  {item.is_active ? "Aktif" : "Nonaktif"}
                </Badge>
              }
              accentColor={accentColor}
              expandedOpen={isExpanded}
              onToggle={() => setExpandedResidentId(isExpanded ? null : item.id)}
              expanded={
                <div className="space-y-2">
                  {item.phone ? (
                    <div className="text-xs">
                      <span className="text-slate-400">Telepon</span>
                      <p className="font-medium text-slate-800">{item.phone}</p>
                    </div>
                  ) : null}
                  {canEditSuperAdmin ? null : (
                    <p className="text-xs text-amber-700">Role super_admin hanya dapat dikelola super_admin.</p>
                  )}

                  {/* Inline h-8 actions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs"
                      disabled={!canEditSuperAdmin}
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
                      disabled={!item.is_active || saving || !canEditSuperAdmin}
                      onClick={() => handleDeactivate(item)}
                    >
                      Nonaktif
                    </Button>
                  </div>

                  {/* Mapping section */}
                  <div className="border-t border-slate-100 pt-2">
                    <KavlingResidentMapping residentId={item.id} />
                  </div>
                </div>
              }
            />
          </div>
        );
      })}
    </ListContainer>
  );

  const desktopContent = hasNoContent ? (
    <EmptyState icon={Inbox} title="Belum ada data resident." />
  ) : (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-sm">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="text-xs uppercase tracking-wide text-slate-500">
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telepon</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mapping</TableHead>
            <TableHead>Kelola Mapping</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedItems.map((item) => {
            const canEditSuperAdmin = canManageSuperAdmin || item.role !== "super_admin";
            const isExpanded = expandedResidentId === item.id;

            return (
              <TableRow key={item.id} className="align-top">
                <TableCell>
                  <p className="font-medium text-slate-900">{item.full_name}</p>
                  <p className="text-xs text-slate-500">{item.display_name ?? "-"}</p>
                </TableCell>
                <TableCell className="text-slate-700">{item.email ?? "-"}</TableCell>
                <TableCell className="text-slate-700">{item.phone ?? "-"}</TableCell>
                <TableCell className="text-slate-700">{item.role}</TableCell>
                <TableCell>
                  <Badge variant={item.is_active ? "success" : "default"}>
                    {item.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {(() => {
                    const status = getMappingStatusLabel(item.id);
                    return <Badge variant={status.variant}>{status.text}</Badge>;
                  })()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedResidentId(isExpanded ? null : item.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                    {isExpanded ? "Tutup" : "Kelola"}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canEditSuperAdmin}
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
                      disabled={!item.is_active || saving || !canEditSuperAdmin}
                      onClick={() => handleDeactivate(item)}
                    >
                      Nonaktifkan
                    </Button>
                  </div>
                  {canEditSuperAdmin ? null : (
                    <p className="mt-1 text-xs text-amber-700">Role super_admin hanya dapat dikelola super_admin.</p>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="Admin"
        title="Manajemen Resident"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => loadResidents()} disabled={loading || saving}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreating((value) => !value);
                setEditingId(null);
              }}
            >
              <Plus className="size-4" /> {creating ? "Tutup Form" : "Tambah/Invite Resident"}
            </Button>
          </>
        }
      />

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-5 py-3.5 text-sm text-red-700 font-medium">
          {errorMessage}
        </div>
      ) : null}

      {creating ? (
        <div className="admin-card p-5">
          <h3 className="text-base font-bold text-slate-900 mb-4">Resident Baru</h3>
          <ResidentForm
            canManageSuperAdmin={canManageSuperAdmin}
            submitLabel="Invite Resident"
            saving={saving}
            onSubmit={handleInviteCreate}
          />
        </div>
      ) : null}

      {editingId && currentEditing ? (
        <div className="admin-card p-5">
          <h3 className="text-base font-bold text-slate-900 mb-4">Edit {currentEditing.full_name}</h3>
          <div className="space-y-3">
            <ResidentForm
              canManageSuperAdmin={canManageSuperAdmin}
              submitLabel="Perbarui Resident"
              saving={saving}
              onSubmit={handleUpdate}
              initialValues={{
                full_name: currentEditing.full_name,
                display_name: currentEditing.display_name ?? "",
                phone: currentEditing.phone ?? "",
                email: currentEditing.email ?? "",
                role: currentEditing.role,
                is_active: currentEditing.is_active,
              }}
            />
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              Batal Edit
            </Button>
          </div>
        </div>
      ) : null}

      <div className="admin-card p-5 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Daftar Resident</h3>
        <DataList
          loading={loading}
          error={null}
          onRetry={loadResidents}
          mobile={mobileContent}
          desktop={desktopContent}
        />

        {!loading && !errorMessage && items.length > 0 ? (
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

        {expandedResidentId ? (
          <div className="hidden lg:block">
            <KavlingResidentMapping residentId={expandedResidentId} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
