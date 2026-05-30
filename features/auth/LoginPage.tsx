"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, KeyRound, MailCheck } from "lucide-react";

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
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-8 sm:px-6">
      <section className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight text-foreground">IPL Jatiloka</p>
          <p className="mt-1 text-sm text-muted-foreground">Residence</p>
        </div>

        <Card className="border-slate-200 bg-white shadow-lg">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Login</h1>
              <p className="text-sm text-muted-foreground">Masuk untuk membuka portal warga.</p>
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
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  placeholder="nama@email.com"
                  autoComplete="email"
                  className="h-10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="login-password">
                  Password
                </label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  className="h-10"
                  required
                />
              </div>

              <Button className="h-10 w-full" size="lg" disabled={loadingPassword}>
                <KeyRound className="size-4" />
                {loadingPassword ? "Memproses..." : "Masuk"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white px-2 text-muted-foreground">atau</span>
              </div>
            </div>

            <form onSubmit={onSendMagicLink}>
              <Button
                variant="outline"
                className="h-10 w-full"
                size="lg"
                disabled={loadingMagicLink || email.trim() === ""}
              >
                <MailCheck className="size-4" />
                {loadingMagicLink ? "Mengirim..." : "Kirim link masuk"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="px-2 text-center text-xs text-muted-foreground">
          Belum punya akses? Hubungi pengurus {APP_NAME}.
        </p>
      </section>
    </main>
  );
}
