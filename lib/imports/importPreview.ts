import { z, type ZodType } from "zod";

import {
  csvBooleanStringSchema,
  csvIntegerStringSchema,
  csvPositiveIntegerStringSchema,
  optionalIsoDateStringSchema,
  requiredStringSchema,
} from "../validation";
import type {
  BuildImportPreviewInput,
  FeeOverrideImportRow,
  ImportPreviewError,
  ImportPreviewResult,
  KavlingImportRow,
  PreviewRow,
  ResidentMappingImportRow,
} from "./importTypes";

const DEFAULT_MAX_ROWS = 5000;

const kavlingRowSchema = z.object({
  code: requiredStringSchema.transform((value) => value.toUpperCase()),
  block: z.string().trim().default(""),
  sort_order: csvIntegerStringSchema,
  active: csvBooleanStringSchema,
  notes: z.string().trim().default(""),
});

const residentMappingRowSchema = z.object({
  kavling_code: requiredStringSchema.transform((value) => value.toUpperCase()),
  resident_email: requiredStringSchema.transform((value) => value.toLowerCase()),
  relation: requiredStringSchema,
  is_primary: csvBooleanStringSchema,
  active: csvBooleanStringSchema,
});

const feeOverrideRowSchema = z
  .object({
    kavling_code: requiredStringSchema.transform((value) => value.toUpperCase()),
    fee_type_code: requiredStringSchema.transform((value) => value.toUpperCase()),
    amount: csvPositiveIntegerStringSchema,
    active_from: optionalIsoDateStringSchema.default(""),
    active_until: optionalIsoDateStringSchema.default(""),
    notes: z.string().trim().default(""),
  })
  .refine(
    (value) => {
      if (!value.active_from || !value.active_until) {
        return true;
      }

      return value.active_until >= value.active_from;
    },
    {
      path: ["active_until"],
      message: "Tanggal akhir harus sama atau setelah tanggal mulai",
    },
  );

function normalizeRawRow(row: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value ?? ""]));
}

function parseRow<T extends PreviewRow>(
  rowSchema: ZodType<T>,
  rowNumber: number,
  row: Record<string, string | undefined>,
): { parsed: T | null; errors: ImportPreviewError[] } {
  const result = rowSchema.safeParse(normalizeRawRow(row));
  if (result.success) {
    return { parsed: result.data, errors: [] };
  }

  return {
    parsed: null,
    errors: result.error.issues.map((issue) => ({
      rowNumber,
      field: issue.path.join(".") || "row",
      message: issue.message,
    })),
  };
}

function duplicateError(rowNumber: number, field: string, message: string): ImportPreviewError {
  return { rowNumber, field, message };
}

export function buildImportPreview(input: BuildImportPreviewInput): ImportPreviewResult {
  const { rows, importType, maxRows = DEFAULT_MAX_ROWS } = input;
  const rowCount = rows.length;

  if (rowCount > maxRows) {
    return {
      rowCount,
      validCount: 0,
      invalidCount: rowCount,
      errors: [
        {
          rowNumber: 0,
          field: "rows",
          message: `Jumlah baris melebihi batas maksimum preview (${maxRows})`,
        },
      ],
      previewRows: [],
    };
  }

  const errors: ImportPreviewError[] = [];
  const previewRows: PreviewRow[] = [];
  const invalidRows = new Set<number>();

  const seenResidentMappings = new Set<string>();
  const seenKavlingCodes = new Set<string>();
  const seenFeeOverrides = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    if (importType === "kavling") {
      const parsed = parseRow(kavlingRowSchema, rowNumber, row);
      if (parsed.errors.length > 0 || parsed.parsed === null) {
        parsed.errors.forEach((error) => errors.push(error));
        invalidRows.add(rowNumber);
        return;
      }

      if (seenKavlingCodes.has(parsed.parsed.code)) {
        errors.push(duplicateError(rowNumber, "code", "Duplikat kode kavling"));
        invalidRows.add(rowNumber);
        return;
      }

      seenKavlingCodes.add(parsed.parsed.code);
      previewRows.push(parsed.parsed as KavlingImportRow);
      return;
    }

    if (importType === "resident_mapping") {
      const parsed = parseRow(residentMappingRowSchema, rowNumber, row);
      if (parsed.errors.length > 0 || parsed.parsed === null) {
        parsed.errors.forEach((error) => errors.push(error));
        invalidRows.add(rowNumber);
        return;
      }

      const dedupeKey = `${parsed.parsed.kavling_code}::${parsed.parsed.resident_email}`;
      if (seenResidentMappings.has(dedupeKey)) {
        errors.push(
          duplicateError(
            rowNumber,
            "kavling_code,resident_email",
            "Duplikat baris untuk kombinasi kavling dan resident",
          ),
        );
        invalidRows.add(rowNumber);
        return;
      }

      seenResidentMappings.add(dedupeKey);
      previewRows.push(parsed.parsed as ResidentMappingImportRow);
      return;
    }

    const parsed = parseRow(feeOverrideRowSchema, rowNumber, row);
    if (parsed.errors.length > 0 || parsed.parsed === null) {
      parsed.errors.forEach((error) => errors.push(error));
      invalidRows.add(rowNumber);
      return;
    }

    const dedupeKey = `${parsed.parsed.kavling_code}::${parsed.parsed.fee_type_code}::${parsed.parsed.active_from}`;
    if (seenFeeOverrides.has(dedupeKey)) {
      errors.push(
        duplicateError(
          rowNumber,
          "kavling_code,fee_type_code,active_from",
          "Duplikat baris override untuk kombinasi kavling, jenis iuran, dan tanggal mulai",
        ),
      );
      invalidRows.add(rowNumber);
      return;
    }

    seenFeeOverrides.add(dedupeKey);
    previewRows.push(parsed.parsed as FeeOverrideImportRow);
  });

  return {
    rowCount,
    validCount: previewRows.length,
    invalidCount: invalidRows.size,
    errors,
    previewRows,
  };
}
