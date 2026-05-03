"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const QRIS_ELIGIBLE_STATUSES = new Set(["unpaid", "partial", "overdue", "rejected", "pending_verification"]);

interface CreateQrisResponse {
  transactionId?: string;
  providerOrderId?: string;
  status?: string;
  qrString?: string | null;
  qrImageUrl?: string | null;
  error?: string;
}

interface QrisPaymentPanelProps {
  invoiceId: string;
  invoiceStatus: string;
  outstandingAmount: number;
  gatewayEnabled: boolean;
}

export function canShowQrisPaymentAction(input: {
  gatewayEnabled: boolean;
  invoiceStatus: string;
  outstandingAmount: number;
}): boolean {
  if (!input.gatewayEnabled) {
    return false;
  }

  if (input.outstandingAmount <= 0) {
    return false;
  }

  return QRIS_ELIGIBLE_STATUSES.has(input.invoiceStatus);
}

export function QrisPaymentPanel({ invoiceId, invoiceStatus, outstandingAmount, gatewayEnabled }: Readonly<QrisPaymentPanelProps>) {
  const client = getSupabaseBrowserClient();
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrString, setQrString] = useState<string | null>(null);

  const canCreate = canShowQrisPaymentAction({
    gatewayEnabled,
    invoiceStatus,
    outstandingAmount,
  });

  if (!canCreate) {
    return null;
  }

  const handleCreateQris = async () => {
    if (!client) {
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data, error } = await client.functions.invoke<CreateQrisResponse>("create-qris-transaction", {
      body: { invoiceId },
    });

    if (error || data?.error) {
      setErrorMessage(data?.error ?? error?.message ?? "Gagal membuat transaksi QRIS.");
      setSaving(false);
      return;
    }

    setQrImageUrl(data?.qrImageUrl ?? null);
    setQrString(data?.qrString ?? null);
    setSuccessMessage("QRIS berhasil dibuat. Silakan scan QR untuk melanjutkan pembayaran.");
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pembayaran QRIS (Opsional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-700">
          Gunakan QRIS bila diperlukan. Jika tidak, Anda tetap bisa kirim bukti transfer manual seperti biasa.
        </p>

        {errorMessage ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
        {successMessage ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p> : null}

        <Button onClick={handleCreateQris} disabled={saving}>
          {saving ? "Membuat QRIS..." : "Buat QRIS"}
        </Button>

        {qrImageUrl ? (
          <a className="text-sm text-blue-700 underline" href={qrImageUrl} target="_blank" rel="noreferrer">
            Buka gambar QRIS
          </a>
        ) : null}

        {qrString ? <p className="text-xs break-all text-slate-500">QR String: {qrString}</p> : null}
      </CardContent>
    </Card>
  );
}
