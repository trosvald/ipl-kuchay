"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  residentNotificationCategorySchema,
  residentNotificationPreferencesSchema,
  residentSettingsProfileSchema,
} from "@/lib/validation";
import { useAuth } from "../auth/authHooks";

type NotificationCategory = "billing_reminders" | "payment_status" | "announcements" | "events";

interface NotificationPreferenceRow {
  category: NotificationCategory;
  in_app_enabled: boolean;
  telegram_enabled: boolean;
}

interface TelegramAccountInfo {
  username: string | null;
  first_name: string | null;
  linked_at: string | null;
}

const notificationCategoryLabels: Record<NotificationCategory, string> = {
  billing_reminders: "Pengingat tagihan",
  payment_status: "Status pembayaran",
  announcements: "Pengumuman warga",
  events: "Agenda acara",
};

const allCategories: NotificationCategory[] = [
  "billing_reminders",
  "payment_status",
  "announcements",
  "events",
];

function buildDefaultPreferences(profileId: string): Array<NotificationPreferenceRow & { profile_id: string }> {
  return allCategories.map((category) => ({
    profile_id: profileId,
    category,
    in_app_enabled: true,
    telegram_enabled: false,
  }));
}

export function ResidentSettingsPage() {
  const client = getSupabaseBrowserClient();
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [preferences, setPreferences] = useState<NotificationPreferenceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [telegramAccount, setTelegramAccount] = useState<TelegramAccountInfo | null>(null);
  const [isLoadingTelegram, setIsLoadingTelegram] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.display_name, profile?.phone]);

  const loadPreferences = useCallback(async () => {
    if (!client || !profile) {
      setIsLoading(false);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const { data, error } = await client
      .from("notification_preferences")
      .select("category, in_app_enabled, telegram_enabled")
      .eq("profile_id", profile.id);

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      const defaults = buildDefaultPreferences(profile.id);
      const { error: upsertDefaultsError } = await client
        .from("notification_preferences")
        .upsert(defaults, { onConflict: "profile_id,category" });

      if (upsertDefaultsError) {
        setErrorMessage(upsertDefaultsError.message);
        setIsLoading(false);
        return;
      }

      setPreferences(defaults.map(({ profile_id: _profileId, ...row }) => row));
      setIsLoading(false);
      return;
    }

    const byCategory = new Map(
      data.map((row) => [
        row.category as NotificationCategory,
        {
          category: row.category as NotificationCategory,
          in_app_enabled: row.in_app_enabled,
          telegram_enabled: row.telegram_enabled,
        },
      ]),
    );

    const normalized = allCategories.map((category) =>
      byCategory.get(category) ?? { category, in_app_enabled: true, telegram_enabled: false },
    );

    setPreferences(normalized);
    setIsLoading(false);
  }, [client, profile]);

  useEffect(() => {
    loadPreferences().catch(() => {
      setErrorMessage("Gagal memuat preferensi notifikasi.");
      setIsLoading(false);
    });
  }, [loadPreferences]);

  // Load Telegram account link state (D-14 through D-17)
  useEffect(() => {
    if (!client || !profile) {
      setIsLoadingTelegram(false);
      return;
    }

    const loadTelegram = async () => {
      try {
        const { data, error } = await client
          .from("telegram_accounts")
          .select("username, first_name, linked_at")
          .eq("profile_id", profile.id)
          .maybeSingle();

        if (!error && data) {
          setTelegramAccount(data as TelegramAccountInfo);
        } else {
          setTelegramAccount(null);
        }
      } catch {
        setTelegramAccount(null);
      } finally {
        setIsLoadingTelegram(false);
      }
    };

    loadTelegram();
  }, [client, profile]);

  const handleLinkTelegram = async () => {
    if (!client) return;

    setIsLinking(true);
    setErrorMessage(null);
    setDeepLink(null);

    try {
      const { data, error } = await client.functions.invoke<{
        plain_token: string;
        deep_link: string;
      }>("link-telegram-account", { body: {} });

      if (error || !data?.deep_link) {
        setErrorMessage("Gagal membuat tautan Telegram. Silakan coba lagi.");
      } else {
        setDeepLink(data.deep_link);
      }
    } catch {
      setErrorMessage("Gagal menghubungi server. Silakan coba lagi.");
    }

    setIsLinking(false);
  };

  const protectedIdentityRows = useMemo(
    () => [
      {
        label: "Nama lengkap",
        value: profile?.full_name ?? "-",
      },
      {
        label: "Email login",
        value: profile?.email ?? "-",
      },
      {
        label: "Peran akun",
        value: profile?.role ?? "-",
      },
      {
        label: "Status akun",
        value: profile?.is_active ? "Aktif" : "Nonaktif",
      },
    ],
    [profile?.email, profile?.full_name, profile?.is_active, profile?.role],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !profile) {
      setErrorMessage("Sesi login tidak tersedia.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const profileValidation = residentSettingsProfileSchema.safeParse({
      display_name: displayName,
      phone,
    });
    if (!profileValidation.success) {
      setErrorMessage(profileValidation.error.issues[0]?.message ?? "Data profil tidak valid.");
      return;
    }

    const preferenceValidation = residentNotificationPreferencesSchema.safeParse({ rows: preferences });
    if (!preferenceValidation.success) {
      setErrorMessage(preferenceValidation.error.issues[0]?.message ?? "Data preferensi tidak valid.");
      return;
    }

    setIsSubmitting(true);

    const { error: updateProfileError } = await client.rpc("update_own_profile", {
      new_display_name: profileValidation.data.display_name ?? "",
      new_phone: profileValidation.data.phone ?? "",
    });

    if (updateProfileError) {
      setErrorMessage(updateProfileError.message);
      setIsSubmitting(false);
      return;
    }

    const payload = preferenceValidation.data.rows.map((row) => ({
      profile_id: profile.id,
      category: row.category,
      in_app_enabled: row.in_app_enabled,
      telegram_enabled: row.telegram_enabled,
    }));

    const { error: upsertPreferenceError } = await client
      .from("notification_preferences")
      .upsert(payload, { onConflict: "profile_id,category" });

    if (upsertPreferenceError) {
      setErrorMessage(upsertPreferenceError.message);
      setIsSubmitting(false);
      return;
    }

    await refreshProfile();
    setSuccessMessage("Perubahan profil dan preferensi berhasil disimpan.");
    setIsSubmitting(false);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2 border-b pb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Pengaturan Warga</p>
        <h2 className="text-xl font-semibold text-foreground">Profil & Preferensi Notifikasi</h2>
        <p className="text-sm text-muted-foreground">
          Anda dapat memperbarui nama tampilan, nomor telepon, dan preferensi notifikasi berdasarkan kategori.
        </p>
      </header>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="space-y-4 rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-semibold text-foreground">Data yang bisa diubah</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Nama tampilan</span>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nama tampilan" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Nomor telepon</span>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Contoh: 0812xxxx" />
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Data identitas terlindungi (read-only)</h3>
            <p className="text-xs text-muted-foreground">
              Data berikut dikunci untuk menjaga keamanan identitas akun. Hubungi pengurus bila perlu perubahan.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {protectedIdentityRows.map((row) => (
              <div key={row.label} className="rounded-md border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-sm font-medium text-foreground">{row.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-semibold text-foreground">Akun Telegram</h3>
          {isLoadingTelegram ? (
            <p className="text-sm text-muted-foreground">Memuat data Telegram...</p>
          ) : telegramAccount ? (
            <div className="space-y-2">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Username Telegram</p>
                  <p className="text-sm font-medium text-foreground">@{telegramAccount.username ?? "-"}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Nama Telegram</p>
                  <p className="text-sm font-medium text-foreground">{telegramAccount.first_name ?? "-"}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Terhubung sejak</p>
                  <p className="text-sm font-medium text-foreground">
                    {telegramAccount.linked_at ? new Date(telegramAccount.linked_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Untuk memutuskan akun Telegram, gunakan perintah /unlink dari Telegram.
              </p>
            </div>
          ) : deepLink ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Klik tautan berikut untuk menghubungkan akun Telegram kamu:
              </p>
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Hubungkan di Telegram
              </a>
              <p className="text-xs text-muted-foreground">
                Tautan berlaku 15 menit. Setelah terhubung, refresh halaman ini untuk melihat status.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Hubungkan akun Telegram kamu untuk menerima notifikasi tagihan, status pembayaran, dan pengumuman warga.
              </p>
              <Button onClick={handleLinkTelegram} disabled={isLinking} variant="default" size="sm">
                {isLinking ? "Membuat tautan..." : "Hubungkan Telegram"}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-semibold text-foreground">Preferensi notifikasi per kategori</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat preferensi...</p>
          ) : (
            <div className="space-y-3">
              {preferences.map((row) => (
                <div key={row.category} className="rounded-md border border-border px-3 py-3">
                  <p className="mb-2 text-sm font-medium text-foreground">{notificationCategoryLabels[row.category]}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.in_app_enabled}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setPreferences((prev) => prev.map((item) => (item.category === row.category ? { ...item, in_app_enabled: checked } : item)));
                        }}
                      />
                      In-app
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.telegram_enabled}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setPreferences((prev) => prev.map((item) => (item.category === row.category ? { ...item, telegram_enabled: checked } : item)));
                        }}
                      />
                      Telegram
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {errorMessage ? <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
        {successMessage ? (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>
        ) : null}

        <div className="flex items-center justify-between">
          <Badge variant={profile?.is_active ? "success" : "destructive"}>
            {profile?.is_active ? "Akun aktif" : "Akun nonaktif"}
          </Badge>
          <Button type="submit" disabled={isSubmitting || isLoading}>
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </section>
  );
}
