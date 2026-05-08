import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script, createContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { buildImportPreview } from "@/lib/imports/importPreview";

type Operation = {
  table: string;
  op: string;
  payload?: unknown;
  field?: string;
  value?: unknown;
  values?: unknown[];
  options?: unknown;
};

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function loadHandleApply() {
  const source = readRepoFile("supabase/functions/import-apply/index.ts")
    .replace(
      'import { serve } from "https://deno.land/std@0.224.0/http/server.ts";',
      "const { serve } = globalThis.__mocks.deno;",
    )
    .replace(
      'import { getCallerProfile, requireRole } from "../_shared/auth.ts";',
      "const { getCallerProfile, requireRole } = globalThis.__mocks.auth;",
    )
    .replace(
      'import { HttpError, jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";',
      "const { HttpError, jsonResponse, methodNotAllowed, optionsResponse } = globalThis.__mocks.responses;",
    )
    .replace(
      'import { createServiceRoleClient, createUserClient } from "../_shared/supabase.ts";',
      "const { createServiceRoleClient, createUserClient } = globalThis.__mocks.supabase;",
    )
    .replace(
      'import { buildImportPreview } from "../../../lib/imports/importPreview.ts";',
      "const { buildImportPreview } = globalThis.__mocks.preview;",
    )
    .replace(/import type {[\s\S]*?} from "\.\.\.\/\.\.\.\/lib\/imports\/importTypes\.ts";\n/, "")
    .concat("\nglobalThis.__exports = { handleApply };\n");

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const context = createContext({
    console,
    Request,
    Response,
    Date,
    exports: {},
    module: { exports: {} },
    globalThis: {
      __mocks: {},
      __exports: {},
    },
  });

  class MockHttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  const serviceRef: { current: ReturnType<typeof createImportServiceClientMock> | null } = { current: null };

  Object.assign(context.globalThis as object, {
    __mocks: {
      deno: { serve: () => undefined },
      auth: {
        getCallerProfile: async () => ({ id: "admin-1", role: "admin" }),
        requireRole: () => undefined,
      },
      responses: {
        HttpError: MockHttpError,
        jsonResponse: (status: number, body: unknown) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          }),
        methodNotAllowed: () => new Response("method not allowed", { status: 405 }),
        optionsResponse: () => new Response(null, { status: 204 }),
      },
      supabase: {
        createServiceRoleClient: () => serviceRef.current,
        createUserClient: () => ({ from: () => ({}) }),
      },
      preview: { buildImportPreview },
    },
  });

  new Script(compiled).runInContext(context);

  return {
    handleApply: (context.globalThis as { __exports: { handleApply: (request: Request) => Promise<Response> } }).__exports.handleApply,
    setServiceClient(client: ReturnType<typeof createImportServiceClientMock>) {
      serviceRef.current = client;
    },
  };
}

function createImportServiceClientMock(input: {
  log: Operation[];
  insertSingleResults?: Record<string, unknown>;
  selectInResults?: Record<string, unknown[]>;
}) {
  return {
    from(table: string) {
      return {
        insert(payload: unknown) {
          input.log.push({ table, op: "insert", payload });
          return {
            select() {
              return {
                single: async () => ({
                  data: input.insertSingleResults?.[table] ?? null,
                  error: null,
                }),
              };
            },
          };
        },
        update(payload: unknown) {
          input.log.push({ table, op: "update", payload });
          return {
            eq: async (field: string, value: unknown) => {
              input.log.push({ table, op: "eq", field, value });
              return { error: null };
            },
          };
        },
        upsert(payload: unknown, options: unknown) {
          input.log.push({ table, op: "upsert", payload, options });
          return Promise.resolve({ error: null });
        },
        select(columns: string) {
          input.log.push({ table, op: "select", payload: columns });
          return {
            in: async (field: string, values: unknown[]) => {
              input.log.push({ table, op: "in", field, values });
              return {
                data: input.selectInResults?.[table] ?? [],
                error: null,
              };
            },
          };
        },
      };
    },
  };
}

