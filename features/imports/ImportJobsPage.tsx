"use client";

import { type ChangeEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportPreviewError, ImportPreviewResult, ImportType, RawImportRow } from "@/lib/imports/importTypes";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface ImportApplyResponse extends ImportPreviewResult {
  jobId: string;
}

const IMPORT_TYPE_OPTIONS: Array<{ value: ImportType; label: string }> = [
  { value: "kavling", label: "Kavling" },
  { value: "resident_mapping", label: "Mapping Resident" },
  { value: "fee_override", label: "Override Iuran" },
];

function parseCsvText(csvText: string): RawImportRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((value) => value.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const row: RawImportRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

export function ImportJobsPage() {
  const client = getSupabaseBrowserClient();

  const [importType, setImportType] = useState<ImportType>("kavling");
  const [filename, setFilename] = useState<string>("");
  const [rows, setRows] = useState<RawImportRow[]>([]);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);

  const hasInvalidRows = useMemo(() => (preview?.invalidCount ?? 0) > 0, [preview]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPreview(null);

    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setRows([]);
      setFilename("");
      return;
    }

    setFilename(file.name);

    const fileText = await file.text();
    const nextRows = parseCsvText(fileText);
    setRows(nextRows);

    if (nextRows.length === 0) {
      setErrorMessage("CSV tidak memiliki baris data. Pastikan ada header dan isi.");
    }
  };

  const handlePreview = async () => {
    if (!client) {
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    if (rows.length === 0) {
      setErrorMessage("Unggah CSV terlebih dahulu.");
      return;
    }

    setLoadingPreview(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data, error } = await client.functions.invoke<ImportPreviewResult>("import-preview", {
      body: {
        importType,
        rows,
      },
    });

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal memproses preview import.");
      setLoadingPreview(false);
      return;
    }

    setPreview(data);
    setLoadingPreview(false);
  };

  const handleApply = async () => {
    if (!client || !preview) {
      return;
    }

    if (preview.invalidCount > 0) {
      setErrorMessage("Masih ada baris tidak valid. Perbaiki CSV sebelum apply.");
      return;
    }

    setLoadingApply(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data, error } = await client.functions.invoke<ImportApplyResponse>("import-apply", {
      body: {
        importType,
        rows,
        originalFilename: filename,
      },
    });

    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal menjalankan apply import.");
      setLoadingApply(false);
      return;
    }

    setPreview(data);
    setSuccessMessage(`Import berhasil diterapkan. Job: ${data.jobId}`);
    setLoadingApply(false);
  };

  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin</p>
        <h1 className="text-2xl font-semibold text-slate-900">Import Data</h1>
        <p className="text-sm text-slate-600">Unggah CSV, cek hasil preview, lalu apply hanya jika semua baris valid.</p>
      </header>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {successMessage ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-sm text-emerald-700">{successMessage}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="space-y-1 text-sm text-slate-700">
            <span>Jenis Import</span>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
              value={importType}
              onChange={(event) => setImportType(event.target.value as ImportType)}
              disabled={loadingPreview || loadingApply}
            >
              {IMPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>File CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              onChange={handleFileChange}
              disabled={loadingPreview || loadingApply}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePreview} disabled={loadingPreview || loadingApply || rows.length === 0}>
              {loadingPreview ? "Memproses Preview..." : "Preview Import"}
            </Button>
            <Button variant="secondary" onClick={handleApply} disabled={loadingApply || loadingPreview || !preview || hasInvalidRows}>
              {loadingApply ? "Menerapkan..." : "Apply Import"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hasil Preview {filename ? `- ${filename}` : ""}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
              <p>Total baris: {preview.rowCount}</p>
              <p>Valid: {preview.validCount}</p>
              <p>Tidak valid: {preview.invalidCount}</p>
            </div>

            {preview.errors.length > 0 ? (
              <>
                <div className="space-y-3 lg:hidden">
                  {preview.errors.map((error: ImportPreviewError, index) => (
                    <div key={`${error.rowNumber}-${error.field}-${index}`} className="rounded-lg border bg-background px-3 py-3">
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <p className="font-semibold text-foreground">Baris {error.rowNumber}</p>
                        <p className="shrink-0 text-xs text-muted-foreground">{error.field}</p>
                      </div>
                      <p className="mt-2 break-words text-sm text-slate-700">{error.message}</p>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Baris</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Pesan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.errors.map((error: ImportPreviewError, index) => (
                        <TableRow key={`${error.rowNumber}-${error.field}-${index}`}>
                          <TableCell>{error.rowNumber}</TableCell>
                          <TableCell>{error.field}</TableCell>
                          <TableCell>{error.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-emerald-700">Semua baris valid. Anda bisa melanjutkan apply.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
