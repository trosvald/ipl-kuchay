import { describe, expect, it } from "vitest";

import { announcementFormSchema } from "@/lib/validation";

// ============================================================
// Phase 04 Plan 02 — Admin Announcements Management
// TDD RED: tests for draft/publish/archive lifecycle
// ============================================================

describe("announcementFormSchema lifecycle", () => {
  // Test 1: save flow defaults to draft and publish is an explicit separate action
  it("defaults is_urgent and is_pinned to false", () => {
    const result = announcementFormSchema.safeParse({
      title: "Test Announcement",
      body: "Test body content",
      status: "draft",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_urgent).toBe(false);
      expect(result.data.is_pinned).toBe(false);
    }
  });

  it("accepts explicit is_urgent and is_pinned values", () => {
    const result = announcementFormSchema.safeParse({
      title: "Urgent Notice",
      body: "Important information",
      status: "published",
      is_urgent: true,
      is_pinned: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_urgent).toBe(true);
      expect(result.data.is_pinned).toBe(true);
    }
  });

  it("rejects empty title", () => {
    const result = announcementFormSchema.safeParse({
      title: "",
      body: "Some content",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty body", () => {
    const result = announcementFormSchema.safeParse({
      title: "Valid Title",
      body: "",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all three status values", () => {
    for (const status of ["draft", "published", "archived"] as const) {
      const result = announcementFormSchema.safeParse({
        title: "Title",
        body: "Body",
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = announcementFormSchema.safeParse({
      title: "Title",
      body: "Body",
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = announcementFormSchema.safeParse({
      title: "Title",
      body: "Body",
      status: "draft",
      extra_field: "not allowed",
    });
    expect(result.success).toBe(false);
  });
});

describe("announcement lifecycle status transitions", () => {
  it("draft status is valid input", () => {
    const result = announcementFormSchema.safeParse({
      title: "Draft Announcement",
      body: "Content",
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("published status is valid for publishing action", () => {
    const result = announcementFormSchema.safeParse({
      title: "Published Announcement",
      body: "Content",
      status: "published",
    });
    expect(result.success).toBe(true);
  });

  it("archived status is valid for archiving action", () => {
    const result = announcementFormSchema.safeParse({
      title: "Archived Announcement",
      body: "Content",
      status: "archived",
    });
    expect(result.success).toBe(true);
  });

  it("is_urgent persists with all status values", () => {
    for (const status of ["draft", "published", "archived"] as const) {
      const result = announcementFormSchema.safeParse({
        title: "Urgent",
        body: "Body",
        status,
        is_urgent: true,
      });
      expect(result.success).toBe(true);
    }
  });

  it("is_pinned persists with all status values", () => {
    for (const status of ["draft", "published", "archived"] as const) {
      const result = announcementFormSchema.safeParse({
        title: "Pinned",
        body: "Body",
        status,
        is_pinned: true,
      });
      expect(result.success).toBe(true);
    }
  });
});