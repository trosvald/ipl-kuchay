import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeAuditLog } from "@/features/audit/writeAuditLog";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

const mockedGetClient = vi.mocked(getSupabaseBrowserClient);

describe("writeAuditLog", () => {
  beforeEach(() => {
    mockedGetClient.mockReset();
  });

  it("throws when the browser Supabase client is unavailable", async () => {
    mockedGetClient.mockReturnValue(null);

    await expect(
      writeAuditLog({
        action: "report.export_csv",
        entityTable: "reports",
        entityId: "period-1",
      }),
    ).rejects.toThrow("Supabase client tidak tersedia");
  });

  it("throws when the audit RPC fails", async () => {
    mockedGetClient.mockReturnValue({
      rpc: vi.fn(async () => ({ error: { message: "audit insert failed" } })),
    } as never);

    await expect(
      writeAuditLog({
        action: "report.export_csv",
        entityTable: "reports",
        entityId: "period-1",
      }),
    ).rejects.toThrow("audit insert failed");
  });
});
