import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("kavling list mobile layout contract", () => {
  it("renders compact mobile kavling rows while keeping the desktop table", () => {
    const source = readRepoFile("features/kavlings/KavlingListPage.tsx");

    expect(source).toContain("CompactListRow");
    expect(source).toContain("ListContainer");
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("Tanpa blok");
    expect(source).toContain("Urutan {item.sort_order}");
    expect(source).toContain("Tambah Kavling");
    expect(source).toContain("Edit");
    expect(source).toContain("Nonaktifkan");
  });
});
