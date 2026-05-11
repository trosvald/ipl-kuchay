// @ts-expect-error Node TypeScript cannot resolve Deno URL imports in editor mode.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getCallerProfile, requireRole } from "../_shared/auth.ts";
import {
  HttpError,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/responses.ts";
import {
  createServiceRoleClient,
  createUserClient,
} from "../_shared/supabase.ts";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import {
  getPaymentEventRecipients,
  getTemplate,
  logDelivery,
  renderTemplate,
  type EligibleRecipient,
  type TemplateVariables,
} from "../_shared/notifications.ts";

interface AttachProofRequest {
  submissionId?: string;
  proofPath?: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface SubmissionRow {
  id: string;
  invoice_id: string;
  submitted_by: string;
  status: "submitted" | "verified" | "rejected" | "cancelled";
  proof_path: string | null;
}

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const mimeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const maxSizeBytes = 5 * 1024 * 1024;

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function parseRequest(request: Request): Promise<{
  submissionId: string;
  proofPath: string;
  mimeType: string;
  sizeBytes: number;
}> {
  let body: AttachProofRequest;

  try {
    body = (await request.json()) as AttachProofRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!isUuid(body.submissionId)) {
    throw new HttpError(400, "Invalid submissionId");
  }

  if (typeof body.proofPath !== "string" || body.proofPath.trim().length === 0) {
    throw new HttpError(400, "Invalid proofPath");
  }

  if (typeof body.mimeType !== "string" || !allowedMimeTypes.has(body.mimeType)) {
    throw new HttpError(400, "Unsupported proof MIME type");
  }

  if (!Number.isInteger(body.sizeBytes) || (body.sizeBytes ?? 0) <= 0) {
    throw new HttpError(400, "sizeBytes must be a positive integer");
  }

  if ((body.sizeBytes ?? 0) > maxSizeBytes) {
    throw new HttpError(400, "Proof file exceeds 5 MB limit");
  }

  const sizeBytes = body.sizeBytes;
  if (sizeBytes === undefined) {
    throw new HttpError(400, "sizeBytes is required");
  }

  return {
    submissionId: body.submissionId,
    proofPath: body.proofPath.trim(),
    mimeType: body.mimeType,
    sizeBytes,
  };
}

function buildExpectedProofPath(callerId: string, invoiceId: string, submissionId: string, mimeType: string): string {
  return `proofs/${callerId}/${invoiceId}/${submissionId}.${mimeToExtension[mimeType]}`;
}

function readMetadataString(metadata: unknown, keys: string[]): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

async function verifyProofObjectExists(input: {
  serviceClient: ReturnType<typeof createServiceRoleClient>;
  proofPath: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<void> {
  const pathSegments = input.proofPath.split("/");
  const fileName = pathSegments.pop();
  const directory = pathSegments.join("/");

  if (!fileName || directory.length === 0) {
    throw new HttpError(400, "Invalid proofPath");
  }

  const { data, error } = await input.serviceClient.storage
    .from("payment-proofs")
    .list(directory, {
      limit: 100,
      search: fileName,
    });

  if (error) {
    throw new HttpError(500, error.message);
  }

  const proofObject = data?.find((item) => item.name === fileName);
  if (!proofObject) {
    throw new HttpError(400, "Proof object not found");
  }

  const objectMimeType = readMetadataString(proofObject.metadata, ["mimetype", "mimeType", "contentType"]);
  const objectSizeBytes = Number(readMetadataString(proofObject.metadata, ["size"]));

  if (objectMimeType !== input.mimeType || !Number.isInteger(objectSizeBytes) || objectSizeBytes !== input.sizeBytes) {
    throw new HttpError(400, "Proof object metadata does not match request");
  }
}

async function notifyPendingSubmission(input: {
  serviceClient: ReturnType<typeof createServiceRoleClient>;
  submissionId: string;
}): Promise<void> {
  const templateCode = "admin_pending_submission";
  const template = await getTemplate(input.serviceClient, templateCode);
  if (!template) {
    return;
  }

  const recipients = await getPaymentEventRecipients(input.serviceClient, templateCode, input.submissionId);
  for (const recipient of recipients) {
    await sendNotificationToRecipient(input.serviceClient, templateCode, template.body_template, recipient);
  }
}

async function sendNotificationToRecipient(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  templateCode: string,
  bodyTemplate: string,
  recipient: EligibleRecipient,
): Promise<void> {
  const vars: TemplateVariables = recipient.template_vars as TemplateVariables ?? {};
  const messageText = renderTemplate(bodyTemplate, vars);

  try {
    const sendResult = await sendTelegramMessage(recipient.telegram_chat_id, messageText);

    await logDelivery(serviceClient, {
      templateCode,
      profileId: recipient.profile_id,
      telegramChatId: recipient.telegram_chat_id,
      status: sendResult.ok ? "sent" : "failed",
      messageText,
      relatedInvoiceId: recipient.related_invoice_id,
      relatedSubmissionId: recipient.related_submission_id,
      telegramMessageId: sendResult.message_id,
      errorMessage: sendResult.ok ? undefined : sendResult.error ?? "Unknown Telegram error",
    });
  } catch (error) {
    try {
      await logDelivery(serviceClient, {
        templateCode,
        profileId: recipient.profile_id,
        telegramChatId: recipient.telegram_chat_id,
        status: "failed",
        messageText,
        relatedInvoiceId: recipient.related_invoice_id,
        relatedSubmissionId: recipient.related_submission_id,
        errorMessage: String(error),
      });
    } catch {
      // Notification failure must not block proof metadata attachment.
    }
  }
}

async function handleAttachProof(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const serviceClient = createServiceRoleClient();

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["resident", "treasurer", "admin", "super_admin"]);

  const input = await parseRequest(request);

  const { data: accessibleSubmission, error: userReadError } = await userClient
    .from("payment_submissions")
    .select("id")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (userReadError) {
    throw new HttpError(400, userReadError.message);
  }

  if (!accessibleSubmission) {
    throw new HttpError(404, "Submission not found or not accessible");
  }

  const { data: submission, error: submissionError } = await serviceClient
    .from("payment_submissions")
    .select("id, invoice_id, submitted_by, status, proof_path")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (submissionError) {
    throw new HttpError(500, submissionError.message);
  }

  if (!submission) {
    throw new HttpError(404, "Submission not found");
  }

  const submissionRow = submission as SubmissionRow;

  if (submissionRow.submitted_by !== caller.id) {
    throw new HttpError(403, "Only submission owner can attach proof");
  }

  if (submissionRow.status !== "submitted") {
    throw new HttpError(400, "Submission is not in submitted status");
  }

  if (submissionRow.proof_path) {
    throw new HttpError(400, "Proof metadata already attached");
  }

  const expectedPath = buildExpectedProofPath(caller.id, submissionRow.invoice_id, submissionRow.id, input.mimeType);
  if (input.proofPath !== expectedPath) {
    throw new HttpError(400, "proofPath does not match expected pattern");
  }

  await verifyProofObjectExists({
    serviceClient,
    proofPath: input.proofPath,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const { error: updateError } = await serviceClient
    .from("payment_submissions")
    .update({
      proof_path: input.proofPath,
      proof_mime_type: input.mimeType,
      proof_size_bytes: input.sizeBytes,
    })
    .eq("id", input.submissionId);

  if (updateError) {
    throw new HttpError(500, updateError.message);
  }

  const { error: recalcError } = await serviceClient.rpc("recalculate_invoice_status", {
    target_invoice_id: submissionRow.invoice_id,
  });

  if (recalcError) {
    throw new HttpError(500, recalcError.message);
  }

  await notifyPendingSubmission({
    serviceClient,
    submissionId: submissionRow.id,
  }).catch(() => {});

  return jsonResponse(200, {
    success: true,
  });
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    return await handleAttachProof(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
