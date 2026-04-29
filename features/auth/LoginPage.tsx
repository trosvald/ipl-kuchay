"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, MailCheck, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_NAME } from "@/lib/constants";
import { useAuth, useIsAdminLike } from "./authHooks";

export function LoginPage({
  reason,
}: Readonly<{ reason?: string }>) {
  const { accessState, session, signIn } = useAuth();
  const isAdminLike = useIsAdminLike();
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
    if (session && accessState !== "inactive" && accessState !== "missing-profile") {
      router.replace(isAdminLike ? "/admin" : "/app");
    }
  }, [accessState, isAdminLike, router, session]);

  const onSubmitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingPassword(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await signIn({ email: email.trim(), password });
      router.push(isAdminLike ? "/admin" : "/app");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login password gagal.",
      );
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
      setSuccessMessage("Magic link terkirim. Cek email Anda.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal kirim magic link.",
      );
    } finally {
      setLoadingMagicLink(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <ShieldCheck className="size-7 text-slate-700" />
              Masuk ke {APP_NAME}
            </CardTitle>
            <CardDescription className="text-base">
              Password adalah jalur login utama. Magic link tetap tersedia untuk onboarding undangan dan pemulihan akses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inactiveProfileMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {inactiveProfileMessage}
              </p>
            ) : null}
            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {errorMessage}
              </p>
            ) : null}
            {successMessage ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {successMessage}
              </p>
            ) : null}

            <form className="space-y-3" onSubmit={onSubmitPassword}>
              <label className="text-sm font-medium text-slate-700" htmlFor="login-email">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="nama@email.com"
                required
              />

              <label className="text-sm font-medium text-slate-700" htmlFor="login-password">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder="Masukkan password"
                required
              />

              <Button className="w-full" disabled={loadingPassword}>
                <KeyRound className="size-4" />
                {loadingPassword ? "Memproses..." : "Masuk dengan password"}
              </Button>
            </form>

            <form onSubmit={onSendMagicLink}>
              <Button
                variant="secondary"
                className="w-full"
                disabled={loadingMagicLink || email.trim() === ""}
              >
                <MailCheck className="size-4" />
                {loadingMagicLink ? "Mengirim..." : "Kirim magic link"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Akses dan Undangan</CardTitle>
            <CardDescription>
              Belum punya akses? Minta pengurus/admin membuat undangan akun terlebih dahulu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              Warga yang menerima undangan bisa mulai lewat magic link, lalu lanjutkan dengan membuat/menyimpan password
              untuk login berikutnya.
            </p>
            <p>
              Setelah login, Anda otomatis diarahkan sesuai peran: {" "}
              <span className="font-semibold text-slate-900">warga ke /app</span>,{" "}
              <span className="font-semibold text-slate-900">admin-like ke /admin</span>.
            </p>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/">
                <ArrowLeft className="size-4" />
                Kembali ke dashboard publik
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
