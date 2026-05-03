export type ImportType = "kavling" | "resident_mapping" | "fee_override";

export type RawImportRow = Record<string, string | undefined>;

export interface KavlingImportRow {
  code: string;
  block: string;
  sort_order: number;
  active: boolean;
  notes: string;
}

export interface ResidentMappingImportRow {
  kavling_code: string;
  resident_email: string;
  relation: string;
  is_primary: boolean;
  active: boolean;
}

export interface FeeOverrideImportRow {
  kavling_code: string;
  fee_type_code: string;
  amount: number;
  active_from: string;
  active_until: string;
  notes: string;
}

export type PreviewRow = KavlingImportRow | ResidentMappingImportRow | FeeOverrideImportRow;

export interface ImportPreviewError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ImportPreviewResult {
  rowCount: number;
  validCount: number;
  invalidCount: number;
  errors: ImportPreviewError[];
  previewRows: PreviewRow[];
}

export interface BuildImportPreviewInput {
  importType: ImportType;
  rows: RawImportRow[];
  maxRows?: number;
}
