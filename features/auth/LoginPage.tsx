"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, CheckCircle2, KeyRound, LockKeyhole, Mail, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_NAME } from "@/lib/constants";
import { useAuth } from "./authHooks";
import { canRedirectAfterAuthResolution, getAuthenticatedLandingPath } from "./authRouting";

export function LoginPage({ reason }: Readonly<{ reason?: string }>) {
  const { accessState, loading: authLoading, role, session, signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingMagicLink, setLoadingMagicLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const inactiveProfileMessage = useMemo(() => {
    return reason === "inactive_profile"
      ? "Profil Anda nonaktif. Hubungi pengurus untuk aktivasi ulang akun."
      : null;
  }, [reason]);

  useEffect(() => {
    if (
      canRedirectAfterAuthResolution({
        loading: authLoading,
        hasSession: Boolean(session),
        accessState,
      })
    ) {
      router.replace(getAuthenticatedLandingPath(role));
    }
  }, [accessState, authLoading, role, router, session]);

  const onSubmitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingPassword(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData(event.currentTarget);
      const submittedEmail = String(formData.get("email") ?? "").trim();
      const submittedPassword = String(formData.get("password") ?? "");

      if (!submittedEmail || !submittedPassword) {
        throw new Error("Email dan password wajib diisi.");
      }

      await signIn({ email: submittedEmail, password: submittedPassword });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login gagal.");
    } finally {
      setLoadingPassword(false);
    }
  };

  const onSendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingMagicLink(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await signIn({ email: email.trim(), magicLink: true });
      setSuccessMessage("Link masuk terkirim. Cek email Anda.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengirim link masuk.");
    } finally {
      setLoadingMagicLink(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_36%),linear-gradient(to_bottom,#f8fafc,#ffffff)] px-4 py-8 sm:px-6">
      <section className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200/70 ring-4 ring-white">
            <Building2 className="size-7" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">{APP_NAME}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Login</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Masuk ke portal warga dan admin untuk mengelola tagihan, informasi, dan aktivitas lingkungan.
          </p>
        </div>

        <Card className="overflow-hidden rounded-[1.75rem] border-0 bg-white/95 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200 backdrop-blur">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <LockKeyhole className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Akses portal</p>
                  <p className="text-xs text-slate-500">Gunakan akun yang sudah diaktifkan oleh pengurus.</p>
                </div>
              </div>
            </div>

            {inactiveProfileMessage ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{inactiveProfileMessage}</p>
              </div>
            ) : null}
            {errorMessage ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            ) : null}
            {successMessage ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <p>{successMessage}</p>
              </div>
            ) : null}

            <form className="space-y-3" onSubmit={onSubmitPassword}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="login-email">
                  Email
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 ring-1 ring-transparent transition focus-within:border-blue-300 focus-within:ring-blue-100">
                  <Mail className="size-4 shrink-0 text-slate-400" />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                    className="h-11 border-0 bg-transparent px-0 shadow-none ring-0 focus-visible:ring-0"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="login-password">
                  Password
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 ring-1 ring-transparent transition focus-within:border-blue-300 focus-within:ring-blue-100">
                  <LockKeyhole className="size-4 shrink-0 text-slate-400" />
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    className="h-11 border-0 bg-transparent px-0 shadow-none ring-0 focus-visible:ring-0"
                    required
                  />
                </div>
              </div>

              <Button className="h-11 w-full rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700" size="lg" disabled={loadingPassword}>
                <KeyRound className="size-4" />
                {loadingPassword ? "Memproses..." : "Masuk"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white px-3 text-slate-400">atau</span>
              </div>
            </div>

            <form onSubmit={onSendMagicLink}>
              <Button
                variant="outline"
                className="h-11 w-full rounded-2xl border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                size="lg"
                disabled={loadingMagicLink || email.trim() === ""}
              >
                <MailCheck className="size-4" />
                {loadingMagicLink ? "Mengirim..." : "Kirim link masuk"}
              </Button>
            </form>

            <div className="grid gap-3 rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600 ring-1 ring-slate-200/80 sm:grid-cols-2">
              <div>
                <p className="font-medium text-slate-900">Portal Warga</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Lihat tagihan, pengumuman, acara, dan status pembayaran.</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Portal Admin</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Kelola verifikasi, billing, laporan, dan data lingkungan.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="px-2 text-center text-xs text-slate-500">
          Belum punya akses? Hubungi pengurus {APP_NAME}.
        </p>
      </section>
    </main>
  );
}
