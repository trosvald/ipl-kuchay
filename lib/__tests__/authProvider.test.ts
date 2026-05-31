import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";

import { deriveNeedsPasswordSetup } from "@/features/auth/AuthProvider";

function createSession(passwordSetupCompleted?: boolean): Session {
  return {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    expires_at: 9999999999,
    token_type: "bearer",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      app_metadata: {},
      user_metadata:
        passwordSetupCompleted === undefined
          ? {}
          : { password_setup_completed: passwordSetupCompleted },
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  } as Session;
}

describe("deriveNeedsPasswordSetup", () => {
  it("does not require password setup without a session", () => {
    expect(deriveNeedsPasswordSetup(null, null)).toBe(false);
  });

  it("requires password setup when metadata explicitly says false", () => {
    expect(deriveNeedsPasswordSetup(createSession(false), "resident")).toBe(true);
    expect(deriveNeedsPasswordSetup(createSession(false), "admin")).toBe(true);
  });

  it("does not require password setup when metadata explicitly says true", () => {
    expect(deriveNeedsPasswordSetup(createSession(true), "resident")).toBe(false);
  });

  it("requires resident password setup when legacy metadata is missing", () => {
    expect(deriveNeedsPasswordSetup(createSession(undefined), "resident")).toBe(true);
  });

  it("does not force non-resident users when legacy metadata is missing", () => {
    expect(deriveNeedsPasswordSetup(createSession(undefined), "admin")).toBe(false);
    expect(deriveNeedsPasswordSetup(createSession(undefined), "super_admin")).toBe(false);
  });
});
