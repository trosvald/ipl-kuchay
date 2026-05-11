import type { AuditLogInput } from "@/features/audit/auditTypes";
import { writeAuditLog } from "@/features/audit/writeAuditLog";
import { downloadCsv } from "@/features/reports/reportCsv";

export type FinanceCsvExportType = "collection_summary" | "arrears";

interface AuditedFinanceCsvInput {
  csvContent: string;
  filename: string;
  exportType: FinanceCsvExportType;
  billingPeriodId: string;
  billingPeriodLabel: string;
  rowCount: number;
}

interface AuditedFinanceCsvDeps {
  writeAuditLog: (payload: AuditLogInput) => Promise<void>;
  downloadCsv: (csvContent: string, filename: string) => void;
}

export async function downloadAuditedFinanceCsv(
  input: AuditedFinanceCsvInput,
  deps: AuditedFinanceCsvDeps = { writeAuditLog, downloadCsv },
): Promise<void> {
  await deps.writeAuditLog({
    action: "report.export_csv",
    entityTable: "reports",
    entityId: input.billingPeriodId,
    afterData: {
      export_type: input.exportType,
      billing_period_id: input.billingPeriodId,
      billing_period_label: input.billingPeriodLabel,
      filename: input.filename,
      row_count: input.rowCount,
    },
  });

  deps.downloadCsv(input.csvContent, input.filename);
}
