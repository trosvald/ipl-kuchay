import { z } from "zod";

import { isValidBillingMonth, parseIsoDateInput } from "./date";

export const uuidSchema = z.uuid();
export const appRoleSchema = z.enum(["resident", "treasurer", "admin", "super_admin"]);

export const rupiahAmountSchema = z
  .number()
  .int("Nominal harus berupa angka bulat")
  .positive("Nominal harus lebih dari 0");

export const requiredStringSchema = z.string().trim().min(1, "Wajib diisi");
export const csvIntegerStringSchema = z
  .string()
  .trim()
  .regex(/^-?\d+$/, "Harus berupa angka bulat")
  .transform((value) => Number.parseInt(value, 10));

export const csvPositiveIntegerStringSchema = csvIntegerStringSchema.refine((value) => value > 0, {
  message: "Nominal harus lebih dari 0",
});

export const csvBooleanStringSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => ["true", "false", "1", "0", "yes", "no", "y", "n"].includes(value), {
    message: "Nilai boolean tidak valid",
  })
  .transform((value) => ["true", "1", "yes", "y"].includes(value));

export const optionalIsoDateStringSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || parseIsoDateInput(value) !== null, "Format tanggal harus yyyy-mm-dd");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const kavlingFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode kavling minimal 2 karakter")
    .max(40, "Kode kavling maksimal 40 karakter"),
  block: z
    .string()
    .trim()
    .max(40, "Blok maksimal 40 karakter")
    .optional()
    .or(z.literal("")),
  sort_order: z.number().int("Urutan harus bilangan bulat").min(0, "Urutan minimal 0"),
  active: z.boolean(),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .or(z.literal("")),
});

export const residentFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(120, "Nama lengkap maksimal 120 karakter"),
  display_name: z
    .string()
    .trim()
    .max(80, "Nama tampilan maksimal 80 karakter")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(30, "Nomor telepon maksimal 30 karakter")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || emailPattern.test(value), "Format email tidak valid")
    .optional()
    .or(z.literal("")),
  role: appRoleSchema,
  is_active: z.boolean(),
});

export const kavlingResidentMappingSchema = z.object({
  kavling_id: uuidSchema,
  profile_id: uuidSchema,
  relation: z
    .string()
    .trim()
    .min(2, "Relasi minimal 2 karakter")
    .max(40, "Relasi maksimal 40 karakter"),
  is_primary: z.boolean(),
  active: z.boolean(),
});

export const feeTypeFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, "Kode hanya boleh huruf kapital, angka, underscore, atau dash")
    .min(2, "Kode minimal 2 karakter")
    .max(40, "Kode maksimal 40 karakter"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120, "Nama maksimal 120 karakter"),
  description: z
    .string()
    .trim()
    .max(400, "Deskripsi maksimal 400 karakter")
    .optional()
    .or(z.literal("")),
  default_amount: z.number().int("Nominal harus bilangan bulat").min(0, "Nominal minimal 0"),
  is_recurring: z.boolean(),
  billing_cycle: z.enum(["monthly", "yearly"]),
  charge_month: z.number().int("Bulan tagih harus bilangan bulat").min(1, "Minimal 1").max(12, "Maksimal 12").nullable(),
  is_penalty: z.boolean(),
  active: z.boolean(),
  sort_order: z.number().int("Urutan harus bilangan bulat").min(0, "Urutan minimal 0"),
}).superRefine((value, ctx) => {
  if (!value.is_recurring && (value.billing_cycle !== "monthly" || value.charge_month !== null)) {
    ctx.addIssue({
      code: "custom",
      path: ["billing_cycle"],
      message: "Biaya one-off harus pakai siklus monthly tanpa charge month.",
    });
  }

  if (value.is_recurring && value.billing_cycle === "yearly" && value.charge_month === null) {
    ctx.addIssue({
      code: "custom",
      path: ["charge_month"],
      message: "Biaya yearly wajib memilih bulan tagih.",
    });
  }

  if (value.is_recurring && value.billing_cycle === "monthly" && value.charge_month !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["charge_month"],
      message: "Biaya monthly tidak perlu bulan tagih.",
    });
  }
});

const optionalDateInputSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || parseIsoDateInput(value) !== null, "Format tanggal harus yyyy-mm-dd")
  .optional()
  .or(z.literal(""));

export const feeOverrideFormSchema = z
  .object({
    kavling_id: uuidSchema,
    fee_type_id: uuidSchema,
    amount: z.number().int("Nominal harus bilangan bulat").min(0, "Nominal minimal 0"),
    active_from: optionalDateInputSchema,
    active_until: optionalDateInputSchema,
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().or(z.literal("")),
  })
  .refine(
    (value) => {
      if (!value.active_from || !value.active_until) {
        return true;
      }

      const from = parseIsoDateInput(value.active_from);
      const until = parseIsoDateInput(value.active_until);
      if (!from || !until) {
        return false;
      }

      return until.getTime() >= from.getTime();
    },
    {
      path: ["active_until"],
      message: "Tanggal akhir harus sama atau setelah tanggal mulai",
    },
  );

export const billingPeriodStatusSchema = z.enum(["draft", "open", "closed", "archived"]);

export const billingPeriodFormSchema = z
  .object({
    year: z.number().int("Tahun harus bilangan bulat"),
    month: z.number().int("Bulan harus bilangan bulat"),
    due_date: z
      .string()
      .trim()
      .refine((value) => parseIsoDateInput(value) !== null, "Format tanggal harus yyyy-mm-dd"),
    label: z.string().trim().min(2, "Label minimal 2 karakter").max(120, "Label maksimal 120 karakter"),
  })
  .refine((value) => isValidBillingMonth(value.year, value.month), {
    path: ["month"],
    message: "Periode harus dalam rentang tahun 2020-2100 dan bulan 1-12",
  });

