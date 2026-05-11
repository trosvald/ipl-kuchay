export type TelegramDispatchRole = "resident" | "treasurer" | "admin" | "super_admin";

export type TelegramDispatchTemplateCode =
  | "resident_invoice_created"
  | "resident_payment_pending"
  | "resident_payment_verified"
  | "resident_payment_rejected"
  | "resident_payment_reminder"
  | "admin_pending_submission"
  | "admin_monthly_summary"
  | "resident_announcement";

const paymentEventTemplateCodes = new Set<TelegramDispatchTemplateCode>([
  "admin_pending_submission",
  "resident_payment_pending",
  "resident_payment_verified",
  "resident_payment_rejected",
]);

const financeRoles = new Set<TelegramDispatchRole>(["treasurer", "admin", "super_admin"]);
const announcementRoles = new Set<TelegramDispatchRole>(["admin", "super_admin"]);

export function isPaymentEventTemplate(code: TelegramDispatchTemplateCode): boolean {
  return paymentEventTemplateCodes.has(code);
}

export function canDispatchTelegramTemplate(
  role: TelegramDispatchRole,
  templateCode: TelegramDispatchTemplateCode,
): boolean {
  if (isPaymentEventTemplate(templateCode)) {
    return financeRoles.has(role);
  }

  if (templateCode === "resident_announcement") {
    return announcementRoles.has(role);
  }

  return false;
}

export function acceptsClientTemplateVars(templateCode: TelegramDispatchTemplateCode): boolean {
  return !isPaymentEventTemplate(templateCode);
}
