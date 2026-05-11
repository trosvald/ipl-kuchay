import { describe, expect, it, vi } from "vitest";

import { resolveAuthDerivedState } from "@/features/auth/AuthProvider";

describe("resolveAuthDerivedState", () => {
  const activeAdminProfile = {
    id: "admin-1",
    full_name: "Admin",
    display_name: null,
    phone: null,
    email: "admin@example.com",
    role: "admin" as const,
    is_active: true,
  };

  it("clears profile and mapping state when profile refresh fails", async () => {
    const state = await resolveAuthDerivedState("admin-1", {
      fetchProfile: vi.fn(async () => {
        throw new Error("network failed");
      }),
      fetchHasActiveKavlingMapping: vi.fn(async () => true),
    });

    expect(state).toEqual({
      profile: null,
      hasActiveKavlingMapping: false,
    });
  });

  it("clears profile and mapping state when mapping refresh fails", async () => {
    const state = await resolveAuthDerivedState("admin-1", {
      fetchProfile: vi.fn(async () => activeAdminProfile),
      fetchHasActiveKavlingMapping: vi.fn(async () => {
        throw new Error("mapping failed");
      }),
    });

    expect(state).toEqual({
      profile: null,
      hasActiveKavlingMapping: false,
    });
  });

  it("returns resolved profile and mapping when refresh succeeds", async () => {
    const state = await resolveAuthDerivedState("admin-1", {
      fetchProfile: vi.fn(async () => activeAdminProfile),
      fetchHasActiveKavlingMapping: vi.fn(async () => true),
    });

    expect(state).toEqual({
      profile: activeAdminProfile,
      hasActiveKavlingMapping: true,
    });
  });
});
