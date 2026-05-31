"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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
    <Card className="rounded-2xl border-0 bg-white shadow-sm ring-1 ring-slate-200">
      <CardHeader className="px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <CreditCard className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">Gateway Pembayaran (QRIS)</CardTitle>
            <CardDescription>Aktifkan/nonaktifkan fitur pembayaran QRIS untuk warga.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        <Separator />

        {/* Status row */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/60">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-900">Status Gateway</p>
            <p className="text-xs text-slate-500">
              {enabled ? "Warga dapat melakukan pembayaran via QRIS" : "Hanya transfer manual yang tersedia"}
            </p>
          </div>
          <Badge variant={enabled ? "success" : "secondary"} className="gap-1.5 px-3 py-1 text-xs font-semibold">
            <span className={cn("inline-block size-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-slate-400")} />
            {enabled ? "QRIS Aktif" : "QRIS Nonaktif"}
          </Badge>
        </div>

        {/* Info callout */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-3 text-sm text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="leading-relaxed">
            Transfer manual adalah baseline peluncuran. Saat QRIS dinonaktifkan, alur kirim bukti transfer manual tetap berjalan penuh.
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{errorMessage}</div>
        ) : null}
        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{successMessage}</div>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <Button
            variant={enabled ? "destructive" : "default"}
            onClick={handleToggle}
            disabled={loading || saving}
            className="min-w-[10rem]"
          >
            {saving ? "Menyimpan..." : enabled ? "Nonaktifkan QRIS" : "Aktifkan QRIS"}
          </Button>
          {loading ? (
            <span className="text-xs text-slate-400">Memuat status...</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
