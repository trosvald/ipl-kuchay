/**
 * Shared Telegram helper module for IPL Jatiloka.
 *
 * Provides reusable contracts for:
 * - Bot username lookup from env
 * - Telegram update / user / chat payload parsing
 * - Safe message sending primitives (no bot token leakage to browser)
 * - `link_` token extraction for deep-link consume flows
 *
 * No bot token is ever exposed to browser code.
 */

// Deno runtime note: this file uses Deno-compatible npm: specifiers.
import "npm:@supabase/supabase-js@2";

/**
 * Telegram Bot API endpoint base.
 * Token is read server-side only — never exposed to browser.
 */
function getTelegramApiUrl(): string {
  const denoEnv = "Deno" in globalThis
    ? (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
    : undefined;
  const botToken = denoEnv?.get?.("TELEGRAM_BOT_TOKEN");

  if (!botToken) {
    throw new Error("Missing required env: TELEGRAM_BOT_TOKEN");
  }

  return `https://api.telegram.org/bot${botToken}`;
}

/**
 * Telegram user object parsed from Bot API update.
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  username: string | null;
  first_name: string;
  last_name: string | null;
  language_code: string | null;
}

/**
 * Telegram chat object parsed from Bot API update.
 */
export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram update payload from webhook POST body.
 */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    from?: TelegramUser;
    chat?: TelegramChat;
    text?: string;
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
    }>;
  };
  edited_message?: unknown;
  channel_post?: unknown;
  edited_channel_post?: unknown;
}

/**
 * Extract the deep-link token from a Telegram /start command text.
 * Returns the plain token (without "link_" prefix) if found, or null.
 *
 * Examples:
 *   "/start link_abc123" → "abc123"
 *   "/startlink_abc123" → null
 *   "/help" → null
 */
export function extractLinkToken(commandText: string | null | undefined): string | null {
  if (!commandText) return null;

  // Normalize: find "start link_<token>" pattern
  // Bot API sends /start link_<token> where the whole string after /start is the parameter
  const trimmed = commandText.trim();

  if (trimmed === "/start" || trimmed === "/start ") {
    return null;
  }

  // Extract after "/start " (with space) or "/start"
  let tokenPart: string;
  if (trimmed.startsWith("/start ")) {
    tokenPart = trimmed.slice(7).trim(); // slice past "/start "
  } else if (trimmed.startsWith("/start")) {
    tokenPart = trimmed.slice(6).trim(); // slice past "/start"
  } else {
    return null;
  }

  if (!tokenPart.startsWith("link_")) {
    return null;
  }

  const token = tokenPart.slice(5); // strip "link_" prefix
  if (token.length === 0) {
    return null;
  }

  return token;
}

/**
 * Parse TelegramUser from an update message.
 */
export function parseTelegramUser(update: TelegramUpdate): TelegramUser | null {
  const msg = update.message;
  if (!msg?.from) return null;

  return {
    id: msg.from.id,
    is_bot: msg.from.is_bot ?? false,
    username: msg.from.username ?? null,
    first_name: msg.from.first_name ?? "",
    last_name: msg.from.last_name ?? null,
    language_code: msg.from.language_code ?? null,
  };
}

/**
 * Parse TelegramChat from an update message.
 */
export function parseTelegramChat(update: TelegramUpdate): TelegramChat | null {
  const msg = update.message;
  if (!msg?.chat) return null;

  return {
    id: msg.chat.id,
    type: msg.chat.type ?? "private",
    title: msg.chat.title,
    username: msg.chat.username,
    first_name: msg.chat.first_name,
    last_name: msg.chat.last_name,
  };
}

/**
 * Build the Telegram deep link URL for a given bot username and plain token.
 *
 * @param botUsername - The bot username (without @), e.g. "test_ipl_jatiloka_bot"
 * @param plainToken  - The plain link token (with "link_" prefix already included)
 */
export function buildDeepLinkUrl(botUsername: string, plainToken: string): string {
  return `https://t.me/${botUsername}?start=${plainToken}`;
}

/**
 * Send a text message to a Telegram chat via the Bot API.
 * All requests are server-side only — bot token never leaves the server.
 *
 * @param chatId    - The target Telegram chat ID
 * @param text     - Message text (max 4096 chars)
 * @param parseMode - Optional MarkdownV2 or HTML parse mode
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  parseMode: "MarkdownV2" | "HTML" | undefined = undefined,
): Promise<{ ok: boolean; message_id?: number; error?: string }> {
  const apiBase = getTelegramApiUrl();

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: text.slice(0, 4096), // Telegram max
  };

  if (parseMode) {
    body.parse_mode = parseMode;
  }

  try {
    const response = await fetch(`${apiBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

    if (!result.ok) {
      return { ok: false, error: result.description ?? "Unknown Telegram API error" };
    }

    return { ok: true, message_id: result.result?.message_id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Answer a Telegram deep-link /start parameter with a custom greeting
 * instead of the default "Start" bot response.
 *
 * Passing show_alert=false makes Telegram close the alert and show
 * only the command confirmation.
 */
export async function answerTelegramStart(
  startParameter: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiBase = getTelegramApiUrl();

  try {
    const response = await fetch(`${apiBase}/answerStartParam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_parameter: startParameter,
        is_background: false,
        allow_without_authentication: false,
      }),
    });

    const result = await response.json() as { ok: boolean; description?: string };

    if (!result.ok) {
      return { ok: false, error: result.description ?? "Unknown Telegram API error" };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
