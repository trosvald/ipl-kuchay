import { HttpError } from "./responses.ts";

export type AppRole = "resident" | "treasurer" | "admin" | "super_admin";

export interface CallerProfile {
  id: string;
  role: AppRole;
  is_active: boolean;
  email: string | null;
}

interface AuthUserResult {
  data: { user: { id: string } | null };
  error: unknown;
}

interface ProfileQueryResult {
  data: CallerProfile | null;
  error: unknown;
}

interface CallerProfileClient {
  auth: {
    getUser: (jwt: string) => Promise<AuthUserResult>;
  };
  from: (
    table: "profiles",
  ) => {
    select: (
      columns: "id, role, is_active, email",
    ) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        maybeSingle: () => Promise<ProfileQueryResult>;
      };
    };
  };
}

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }

  return authHeader.slice(7).trim();
}

export async function getCallerProfile(
  request: Request,
  userClient: CallerProfileClient,
): Promise<CallerProfile> {
  const token = readBearerToken(request);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    throw new HttpError(401, "Invalid auth token");
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id, role, is_active, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new HttpError(500, "Failed to read caller profile");
  }

  if (!profile) {
    throw new HttpError(403, "Profile not found");
  }

  if (!profile.is_active) {
    throw new HttpError(403, "Profile is inactive");
  }

  if (
    profile.role !== "resident" &&
    profile.role !== "treasurer" &&
    profile.role !== "admin" &&
    profile.role !== "super_admin"
  ) {
    throw new HttpError(403, "Invalid profile role");
  }

  return {
    id: profile.id,
    role: profile.role,
    is_active: profile.is_active,
    email: profile.email,
  };
}

export function requireRole(profile: CallerProfile, roles: AppRole[]) {
  if (!roles.includes(profile.role)) {
    throw new HttpError(403, "Forbidden");
  }
}
