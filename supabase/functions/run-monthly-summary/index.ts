// @ts-expect-error Node TypeScript cannot resolve Deno npm: specifiers in editor mode.
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { jsonResponse, optionsResponse } from "../_shared/responses.ts";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import {
  renderTemplate,
  getTemplate,
  logDelivery,
} from "../_shared/notifications.ts";

/**
 * run-monthly-summary
 *
 * Scheduled Edge Function invoked by pg_cron on the 1st of each month (D-06).
 * Secret-gated via APP_INTERNAL_CRON_SECRET (T-05-13).
 *
 * Queries linked admin-like profiles (admin, super_admin, treasurer)
 * and sends a monthly billing summary snapshot.
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

interface AdminRecipient {
  profile_id: string;
  telegram_chat_id: number;
}

interface InvoiceSummaryRow {
  status: string;
  amount_due: number | null;
  amount_paid: number | null;
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

    // 1. Fetch the monthly summary template
    const template = await getTemplate(client, "admin_monthly_summary");
    if (!template) {
      return jsonResponse(500, { error: "Monthly summary template not found" });
    }

    // 2. Aggregate billing stats for the current open period
    // @ts-expect-error Deno runtime compat
    // deno-lint-ignore no-explicit-any
    const sb = client as any;

    const { data: periodData, error: periodError } = await sb
      .from("billing_periods")
      .select("id, label, month, year")
      .eq("status", "open")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1)
      .single();

    if (periodError || !periodData) {
      return jsonResponse(200, {
        success: true,
        message: "No open billing period — summary skipped",
      });
    }

    // 3. Count paid vs total invoices for this period
    const { data: invoices, error: invoicesError } = await sb
      .from("invoices")
      .select("status, amount_due, amount_paid")
      .eq("billing_period_id", periodData.id);

    if (invoicesError) {
      return jsonResponse(500, { error: invoicesError.message });
    }

    const invoiceRows = (invoices ?? []) as InvoiceSummaryRow[];
    const totalCount = invoiceRows.length;
    const paidCount = invoiceRows.filter((row) => row.status === "paid").length;
    const totalPaid = invoiceRows.reduce(
      (sum, row) => sum + (row.amount_paid ?? 0),
      0,
    );
    const totalUnpaid = invoiceRows
      .filter((row) => ["unpaid", "overdue", "partial"].includes(row.status))
      .reduce(
        (sum, row) => sum + Math.max((row.amount_due ?? 0) - (row.amount_paid ?? 0), 0),
        0,
      );

    // 4. Get admin-like linked Telegram recipients through the preference-aware RPC.
    const { data: adminRecipients, error: adminError } = await sb
      .rpc("get_linked_telegram_recipients", {
        p_template_code: "admin_monthly_summary",
      });

    if (adminError || !adminRecipients || adminRecipients.length === 0) {
      return jsonResponse(200, {
        success: true,
        message: "No admin-like Telegram recipients to send summary",
      });
    }

    const filteredRecipients = adminRecipients as AdminRecipient[];

    // 6. Send summary to each admin-like recipient
    const messageText = renderTemplate(template.body_template, {
      period_label: periodData.label,
      paid_count: String(paidCount || 0),
      total_count: String(totalCount || 0),
      total_paid: `Rp ${totalPaid.toLocaleString("id-ID")}`,
      total_unpaid: `Rp ${totalUnpaid.toLocaleString("id-ID")}`,
    });

    let sent = 0;
    let failed = 0;

    for (const recipient of filteredRecipients) {
      try {
        const sendResult = await sendTelegramMessage(
          recipient.telegram_chat_id,
          messageText,
        );

        if (sendResult.ok) {
          await logDelivery(client, {
            templateCode: "admin_monthly_summary",
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "sent",
            messageText,
            telegramMessageId: sendResult.message_id,
          });
          sent++;
        } else {
          await logDelivery(client, {
            templateCode: "admin_monthly_summary",
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "failed",
            messageText,
            errorMessage: sendResult.error ?? "Unknown Telegram error",
          });
          failed++;
        }
      } catch (err) {
        try {
          await logDelivery(client, {
            templateCode: "admin_monthly_summary",
            profileId: recipient.profile_id,
            telegramChatId: recipient.telegram_chat_id,
            status: "failed",
            messageText,
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
      total: filteredRecipients.length,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized: invalid internal secret") {
      return jsonResponse(401, { error: "Unauthorized" });
    }
    return jsonResponse(500, { error: String(err) });
  }
});
