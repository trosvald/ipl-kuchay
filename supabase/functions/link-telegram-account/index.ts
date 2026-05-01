import { createServiceRoleClient } from "../_shared/supabase.ts";
import { createUserClient, getOptionalEnv } from "../_shared/supabase.ts";
import { jsonResponse, HttpError, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";

function requireBotUsername(): string {
  const username = getOptionalEnv("TELEGRAM_BOT_USERNAME");

  if (!username) {
    throw new Error("Missing TELEGRAM_BOT_USERNAME");
  }

  return username;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    // Authenticate the resident via Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing Authorization header" });
    }

    // Create authenticated Supabase client
    const supabase = createUserClient(authHeader);

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse(401, { error: "Invalid or expired session" });
    }

    const botUsername = requireBotUsername();

    // Create service-role client to call the SQL contract (bypasses RLS
    // since the contract function uses security definer)
    const adminClient = createServiceRoleClient();

    // Call the SQL contract to issue a one-time link token
    const { data, error: rpcError } = await adminClient.rpc("issue_telegram_link_token", {
      p_profile_id: user.id,
      p_bot_username: botUsername,
    });

    if (rpcError) {
      console.error("issue_telegram_link_token error:", rpcError);
      return jsonResponse(500, { error: "Gagal membuat tautan Telegram. Silakan coba lagi." });
    }

    // data is a table result set (single row)
    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return jsonResponse(500, { error: "Gagal membuat tautan Telegram. Silakan coba lagi." });
    }

    return jsonResponse(200, {
      deep_link: row.deep_link,
      deepLink: row.deep_link,
      plain_token: row.plain_token,
      plainToken: row.plain_token,
      expiresInMinutes: 15,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.status, { error: err.message });
    }

    console.error("link-telegram-account error:", err);
    return jsonResponse(500, { error: "Terjadi kesalahan server." });
  }
});
