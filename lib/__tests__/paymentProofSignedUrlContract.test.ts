import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script, createContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type CallerRole = "resident" | "treasurer" | "admin" | "super_admin";

type Operation = {
  table: string;
  op: string;
  payload?: unknown;
  field?: string;
  value?: unknown;
};

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function loadHandleGetProofSignedUrl(caller: { id: string; role: CallerRole }) {
  const source = readRepoFile("supabase/functions/get-proof-signed-url/index.ts")
    .replace(
      'import { serve } from "https://deno.land/std@0.224.0/http/server.ts";',
      "const { serve } = globalThis.__mocks.deno;",
    )
    .replace(
      'import { getCallerProfile, requireRole } from "../_shared/auth.ts";',
      "const { getCallerProfile, requireRole } = globalThis.__mocks.auth;",
    )
    .replace(
      `import {
  HttpError,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/responses.ts";`,
      "const { HttpError, jsonResponse, methodNotAllowed, optionsResponse } = globalThis.__mocks.responses;",
    )
    .replace(
      `import {
  createServiceRoleClient,
  createUserClient,
} from "../_shared/supabase.ts";`,
      "const { createServiceRoleClient, createUserClient } = globalThis.__mocks.supabase;",
    )
    .concat("\nglobalThis.__exports = { handleGetProofSignedUrl };\n");

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
    URL,
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

  const userRef: { current: ReturnType<typeof createProofUserClientMock> | null } = { current: null };
  const serviceRef: { current: ReturnType<typeof createProofServiceClientMock> | null } = { current: null };
  const requireRole = vi.fn();

  Object.assign(context.globalThis as object, {
    __mocks: {
      deno: { serve: () => undefined },
      auth: {
        getCallerProfile: async () => ({ ...caller, is_active: true, email: null }),
        requireRole,
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
        createUserClient: () => userRef.current,
      },
    },
  });

  new Script(compiled).runInContext(context);

  return {
    handleGetProofSignedUrl: (context.globalThis as {
      __exports: { handleGetProofSignedUrl: (request: Request) => Promise<Response> };
    }).__exports.handleGetProofSignedUrl,
    requireRole,
    setClients(input: {
      userClient: ReturnType<typeof createProofUserClientMock>;
      serviceClient: ReturnType<typeof createProofServiceClientMock>;
    }) {
      userRef.current = input.userClient;
      serviceRef.current = input.serviceClient;
    },
  };
}

function createProofUserClientMock(input: {
  log: Operation[];
  canAccessProof: boolean;
  rpcError?: { message: string };
}) {
  return {
    rpc(fn: string, payload: unknown) {
      input.log.push({ table: "rpc", op: fn, payload });
      return Promise.resolve({
        data: input.rpcError ? null : input.canAccessProof,
        error: input.rpcError ?? null,
      });
    },
  };
}

function createProofServiceClientMock(input: {
  log: Operation[];
  submission?: unknown;
  auditError?: { message: string };
}) {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          input.log.push({ table, op: "select", payload: columns });
          return {
            eq(field: string, value: unknown) {
              input.log.push({ table, op: "eq", field, value });
              return {
                maybeSingle: async () => ({
                  data: input.submission ?? {
                    id: "11111111-1111-4111-8111-111111111111",
                    invoice_id: "22222222-2222-4222-8222-222222222222",
                    submitted_by: "resident-1",
                    proof_path: "payment-proofs/demo/proof.png",
                  },
                  error: null,
                }),
              };
            },
          };
        },
        insert(payload: unknown) {
          input.log.push({ table, op: "insert", payload });
          return Promise.resolve({ error: input.auditError ?? null });
        },
      };
    },
    storage: {
      from(bucket: string) {
        input.log.push({ table: "storage", op: "from", value: bucket });
        return {
          createSignedUrl(path: string, expiresInSeconds: number) {
            input.log.push({
              table: "storage",
              op: "createSignedUrl",
              payload: { path, expiresInSeconds },
            });
            return Promise.resolve({
              data: { signedUrl: `http://kong/storage/v1/object/sign/payment-proofs/${path}?token=abc` },
              error: null,
            });
          },
        };
      },
    },
  };
}

function buildRequest(submissionId = "11111111-1111-4111-8111-111111111111") {
  return new Request("http://edge.test/get-proof-signed-url", {
    method: "POST",
    headers: {
      Authorization: "Bearer token",
      "content-type": "application/json",
      "x-request-id": "req-proof-1",
    },
    body: JSON.stringify({ submissionId }),
  });
}

describe("payment proof signed URL contract", () => {
  it("authorizes with the proof-specific RPC and audits resident submitter access", async () => {
    const log: Operation[] = [];
    const harness = loadHandleGetProofSignedUrl({ id: "resident-1", role: "resident" });
    harness.setClients({
      userClient: createProofUserClientMock({ log, canAccessProof: true }),
      serviceClient: createProofServiceClientMock({ log }),
    });

    const response = await harness.handleGetProofSignedUrl(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ expiresInSeconds: 300 });
    expect(body.signedUrl).toContain("/storage/v1/object/sign/payment-proofs/demo/proof.png");
    expect(harness.requireRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: "resident-1", role: "resident" }),
      ["resident", "treasurer", "admin", "super_admin"],
    );
    expect(log).toContainEqual({
      table: "rpc",
      op: "can_access_payment_proof_submission",
      payload: { target_submission_id: "11111111-1111-4111-8111-111111111111" },
    });
    expect(log).not.toContainEqual(
      expect.objectContaining({ table: "payment_submissions", op: "select", payload: "id" }),
    );
    expect(log).toContainEqual({
      table: "audit_logs",
      op: "insert",
      payload: expect.objectContaining({
        actor_id: "resident-1",
        actor_role: "resident",
        action: "payment_submission.proof_signed_url",
        entity_table: "payment_submissions",
        entity_id: "11111111-1111-4111-8111-111111111111",
        after_data: expect.objectContaining({
          submission_id: "11111111-1111-4111-8111-111111111111",
          invoice_id: "22222222-2222-4222-8222-222222222222",
          access_scope: "submitter",
          expires_in_seconds: 300,
        }),
        request_id: "req-proof-1",
      }),
    });
  });

  it("denies non-submitter residents before creating storage URLs or audit rows", async () => {
    const log: Operation[] = [];
    const harness = loadHandleGetProofSignedUrl({ id: "co-resident-1", role: "resident" });
    harness.setClients({
      userClient: createProofUserClientMock({ log, canAccessProof: false }),
      serviceClient: createProofServiceClientMock({ log }),
    });

    await expect(harness.handleGetProofSignedUrl(buildRequest())).rejects.toMatchObject({
      status: 404,
      message: "Submission not found or not accessible",
    });
    expect(log).not.toContainEqual(expect.objectContaining({ table: "storage" }));
    expect(log).not.toContainEqual(expect.objectContaining({ table: "audit_logs" }));
  });

  it("audits active finance access separately from submitter access", async () => {
    const log: Operation[] = [];
    const harness = loadHandleGetProofSignedUrl({ id: "treasurer-1", role: "treasurer" });
    harness.setClients({
      userClient: createProofUserClientMock({ log, canAccessProof: true }),
      serviceClient: createProofServiceClientMock({ log }),
    });

    const response = await harness.handleGetProofSignedUrl(buildRequest());

    expect(response.status).toBe(200);
    expect(log).toContainEqual({
      table: "audit_logs",
      op: "insert",
      payload: expect.objectContaining({
        actor_id: "treasurer-1",
        actor_role: "treasurer",
        after_data: expect.objectContaining({
          access_scope: "finance",
        }),
      }),
    });
  });
});
