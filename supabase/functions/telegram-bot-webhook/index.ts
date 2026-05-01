// @ts-expect-error Node TypeScript cannot resolve Deno npm: specifiers in editor mode.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";
import {
  extractLinkToken,
  parseTelegramUser,
  parseTelegramChat,
  sendTelegramMessage,
  type TelegramUpdate,
} from "../_shared/telegram.ts";

// Deno runtime compatibility
declare function serve(handler: (req: Request) => Response | Promise<Response>): void;

const TELEGRAM_WEBHOOK_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

function requireTelegramSecret(request: Request): void {
  const denoEnv = "Deno" in globalThis
    ? (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
    : undefined;
  const expected = denoEnv?.get?.("TELEGRAM_WEBHOOK_SECRET");
  if (!expected) throw new Error("Missing TELEGRAM_WEBHOOK_SECRET");
  const received = request.headers.get(TELEGRAM_WEBHOOK_SECRET_HEADER);
  if (!received || received !== expected) throw new Error("Invalid secret");
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ============================================================
// Command dispatcher
// ============================================================

type CommandHandler = (
  client: SupabaseClient,
  chatId: number,
  telegramUserId: number,
) => Promise<string>;

interface LinkedProfile {
  profile_id: string;
  role: string;
  telegram_user_id: number;
}

async function resolveLinkedProfile(
  client: SupabaseClient,
  telegramUserId: number,
): Promise<LinkedProfile | null> {
  const { data } = await client
    .from("telegram_accounts")
    .select("profile_id, profiles(role), telegram_user_id")
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (!data) return null;
  return {
    profile_id: data.profile_id,
    role: data.profiles?.role ?? "resident",
    telegram_user_id: data.telegram_user_id,
  };
}

// --- Command implementations ---

async function handleStart(
  client: SupabaseClient,
  chatId: number,
  telegramUserId: number,
  messageText: string | null,
): Promise<string> {
  // Check if this is a deep-link /start link_<token>
  const linkToken = extractLinkToken(messageText);
  if (linkToken) {
    // Parse Telegram identity from the update
    const telegramUser = parseTelegramUser(update);
    const telegramChat = parseTelegramChat(update);

    const telegramUserData = telegramUser || { id: telegramUserId, is_bot: false, username: null, first_name: "", last_name: null, language_code: null };

    const { data } = await client.rpc("consume_telegram_link_token", {
      p_plain_token: linkToken,
      p_telegram_user_id: telegramUserId,
      p_telegram_chat_id: chatId,
      p_username: telegramUserData.username ?? null,
      p_first_name: telegramUserData.first_name,
      p_last_name: telegramUserData.last_name ?? null,
      p_language_code: telegramUserData.language_code ?? null,
    });

    const result = (Array.isArray(data) ? data[0] : data) as { success: boolean; error?: string } | null;

    if (result?.success) {
      return "Akun Telegram kamu sudah terhubung dengan IPL Jatiloka. Gunakan /status untuk cek tagihan atau /help untuk daftar perintah.";
    }
    return result?.error ?? "Terjadi kesalahan saat memproses tautan. Silakan coba lagi atau hubungi pengurus.";
  }

  // Generic /start — D-10 for unlinked
  const linked = await resolveLinkedProfile(client, telegramUserId);
  if (!linked) {
    return "Akun Telegram kamu belum terhubung dengan IPL Jatiloka. Silakan login ke aplikasi web dan hubungkan akun Telegram dari menu Pengaturan.";
  }
  return "Selamat datang kembali di IPL Jatiloka Residence! Gunakan /help untuk melihat daftar perintah.";
}

async function handleHelp(): Promise<string> {
  return `Perintah yang tersedia:
/start — Mulai / hubungkan akun
/status — Ringkasan tagihan
/tagihanku — Detail tagihan per kavling
/riwayat — Riwayat pembayaran
/settings — Buka pengaturan di aplikasi web
/unlink — Putuskan akun Telegram
/admin — Ringkasan operasional (admin)

Gunakan aplikasi web IPL Jatiloka untuk fitur lengkap.`;
}

async function handleStatus(
  client: SupabaseClient,
  _chatId: number,
  telegramUserId: number,
): Promise<string> {
  const linked = await resolveLinkedProfile(client, telegramUserId);
  if (!linked) return unlinkedMessage();

  const { data: invoices } = await client.rpc("get_resident_invoice_summary", {
    p_profile_id: linked.profile_id,
  });

  if (!invoices || (Array.isArray(invoices) && invoices.length === 0)) {
    return "Tidak ada tagihan aktif saat ini.";
  }

  const rows = Array.isArray(invoices) ? invoices : [];
  let message = "Ringkasan Tagihan IPL Jatiloka:\n";
  let total = 0;

  for (const row of rows) {
    const amount = row.total_outstanding ?? row.amount_due ?? 0;
    total += Number(amount);
    message += `\n${row.kavling_code ?? "?"}: Rp ${Number(amount).toLocaleString("id-ID")} (${row.status ?? "?"})`;
  }

  message += `\n\nTotal: Rp ${total.toLocaleString("id-ID")}`;
  return message;
}

async function handleTagihanKu(
  client: SupabaseClient,
  _chatId: number,
  telegramUserId: number,
): Promise<string> {
  const linked = await resolveLinkedProfile(client, telegramUserId);
  if (!linked) return unlinkedMessage();

  const { data } = await client
    .from("invoices")
    .select(`
      id, invoice_number, amount_due, amount_paid, status, due_date,
      billing_periods(label, month, year),
      kavlings(code)
    `)
    .eq("kavling_residents.profile_id", linked.profile_id)
    .order("due_date", { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    return "Tidak ada tagihan.";
  }

  let message = "Detail Tagihan:\n";
  for (const inv of data) {
    const outstanding = Math.max((inv.amount_due ?? 0) - (inv.amount_paid ?? 0), 0);
    message += `\n${inv.kavlings?.code ?? "?"} — ${inv.billing_periods?.label ?? "?"}`;
    message += `\n  Total: Rp ${(inv.amount_due ?? 0).toLocaleString("id-ID")}`;
    message += `\n  Terbayar: Rp ${(inv.amount_paid ?? 0).toLocaleString("id-ID")}`;
    if (outstanding > 0) {
      message += `\n  Sisa: Rp ${outstanding.toLocaleString("id-ID")}`;
    }
    message += `\n  Status: ${inv.status}`;
  }
  return message;
}

async function handleRiwayat(
  client: SupabaseClient,
  _chatId: number,
  telegramUserId: number,
): Promise<string> {
  const linked = await resolveLinkedProfile(client, telegramUserId);
  if (!linked) return unlinkedMessage();

  const { data } = await client
    .from("payment_submissions")
    .select(`
      id, amount_submitted, status, created_at,
      invoices(invoice_number, billing_periods(label)),
      payment_verifications(verified_at)
    `)
    .eq("submitted_by", linked.profile_id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data || data.length === 0) {
    return "Belum ada riwayat pembayaran.";
  }

  let message = "Riwayat Pembayaran (5 terakhir):\n";
  for (const sub of data) {
    const date = sub.created_at ? new Date(sub.created_at).toLocaleDateString("id-ID") : "?";
    message += `\n${sub.invoices?.billing_periods?.label ?? "?"} — `;
    message += `Rp ${(sub.amount_submitted ?? 0).toLocaleString("id-ID")}`;
    message += ` (${sub.status}) — ${date}`;
  }
  return message;
}

async function handleSettings(): Promise<string> {
  return "Buka aplikasi web IPL Jatiloka untuk mengelola pengaturan notifikasi dan akun Telegram kamu.";
}

async function handleUnlink(
  client: SupabaseClient,
  chatId: number,
  telegramUserId: number,
): Promise<string> {
  const linked = await resolveLinkedProfile(client, telegramUserId);
  if (!linked) return "Akun Telegram kamu belum terhubung dengan IPL Jatiloka.";

  // Delete telegram_accounts (keep notification_preferences per D-17)
  const { error } = await client
    .from("telegram_accounts")
    .delete()
    .eq("profile_id", linked.profile_id);

  if (error) {
    return "Terjadi kesalahan saat memutuskan akun. Silakan coba lagi.";
  }

  return "Akun Telegram kamu telah diputuskan dari IPL Jatiloka. Preferensi notifikasi kamu tetap disimpan. Hubungkan kembali dari aplikasi web untuk melanjutkan notifikasi Telegram.";
}

async function handleAdmin(
  client: SupabaseClient,
  _chatId: number,
  telegramUserId: number,
): Promise<string> {
  const linked = await resolveLinkedProfile(client, telegramUserId);
  if (!linked) return unlinkedMessage();

  // Require admin-like role
  if (!["admin", "super_admin", "treasurer"].includes(linked.role)) {
    return "Perintah ini hanya untuk pengurus.";
  }

  // Pending submissions count
  const { count: pendingCount } = await client
    .from("payment_submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "submitted");

  // Recent submissions
  const { data: recent } = await client
    .from("payment_submissions")
    .select("amount_submitted, status, created_at, invoices(kavlings(code))")
    .order("created_at", { ascending: false })
    .limit(5);

  let message = `Ringkasan Operasional:\n`;
  message += `\nMenunggu verifikasi: ${pendingCount ?? 0} submission\n`;

  if (recent && recent.length > 0) {
    message += "\nSubmission terbaru:";
    for (const sub of recent) {
      message += `\n- ${sub.invoices?.kavlings?.code ?? "?"}: Rp ${(sub.amount_submitted ?? 0).toLocaleString("id-ID")} (${sub.status})`;
    }
  }

  return message;
}

// ============================================================
// Route commands
// ============================================================

const COMMANDS: Record<string, CommandHandler> = {
  "/start": async (client, chatId, telegramUserId, _msg?) => {
    // /start is handled specially because it may include deep-link token
    return "";
  },
  "/help": async () => handleHelp(),
  "/status": handleStatus,
  "/tagihanku": handleTagihanKu,
  "/riwayat": handleRiwayat,
  "/settings": async () => handleSettings(),
  "/unlink": handleUnlink,
  "/admin": handleAdmin,
};

function parseCommand(text: string | null): { command: string; args: string } | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return { command: trimmed.toLowerCase(), args: "" };

  return {
    command: trimmed.slice(0, spaceIdx).toLowerCase(),
    args: trimmed.slice(spaceIdx + 1).trim(),
  };
}

function unlinkedMessage(): string {
  return "Akun Telegram kamu belum terhubung dengan IPL Jatiloka. Silakan login ke aplikasi web dan hubungkan akun Telegram dari menu Pengaturan.";
}

// ============================================================
// Main handler
// ============================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return methodNotAllowed();

  try {
    requireTelegramSecret(req);
  } catch {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const telegramUser = parseTelegramUser(update);
  const telegramChat = parseTelegramChat(update);

  if (!telegramChat) {
    return jsonResponse(200, { ok: true });
  }

  const messageText = update.message?.text ?? null;
  const adminClient = createServiceRoleClient();
  const telegramUserId = telegramUser?.id ?? 0;

  // If /start — handle deep-link or welcome
  if (!messageText || messageText.trim().startsWith("/start")) {
    const reply = await handleStart(adminClient, telegramChat.id, telegramUserId, messageText);
    if (reply) {
      await sendTelegramMessage(telegramChat.id, reply);
    }
    return jsonResponse(200, { ok: true });
  }

  // Parse command
  const parsed = parseCommand(messageText);
  if (!parsed) {
    await sendTelegramMessage(
      telegramChat.id,
      "Gunakan /help untuk melihat daftar perintah yang tersedia.",
    );
    return jsonResponse(200, { ok: true });
  }

  const handler = COMMANDS[parsed.command];
  if (!handler) {
    await sendTelegramMessage(
      telegramChat.id,
      "Perintah tidak dikenal. Gunakan /help untuk daftar perintah.",
    );
    return jsonResponse(200, { ok: true });
  }

  try {
    const reply = await handler(adminClient, telegramChat.id, telegramUserId);
    if (reply) {
      await sendTelegramMessage(telegramChat.id, reply);
    }
  } catch (err) {
    await sendTelegramMessage(
      telegramChat.id,
      "Terjadi kesalahan. Silakan coba lagi nanti.",
    );
  }

  return jsonResponse(200, { ok: true });
});
