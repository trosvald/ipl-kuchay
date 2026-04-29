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
  | "mapping.deactivate";

export interface AuditLogInput {
  action: AuditAction;
  entityTable: "kavlings" | "profiles" | "kavling_residents";
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  actorId?: string | null;
  actorRole?: AppRole | null;
  requestId?: string;
}
