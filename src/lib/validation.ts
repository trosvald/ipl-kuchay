import { z } from "zod";

export const uuidSchema = z.uuid();

export const rupiahAmountSchema = z
  .number()
  .int("Nominal harus berupa angka bulat")
  .positive("Nominal harus lebih dari 0");

export const requiredStringSchema = z
  .string()
  .trim()
  .min(1, "Wajib diisi");
