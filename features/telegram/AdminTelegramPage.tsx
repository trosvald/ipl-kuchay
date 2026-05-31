"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, MessageSquare, RefreshCw, RotateCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { DataList } from "@/features/layout/DataList";
import { FilterBar, FilterGroup } from "@/components/ui/FilterBar";
import { ListContainer } from "@/components/ui/ListContainer";
import { PageHeader } from "@/features/layout/PageHeader";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { StatusDot } from "@/components/ui/StatusDot";
import { StatsGrid } from "@/components/ui/StatsGrid";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/authHooks";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface TemplateRow {
  id: string;
  code: string;
  title: string;
  body_template: string;
  active: boolean;
}

interface DeliveryRow {
  id: string;
  template_code: string;
  profile_id: string;
  status: string;
  message_text: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

const TEMPLATE_CODE_LABELS: Record<string, string> = {
  resident_invoice_created: "Tagihan baru",
  resident_payment_pending: "Bukti diterima",
  resident_payment_verified: "Pembayaran terverifikasi",
  resident_payment_rejected: "Bukti ditolak",
  resident_payment_reminder: "Pengingat IPL",
  admin_pending_submission: "Bukti baru",
  admin_monthly_summary: "Ringkasan bulanan",
  resident_announcement: "Pengumuman baru",
};

function statusBadgeVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  if (status === "sent") return "default";
  if (status === "failed") return "destructive";
  if (status === "queued") return "secondary";
  return "outline";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminTelegramPage() {
  const client = getSupabaseBrowserClient();
  const { profile } = useAuth();

  const [linkedCount, setLinkedCount] = useState(0);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [filterTemplate, setFilterTemplate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // Template editor
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!client) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      // Linked count
      const { count } = await client
        .from("telegram_accounts")
        .select("*", { count: "exact", head: true });
      setLinkedCount(count ?? 0);

      // Templates
      const { data: tmplData } = await client
        .from("notification_templates")
        .select("id, code, title, body_template, active")
        .order("code");
      setTemplates((tmplData as TemplateRow[]) ?? []);

      // Deliveries (recent 50)
      const { data: delData } = await client
        .from("notification_deliveries")
        .select("id, template_code, profile_id, status, message_text, error_message, sent_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setDeliveries((delData as DeliveryRow[]) ?? []);
    } catch (err) {
      setErrorMessage("Gagal memuat data Telegram.");
    }

    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, [loadData]);

  const filteredDeliveries = useMemo(() => deliveries.filter((d) => {
    if (filterTemplate && d.template_code !== filterTemplate) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    return true;
  }), [deliveries, filterStatus, filterTemplate]);
  const totalRows = filteredDeliveries.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedDeliveries = useMemo(
    () => filteredDeliveries.slice((page - 1) * pageSize, page * pageSize),
    [filteredDeliveries, page, pageSize],
  );
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const failedCount = deliveries.filter((d) => d.status === "failed").length;
  const sentCount = deliveries.filter((d) => d.status === "sent").length;

  const handleSaveTemplate = async () => {
    if (!client || !editingTemplate || !profile) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMsg(null);

    const previous = templates.find((t) => t.id === editingTemplate.id);

    const { error } = await client
      .from("notification_templates")
      .update({ body_template: editBody, title: editingTemplate.title })
      .eq("id", editingTemplate.id);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMsg("Template berhasil disimpan.");
    setSaving(false);
    setEditingTemplate(null);
    await loadData();
  };

