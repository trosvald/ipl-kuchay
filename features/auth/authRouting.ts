import type { AppRole } from "@/features/auth/AuthProvider";

type AccessState = "anonymous" | "missing-profile" | "inactive" | "active-mapped" | "active-unmapped";

export function getAuthenticatedLandingPath(role: AppRole | null): "/admin" | "/app" {
  return role === "treasurer" || role === "admin" || role === "super_admin" ? "/admin" : "/app";
}

export function getPostAuthRedirectPath({
  role,
  needsPasswordSetup,
}: {
  role: AppRole | null;
  needsPasswordSetup: boolean;
}): "/set-password" | "/admin" | "/app" {
  if (needsPasswordSetup) {
    return "/set-password";
  }

  return getAuthenticatedLandingPath(role);
}

export function canRedirectAfterAuthResolution({
  loading,
  hasSession,
  accessState,
}: {
  loading: boolean;
  hasSession: boolean;
  accessState: AccessState;
}): boolean {
  return !loading && hasSession && accessState !== "inactive" && accessState !== "missing-profile";
}
