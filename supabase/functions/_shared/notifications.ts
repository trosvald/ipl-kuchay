/**
 * Shared notification helper module for IPL Jatiloka.
 *
 * Provides reusable contracts for:
 * - Template variable substitution with Indonesian body text
 * - Recipient eligibility checks (D-02, D-20)
 * - Delivery logging through SQL contracts
 * - Safe template rendering without unresolved placeholders
 */

import { createServiceRoleClient } from "./supabase.ts";

/**
 * Valid template codes (whitelist for T-05-09).
 */
export type NotificationTemplateCode =
  | "resident_invoice_created"
  | "resident_payment_pending"
  | "resident_payment_verified"
  | "resident_payment_rejected"
  | "resident_payment_reminder"
  | "admin_pending_submission"
  | "admin_monthly_summary";

export const VALID_TEMPLATE_CODES: NotificationTemplateCode[] = [
  "resident_invoice_created",
  "resident_payment_pending",
  "resident_payment_verified",
  "resident_payment_rejected",
  "resident_payment_reminder",
  "admin_pending_submission",
  "admin_monthly_summary",
];

/**
 * Template variable values for rendering.
 * All values are strings for substitution; optional keys are {string | undefined}.
 */
export interface TemplateVariables {
  name?: string;
  period_label?: string;
  kavling_code?: string;
  amount_due?: string;
  due_date?: string;
  status?: string;
  reason?: string;
  amount_submitted?: string;
  paid_count?: string;
  total_count?: string;
  total_paid?: string;
  total_unpaid?: string;
}

/**
 * Render a notification template by substituting {{var}} placeholders.
 * Unresolved placeholders are kept as-is (never silently removed).
 * Template keys are validated against the known set to prevent injection.
 */
export function renderTemplate(
  bodyTemplate: string,
  vars: TemplateVariables,
): string {
  let result = bodyTemplate;

  const knownKeys: (keyof TemplateVariables)[] = [
    "name",
    "period_label",
    "kavling_code",
    "amount_due",
    "due_date",
    "status",
    "reason",
    "amount_submitted",
    "paid_count",
    "total_count",
    "total_paid",
    "total_unpaid",
  ];

  for (const key of knownKeys) {
    const value = vars[key];
    if (value !== undefined) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
  }

  return result;
}

/**
 * Validate that a template code is whitelisted (T-05-09).
 */
export function isValidTemplateCode(code: string): code is NotificationTemplateCode {
  return VALID_TEMPLATE_CODES.includes(code as NotificationTemplateCode);
}

/**
 * Recipient record from the DB eligibility query.
 */
export interface EligibleRecipient {
  profile_id: string;
  telegram_chat_id: number;
  template_code: string;
  related_invoice_id?: string;
  related_submission_id?: string;
  template_vars?: Record<string, unknown>;
}

/**
 * Delivery result from sendTelegramNotification.
 */
export interface DeliveryResult {
  success: boolean;
  delivery_id?: string;
  telegram_message_id?: number;
  error?: string;
}

/**
 * Fetch a template by code from the database.
 */
export async function getTemplate(
  client: ReturnType<typeof createServiceRoleClient>,
  code: string,
): Promise<{ title: string; body_template: string } | null> {
  // @ts-expect-error Deno runtime compat — using any for typed client
  // deno-lint-ignore no-explicit-any
  const sb = client as any;

  const { data, error } = await sb
    .from("notification_templates")
    .select("title, body_template")
    .eq("code", code)
    .eq("active", true)
    .single();

  if (error || !data) {
    return null;
  }

  return { title: data.title, body_template: data.body_template };
}

/**
 * Fetch eligible recipients for a given template from the SQL contract.
 */
export async function getEligibleRecipients(
  client: ReturnType<typeof createServiceRoleClient>,
  templateCode: string,
): Promise<EligibleRecipient[]> {
  // @ts-expect-error Deno runtime compat
  // deno-lint-ignore no-explicit-any
  const sb = client as any;

  const { data, error } = await sb.rpc("get_linked_telegram_recipients", {
    p_template_code: templateCode,
  });

  if (error || !data) {
    return [];
  }

  return data as EligibleRecipient[];
}

/**
 * Log a delivery attempt through the SQL contract.
 */
export async function logDelivery(
  client: ReturnType<typeof createServiceRoleClient>,
  params: {
    templateCode: string;
    profileId: string;
    telegramChatId: number;
    status: "sent" | "failed";
    messageText: string;
    relatedInvoiceId?: string;
    relatedSubmissionId?: string;
    telegramMessageId?: number;
    errorMessage?: string;
  },
): Promise<string> {
  // @ts-expect-error Deno runtime compat
  // deno-lint-ignore no-explicit-any
  const sb = client as any;

  const { data, error } = await sb.rpc("log_notification_delivery", {
    p_template_code: params.templateCode,
    p_profile_id: params.profileId,
    p_telegram_chat_id: params.telegramChatId,
    p_status: params.status,
    p_message_text: params.messageText,
    p_related_invoice_id: params.relatedInvoiceId ?? null,
    p_related_submission_id: params.relatedSubmissionId ?? null,
    p_telegram_message_id: params.telegramMessageId ?? null,
    p_error_message: params.errorMessage ?? null,
  });

  if (error) {
    throw new Error(`Failed to log delivery: ${error.message}`);
  }

  return data as string;
}

/**
 * Fetch reminder recipients from the SQL selection contract.
 */
export async function getReminderRecipients(
  client: ReturnType<typeof createServiceRoleClient>,
): Promise<Array<{
  profile_id: string;
  telegram_chat_id: number;
  related_invoice_id: string;
  period_label: string;
  amount_due: number;
  due_date: string;
  kavling_code: string;
  resident_name: string;
  billing_period_month: number;
  billing_period_year: number;
  template_code: string;
}>> {
  // @ts-expect-error Deno runtime compat
  // deno-lint-ignore no-explicit-any
  const sb = client as any;

  const { data, error } = await sb.rpc("select_reminder_recipients");

  if (error || !data) {
    return [];
  }

  return data;
}
