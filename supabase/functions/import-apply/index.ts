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

  for (const row of rows) {
    const { error } = await client.from("kavlings").upsert(
      {
        code: row.code,
        block: row.block || null,
        sort_order: row.sort_order,
        active: row.active,
        notes: row.notes || null,
      },
      { onConflict: "code" },
    );

    if (error) {
      throw new HttpError(400, `Gagal menerapkan data kavling (${row.code}): ${error.message}`);
    }
  }
}

async function applyResidentMappings(rows: ResidentMappingImportRow[]) {
  const client = createServiceRoleClient();

  for (const row of rows) {
    const { data: kavling, error: kavlingError } = await client
      .from("kavlings")
      .select("id")
      .eq("code", row.kavling_code)
      .maybeSingle();

    if (kavlingError) {
      throw new HttpError(400, `Gagal mencari kavling ${row.kavling_code}: ${kavlingError.message}`);
    }

    if (!kavling?.id) {
      throw new HttpError(400, `Kavling tidak ditemukan: ${row.kavling_code}`);
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id")
      .eq("email", row.resident_email)
      .maybeSingle();

    if (profileError) {
      throw new HttpError(400, `Gagal mencari resident ${row.resident_email}: ${profileError.message}`);
    }

    if (!profile?.id) {
      throw new HttpError(400, `Resident tidak ditemukan: ${row.resident_email}`);
    }

    const { error } = await client.from("kavling_residents").upsert(
      {
        kavling_id: kavling.id,
        profile_id: profile.id,
        relation: row.relation,
        relation_type: "other",
        relation_label: row.relation,
        is_primary: row.is_primary,
        active: row.active,
      },
      { onConflict: "kavling_id,profile_id" },
    );

    if (error) {
      throw new HttpError(
        400,
        `Gagal menerapkan mapping ${row.kavling_code} - ${row.resident_email}: ${error.message}`,
      );
    }
  }
}

async function applyFeeOverrides(rows: FeeOverrideImportRow[]) {
  const client = createServiceRoleClient();

  for (const row of rows) {
    const { data: kavling, error: kavlingError } = await client
      .from("kavlings")
      .select("id")
      .eq("code", row.kavling_code)
      .maybeSingle();

    if (kavlingError) {
      throw new HttpError(400, `Gagal mencari kavling ${row.kavling_code}: ${kavlingError.message}`);
    }

    if (!kavling?.id) {
      throw new HttpError(400, `Kavling tidak ditemukan: ${row.kavling_code}`);
    }

    const { data: feeType, error: feeTypeError } = await client
      .from("fee_types")
      .select("id")
      .eq("code", row.fee_type_code)
      .maybeSingle();

    if (feeTypeError) {
      throw new HttpError(400, `Gagal mencari jenis iuran ${row.fee_type_code}: ${feeTypeError.message}`);
    }

    if (!feeType?.id) {
      throw new HttpError(400, `Jenis iuran tidak ditemukan: ${row.fee_type_code}`);
    }

    const { error } = await client.from("kavling_fee_overrides").upsert(
      {
        kavling_id: kavling.id,
        fee_type_id: feeType.id,
        amount: row.amount,
        active_from: row.active_from || null,
        active_until: row.active_until || null,
        notes: row.notes || null,
      },
      { onConflict: "kavling_id,fee_type_id,active_from" },
    );

    if (error) {
      throw new HttpError(
        400,
        `Gagal menerapkan override ${row.kavling_code} - ${row.fee_type_code}: ${error.message}`,
      );
    }
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
