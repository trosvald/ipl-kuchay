"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/features/auth/AuthProvider";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>;
}
