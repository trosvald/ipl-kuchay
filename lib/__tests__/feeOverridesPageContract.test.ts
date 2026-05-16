import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("fee overrides page contract", () => {
  it("keeps kavling fee overrides deletable with confirmation and audit coverage", () => {
    const source = readRepoFile("features/settings/FeeOverridesPage.tsx");
    const auditTypes = readRepoFile("features/audit/auditTypes.ts");

    expect(source).toContain("Hapus override?");
    expect(source).toContain('<Trash2 className="size-4" /> Hapus');
    expect(source).toContain('.from("kavling_fee_overrides")');
    expect(source).toContain(".delete()");
    expect(source).toContain('.eq("id", row.id)');
    expect(source).toContain('action: "fee_override.delete"');
    expect(source).toContain("Akhiri Hari Ini");
    expect(auditTypes).toContain('"fee_override.delete"');
  });
});
