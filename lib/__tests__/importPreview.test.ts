import { describe, expect, it } from "vitest";

import { buildImportPreview } from "@/lib/imports/importPreview";

describe("importPreview", () => {
  it("returns normalized kavling rows when input is valid", () => {
    const result = buildImportPreview({
      importType: "kavling",
      rows: [
        {
          code: " a-01 ",
          block: "A",
          sort_order: "2",
          active: "true",
          notes: "Depan taman",
        },
      ],
    });

    expect(result.rowCount).toBe(1);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.previewRows).toEqual([
      {
        code: "A-01",
        block: "A",
        sort_order: 2,
        active: true,
        notes: "Depan taman",
      },
    ]);
  });

  it("returns valid resident mapping rows", () => {
    const result = buildImportPreview({
      importType: "resident_mapping",
      rows: [
        {
          kavling_code: "B-02",
          resident_email: "warga@example.com",
          relation: "owner",
          is_primary: "1",
          active: "yes",
        },
      ],
    });

    expect(result.rowCount).toBe(1);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.previewRows[0]).toMatchObject({
      kavling_code: "B-02",
      resident_email: "warga@example.com",
      relation: "owner",
      is_primary: true,
      active: true,
    });
  });

  it("returns valid fee override rows", () => {
    const result = buildImportPreview({
      importType: "fee_override",
      rows: [
        {
          kavling_code: "C-03",
          fee_type_code: "IPL",
          amount: "125000",
          active_from: "2026-01-01",
          active_until: "2026-12-31",
          notes: "Penyesuaian renovasi",
        },
      ],
    });

    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.previewRows[0]).toMatchObject({
      kavling_code: "C-03",
      fee_type_code: "IPL",
      amount: 125000,
      active_from: "2026-01-01",
      active_until: "2026-12-31",
    });
  });

  it("returns Indonesian per-row errors for required and malformed fields", () => {
    const result = buildImportPreview({
      importType: "fee_override",
      rows: [
        {
          kavling_code: "",
          fee_type_code: "",
          amount: "bukan-angka",
          active_from: "2026-99-01",
          active_until: "abc",
          notes: "",
        },
      ],
    });

    expect(result.rowCount).toBe(1);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 1, field: "kavling_code", message: "Wajib diisi" }),
        expect.objectContaining({ rowNumber: 1, field: "fee_type_code", message: "Wajib diisi" }),
        expect.objectContaining({ rowNumber: 1, field: "amount" }),
        expect.objectContaining({ rowNumber: 1, field: "active_from" }),
      ]),
    );
  });

  it("flags duplicate keys with explicit row reasons", () => {
    const result = buildImportPreview({
      importType: "resident_mapping",
      rows: [
        {
          kavling_code: "A-01",
          resident_email: "sama@example.com",
          relation: "owner",
          is_primary: "true",
          active: "true",
        },
        {
          kavling_code: "A-01",
          resident_email: "sama@example.com",
          relation: "owner",
          is_primary: "false",
          active: "true",
        },
      ],
    });

    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 2,
          field: "kavling_code,resident_email",
          message: "Duplikat baris untuk kombinasi kavling dan resident",
        }),
      ]),
    );
  });

  it("enforces maximum preview rows", () => {
    const result = buildImportPreview({
      importType: "kavling",
      rows: [
        { code: "A-01", block: "A", sort_order: "1", active: "true", notes: "" },
        { code: "A-02", block: "A", sort_order: "2", active: "true", notes: "" },
      ],
      maxRows: 1,
    });

    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(2);
    expect(result.errors).toEqual([
      {
        rowNumber: 0,
        field: "rows",
        message: "Jumlah baris melebihi batas maksimum preview (1)",
      },
    ]);
  });
});
