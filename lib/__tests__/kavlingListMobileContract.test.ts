import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("kavling list mobile layout contract", () => {
  it("renders compact mobile kavling cards while keeping the desktop table", () => {
    const source = readRepoFile("features/kavlings/KavlingListPage.tsx");

    expect(source).toContain('className="space-y-2 md:hidden"');
    expect(source).toContain('className="hidden overflow-x-auto md:block"');
    expect(source).toContain("Tanpa blok");
    expect(source).toContain("Urutan {item.sort_order}");
    expect(source).toContain("aria-label={`Edit kavling ${item.code}`}");
    expect(source).toContain("aria-label={`Nonaktifkan kavling ${item.code}`}");
  });
});
