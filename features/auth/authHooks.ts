"use client";

import { useAuthContext } from "./AuthProvider";

export function useAuth() {
  return useAuthContext();
}

export function useIsAdminLike(): boolean {
  const { role } = useAuthContext();
  return role === "treasurer" || role === "admin" || role === "super_admin";
}

export function useIsSuperAdmin(): boolean {
  const { role } = useAuthContext();
  return role === "super_admin";
}
