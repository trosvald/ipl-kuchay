import type { AppRole } from "@/features/auth/AuthProvider";

export type AuditAction =
  | "kavling.create"
  | "kavling.update"
  | "kavling.deactivate"
  | "resident.create"
  | "resident.update"
  | "resident.deactivate"
  | "resident.role_change"
  | "mapping.create"
  | "mapping.update"
  | "mapping.deactivate"
  | "fee_type.create"
  | "fee_type.update"
  | "fee_type.activate"
  | "fee_type.deactivate"
  | "fee_override.create"
  | "fee_override.update"
  | "fee_override.end"
  | "billing_period.create"
  | "billing_period.generate_invoices"
  | "billing_period.apply_penalties"
  | "billing_period.status_open"
  | "billing_period.status_closed"
  | "billing_period.status_archived";

export type BillingPeriodStatusForAudit = "draft" | "open" | "closed" | "archived";

export function resolveBillingPeriodStatusAuditAction(status: BillingPeriodStatusForAudit): AuditAction {
  if (status === "open") {
    return "billing_period.status_open";
  }

  if (status === "closed") {
    return "billing_period.status_closed";
  }

  if (status === "archived") {
    return "billing_period.status_archived";
  }

  throw new Error(`Unsupported billing period status action: ${status}`);
}

export interface AuditLogInput {
  action: AuditAction;
  entityTable: "kavlings" | "profiles" | "kavling_residents" | "fee_types" | "kavling_fee_overrides" | "billing_periods";
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  actorId?: string | null;
  actorRole?: AppRole | null;
  requestId?: string;
}
