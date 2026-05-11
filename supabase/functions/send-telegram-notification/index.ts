// @ts-expect-error Node TypeScript cannot resolve Deno npm: specifiers in editor mode.
import { createServiceRoleClient, createUserClient } from "../_shared/supabase.ts";
import { getCallerProfile, type AppRole } from "../_shared/auth.ts";
import {
  HttpError,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/responses.ts";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import {
  renderTemplate,
  getTemplate,
  getEligibleRecipients,
  getPaymentEventRecipients,
  logDelivery,
  isValidTemplateCode,
  type EligibleRecipient,
  type NotificationTemplateCode,
  type TemplateVariables,
} from "../_shared/notifications.ts";
import {
  acceptsClientTemplateVars,
  canDispatchTelegramTemplate,
  isPaymentEventTemplate,
} from "../../../lib/telegramNotificationDispatchPolicy.ts";

/**
 * send-telegram-notification
 *
 * Synchronous Telegram dispatch endpoint (D-01, D-02, D-03).
 * Called by upstream events (payment review, announcement publish)
 * to push one notification to all eligible linked residents.
 *
 * Accepts:
 *   - template_code: whitelisted template code
 *   - template_vars: optional overrides for template variables
 *   - related_invoice_id: optional, for audit linkage
 *   - related_submission_id: optional, for audit linkage
 *
 * No bot token or proof URLs ever reach browser code (T-05-11).
 * Delivery failure does NOT block the caller — status is logged (T-05-14).
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendPayload {
  template_code: string;
  template_vars?: Record<string, string>;
  related_invoice_id?: string;
  related_submission_id?: string;
}

function assertDispatchAllowed(
  callerRole: AppRole,
  templateCode: NotificationTemplateCode,
  body: SendPayload,
): void {
  if (!canDispatchTelegramTemplate(callerRole, templateCode)) {
    throw new HttpError(403, "Forbidden");
  }

  if (isPaymentEventTemplate(templateCode)) {
    if (!body.related_submission_id) {
      throw new HttpError(400, "related_submission_id is required");
    }

    if (!acceptsClientTemplateVars(templateCode) && body.template_vars) {
      throw new HttpError(400, "template_vars are not accepted for payment event templates");
    }

    return;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const userClient = createUserClient(req.headers.get("Authorization"));
    const caller = await getCallerProfile(req, userClient);

    const body: SendPayload = await req.json();

    if (!body.template_code || !isValidTemplateCode(body.template_code)) {
      return jsonResponse(400, {
        error: "Invalid or missing template_code",
      });
    }

    const templateCode = body.template_code;
    assertDispatchAllowed(caller.role, templateCode, body);

    const client = createServiceRoleClient();

    // 1. Fetch the template
    const template = await getTemplate(client, templateCode);
    if (!template) {
      return jsonResponse(404, { error: "Template not found or inactive" });
    }

    // 2. Resolve eligible recipients from DB truth (T-05-08)
    const recipients: EligibleRecipient[] = isPaymentEventTemplate(templateCode)
      ? await getPaymentEventRecipients(client, templateCode, body.related_submission_id as string)
      : await getEligibleRecipients(client, templateCode);

    if (recipients.length === 0) {
      return jsonResponse(200, {
        success: true,
        delivered: 0,
        message: "No eligible recipients",
      });
    }

    // 3. Build template variables (merge DB vars with override)
    const overrideVars: TemplateVariables = {};
    if (!isPaymentEventTemplate(templateCode) && body.template_vars) {
      for (const [key, value] of Object.entries(body.template_vars)) {
        (overrideVars as Record<string, string>)[key] = value;
      }
    }

    // 4. Send to each recipient — non-blocking (D-03, T-05-14)
    const results: Array<{
      profile_id: string;
      status: "sent" | "failed";
      delivery_id?: string;
      error?: string;
    }> = [];

    for (const recipient of recipients) {
      try {
        // Merge recipient template_vars with override
        const vars: TemplateVariables = {
          ...(recipient.template_vars as unknown as TemplateVariables ?? {}),
          ...overrideVars,
        };

        const messageText = renderTemplate(template.body_template, vars);

        // Send via Telegram Bot API (T-05-11: no proof URLs)
        const sendResult = await sendTelegramMessage(
          recipient.telegram_chat_id,
          messageText,
        );

        if (sendResult.ok) {
          const deliveryId = await logDelivery(client, {
            templateCode,
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "sent",
            messageText,
            relatedInvoiceId: recipient.related_invoice_id ?? body.related_invoice_id,
            relatedSubmissionId: recipient.related_submission_id ?? body.related_submission_id,
            telegramMessageId: sendResult.message_id,
          });

          results.push({
            profile_id: recipient.profile_id,
            status: "sent",
            delivery_id: deliveryId,
          });
        } else {
          const deliveryId = await logDelivery(client, {
            templateCode,
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "failed",
            messageText,
            relatedInvoiceId: recipient.related_invoice_id ?? body.related_invoice_id,
            relatedSubmissionId: recipient.related_submission_id ?? body.related_submission_id,
            errorMessage: sendResult.error ?? "Unknown Telegram error",
          });

          results.push({
            profile_id: recipient.profile_id,
            status: "failed",
            delivery_id: deliveryId,
            error: sendResult.error,
          });
        }
      } catch (err) {
        // Catch-and-log: never throw to upstream (T-05-14)
        try {
          await logDelivery(client, {
            templateCode,
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "failed",
            messageText: template.body_template,
            relatedInvoiceId: recipient.related_invoice_id ?? body.related_invoice_id,
            relatedSubmissionId: recipient.related_submission_id ?? body.related_submission_id,
            errorMessage: String(err),
          });
        } catch {
          // Even logging failed — still don't throw
        }
        results.push({
          profile_id: recipient.profile_id,
          status: "failed",
          error: String(err),
        });
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;

    return jsonResponse(200, {
      success: true,
      delivered: sentCount,
      total: results.length,
      results,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.status, { error: err.message });
    }
    return jsonResponse(500, { error: String(err) });
  }
});
