import type { AuditLogInput } from "@/features/audit/auditTypes";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export async function writeAuditLog(payload: AuditLogInput) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase client tidak tersedia untuk audit log.");
  }

  const { error } = await client.rpc("log_admin_action", {
    action_name: payload.action,
    target_entity_table: payload.entityTable,
    target_entity_id: payload.entityId,
    previous_data: payload.beforeData ?? null,
    next_data: payload.afterData ?? null,
    source_request_id: payload.requestId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}
