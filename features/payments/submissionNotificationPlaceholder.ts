import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export interface SubmissionNotificationPlaceholderInput {
  submissionId: string;
  invoiceId: string;
  outcome: "approved" | "rejected";
}

/**
 * Notify resident and admin-like users about a payment submission review outcome.
 *
 * D-01, D-03: synchronous dispatch, non-blocking.
 * T-05-11: No proof URLs/files transmitted through Telegram.
 * T-05-14: Notification failure does NOT block the source-of-truth action.
 */
export async function notifySubmissionReviewed(
  input: SubmissionNotificationPlaceholderInput,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) return;

  const templateCode =
    input.outcome === "approved"
      ? "resident_payment_verified"
      : "resident_payment_rejected";

  // Dispatch to the send-telegram-notification Edge Function.
  // This is fire-and-forget: we don't await the result to avoid
  // blocking the payment verification workflow (T-05-14).
  client.functions
    .invoke("send-telegram-notification", {
      body: {
        template_code: templateCode,
        related_invoice_id: input.invoiceId,
        related_submission_id: input.submissionId,
      },
    })
    .catch(() => {
      // Silently swallow — delivery logging happens server-side
    });
}
