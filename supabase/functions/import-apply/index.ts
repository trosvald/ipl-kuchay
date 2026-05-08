// @ts-expect-error Node TypeScript cannot resolve Deno URL imports in editor mode.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getCallerProfile, requireRole } from "../_shared/auth.ts";
import { HttpError, jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";
import { createServiceRoleClient, createUserClient } from "../_shared/supabase.ts";
import { buildImportPreview } from "../../../lib/imports/importPreview.ts";
import type {
  FeeOverrideImportRow,
  ImportType,
  KavlingImportRow,
  RawImportRow,
  ResidentMappingImportRow,
} from "../../../lib/imports/importTypes.ts";

interface ImportApplyRequest {
  importType?: ImportType;
  rows?: RawImportRow[];
  originalFilename?: string;
}

interface ImportJobRow {
  id: string;
}

interface KavlingLookupRow {
  id: string;
  code: string;
}

interface ProfileLookupRow {
  id: string;
  email: string;
}

interface FeeTypeLookupRow {
  id: string;
  code: string;
}

function isImportType(value: unknown): value is ImportType {
  return value === "kavling" || value === "resident_mapping" || value === "fee_override";
}

function normalizeFilename(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 255) : null;
}

async function parseRequest(request: Request): Promise<{
  importType: ImportType;
  rows: RawImportRow[];
  originalFilename: string | null;
}> {
  let body: ImportApplyRequest;

  try {
    body = (await request.json()) as ImportApplyRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isImportType(body.importType)) {
    throw new HttpError(400, "importType tidak valid");
  }

  if (!Array.isArray(body.rows)) {
    throw new HttpError(400, "rows harus berupa array");
  }

  if (body.rows.length === 0) {
    throw new HttpError(400, "CSV tidak memiliki baris data");
  }

  return {
    importType: body.importType,
    rows: body.rows,
    originalFilename: normalizeFilename(body.originalFilename),
  };
}

async function applyKavlingRows(rows: KavlingImportRow[]) {
  const client = createServiceRoleClient();

  const payload = rows.map((row) => ({
    code: row.code,
    block: row.block || null,
    sort_order: row.sort_order,
    active: row.active,
    notes: row.notes || null,
  }));

  const { error } = await client.from("kavlings").upsert(payload, { onConflict: "code" });

  if (error) {
    throw new HttpError(400, `Gagal menerapkan data kavling: ${error.message}`);
  }
}

async function applyResidentMappings(rows: ResidentMappingImportRow[]) {
  const client = createServiceRoleClient();

  const kavlingCodes = [...new Set(rows.map((row) => row.kavling_code))];
  const residentEmails = [...new Set(rows.map((row) => row.resident_email))];

  const { data: kavlings, error: kavlingError } = await client
    .from("kavlings")
    .select("id, code")
    .in("code", kavlingCodes);

  if (kavlingError) {
    throw new HttpError(400, `Gagal memuat data kavling import: ${kavlingError.message}`);
  }

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, email")
    .in("email", residentEmails);

  if (profileError) {
    throw new HttpError(400, `Gagal memuat data resident import: ${profileError.message}`);
  }

  const kavlingByCode = new Map(
    ((kavlings ?? []) as KavlingLookupRow[]).map((row) => [row.code, row.id]),
  );
  const profileByEmail = new Map(
    ((profiles ?? []) as ProfileLookupRow[]).map((row) => [row.email, row.id]),
  );

  const payload = rows.map((row) => {
    const kavlingId = kavlingByCode.get(row.kavling_code);
    if (!kavlingId) {
      throw new HttpError(400, `Kavling tidak ditemukan: ${row.kavling_code}`);
    }

    const profileId = profileByEmail.get(row.resident_email);
    if (!profileId) {
      throw new HttpError(400, `Resident tidak ditemukan: ${row.resident_email}`);
    }

    return {
      kavling_id: kavlingId,
      profile_id: profileId,
      relation: row.relation,
      relation_type: "other",
      relation_label: row.relation,
      is_primary: row.is_primary,
      active: row.active,
    };
  });

  const { error } = await client
    .from("kavling_residents")
    .upsert(payload, { onConflict: "kavling_id,profile_id" });

  if (error) {
    throw new HttpError(400, `Gagal menerapkan mapping resident: ${error.message}`);
  }
}

