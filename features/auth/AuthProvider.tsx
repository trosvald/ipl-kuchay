"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AppRole = "resident" | "treasurer" | "admin" | "super_admin";

export interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  role: AppRole;
  is_active: boolean;
}

export interface SignInInput {
  email: string;
  password?: string;
  magicLink?: boolean;
}

export interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function isProfileRow(data: unknown): data is Profile {
  if (!data || typeof data !== "object") {
    return false;
  }

  const row = data as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.full_name === "string" &&
    typeof row.is_active === "boolean" &&
    (row.role === "resident" ||
      row.role === "treasurer" ||
      row.role === "admin" ||
      row.role === "super_admin")
  );
}

async function fetchProfile(
  client: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, display_name, phone, email, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!isProfileRow(data)) {
    return null;
  }

  return data;
}

export function AuthProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const client = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!client || !session?.user) {
      setProfile(null);
      return;
    }

    const nextProfile = await fetchProfile(client, session.user.id);
    setProfile(nextProfile);
  }, [client, session?.user]);

  const signIn = useCallback(
    async ({ email, password }: SignInInput) => {
      if (!client) {
        throw new Error("Supabase client is unavailable");
      }

      if (password && password.length > 0) {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        return;
      }

      const redirectTo = `${globalThis.location.origin}/app`;
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) {
      setSession(null);
      setProfile(null);
      return;
    }

    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }

    setSession(null);
    setProfile(null);
  }, [client]);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const bootstrap = async () => {
      const { data, error } = await client.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const nextSession = data.session;
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await fetchProfile(client, nextSession.user.id);
        if (!isMounted) {
          return;
        }

        setProfile(nextProfile);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    bootstrap().catch(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      fetchProfile(client, nextSession.user.id)
        .then((nextProfile) => {
          if (!isMounted) {
            return;
          }

          setProfile(nextProfile);
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, profile, refreshProfile, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