describe("import apply contract", () => {
  it("marks invalid apply attempts as failed before touching business tables", async () => {
    const harness = loadHandleApply();
    const log: Operation[] = [];
    harness.setServiceClient(
      createImportServiceClientMock({
        log,
        insertSingleResults: {
          import_jobs: { id: "job-invalid" },
        },
      }),
    );

    const response = await harness.handleApply(
      new Request("http://localhost/import-apply", {
        method: "POST",
        body: JSON.stringify({
          importType: "fee_override",
          rows: [{ kavling_code: "", fee_type_code: "IPL", amount: "oops" }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Masih ada baris tidak valid. Perbaiki CSV sebelum apply.",
      jobId: "job-invalid",
      invalidCount: 1,
    });
    expect(log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "import_jobs", op: "insert" }),
        expect.objectContaining({
          table: "import_jobs",
          op: "update",
          payload: expect.objectContaining({ status: "failed" }),
        }),
      ]),
    );
    expect(log.some((entry) => entry.table === "kavlings" && entry.op === "upsert")).toBe(false);
    expect(log.some((entry) => entry.table === "kavling_residents" && entry.op === "upsert")).toBe(false);
    expect(log.some((entry) => entry.table === "kavling_fee_overrides" && entry.op === "upsert")).toBe(false);
  });

  it("applies valid kavling rows and promotes the job to applied", async () => {
    const harness = loadHandleApply();
    const log: Operation[] = [];
    harness.setServiceClient(
      createImportServiceClientMock({
        log,
        insertSingleResults: {
          import_jobs: { id: "job-kavling" },
        },
      }),
    );

    const response = await harness.handleApply(
      new Request("http://localhost/import-apply", {
        method: "POST",
        body: JSON.stringify({
          importType: "kavling",
          rows: [{ code: " a-01 ", block: "A", sort_order: "2", active: "true", notes: "Depan" }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "kavlings",
          op: "upsert",
          payload: [
            {
              code: "A-01",
              block: "A",
              sort_order: 2,
              active: true,
              notes: "Depan",
            },
          ],
        }),
        expect.objectContaining({
          table: "import_jobs",
          op: "update",
          payload: expect.objectContaining({ status: "applied" }),
        }),
      ]),
    );
  });

  it("resolves kavling and resident lookups before applying resident mappings", async () => {
    const harness = loadHandleApply();
    const log: Operation[] = [];
    harness.setServiceClient(
      createImportServiceClientMock({
        log,
        insertSingleResults: {
          import_jobs: { id: "job-mapping" },
        },
        selectInResults: {
          kavlings: [{ id: "k-1", code: "B-02" }],
          profiles: [{ id: "p-1", email: "warga@example.com" }],
        },
      }),
    );

    const response = await harness.handleApply(
      new Request("http://localhost/import-apply", {
        method: "POST",
        body: JSON.stringify({
          importType: "resident_mapping",
          rows: [
            {
              kavling_code: "B-02",
              resident_email: "warga@example.com",
              relation: "owner",
              is_primary: "true",
              active: "yes",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "kavlings", op: "in", field: "code", values: ["B-02"] }),
        expect.objectContaining({ table: "profiles", op: "in", field: "email", values: ["warga@example.com"] }),
        expect.objectContaining({
          table: "kavling_residents",
          op: "upsert",
          payload: [
            {
              kavling_id: "k-1",
              profile_id: "p-1",
              relation: "owner",
              relation_type: "other",
              relation_label: "owner",
              is_primary: true,
              active: true,
            },
          ],
        }),
      ]),
    );
  });

  it("resolves kavling and fee type lookups before applying fee overrides", async () => {
    const harness = loadHandleApply();
    const log: Operation[] = [];
    harness.setServiceClient(
      createImportServiceClientMock({
        log,
        insertSingleResults: {
          import_jobs: { id: "job-override" },
        },
        selectInResults: {
          kavlings: [{ id: "k-2", code: "C-03" }],
          fee_types: [{ id: "f-1", code: "IPL" }],
        },
      }),
    );

    const response = await harness.handleApply(
      new Request("http://localhost/import-apply", {
        method: "POST",
        body: JSON.stringify({
          importType: "fee_override",
          rows: [
            {
              kavling_code: "C-03",
              fee_type_code: "IPL",
              amount: "125000",
              active_from: "2026-01-01",
              active_until: "2026-12-31",
              notes: "Penyesuaian",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "kavlings", op: "in", field: "code", values: ["C-03"] }),
        expect.objectContaining({ table: "fee_types", op: "in", field: "code", values: ["IPL"] }),
        expect.objectContaining({
          table: "kavling_fee_overrides",
          op: "upsert",
          payload: [
            {
              kavling_id: "k-2",
              fee_type_id: "f-1",
              amount: 125000,
              active_from: "2026-01-01",
              active_until: "2026-12-31",
              notes: "Penyesuaian",
            },
          ],
        }),
      ]),
    );
  });
});
