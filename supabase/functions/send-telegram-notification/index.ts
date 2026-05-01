// @ts-expect-error Node TypeScript cannot resolve Deno npm: specifiers in editor mode.
import { createServiceRoleClient, createUserClient } from "../_shared/supabase.ts";
import { jsonResponse, optionsResponse } from "../_shared/responses.ts";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import {
  renderTemplate,
  getTemplate,
  getEligibleRecipients,
  logDelivery,
  isValidTemplateCode,
  type TemplateVariables,
} from "../_shared/notifications.ts";

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

async function requireAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authentication required");
  }
  // Validate JWT via Supabase and return the authenticated user's ID
  const userClient = createUserClient(authHeader);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    throw new Error("Authentication required");
  }
  return user.id;
}

interface SendPayload {
  template_code: string;
  template_vars?: Record<string, string>;
  related_invoice_id?: string;
  related_submission_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    // Auth gate: require authenticated JWT
    await requireAuth(req);

    const body: SendPayload = await req.json();

    if (!body.template_code || !isValidTemplateCode(body.template_code)) {
      return jsonResponse(400, {
        error: "Invalid or missing template_code",
      });
    }

    const client = createServiceRoleClient();

    // 1. Fetch the template
    const template = await getTemplate(client, body.template_code);
    if (!template) {
      return jsonResponse(404, { error: "Template not found or inactive" });
    }

    // 2. Resolve eligible recipients from DB truth (T-05-08)
    const recipients = await getEligibleRecipients(client, body.template_code);

    if (recipients.length === 0) {
      return jsonResponse(200, {
        success: true,
        delivered: 0,
        message: "No eligible recipients",
      });
    }

    // 3. Build template variables (merge DB vars with override)
    const overrideVars: TemplateVariables = {};
    if (body.template_vars) {
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
            templateCode: body.template_code,
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "sent",
            messageText,
            relatedInvoiceId: body.related_invoice_id,
            relatedSubmissionId: body.related_submission_id,
            telegramMessageId: sendResult.message_id,
          });

          results.push({
            profile_id: recipient.profile_id,
            status: "sent",
            delivery_id: deliveryId,
          });
        } else {
          const deliveryId = await logDelivery(client, {
            templateCode: body.template_code,
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "failed",
            messageText,
            relatedInvoiceId: body.related_invoice_id,
            relatedSubmissionId: body.related_submission_id,
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
            templateCode: body.template_code,
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "failed",
            messageText: template.body_template,
            relatedInvoiceId: body.related_invoice_id,
            relatedSubmissionId: body.related_submission_id,
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
    if (err instanceof Error && err.message === "Authentication required") {
      return jsonResponse(401, { error: "Unauthorized" });
    }
    return jsonResponse(500, { error: String(err) });
  }
});
