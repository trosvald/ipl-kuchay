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
  getOptionalEnv,
} from "../_shared/supabase.ts";

type AppRole = "resident" | "treasurer" | "admin" | "super_admin";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

interface InviteRequest {
  email?: string;
  fullName?: string;
  displayName?: string;
  phone?: string;
  role?: AppRole;
}

interface NormalizedInviteInput {
  email: string;
  fullName: string;
  displayName: string;
  phone: string | null;
  role: AppRole;
}

interface ExistingProfile {
  id: string;
  role: AppRole;
  full_name: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
}

interface AuthAdminUser {
  id: string;
  email?: string | null;
}

interface InviteAuthError {
  message: string;
  status?: number;
  code?: string;
}

function getInviteRedirectTo(): string {
  const baseUrl =
    getOptionalEnv("APP_SITE_URL") ??
    getOptionalEnv("NEXT_PUBLIC_SITE_URL") ??
    getOptionalEnv("SITE_URL");

  if (!baseUrl) {
    throw new HttpError(500, "APP_SITE_URL is not configured");
  }

  return `${baseUrl.replace(/\/$/, "")}/set-password`;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: unknown): string {
  const email = normalizeString(value)?.toLowerCase();
  if (!email?.includes("@")) {
    throw new HttpError(400, "Invalid email");
  }

  return email;
}

function normalizeRole(value: unknown): AppRole {
  if (
    value === "resident" ||
    value === "treasurer" ||
    value === "admin" ||
    value === "super_admin"
  ) {
    return value;
  }

  throw new HttpError(400, "Invalid role");
}

async function parseInviteInput(request: Request): Promise<NormalizedInviteInput> {
  let body: InviteRequest;

  try {
    body = (await request.json()) as InviteRequest;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const email = normalizeEmail(body.email);
  const fullName = normalizeString(body.fullName);
  if (!fullName) {
    throw new HttpError(400, "fullName is required");
  }

  const displayName = normalizeString(body.displayName) ?? fullName;
  const phone = normalizeString(body.phone);
  const role = normalizeRole(body.role);

  return {
    email,
    fullName,
    displayName,
    phone,
    role,
  };
}

function ensureRoleChangeAllowed(callerRole: AppRole, targetRole: AppRole): void {
  if (targetRole === "super_admin" && callerRole !== "super_admin") {
    throw new HttpError(403, "Only super_admin can invite super_admin role");
  }
}

async function fetchExistingProfile(
  serviceClient: ServiceClient,
  email: string,
): Promise<ExistingProfile | null> {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, role, full_name, display_name, phone, email")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to check existing profile");
  }

  return (data as ExistingProfile | null) ?? null;
}

function ensureExistingProfileChangeAllowed(
  callerRole: AppRole,
  existingProfile: ExistingProfile | null,
): void {
  if (existingProfile?.role === "super_admin" && callerRole !== "super_admin") {
    throw new HttpError(403, "Only super_admin can modify super_admin profile");
  }
}

function isInviteAuthError(error: unknown): error is InviteAuthError {
  return typeof error === "object" && error !== null && "message" in error;
}

function isExistingAuthUserError(error: InviteAuthError): boolean {
  return error.code === "email_exists" || error.code === "user_already_exists";
}

async function findExistingAuthUserByEmail(
  serviceClient: ServiceClient,
  email: string,
): Promise<AuthAdminUser | null> {
  let page = 1;

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new HttpError(error.status ?? 500, "Failed to read existing auth users");
    }

    const existingUser = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );

    if (existingUser?.id) {
      return {
        id: existingUser.id,
        email: existingUser.email ?? null,
      };
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }
}

async function inviteUserAndResolveProfileId(
  serviceClient: ServiceClient,
  input: NormalizedInviteInput,
  existingProfileId: string | null,
): Promise<string> {
  if (existingProfileId) {
    return existingProfileId;
  }

  const { data: inviteData, error: inviteError } =
    await serviceClient.auth.admin.inviteUserByEmail(input.email, {
      data: {
        full_name: input.fullName,
        display_name: input.displayName,
        phone: input.phone,
        password_setup_completed: false,
      },
      redirectTo: getInviteRedirectTo(),
    });

  if (inviteError) {
    if (isInviteAuthError(inviteError) && isExistingAuthUserError(inviteError)) {
      const existingAuthUser = await findExistingAuthUserByEmail(serviceClient, input.email);
      if (existingAuthUser?.id) {
        return existingAuthUser.id;
      }
    }

    throw new HttpError(
      isInviteAuthError(inviteError) ? inviteError.status ?? 400 : 400,
      isInviteAuthError(inviteError) ? inviteError.message : "Failed to invite user",
    );
  }

  const invitedProfileId = inviteData.user?.id;
  if (invitedProfileId) {
    return invitedProfileId;
  }

  const { data: profileByEmail, error: profileByEmailError } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();

  if (profileByEmailError || !profileByEmail?.id) {
    throw new HttpError(500, "Failed to resolve profile id");
  }

  return profileByEmail.id;
}

async function upsertProfile(
  serviceClient: ServiceClient,
  profileId: string,
  input: NormalizedInviteInput,
): Promise<void> {
  const { error } = await serviceClient.from("profiles").upsert(
    {
      id: profileId,
      email: input.email,
      full_name: input.fullName,
      display_name: input.displayName,
      phone: input.phone,
      role: input.role,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new HttpError(500, error.message);
  }
}

async function writeAuditLog(
  serviceClient: ServiceClient,
  request: Request,
  caller: { id: string; role: AppRole },
  existingProfile: ExistingProfile | null,
  profileId: string,
  input: NormalizedInviteInput,
): Promise<void> {
  const action = existingProfile
    ? "admin_invite_user_profile_updated"
    : "admin_invite_user_profile_created";

  const { error } = await serviceClient.from("audit_logs").insert({
    actor_id: caller.id,
    actor_role: caller.role,
    action,
    entity_table: "profiles",
    entity_id: profileId,
    before_data: existingProfile
      ? {
          role: existingProfile.role,
          full_name: existingProfile.full_name,
          display_name: existingProfile.display_name,
          phone: existingProfile.phone,
          email: existingProfile.email,
        }
      : null,
    after_data: {
      role: input.role,
      full_name: input.fullName,
      display_name: input.displayName,
      phone: input.phone,
      email: input.email,
    },
    request_id: request.headers.get("x-request-id"),
  });

  if (error) {
    throw new HttpError(500, "Failed to write audit log");
  }
}

async function handleInviteRequest(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const userClient = createUserClient(authHeader);
  const serviceClient = createServiceRoleClient();

  const caller = await getCallerProfile(request, userClient);
  requireRole(caller, ["admin", "super_admin"]);

  const input = await parseInviteInput(request);
  ensureRoleChangeAllowed(caller.role, input.role);

  const existingProfile = await fetchExistingProfile(serviceClient, input.email);
  ensureExistingProfileChangeAllowed(caller.role, existingProfile);

  const profileId = await inviteUserAndResolveProfileId(
    serviceClient,
    input,
    existingProfile?.id ?? null,
  );

  await upsertProfile(serviceClient, profileId, input);
  await writeAuditLog(serviceClient, request, caller, existingProfile, profileId, input);

  return jsonResponse(200, {
    profileId,
    email: input.email,
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
    return await handleInviteRequest(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message });
    }

    if (error instanceof Error) {
      return jsonResponse(500, { error: error.message });
    }

    return jsonResponse(500, { error: "Unexpected error" });
  }
});
