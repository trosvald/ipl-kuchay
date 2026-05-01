// @ts-expect-error Node TypeScript cannot resolve Deno npm: specifiers in editor mode.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";
import {
  extractLinkToken,
  parseTelegramUser,
  parseTelegramChat,
  sendTelegramMessage,
  TelegramUpdate,
} from "../_shared/telegram.ts";

// Deno runtime: uses npm: specifiers and reads env via Deno.env.
// This is the only public Telegram entry point — verify_jwt = false.

const TELEGRAM_WEBHOOK_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

/**
 * Validate the Telegram secret token.
 * Throws if missing or incorrect.
 */
function requireTelegramSecret(request: Request): string {
  const denoEnv = "Deno" in globalThis
    ? (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
    : undefined;
  const expectedSecret = denoEnv?.get?.("TELEGRAM_WEBHOOK_SECRET");

  if (!expectedSecret) {
    throw new Error("Missing required env: TELEGRAM_WEBHOOK_SECRET");
  }

  const receivedSecret = request.headers.get(TELEGRAM_WEBHOOK_SECRET_HEADER);

  if (!receivedSecret) {
    throw new Error("Missing X-Telegram-Bot-Api-Secret-Token header");
  }

  if (receivedSecret !== expectedSecret) {
    throw new Error("Invalid X-Telegram-Bot-Api-Secret-Token");
  }

  return receivedSecret;
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  // Telegram webhook: POST only
  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  let secret: string;
  try {
    secret = requireTelegramSecret(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    // Return generic 401 to avoid leaking secret validation details
    return jsonResponse(401, { error: "Unauthorized" });
  }

  // Parse the Telegram update body
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  // Extract the /start link_<token> command
  const messageText = update.message?.text ?? null;
  const linkToken = extractLinkToken(messageText);

  // If no link token found, this is not a deep-link /start command.
  // Send generic welcome — do not reveal internal state.
  if (!linkToken) {
    // Acknowledge with 200 to Telegram regardless (it will retry otherwise)
    // D-10: unlinked users receive guidance
    const welcomeMessage = "Selamat datang di IPL Jatiloka Residence! Gunakan /help untuk melihat daftar perintah yang tersedia.";
    const chat = parseTelegramChat(update);
    if (chat) {
      await sendTelegramMessage(chat.id, welcomeMessage);
    }
    return jsonResponse(200, { ok: true });
  }

  // Parse Telegram identity from the update
  const telegramUser = parseTelegramUser(update);
  const telegramChat = parseTelegramChat(update);

  if (!telegramUser || !telegramChat) {
    // Could not parse user/chat — send generic failure (do not leak details)
    if (telegramChat) {
      await sendTelegramMessage(
        telegramChat.id,
        "Terjadi kesalahan saat memproses tautan. Silakan coba lagi atau hubungi pengurus.",
      );
    }
    return jsonResponse(200, { ok: false, error: "Parse error" });
  }

  // Call the consume SQL contract
  const adminClient = createServiceRoleClient();

  const { data, error: rpcError } = await adminClient.rpc("consume_telegram_link_token", {
    p_plain_token: linkToken,
    p_telegram_user_id: telegramUser.id,
    p_telegram_chat_id: telegramChat.id,
    p_username: telegramUser.username ?? null,
    p_first_name: telegramUser.first_name,
    p_last_name: telegramUser.last_name ?? null,
    p_language_code: telegramUser.language_code ?? null,
  });

  const result = (Array.isArray(data) ? data[0] : data) as { success: boolean; error?: string } | null;

  // Determine reply based on consume result
  if (result?.success) {
    // D-11: success copy
    const successMessage =
      "Akun Telegram kamu sudah terhubung dengan IPL Jatiloka. Gunakan /status untuk cek tagihan atau /help untuk daftar perintah.";
    await sendTelegramMessage(telegramChat.id, successMessage);
  } else if (result?.error) {
    // D-18 or expired/replay error — safe user-facing copy
    // Do not leak whether token was expired, replayed, or conflicted
    const errorMessage =
      result.error ??
      "Terjadi kesalahan saat memproses tautan. Silakan coba lagi atau hubungi pengurus.";
    await sendTelegramMessage(telegramChat.id, errorMessage);
  } else {
    // Unexpected error
    await sendTelegramMessage(
      telegramChat.id,
      "Terjadi kesalahan saat memproses tautan. Silakan coba lagi atau hubungi pengurus.",
    );
  }

  // Always return 200 to Telegram (prevents retries for expected cases)
  return jsonResponse(200, { ok: true });
});
