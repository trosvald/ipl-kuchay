import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script, createContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type Operation = {
  table: string;
  op: string;
  payload?: unknown;
  field?: string;
  value?: unknown;
  values?: unknown[];
};

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function loadHandleCreateQris() {
  const source = readRepoFile("supabase/functions/create-qris-transaction/index.ts")
    .replace(
      'import { serve } from "https://deno.land/std@0.224.0/http/server.ts";',
      "const { serve } = globalThis.__mocks.deno;",
    )
    .replace(
      'import { getCallerProfile, requireRole } from "../_shared/auth.ts";',
      "const { getCallerProfile, requireRole } = globalThis.__mocks.auth;",
    )
    .replace(
      'import { createQrisCharge } from "../_shared/midtrans.ts";',
      "const { createQrisCharge } = globalThis.__mocks.midtrans;",
    )
    .replace(
      'import { HttpError, jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";',
      "const { HttpError, jsonResponse, methodNotAllowed, optionsResponse } = globalThis.__mocks.responses;",
    )
    .replace(
      'import { createServiceRoleClient, createUserClient } from "../_shared/supabase.ts";',
      "const { createServiceRoleClient, createUserClient } = globalThis.__mocks.supabase;",
    )
    .concat("\nglobalThis.__exports = { handleCreateQris };\n");

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

  const userRef: { current: ReturnType<typeof createQrisUserClientMock> | null } = { current: null };
  const serviceRef: { current: ReturnType<typeof createQrisServiceClientMock> | null } = { current: null };
  const createQrisCharge = vi.fn();

  Object.assign(context.globalThis as object, {
    __mocks: {
      deno: { serve: () => undefined },
      auth: {
        getCallerProfile: async () => ({ id: "resident-1", role: "resident" }),
        requireRole: () => undefined,
      },
      midtrans: {
        createQrisCharge,
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
    createQrisCharge,
    handleCreateQris: (context.globalThis as { __exports: { handleCreateQris: (request: Request) => Promise<Response> } }).__exports.handleCreateQris,
    setClients(input: {
      userClient: ReturnType<typeof createQrisUserClientMock>;
      serviceClient: ReturnType<typeof createQrisServiceClientMock>;
    }) {
      userRef.current = input.userClient;
      serviceRef.current = input.serviceClient;
    },
  };
}

function createQrisUserClientMock(input: { invoice: unknown }) {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(field: string, value: unknown) {
              return {
                maybeSingle: async () => {
                  void table;
                  void columns;
                  void field;
                  void value;
                  return { data: input.invoice, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

function createQrisServiceClientMock(input: {
  log: Operation[];
  gatewayConfig?: unknown;
  activeTransaction?: unknown;
  insertedRow?: unknown;
}) {
  return {
    rpc(fn: string) {
      input.log.push({ table: "rpc", op: fn });
      return Promise.resolve({ data: input.gatewayConfig ?? { qris_enabled: true }, error: null });
    },
    from(table: string) {
      return {
        select(columns: string) {
          input.log.push({ table, op: "select", payload: columns });
          return {
            eq(field: string, value: unknown) {
              input.log.push({ table, op: "eq", field, value });
              return {
                in(statusField: string, values: unknown[]) {
                  input.log.push({ table, op: "in", field: statusField, values });
                  return {
                    maybeSingle: async () => ({ data: input.activeTransaction ?? null, error: null }),
                  };
                },
              };
            },
          };
        },
        insert(payload: unknown) {
          input.log.push({ table, op: "insert", payload });
          return {
            select() {
              return {
                single: async () => ({ data: input.insertedRow ?? null, error: null }),
              };
            },
          };
        },
      };
    },
  };
}

describe("create QRIS transaction contract", () => {
  it("rejects QRIS creation when the server-side feature flag is disabled", async () => {
    const harness = loadHandleCreateQris();
    const log: Operation[] = [];
    harness.setClients({
      userClient: createQrisUserClientMock({
        invoice: {
          id: "44444444-4444-4444-8444-444444444444",
          amount_due: 100000,
          amount_paid: 0,
          status: "unpaid",
        },
      }),
      serviceClient: createQrisServiceClientMock({
        log,
        gatewayConfig: { qris_enabled: false },
      }),
    });

    await expect(
      harness.handleCreateQris(
        new Request("http://localhost/create-qris-transaction", {
          method: "POST",
          body: JSON.stringify({ invoiceId: "44444444-4444-4444-8444-444444444444" }),
        }),
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: "QRIS payment is disabled",
    });
    expect(harness.createQrisCharge).not.toHaveBeenCalled();
    expect(log).toEqual([expect.objectContaining({ table: "rpc", op: "get_resident_payment_gateway_config" })]);
  });

  it("blocks QRIS creation when an active transaction already exists", async () => {
    const harness = loadHandleCreateQris();
    const log: Operation[] = [];
    harness.setClients({
      userClient: createQrisUserClientMock({
        invoice: {
          id: "11111111-1111-4111-8111-111111111111",
          amount_due: 100000,
          amount_paid: 0,
          status: "unpaid",
        },
      }),
      serviceClient: createQrisServiceClientMock({
        log,
        activeTransaction: { id: "txn-1" },
      }),
    });

    await expect(
      harness.handleCreateQris(
        new Request("http://localhost/create-qris-transaction", {
          method: "POST",
          body: JSON.stringify({ invoiceId: "11111111-1111-4111-8111-111111111111" }),
        }),
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: "Invoice already has an active QRIS transaction",
    });
    expect(harness.createQrisCharge).not.toHaveBeenCalled();
    expect(log.some((entry) => entry.op === "insert")).toBe(false);
  });

  it("rejects invoices outside the QRIS-eligible status set", async () => {
    const harness = loadHandleCreateQris();
    harness.setClients({
      userClient: createQrisUserClientMock({
        invoice: {
          id: "22222222-2222-4222-8222-222222222222",
          amount_due: 100000,
          amount_paid: 0,
          status: "paid",
        },
      }),
      serviceClient: createQrisServiceClientMock({ log: [] }),
    });

    await expect(
      harness.handleCreateQris(
        new Request("http://localhost/create-qris-transaction", {
          method: "POST",
          body: JSON.stringify({ invoiceId: "22222222-2222-4222-8222-222222222222" }),
        }),
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: "Invoice is not eligible for QRIS payment",
    });
    expect(harness.createQrisCharge).not.toHaveBeenCalled();
  });

  it("creates an eligible QRIS transaction and maps the gateway response", async () => {
    const harness = loadHandleCreateQris();
    const log: Operation[] = [];
    harness.createQrisCharge.mockResolvedValue({
      transaction_status: "pending",
      transaction_id: "mid-1",
      payment_type: "qris",
      qr_string: "qr-content",
      actions: [{ name: "generate-qr-code", url: "https://midtrans.test/qr.png" }],
    });
    harness.setClients({
      userClient: createQrisUserClientMock({
        invoice: {
          id: "33333333-3333-4333-8333-333333333333",
          amount_due: 100000,
          amount_paid: 30000,
          status: "partial",
        },
      }),
      serviceClient: createQrisServiceClientMock({
        log,
        insertedRow: {
          id: "txn-2",
          provider_order_id: "IPL-QRIS-ORDER-1",
          status: "pending",
          payment_type: "qris",
          qr_string: "qr-content",
          qr_image_url: "https://midtrans.test/qr.png",
        },
      }),
    });

    const response = await harness.handleCreateQris(
      new Request("http://localhost/create-qris-transaction", {
        method: "POST",
        body: JSON.stringify({ invoiceId: "33333333-3333-4333-8333-333333333333" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      transactionId: "txn-2",
      providerOrderId: "IPL-QRIS-ORDER-1",
      status: "pending",
      paymentType: "qris",
      qrString: "qr-content",
      qrImageUrl: "https://midtrans.test/qr.png",
    });
    expect(harness.createQrisCharge).toHaveBeenCalledWith(
      expect.objectContaining({ grossAmount: 70000 }),
    );
    expect(log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "payment_gateway_transactions",
          op: "insert",
          payload: expect.objectContaining({
            invoice_id: "33333333-3333-4333-8333-333333333333",
            amount: 70000,
            status: "pending",
            provider_transaction_id: "mid-1",
            qr_string: "qr-content",
            qr_image_url: "https://midtrans.test/qr.png",
          }),
        }),
      ]),
    );
  });
});
