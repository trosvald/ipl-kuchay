// @ts-expect-error Node TypeScript cannot resolve Deno npm: specifiers in editor mode.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { jsonResponse, HttpError, methodNotAllowed, optionsResponse } from "../_shared/responses.ts";
import { buildDeepLinkUrl } from "../_shared/telegram.ts";

// Deno runtime: uses npm: specifiers and reads env via Deno.env.
// Browser code never sees the bot token or direct Telegram API calls.

interface IssueTokenRequest {
  botUsername: string;
}

serve(async (req: Request) => {
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
    const supabase = createClient(authHeader);

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse(401, { error: "Invalid or expired session" });
    }

    // Parse request body
    let body: IssueTokenRequest;
    try {
      body = (await req.json()) as IssueTokenRequest;
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    if (!body.botUsername || typeof body.botUsername !== "string" || body.botUsername.length === 0) {
      // Fall back to env var so browser code doesn't need to know the bot username
      const denoEnv = "Deno" in globalThis
        ? (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
        : undefined;
      const envUsername = denoEnv?.get?.("TELEGRAM_BOT_USERNAME");
      if (!envUsername) {
        return jsonResponse(400, { error: "botUsername is required" });
      }
      body.botUsername = envUsername;
    }

    // Create service-role client to call the SQL contract (bypasses RLS
    // since the contract function uses security definer)
    const adminClient = createServiceRoleClient();

    // Call the SQL contract to issue a one-time link token
    const { data, error: rpcError } = await adminClient.rpc("issue_telegram_link_token", {
      p_profile_id: user.id,
      p_bot_username: body.botUsername,
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
      deepLink: row.deep_link,
      plainToken: row.plain_token,
      // Include expiry info so the UI can show countdown
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
