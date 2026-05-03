// @ts-expect-error Node TypeScript cannot resolve Deno URL imports in editor mode.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getCallerProfile, requireRole } from "../_shared/auth.ts";
import { HttpError, jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";
import { createUserClient } from "../_shared/supabase.ts";
import { buildImportPreview } from "../../../lib/imports/importPreview.ts";
import type { ImportType, RawImportRow } from "../../../lib/imports/importTypes.ts";

interface ImportPreviewRequest {
  importType?: ImportType;
  rows?: RawImportRow[];
  maxRows?: number;
}

function isImportType(value: unknown): value is ImportType {
  return value === "kavling" || value === "resident_mapping" || value === "fee_override";
}

async function parseRequest(request: Request): Promise<{
  importType: ImportType;
  rows: RawImportRow[];
  maxRows?: number;
}> {
  let body: ImportPreviewRequest;

  try {
    body = (await request.json()) as ImportPreviewRequest;
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

  if (body.rows.some((row) => typeof row !== "object" || row === null || Array.isArray(row))) {
    throw new HttpError(400, "rows harus berupa object per baris");
  }

  if (body.maxRows !== undefined && (!Number.isInteger(body.maxRows) || body.maxRows < 1)) {
    throw new HttpError(400, "maxRows harus bilangan bulat positif");
  }

  return {
    importType: body.importType,
    rows: body.rows,
    maxRows: body.maxRows,
  };
}

async function handlePreview(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["admin", "super_admin"]);

  const input = await parseRequest(request);
  const result = buildImportPreview(input);

  return jsonResponse(200, result as unknown as Record<string, unknown>);
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    return await handlePreview(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
