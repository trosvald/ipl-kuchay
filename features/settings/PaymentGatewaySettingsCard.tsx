"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useIsOperatorRole } from "@/features/auth/authHooks";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const PAYMENT_GATEWAY_SETTING_KEY = "payment_gateway";
const PAYMENT_GATEWAY_SETTING_DESCRIPTION = "Konfigurasi fitur gateway pembayaran QRIS untuk peluncuran bertahap.";

interface PaymentGatewaySettingRow {
  key: string;
  value: unknown;
}

export function isPaymentGatewayEnabledFromSetting(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const enabled = (value as { enabled?: unknown }).enabled;
  return enabled === true;
}

export function buildPaymentGatewayUpsertPayload(enabled: boolean, actorId: string) {
  return {
    key: PAYMENT_GATEWAY_SETTING_KEY,
    value: { enabled },
    description: PAYMENT_GATEWAY_SETTING_DESCRIPTION,
    updated_by: actorId,
  };
}

export function PaymentGatewaySettingsCard() {
  const client = getSupabaseBrowserClient();
  const { profile } = useAuth();
  const canManageGateway = useIsOperatorRole();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSetting = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client
      .from("app_settings")
      .select("key, value")
      .eq("key", PAYMENT_GATEWAY_SETTING_KEY)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const row = data as PaymentGatewaySettingRow | null;
    setEnabled(isPaymentGatewayEnabledFromSetting(row?.value ?? null));
    setLoading(false);
  }, [client]);

  useEffect(() => {
    if (!canManageGateway) {
      setLoading(false);
      return;
    }

    loadSetting().catch(() => {
      setErrorMessage("Gagal memuat konfigurasi gateway pembayaran.");
      setLoading(false);
    });
  }, [canManageGateway, loadSetting]);

  const handleToggle = async () => {
    if (!client || !profile) {
      setErrorMessage("Sesi admin tidak valid.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const nextEnabled = !enabled;
    const payload = buildPaymentGatewayUpsertPayload(nextEnabled, profile.id);

    const { error } = await client
      .from("app_settings")
      .upsert(payload, { onConflict: "key" });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setEnabled(nextEnabled);
    setSuccessMessage(nextEnabled ? "QRIS berhasil diaktifkan." : "QRIS berhasil dinonaktifkan.");
    setSaving(false);
  };

  if (!canManageGateway) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pengaturan Gateway Pembayaran (QRIS)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Transfer manual adalah baseline peluncuran. Saat QRIS dinonaktifkan, alur kirim bukti transfer manual harus tetap berjalan penuh.
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Status saat ini: <strong>{enabled ? "QRIS aktif" : "QRIS nonaktif"}</strong>
        </div>

        {errorMessage ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
        {successMessage ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p> : null}

        <Button onClick={handleToggle} disabled={loading || saving}>
          {saving ? "Menyimpan..." : enabled ? "Nonaktifkan QRIS" : "Aktifkan QRIS"}
        </Button>
      </CardContent>
    </Card>
  );
}
