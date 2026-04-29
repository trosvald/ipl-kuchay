import { describe, expect, it } from "vitest";

import { deriveAccessState } from "@/features/auth/authHooks";

describe("deriveAccessState", () => {
  it("returns active-mapped for active resident with kavling mappings", () => {
    const state = deriveAccessState({
      session: { user: { id: "resident-1" } },
      profile: { is_active: true },
      hasActiveKavlingMapping: true,
    });

    expect(state).toBe("active-mapped");
  });

  it("returns active-unmapped for active resident with no mapping", () => {
    const state = deriveAccessState({
      session: { user: { id: "resident-1" } },
      profile: { is_active: true },
      hasActiveKavlingMapping: false,
    });

    expect(state).toBe("active-unmapped");
  });

  it("returns inactive for authenticated inactive profile", () => {
    const state = deriveAccessState({
      session: { user: { id: "resident-1" } },
      profile: { is_active: false },
      hasActiveKavlingMapping: true,
    });

    expect(state).toBe("inactive");
  });
});
