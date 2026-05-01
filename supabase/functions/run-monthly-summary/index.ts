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

interface MonthlyStats {
  period_label: string;
  paid_count: number;
  total_count: number;
  total_paid: number;
  total_unpaid: number;
}

interface AdminRecipient {
  profile_id: string;
  telegram_chat_id: number;
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
      .select("label, month, year")
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
      .eq("billing_period_id", (await sb
        .from("billing_periods")
        .select("id")
        .eq("month", periodData.month)
        .eq("year", periodData.year)
        .limit(1)
        .single()).data?.id);

    // Simpler approach: use raw count queries
    const { count: totalCount } = await sb
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("billing_period_id", (
        await sb.from("billing_periods")
          .select("id")
          .eq("month", periodData.month)
          .eq("year", periodData.year)
          .limit(1)
          .single()
      ).data?.id);

    const { count: paidCount } = await sb
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("billing_period_id", (
        await sb.from("billing_periods")
          .select("id")
          .eq("month", periodData.month)
          .eq("year", periodData.year)
          .limit(1)
          .single()
      ).data?.id)
      .eq("status", "paid");

    const { data: totalPaidData } = await sb
      .from("invoices")
      .select("amount_paid")
      .eq("billing_period_id", (
        await sb.from("billing_periods")
          .select("id")
          .eq("month", periodData.month)
          .eq("year", periodData.year)
          .limit(1)
          .single()
      ).data?.id);

    const totalPaid = totalPaidData?.reduce(
      (sum: number, row: { amount_paid: number }) => sum + (row.amount_paid || 0),
      0,
    ) || 0;

    const { data: totalUnpaidData } = await sb
      .from("invoices")
      .select("amount_due")
      .eq("billing_period_id", (
        await sb.from("billing_periods")
          .select("id")
          .eq("month", periodData.month)
          .eq("year", periodData.year)
          .limit(1)
          .single()
      ).data?.id)
      .in("status", ["unpaid", "overdue", "partial"]);

    const totalUnpaid = totalUnpaidData?.reduce(
      (sum: number, row: { amount_due: number }) => sum + (row.amount_due || 0),
      0,
    ) || 0;

    // 4. Get Admin-like linked Telegram recipients
    const { data: adminRecipients, error: adminError } = await sb
      .from("telegram_accounts")
      .select("profile_id, telegram_chat_id")
      .eq("allows_notifications", true);

    if (adminError || !adminRecipients || adminRecipients.length === 0) {
      return jsonResponse(200, {
        success: true,
        message: "No admin-like Telegram recipients to send summary",
      });
    }

    // 5. Filter to admin-like roles only
    const profileIds = adminRecipients.map((r: AdminRecipient) => r.profile_id);
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, role")
      .in("id", profileIds)
      .in("role", ["admin", "super_admin", "treasurer"])
      .eq("is_active", true);

    if (!profiles || profiles.length === 0) {
      return jsonResponse(200, {
        success: true,
        message: "No active admin-like Telegram accounts",
      });
    }

    const adminIds = new Set(profiles.map((p: { id: string }) => p.id));
    const filteredRecipients = adminRecipients.filter(
      (r: AdminRecipient) => adminIds.has(r.profile_id),
    );

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
