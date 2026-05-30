"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, RefreshCw, RotateCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Communication</p>
          <h1 className="text-2xl font-semibold text-slate-900">Telegram</h1>
          <p className="text-sm text-slate-600">Status pengiriman notifikasi Telegram dan pengelolaan template.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </header>

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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-slate-500">Akun Terhubung</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <p className="text-2xl font-bold text-slate-900">{linkedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-slate-500">Terkirim</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <p className="text-2xl font-bold text-emerald-600">{sentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-slate-500">Gagal</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            {failedCount > 0 && (
              <div className="mt-1 space-y-1">
                {deliveries
                  .filter((d) => d.status === "failed" && d.error_message)
                  .slice(0, 3)
                  .map((d) => (
                    <p key={d.id} className="text-xs text-red-500 truncate">
                      {d.template_code}: {d.error_message}
                    </p>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivery History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Riwayat Pengiriman
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={filterTemplate}
              onChange={(e) => {
                setFilterTemplate(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">Semua template</option>
              {Object.entries(TEMPLATE_CODE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">Semua status</option>
              <option value="sent">Terkirim</option>
              <option value="failed">Gagal</option>
              <option value="queued">Antrian</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Memuat data...</p>
          ) : filteredDeliveries.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada pengiriman.</p>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {pagedDeliveries.map((row) => (
                  <div key={row.id} className="rounded-lg border bg-background px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {TEMPLATE_CODE_LABELS[row.template_code] ?? row.template_code}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.sent_at ?? row.created_at)}</p>
                      </div>
                      <Badge variant={statusBadgeVariant(row.status)} className="shrink-0 text-xs">
                        {row.status === "sent" ? <CheckCircle className="mr-1 inline size-3" /> : null}
                        {row.status === "failed" ? <XCircle className="mr-1 inline size-3" /> : null}
                        {row.status === "queued" ? <AlertTriangle className="mr-1 inline size-3" /> : null}
                        {row.status === "sent" ? "Terkirim" : row.status === "failed" ? "Gagal" : "Antrian"}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs text-slate-700">{row.message_text}</p>
                    {row.error_message ? (
                      <p className="mt-2 break-words text-xs text-red-600">{row.error_message}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
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
                        <TableCell className="max-w-xs text-xs text-slate-700 truncate">
                          {row.message_text}
                        </TableCell>
                        <TableCell className="max-w-xs text-xs text-red-500 truncate">
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
            </>
          )}

          {!loading && filteredDeliveries.length > 0 ? (
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
            <div className="space-y-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{tpl.title}</p>
                      <p className="text-xs text-slate-500">{tpl.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
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
                        onClick={() => handleResetTemplate(tpl)}
                        disabled={saving}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 rounded p-2 font-mono whitespace-pre-wrap">
                    {tpl.body_template}
                  </p>
                </div>
              ))}
            </div>
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
