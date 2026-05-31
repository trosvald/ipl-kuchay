"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, KeyRound, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/authHooks";
import { getAuthenticatedLandingPath } from "@/features/auth/authRouting";
import { APP_NAME } from "@/lib/constants";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { passwordSetupFormSchema } from "@/lib/validation";

export function SetPasswordPage() {
  const { loading: authLoading, needsPasswordSetup, refreshProfile, role, session } = useAuth();
  const client = getSupabaseBrowserClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && session && !needsPasswordSetup) {
      router.replace(getAuthenticatedLandingPath(role));
    }
  }, [authLoading, needsPasswordSetup, role, router, session]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!client || !session) {
      setErrorMessage("Sesi undangan tidak ditemukan. Minta pengurus mengirim ulang undangan.");
      return;
    }

    const result = passwordSetupFormSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!result.success) {
      setErrorMessage(result.error.issues[0]?.message ?? "Password belum valid.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const currentMetadata =
      session.user.user_metadata && typeof session.user.user_metadata === "object"
        ? session.user.user_metadata
        : {};

    const { error } = await client.auth.updateUser({
      password: result.data.password,
      data: {
        ...currentMetadata,
        password_setup_completed: true,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    await refreshProfile();
    setSuccessMessage("Password berhasil dibuat. Anda akan diarahkan ke portal.");
    setSubmitting(false);
    setPassword("");
    setConfirmPassword("");
  };

  const isInviteUnavailable = !authLoading && !session;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_36%),linear-gradient(to_bottom,#f8fafc,#ffffff)] px-4 py-8 sm:px-6">
      <section className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200/70 ring-4 ring-white">
            <LockKeyhole className="size-7" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">{APP_NAME}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Buat Password</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Selesaikan aktivasi akun undangan Anda dengan membuat password baru.
          </p>
        </div>

        <Card className="overflow-hidden rounded-[1.75rem] border-0 bg-white/95 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200 backdrop-blur">
          <CardContent className="space-y-5 p-5 sm:p-6">
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

            {isInviteUnavailable ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Link undangan tidak valid, sudah dipakai, atau sudah kedaluwarsa.
                </div>
                <Button asChild className="h-11 w-full rounded-2xl" variant="outline">
                  <Link href="/login">Kembali ke login</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="set-password">
                    Password baru
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 ring-1 ring-transparent transition focus-within:border-blue-300 focus-within:ring-blue-100">
                    <LockKeyhole className="size-4 shrink-0 text-slate-400" />
                    <Input
                      id="set-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.currentTarget.value)}
                      placeholder="Minimal 8 karakter"
                      autoComplete="new-password"
                      className="h-11 border-0 bg-transparent px-0 shadow-none ring-0 focus-visible:ring-0"
                      disabled={authLoading || submitting}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="confirm-password">
                    Konfirmasi password
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 ring-1 ring-transparent transition focus-within:border-blue-300 focus-within:ring-blue-100">
                    <LockKeyhole className="size-4 shrink-0 text-slate-400" />
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                      placeholder="Ulangi password baru"
                      autoComplete="new-password"
                      className="h-11 border-0 bg-transparent px-0 shadow-none ring-0 focus-visible:ring-0"
                      disabled={authLoading || submitting}
                      required
                    />
                  </div>
                </div>

                <Button
                  className="h-11 w-full rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
                  size="lg"
                  disabled={authLoading || submitting}
                >
                  <KeyRound className="size-4" />
                  {submitting ? "Menyimpan..." : "Simpan password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