export const paymentSubmissionFormSchema = z.object({
  invoiceId: uuidSchema,
  amountSubmitted: z.number().int("Nominal harus bilangan bulat").min(1, "Nominal minimal 1"),
  bankAccountId: uuidSchema,
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().or(z.literal("")),
});

export const paymentProofMetadataSchema = z.object({
  submissionId: uuidSchema,
  proofPath: z.string().trim().min(1, "Path bukti wajib diisi"),
  mimeType: z.string().trim().min(1, "MIME type wajib diisi"),
  sizeBytes: z.number().int("Ukuran file harus bilangan bulat").min(1, "Ukuran file tidak valid"),
});

export const residentNotificationCategorySchema = z.enum([
  "billing_reminders",
  "payment_status",
  "announcements",
  "events",
]);

export const residentSettingsProfileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .max(80, "Nama tampilan maksimal 80 karakter")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .max(30, "Nomor telepon maksimal 30 karakter")
      .optional()
      .or(z.literal("")),
  })
  .strict();

export const residentNotificationPreferenceRowSchema = z.object({
  category: residentNotificationCategorySchema,
  in_app_enabled: z.boolean(),
  telegram_enabled: z.boolean(),
});

const requiredResidentNotificationCategories = [
  "billing_reminders",
  "payment_status",
  "announcements",
  "events",
] as const;

export const residentNotificationPreferencesSchema = z
  .object({
    rows: z.array(residentNotificationPreferenceRowSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.rows.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Minimal satu preferensi wajib diisi",
      });
      return;
    }

    const categories = value.rows.map((row) => row.category);
    const unique = new Set(categories);
    if (unique.size !== categories.length) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Kategori preferensi tidak boleh duplikat",
      });
    }

    for (const category of requiredResidentNotificationCategories) {
      if (!unique.has(category)) {
        ctx.addIssue({
          code: "custom",
          path: ["rows"],
          message: `Kategori ${category} wajib ada`,
        });
      }
    }
  });

// ============================================================
// Announcement, Event, and RSVP schemas (Phase 4)
// ============================================================

export const announcementStatusSchema = z.enum(["draft", "published", "archived"]);

export const announcementFormSchema = z
  .object({
    title: z.string().trim().min(1, "Judul wajib diisi"),
    body: z.string().trim().min(1, "Isi pengumuman wajib diisi"),
    is_urgent: z.boolean().optional().default(false),
    is_pinned: z.boolean().optional().default(false),
    status: announcementStatusSchema,
  })
  .strict();

export const announcementAttachmentSchema = z
  .object({
    announcement_id: uuidSchema,
    label: z.string().trim().min(1, "Label lampiran wajib diisi"),
    storage_path: z.string().trim().min(1, "Path penyimpanan wajib diisi"),
    mime_type: z.string().trim().min(1, "Tipe file wajib diisi"),
    size_bytes: z.number().int("Ukuran file harus bilangan bulat").positive("Ukuran file tidak valid"),
  })
  .strict();

export const eventStatusSchema = z.enum(["scheduled", "cancelled"]);

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, "Judul acara wajib diisi"),
    description: z.string().trim().optional().default(""),
    location: z.string().trim().min(1, "Lokasi acara wajib diisi"),
    starts_at: z.string().trim().min(1, "Waktu mulai wajib diisi"),
    ends_at: z.string().trim().optional().nullable(),
    status: eventStatusSchema,
    cancellation_note: z.string().trim().optional().default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.ends_at != null && value.ends_at.length > 0) {
      if (value.ends_at <= value.starts_at) {
        ctx.addIssue({
          code: "custom",
          path: ["ends_at"],
          message: "Waktu selesai harus setelah waktu mulai",
        });
      }
    }
  });

export const rsvpResponseSchema = z.enum(["attending", "not_attending", "no_response"]);

export const rsvpUpsertSchema = z
  .object({
    event_id: uuidSchema,
    response: rsvpResponseSchema,
  })
  .strict();

export type KavlingFormInput = z.infer<typeof kavlingFormSchema>;
export type ResidentFormInput = z.infer<typeof residentFormSchema>;
export type KavlingResidentMappingInput = z.infer<typeof kavlingResidentMappingSchema>;
export type FeeTypeFormInput = z.infer<typeof feeTypeFormSchema>;
export type FeeOverrideFormInput = z.infer<typeof feeOverrideFormSchema>;
export type BillingPeriodFormInput = z.infer<typeof billingPeriodFormSchema>;
export type BillingPeriodStatus = z.infer<typeof billingPeriodStatusSchema>;
export type PaymentSubmissionFormInput = z.infer<typeof paymentSubmissionFormSchema>;
export type PaymentProofMetadataInput = z.infer<typeof paymentProofMetadataSchema>;
export type ResidentSettingsProfileInput = z.infer<typeof residentSettingsProfileSchema>;
export type ResidentNotificationCategory = z.infer<typeof residentNotificationCategorySchema>;
export type ResidentNotificationPreferenceRowInput = z.infer<typeof residentNotificationPreferenceRowSchema>;
export type ResidentNotificationPreferencesInput = z.infer<typeof residentNotificationPreferencesSchema>;
export type AnnouncementFormInput = z.infer<typeof announcementFormSchema>;
export type AnnouncementAttachmentInput = z.infer<typeof announcementAttachmentSchema>;
export type EventFormInput = z.infer<typeof eventFormSchema>;
export type RSVPUpsertInput = z.infer<typeof rsvpUpsertSchema>;
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type RSVPResponse = z.infer<typeof rsvpResponseSchema>;
