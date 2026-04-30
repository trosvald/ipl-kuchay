import { describe, expect, it } from "vitest";

import {
  announcementFormSchema,
  announcementAttachmentSchema,
  eventFormSchema,
  rsvpUpsertSchema,
  billingPeriodFormSchema,
  kavlingResidentMappingSchema,
  paymentSubmissionFormSchema,
  residentNotificationPreferencesSchema,
  residentSettingsProfileSchema,
} from "@/lib/validation";

describe("validation schemas", () => {
  it("accepts valid payment submission payload", () => {
    const result = paymentSubmissionFormSchema.safeParse({
      invoiceId: "11111111-1111-4111-8111-111111111111",
      amountSubmitted: 100000,
      bankAccountId: "22222222-2222-4222-8222-222222222222",
      note: "transfer pagi",
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-positive payment amount", () => {
    const result = paymentSubmissionFormSchema.safeParse({
      invoiceId: "11111111-1111-4111-8111-111111111111",
      amountSubmitted: 0,
      bankAccountId: "22222222-2222-4222-8222-222222222222",
      note: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid billing period payload", () => {
    const result = billingPeriodFormSchema.safeParse({
      year: 2026,
      month: 7,
      due_date: "2026-07-31",
      label: "Juli 2026",
    });

    expect(result.success).toBe(true);
  });

  it("rejects out-of-range billing month", () => {
    const result = billingPeriodFormSchema.safeParse({
      year: 2026,
      month: 13,
      due_date: "2026-07-31",
      label: "Invalid",
    });

    expect(result.success).toBe(false);
  });

  it("accepts resident settings editable fields and rejects protected identity fields", () => {
    const valid = residentSettingsProfileSchema.safeParse({
      display_name: "Budi",
      phone: "08123456789",
    });
    expect(valid.success).toBe(true);

    const invalid = residentSettingsProfileSchema.safeParse({
      display_name: "Budi",
      phone: "08123456789",
      full_name: "Budi Santoso",
      email: "budi@example.com",
      role: "resident",
      is_active: true,
    });
    expect(invalid.success).toBe(false);
  });

  it("requires category-based notification preference rows and rejects global toggle payload", () => {
    const valid = residentNotificationPreferencesSchema.safeParse({
      rows: [
        { category: "billing_reminders", in_app_enabled: true, telegram_enabled: false },
        { category: "payment_status", in_app_enabled: true, telegram_enabled: false },
        { category: "announcements", in_app_enabled: true, telegram_enabled: true },
        { category: "events", in_app_enabled: false, telegram_enabled: false },
      ],
    });
    expect(valid.success).toBe(true);

    const invalid = residentNotificationPreferencesSchema.safeParse({
      enabled: true,
    });
    expect(invalid.success).toBe(false);
  });

  it("accepts valid announcement create payload with all writable fields", () => {
    const result = announcementFormSchema.safeParse({
      title: "Pengumuman Gotong Royong",
      body: "Akan diadakan kerja bakti minggu depan.",
      is_urgent: false,
      is_pinned: true,
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title on announcement payload", () => {
    const result = announcementFormSchema.safeParse({
      title: "   ",
      body: "Some body content",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty body on announcement payload", () => {
    const result = announcementFormSchema.safeParse({
      title: "Valid Title",
      body: "",
      status: "published",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra fields on announcement payload (strict)", () => {
    const result = announcementFormSchema.safeParse({
      title: "Valid Title",
      body: "Valid body",
      status: "draft",
      created_at: "2026-01-01T00:00:00Z",
      published_at: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid event create payload with all writable fields", () => {
    const result = eventFormSchema.safeParse({
      title: "Kerja Bakti",
      description: "Kegiatan kebersihan lingkungan",
      location: "Halaman mansion",
      starts_at: "2026-05-10T08:00:00Z",
      ends_at: "2026-05-10T11:00:00Z",
      status: "scheduled",
    });
    expect(result.success).toBe(true);
  });

  it("rejects event when ends_at is before starts_at", () => {
    const result = eventFormSchema.safeParse({
      title: "Kerja Bakti",
      description: "Kegiatan",
      location: "Halaman",
      starts_at: "2026-05-10T11:00:00Z",
      ends_at: "2026-05-10T08:00:00Z",
      status: "scheduled",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title on event payload", () => {
    const result = eventFormSchema.safeParse({
      description: "Kegiatan",
      location: "Halaman",
      starts_at: "2026-05-10T08:00:00Z",
      status: "scheduled",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing location on event payload", () => {
    const result = eventFormSchema.safeParse({
      title: "Kerja Bakti",
      description: "Kegiatan",
      starts_at: "2026-05-10T08:00:00Z",
      status: "scheduled",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid RSVP upsert payload with attending response", () => {
    const result = rsvpUpsertSchema.safeParse({
      event_id: "11111111-1111-4111-8111-111111111111",
      response: "attending",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid RSVP upsert payload with not_attending response", () => {
    const result = rsvpUpsertSchema.safeParse({
      event_id: "11111111-1111-4111-8111-111111111111",
      response: "not_attending",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid RSVP upsert payload with no_response response", () => {
    const result = rsvpUpsertSchema.safeParse({
      event_id: "11111111-1111-4111-8111-111111111111",
      response: "no_response",
    });
    expect(result.success).toBe(true);
  });

  it("rejects RSVP payload with invalid response value", () => {
    const result = rsvpUpsertSchema.safeParse({
      event_id: "11111111-1111-4111-8111-111111111111",
      response: "maybe_attending",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid announcement attachment metadata", () => {
    const result = announcementAttachmentSchema.safeParse({
      announcement_id: "11111111-1111-4111-8111-111111111111",
      label: "Surat Edaran.pdf",
      storage_path: "announcements/abc123/surat.pdf",
      mime_type: "application/pdf",
      size_bytes: 204800,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty label on attachment metadata", () => {
    const result = announcementAttachmentSchema.safeParse({
      announcement_id: "11111111-1111-4111-8111-111111111111",
      label: "   ",
      storage_path: "announcements/abc123/surat.pdf",
      mime_type: "application/pdf",
      size_bytes: 204800,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty storage_path on attachment metadata", () => {
    const result = announcementAttachmentSchema.safeParse({
      announcement_id: "11111111-1111-4111-8111-111111111111",
      label: "Surat.pdf",
      storage_path: "",
      mime_type: "application/pdf",
      size_bytes: 204800,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty mime_type on attachment metadata", () => {
    const result = announcementAttachmentSchema.safeParse({
      announcement_id: "11111111-1111-4111-8111-111111111111",
      label: "Surat.pdf",
      storage_path: "announcements/abc123/surat.pdf",
      mime_type: "   ",
      size_bytes: 204800,
    });
    expect(result.success).toBe(false);
  });

  it("validates kavling-resident mapping payload for relation and identity fields", () => {
    const valid = kavlingResidentMappingSchema.safeParse({
      kavling_id: "11111111-1111-4111-8111-111111111111",
      profile_id: "22222222-2222-4222-8222-222222222222",
      relation: "owner",
      is_primary: true,
      active: true,
    });
    expect(valid.success).toBe(true);

    const invalidRelation = kavlingResidentMappingSchema.safeParse({
      kavling_id: "11111111-1111-4111-8111-111111111111",
      profile_id: "22222222-2222-4222-8222-222222222222",
      relation: "a",
      is_primary: true,
      active: true,
    });
    expect(invalidRelation.success).toBe(false);
  });
});
