import { format, isValid, parse, startOfMonth } from "date-fns";
import { id } from "date-fns/locale";

export function parseIsoDateInput(value: string): Date | null {
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) {
    return null;
  }
  return parsed;
}

export function toBillingAnchorDate(year: number, month: number): Date {
  return startOfMonth(new Date(year, month - 1, 1));
}

export function formatPeriodLabel(year: number, month: number): string {
  return format(toBillingAnchorDate(year, month), "LLLL yyyy", { locale: id });
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isValidBillingMonth(year: number, month: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return false;
  }
  if (year < 2020 || year > 2100) {
    return false;
  }
  return month >= 1 && month <= 12;
}
