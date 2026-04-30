import { format } from "date-fns";
import { id } from "date-fns/locale";

import { formatPeriodLabel } from "@/lib/date";

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

export function formatMonthYearId(year: number, month: number): string {
  return formatPeriodLabel(year, month);
}

export function formatInvoiceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    unpaid: "Belum dibayar",
    pending_verification: "Menunggu verifikasi",
    partial: "Dibayar sebagian",
    paid: "Lunas",
    rejected: "Ditolak",
    waived: "Dibebaskan",
    cancelled: "Dibatalkan",
    overdue: "Jatuh tempo lewat",
  };

  return map[status] ?? status;
}

export function formatBillingPeriodStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    open: "Open",
    closed: "Closed",
    archived: "Archived",
  };

  return map[status] ?? status;
}

export function statusToBadgeVariant(status: string): "secondary" | "success" | "destructive" | "outline" {
  if (status === "paid" || status === "open") {
    return "success";
  }

  if (status === "closed" || status === "rejected" || status === "cancelled" || status === "overdue") {
    return "destructive";
  }

  if (status === "pending_verification" || status === "partial") {
    return "outline";
  }

  return "secondary";
}

export function formatPaymentSubmissionStatus(status: string): string {
  if (status === "submitted") {
    return "Menunggu verifikasi";
  }
  if (status === "verified") {
    return "Terverifikasi";
  }
  if (status === "rejected") {
    return "Ditolak";
  }
  if (status === "cancelled") {
    return "Dibatalkan";
  }
  return status;
}

export function buildRejectionGuidance(status: string, reason: string): string | null {
  if (status !== "rejected") {
    return null;
  }
  if (reason && reason.trim().length > 0) {
    return `Submission ditolak: ${reason.trim()}. Silakan kirim submission baru dengan bukti yang benar.`;
  }
  return "Submission ditolak. Silakan kirim submission baru dengan bukti yang benar.";
}

export function formatSubmissionNextStep(status: string): string | null {
  if (status === "submitted") {
    return "Menunggu verifikasi oleh tim kami.";
  }
  if (status === "verified") {
    return "Pembayaran sudah diverifikasi. Invoice telah dilunasi.";
  }
  if (status === "rejected") {
    return "Silakan kirim submission baru dengan bukti yang benar.";
  }
  if (status === "cancelled") {
    return null;
  }
  return null;
}
