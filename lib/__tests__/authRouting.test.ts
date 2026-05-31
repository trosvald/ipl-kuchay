import { describe, expect, it } from "vitest";

import {
  canRedirectAfterAuthResolution,
  getAuthenticatedLandingPath,
  getPostAuthRedirectPath,
} from "@/features/auth/authRouting";

describe("auth routing", () => {
  it("routes admin-like roles to the admin shell", () => {
    expect(getAuthenticatedLandingPath("treasurer")).toBe("/admin");
    expect(getAuthenticatedLandingPath("admin")).toBe("/admin");
    expect(getAuthenticatedLandingPath("super_admin")).toBe("/admin");
  });

  it("routes residents and unresolved roles to the resident shell", () => {
    expect(getAuthenticatedLandingPath("resident")).toBe("/app");
    expect(getAuthenticatedLandingPath(null)).toBe("/app");
  });

  it("routes invited users to set-password before the normal landing path", () => {
    expect(getPostAuthRedirectPath({ role: "resident", needsPasswordSetup: true })).toBe("/set-password");
    expect(getPostAuthRedirectPath({ role: "admin", needsPasswordSetup: true })).toBe("/set-password");
    expect(getPostAuthRedirectPath({ role: "admin", needsPasswordSetup: false })).toBe("/admin");
  });

  it("waits for session and profile resolution before redirecting", () => {
    expect(canRedirectAfterAuthResolution({ loading: true, hasSession: true, accessState: "active-mapped" })).toBe(false);
    expect(canRedirectAfterAuthResolution({ loading: false, hasSession: false, accessState: "anonymous" })).toBe(false);
    expect(canRedirectAfterAuthResolution({ loading: false, hasSession: true, accessState: "missing-profile" })).toBe(false);
    expect(canRedirectAfterAuthResolution({ loading: false, hasSession: true, accessState: "inactive" })).toBe(false);
    expect(canRedirectAfterAuthResolution({ loading: false, hasSession: true, accessState: "active-unmapped" })).toBe(true);
    expect(canRedirectAfterAuthResolution({ loading: false, hasSession: true, accessState: "active-mapped" })).toBe(true);
  });
});
