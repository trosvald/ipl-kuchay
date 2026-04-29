export interface SubmissionNotificationPlaceholderInput {
  submissionId: string;
  invoiceId: string;
  outcome: "approved" | "rejected";
}

export async function notifySubmissionReviewed(
  _input: SubmissionNotificationPlaceholderInput,
) {
  // Milestone 9 will implement the actual Telegram notification dispatch.
  return;
}