  const handleResetTemplate = async (template: TemplateRow) => {
    if (!client || !profile) return;

    // Find the seeded default (use hardcoded defaults matching migration 0007)
    const defaults: Record<string, string> = {
      resident_invoice_created: "Halo {{name}}, tagihan {{period_label}} untuk {{kavling_code}} sudah terbit. Total: Rp {{amount_due}}. Jatuh tempo: {{due_date}}.",
      resident_payment_pending: "Bukti pembayaran {{kavling_code}} untuk {{period_label}} sudah diterima dan menunggu verifikasi bendahara.",
      resident_payment_verified: "Pembayaran {{kavling_code}} untuk {{period_label}} sudah diverifikasi. Terima kasih.",
      resident_payment_rejected: "Bukti pembayaran {{kavling_code}} untuk {{period_label}} ditolak. Alasan: {{reason}}.",
      resident_payment_reminder: "Pengingat: tagihan {{period_label}} untuk {{kavling_code}} masih {{status}}. Total: Rp {{amount_due}}. Jatuh tempo: {{due_date}}.",
      admin_pending_submission: "{{kavling_code}} mengirim bukti pembayaran {{period_label}} sebesar Rp {{amount_submitted}}.",
      admin_monthly_summary: "Ringkasan {{period_label}}: {{paid_count}}/{{total_count}} lunas. Total diterima Rp {{total_paid}}. Tunggakan Rp {{total_unpaid}}.",
      resident_announcement: "Ada pengumuman baru di IPL Jatiloka: \"{{title}}\". Buka aplikasi web untuk membaca selengkapnya.",
    };

    const defaultBody = defaults[template.code];
    if (!defaultBody) return;

    setSaving(true);

    const { error } = await client
      .from("notification_templates")
      .update({ body_template: defaultBody })
      .eq("id", template.id);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSuccessMsg("Template dikembalikan ke default.");
    await loadData();
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin Communication"
        title="Telegram"
        subtitle="Status pengiriman notifikasi Telegram dan pengelolaan template."
        actions={
          <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {successMsg ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-sm text-emerald-700">{successMsg}</CardContent>
        </Card>
      ) : null}

      {/* Summary cards */}
      <StatsGrid
        columns={3}
        items={[
          { label: "Akun Terhubung", value: linkedCount, icon: MessageSquare },
          { label: "Terkirim", value: sentCount, icon: CheckCircle, variant: "success" },
          { label: "Gagal", value: failedCount, icon: XCircle, variant: failedCount > 0 ? "destructive" : "default" },
        ]}
      />
      {failedCount > 0 ? (
        <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {deliveries
            .filter((d) => d.status === "failed" && d.error_message)
            .slice(0, 3)
            .map((d) => (
              <p key={d.id} className="truncate">
                {TEMPLATE_CODE_LABELS[d.template_code] ?? d.template_code}: {d.error_message}
              </p>
            ))}
        </div>
      ) : null}

      {/* Delivery History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Riwayat Pengiriman
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FilterBar className="mb-3">
            <FilterGroup label="Template">
              <select
                value={filterTemplate}
                onChange={(e) => {
                  setFilterTemplate(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs"
              >
                <option value="">Semua template</option>
                {Object.entries(TEMPLATE_CODE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup label="Status">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs"
              >
                <option value="">Semua status</option>
                <option value="sent">Terkirim</option>
                <option value="failed">Gagal</option>
                <option value="queued">Antrian</option>
              </select>
            </FilterGroup>
          </FilterBar>

          <DataList
            loading={loading}
            empty={{ title: "Belum ada pengiriman.", description: "Data pengiriman akan muncul setelah notifikasi dikirim." }}
            mobile={filteredDeliveries.length > 0 ? (
              <ListContainer>
                {pagedDeliveries.map((row) => {
                  const isExpanded = expandedId === row.id;
                  const statusVariant = row.status === "sent" ? "success" : row.status === "failed" ? "destructive" : "warning";
                  const statusLabel = row.status === "sent" ? "Terkirim" : row.status === "failed" ? "Gagal" : "Antrian";
                  return (
                    <CompactListRow
                      key={row.id}
                      primary={TEMPLATE_CODE_LABELS[row.template_code] ?? row.template_code}
                      trailing={
                        <Badge variant={statusBadgeVariant(row.status)} className="text-[10px] h-4 px-1.5">
                          {row.status === "sent" ? <CheckCircle className="mr-0.5 inline size-2.5" /> : null}
                          {row.status === "failed" ? <XCircle className="mr-0.5 inline size-2.5" /> : null}
                          {row.status === "queued" ? <AlertTriangle className="mr-0.5 inline size-2.5" /> : null}
                          {statusLabel}
                        </Badge>
                      }
                      secondary={
                        <span className="flex items-center gap-1.5">
                          <StatusDot variant={statusVariant} />
                          <span>{formatDate(row.sent_at ?? row.created_at)}</span>
                        </span>
                      }
                      accentColor={row.status === "failed" ? "border-l-red-500" : row.status === "sent" ? "border-l-emerald-500" : "border-l-amber-500"}
                      expandedOpen={isExpanded}
                      onToggle={() => setExpandedId(isExpanded ? null : row.id)}
                      expanded={
                        <div className="space-y-1.5 text-xs">
                          <p className="text-slate-700">{row.message_text}</p>
                          {row.error_message ? (
                            <p className="break-words text-red-600">{row.error_message}</p>
                          ) : null}
                        </div>
                      }
                    />
                  );
                })}
              </ListContainer>
            ) : undefined}
            desktop={filteredDeliveries.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="text-xs uppercase tracking-wide text-slate-500">
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pesan</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Tanggal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedDeliveries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-slate-600">
                          {TEMPLATE_CODE_LABELS[row.template_code] ?? row.template_code}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(row.status)} className="text-xs">
                            {row.status === "sent" ? <CheckCircle className="mr-1 size-3 inline" /> : null}
                            {row.status === "failed" ? <XCircle className="mr-1 size-3 inline" /> : null}
                            {row.status === "queued" ? <AlertTriangle className="mr-1 size-3 inline" /> : null}
                            {row.status === "sent" ? "Terkirim" : row.status === "failed" ? "Gagal" : "Antrian"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-slate-700">
                          {row.message_text}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-red-500">
                          {row.error_message ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(row.sent_at ?? row.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : undefined}
          />

          {!loading && filteredDeliveries.length > 0 ? (
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

      {/* Template Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Template Notifikasi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Memuat template...</p>
          ) : (
            <ListContainer>
              {templates.map((tpl) => {
                const tplExpanded = expandedTemplateId === tpl.id;
                return (
                  <CompactListRow
                    key={tpl.id}
                    primary={tpl.title}
                    trailing={
                      <span className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTemplate(tpl);
                            setEditBody(tpl.body_template);
                          }}
                          disabled={saving}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetTemplate(tpl);
                          }}
                          disabled={saving}
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                      </span>
                    }
                    secondary={
                      <span className="text-slate-500">{tpl.code}</span>
                    }
                    accentColor="border-l-indigo-400"
                    expandedOpen={tplExpanded}
                    onToggle={() => setExpandedTemplateId(tplExpanded ? null : tpl.id)}
                    expanded={
                      <p className="text-xs text-slate-600 bg-slate-50 rounded p-2 font-mono whitespace-pre-wrap">
                        {tpl.body_template}
                      </p>
                    }
                  />
                );
              })}
            </ListContainer>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template: {editingTemplate?.code}</DialogTitle>
            <DialogDescription>
              Ubah isi template notifikasi. Gunakan {"{{var}}"} untuk variabel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            {/* Preview */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Pratinjau (dengan data contoh):</p>
              <p className="text-sm text-slate-700">
                {editBody
                  .replaceAll("{{name}}", "Budi")
                  .replaceAll("{{period_label}}", "April 2026")
                  .replaceAll("{{kavling_code}}", "Kav 3A")
                  .replaceAll("{{amount_due}}", "Rp 350.000")
                  .replaceAll("{{due_date}}", "15 April 2026")
                  .replaceAll("{{status}}", "belum lunas")
                  .replaceAll("{{reason}}", "bukti tidak jelas")
                  .replaceAll("{{amount_submitted}}", "Rp 350.000")
                  .replaceAll("{{paid_count}}", "18")
                  .replaceAll("{{total_count}}", "34")
                  .replaceAll("{{total_paid}}", "Rp 6.300.000")
                  .replaceAll("{{total_unpaid}}", "Rp 5.600.000")
                  .replaceAll("{{title}}", "Kerja Bakti Sabtu ini")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingTemplate(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
