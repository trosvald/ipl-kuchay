import { format } from "date-fns";
import { id } from "date-fns/locale";

function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid date value");
  }

  return date;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateId(date: string | Date): string {
  return format(toDate(date), "d MMMM yyyy", { locale: id });
}
