"use client";

import { useAuthContext } from "./AuthProvider";

type AccessState = "anonymous" | "missing-profile" | "inactive" | "active-mapped" | "active-unmapped";

interface AccessStateInput {
  session: { user: { id: string } } | null;
  profile: { is_active: boolean } | null;
  hasActiveKavlingMapping: boolean;
}

export function deriveAccessState({
  session,
  profile,
  hasActiveKavlingMapping,
}: AccessStateInput): AccessState {
  if (!session) {
    return "anonymous";
  }

  if (!profile) {
    return "missing-profile";
  }

  if (!profile.is_active) {
    return "inactive";
  }

  if (!hasActiveKavlingMapping) {
    return "active-unmapped";
  }

  return "active-mapped";
}

export function useAuth() {
  return useAuthContext();
}

export function useAccessState(): AccessState {
  const { session, profile, hasActiveKavlingMapping } = useAuthContext();
  return deriveAccessState({
    session: session ? { user: { id: session.user.id } } : null,
    profile: profile ? { is_active: profile.is_active } : null,
    hasActiveKavlingMapping,
  });
}

export function useHasLimitedPortalAccess(): boolean {
  const accessState = useAccessState();
  return accessState === "active-unmapped";
}

export function useHasPortalAccess(): boolean {
  const accessState = useAccessState();
  return accessState === "active-mapped" || accessState === "active-unmapped";
}

export function useIsAdminLike(): boolean {
  const { role } = useAuthContext();
  return role === "treasurer" || role === "admin" || role === "super_admin";
}

export function useIsSuperAdmin(): boolean {
  const { role } = useAuthContext();
  return role === "super_admin";
}