async function applyFeeOverrides(rows: FeeOverrideImportRow[]) {
  const client = createServiceRoleClient();

  const kavlingCodes = [...new Set(rows.map((row) => row.kavling_code))];
  const feeTypeCodes = [...new Set(rows.map((row) => row.fee_type_code))];

  const { data: kavlings, error: kavlingError } = await client
    .from("kavlings")
    .select("id, code")
    .in("code", kavlingCodes);

  if (kavlingError) {
    throw new HttpError(400, `Gagal memuat data kavling import: ${kavlingError.message}`);
  }

  const { data: feeTypes, error: feeTypeError } = await client
    .from("fee_types")
    .select("id, code")
    .in("code", feeTypeCodes);

  if (feeTypeError) {
    throw new HttpError(400, `Gagal memuat jenis iuran import: ${feeTypeError.message}`);
  }

  const kavlingByCode = new Map(
    ((kavlings ?? []) as KavlingLookupRow[]).map((row) => [row.code, row.id]),
  );
  const feeTypeByCode = new Map(
    ((feeTypes ?? []) as FeeTypeLookupRow[]).map((row) => [row.code, row.id]),
  );

  const payload = rows.map((row) => {
    const kavlingId = kavlingByCode.get(row.kavling_code);
    if (!kavlingId) {
      throw new HttpError(400, `Kavling tidak ditemukan: ${row.kavling_code}`);
    }

    const feeTypeId = feeTypeByCode.get(row.fee_type_code);
    if (!feeTypeId) {
      throw new HttpError(400, `Jenis iuran tidak ditemukan: ${row.fee_type_code}`);
    }

    return {
      kavling_id: kavlingId,
      fee_type_id: feeTypeId,
      amount: row.amount,
      active_from: row.active_from || null,
      active_until: row.active_until || null,
      notes: row.notes || null,
    };
  });

  const { error } = await client
    .from("kavling_fee_overrides")
    .upsert(payload, { onConflict: "kavling_id,fee_type_id,active_from" });

  if (error) {
    throw new HttpError(400, `Gagal menerapkan override iuran: ${error.message}`);
  }
}

async function handleApply(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["admin", "super_admin"]);

  const input = await parseRequest(request);
  const preview = buildImportPreview({ importType: input.importType, rows: input.rows });

  const serviceClient = createServiceRoleClient();
  const { data: job, error: jobInsertError } = await serviceClient
    .from("import_jobs")
    .insert({
      import_type: input.importType,
      status: "draft",
      original_filename: input.originalFilename,
      row_count: preview.rowCount,
      valid_count: preview.validCount,
      invalid_count: preview.invalidCount,
      errors: preview.errors,
      preview_rows: preview.previewRows,
      created_by: caller.id,
    })
    .select("id")
    .single();

  if (jobInsertError || !job?.id) {
    throw new HttpError(500, jobInsertError?.message ?? "Gagal membuat import job");
  }

  const importJob = job as ImportJobRow;

  if (preview.invalidCount > 0) {
    await serviceClient
      .from("import_jobs")
      .update({ status: "failed", applied_by: caller.id, applied_at: new Date().toISOString() })
      .eq("id", importJob.id);

    return jsonResponse(400, {
      error: "Masih ada baris tidak valid. Perbaiki CSV sebelum apply.",
      jobId: importJob.id,
      ...preview,
    });
  }

  try {
    if (input.importType === "kavling") {
      await applyKavlingRows(preview.previewRows as KavlingImportRow[]);
    } else if (input.importType === "resident_mapping") {
      await applyResidentMappings(preview.previewRows as ResidentMappingImportRow[]);
    } else {
      await applyFeeOverrides(preview.previewRows as FeeOverrideImportRow[]);
    }

    const { error: applyStatusError } = await serviceClient
      .from("import_jobs")
      .update({ status: "applied", applied_by: caller.id, applied_at: new Date().toISOString() })
      .eq("id", importJob.id);

    if (applyStatusError) {
      throw new HttpError(500, `Gagal memperbarui status import job: ${applyStatusError.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menerapkan import";
    await serviceClient
      .from("import_jobs")
      .update({
        status: "failed",
        applied_by: caller.id,
        applied_at: new Date().toISOString(),
        errors: [...preview.errors, { rowNumber: 0, field: "apply", message }],
      })
      .eq("id", importJob.id);

    throw error;
  }

  return jsonResponse(200, {
    jobId: importJob.id,
    ...preview,
  });
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    return await handleApply(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
