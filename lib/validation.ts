import { z } from "zod";

export const uuidSchema = z.uuid();
export const appRoleSchema = z.enum(["resident", "treasurer", "admin", "super_admin"]);

export const rupiahAmountSchema = z
  .number()
  .int("Nominal harus berupa angka bulat")
  .positive("Nominal harus lebih dari 0");

export const requiredStringSchema = z.string().trim().min(1, "Wajib diisi");
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

export type KavlingFormInput = z.infer<typeof kavlingFormSchema>;
export type ResidentFormInput = z.infer<typeof residentFormSchema>;
export type KavlingResidentMappingInput = z.infer<typeof kavlingResidentMappingSchema>;
