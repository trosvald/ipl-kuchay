// @ts-expect-error Node TypeScript cannot resolve Deno npm: specifiers in editor mode.
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { jsonResponse, optionsResponse } from "../_shared/responses.ts";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import {
  renderTemplate,
  getTemplate,
  getReminderRecipients,
  logDelivery,
} from "../_shared/notifications.ts";

/**
 * run-scheduled-reminders
 *
 * Scheduled Edge Function invoked by pg_cron daily at 07:00 WIB (D-04).
 * Secret-gated via APP_INTERNAL_CRON_SECRET (T-05-13).
 *
 * Queries select_reminder_recipients() for unpaid/overdue invoices
 * with Telegram-linked, opted-in residents (D-02, D-20).
 * Deduplication is enforced in SQL (D-05).
 * Delivery failure is logged, never retried (D-12, T-05-12).
 */

function requireSecret(req: Request): void {
  const denoEnv = "Deno" in globalThis
    ? (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
    : undefined;
  const expected = denoEnv?.get?.("APP_INTERNAL_CRON_SECRET");

  if (!expected) {
    throw new Error("APP_INTERNAL_CRON_SECRET not configured");
  }

  const provided = req.headers.get("x-internal-secret");
  if (provided !== expected) {
    throw new Error("Unauthorized: invalid internal secret");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    // T-05-13: require internal secret
    requireSecret(req);

    const client = createServiceRoleClient();

    // 1. Fetch the reminder template
    const template = await getTemplate(client, "resident_payment_reminder");
    if (!template) {
      return jsonResponse(500, { error: "Reminder template not found" });
    }

    // 2. Get eligible reminder recipients from SQL contract (D-04, D-05)
    const recipients = await getReminderRecipients(client);

    if (recipients.length === 0) {
      return jsonResponse(200, {
        success: true,
        delivered: 0,
        message: "No reminders to send",
      });
    }

    // 3. Send reminders — non-blocking, no retries (D-03, T-05-12)
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        const messageText = renderTemplate(template.body_template, {
          name: recipient.resident_name,
          period_label: recipient.period_label,
          kavling_code: recipient.kavling_code,
          amount_due: `Rp ${recipient.amount_due.toLocaleString("id-ID")}`,
          due_date: recipient.due_date,
          status: "belum lunas",
        });

        const sendResult = await sendTelegramMessage(
          recipient.telegram_chat_id,
          messageText,
        );

        if (sendResult.ok) {
          await logDelivery(client, {
            templateCode: "resident_payment_reminder",
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "sent",
            messageText,
            relatedInvoiceId: recipient.related_invoice_id,
            telegramMessageId: sendResult.message_id,
          });
          sent++;
        } else {
          await logDelivery(client, {
            templateCode: "resident_payment_reminder",
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "failed",
            messageText,
            relatedInvoiceId: recipient.related_invoice_id,
            errorMessage: sendResult.error ?? "Unknown Telegram error",
          });
          failed++;
        }
      } catch (err) {
        // T-05-14: catch and log, never throw
        try {
          await logDelivery(client, {
            templateCode: "resident_payment_reminder",
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "failed",
            messageText: template.body_template,
            relatedInvoiceId: recipient.related_invoice_id,
            errorMessage: String(err),
          });
        } catch {
          // logging failure itself is already a failure
        }
        failed++;
      }
    }

    return jsonResponse(200, {
      success: true,
      delivered: sent,
      failed,
      total: recipients.length,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized: invalid internal secret") {
      return jsonResponse(401, { error: "Unauthorized" });
    }
    return jsonResponse(500, { error: String(err) });
  }
});
