"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/authHooks";
import {
  buildPaymentProofPath,
  isAllowedPaymentProofMimeType,
  type PaymentProofMimeType,
  validatePaymentProofFile,
} from "@/lib/storage";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { paymentSubmissionFormSchema } from "@/lib/validation";

interface BankAccountOption {
  id: string;
  label: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_default: boolean;
}

interface CreateSubmissionResponse {
  submissionId?: string;
  error?: string;
}

interface AttachProofResponse {
  success?: boolean;
  error?: string;
}

interface PaymentSubmissionFormProps {
  invoiceId: string;
  invoiceStatus: string;
  outstandingAmount: number;
  onSubmitted: () => Promise<void> | void;
}

interface PreparedSubmissionInput {
  authUserId: string;
  proofFile: File;
  proofMimeType: PaymentProofMimeType;
  payload: {
    invoiceId: string;
    amountSubmitted: number;
    bankAccountId: string;
    note?: string;
  };
}

const SUBMITTABLE_STATUSES = new Set(["unpaid", "overdue", "rejected", "partial"]);

export function canSubmitManualTransfer(invoiceStatus: string, outstandingAmount: number): boolean {
  return SUBMITTABLE_STATUSES.has(invoiceStatus) && outstandingAmount > 0;
}

function readFunctionError<T extends { error?: string }>(payload: T | null, fallbackMessage: string): string {
  if (!payload?.error) {
    return fallbackMessage;
  }

  return payload.error;
}

export function PaymentSubmissionForm({
  invoiceId,
  invoiceStatus,
  outstandingAmount,
  onSubmitted,
}: Readonly<PaymentSubmissionFormProps>) {
  const client = getSupabaseBrowserClient();
  const { session } = useAuth();

  const [amountSubmitted, setAmountSubmitted] = useState(() => String(Math.max(outstandingAmount, 0)));
  const [bankAccountId, setBankAccountId] = useState("");
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return canSubmitManualTransfer(invoiceStatus, outstandingAmount);
  }, [invoiceStatus, outstandingAmount]);

  const loadBankAccounts = useCallback(async () => {
    if (!client) {
      setLoadingAccounts(false);
      setErrorMessage("Supabase client tidak tersedia.");
      return;
    }

    setLoadingAccounts(true);
    const { data, error } = await client
      .from("bank_accounts")
      .select("id, label, bank_name, account_number, account_holder, is_default")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("label", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setBankAccounts([]);
      setLoadingAccounts(false);
      return;
    }

    const nextAccounts = (data ?? []) as BankAccountOption[];
    setBankAccounts(nextAccounts);
    setBankAccountId((current) => current || nextAccounts[0]?.id || "");
    setLoadingAccounts(false);
  }, [client]);

  useEffect(() => {
    loadBankAccounts().catch(() => {
      setErrorMessage("Gagal memuat rekening tujuan transfer.");
      setLoadingAccounts(false);
    });
  }, [loadBankAccounts]);

  useEffect(() => {
    if (!amountSubmitted || Number(amountSubmitted) <= 0) {
      setAmountSubmitted(String(Math.max(outstandingAmount, 0)));
    }
  }, [amountSubmitted, outstandingAmount]);

  const prepareSubmissionInput = (): PreparedSubmissionInput | null => {
    if (!client) {
      setErrorMessage("Supabase client tidak tersedia.");
      return null;
    }

    if (!session?.user.id) {
      setErrorMessage("Sesi login tidak valid.");
      return null;
    }

    if (!canSubmit) {
      setErrorMessage("Invoice ini tidak bisa menerima bukti pembayaran baru.");
      return null;
    }

    if (!proofFile) {
      setErrorMessage("File bukti pembayaran wajib dipilih.");
      return null;
    }

    const proofFileError = validatePaymentProofFile(proofFile);
    if (proofFileError) {
      setErrorMessage(proofFileError);
      return null;
    }

    const parsed = paymentSubmissionFormSchema.safeParse({
      invoiceId,
      amountSubmitted: Number(amountSubmitted),
      bankAccountId,
      note,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Input tidak valid.");
      return null;
    }

    if (parsed.data.amountSubmitted > outstandingAmount) {
      setErrorMessage("Nominal tidak boleh melebihi sisa tagihan.");
      return null;
    }

    if (!isAllowedPaymentProofMimeType(proofFile.type)) {
      setErrorMessage("Format bukti tidak didukung.");
      return null;
    }

    return {
      authUserId: session.user.id,
      proofFile,
      proofMimeType: proofFile.type,
      payload: parsed.data,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const preparedInput = prepareSubmissionInput();
    if (!preparedInput || !client) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let submissionId: string | null = null;

    try {
      const createRes = await client.functions.invoke<CreateSubmissionResponse>("create-payment-submission", {
        body: preparedInput.payload,
      });

      if (createRes.error || !createRes.data?.submissionId) {
        throw new Error(readFunctionError(createRes.data ?? null, createRes.error?.message ?? "Gagal membuat submission."));
      }

      submissionId = createRes.data.submissionId;

      // D-06: notify admin-like users about the new pending submission (fire-and-forget, T-05-14)
      client.functions
        .invoke("send-telegram-notification", {
          body: {
            template_code: "admin_pending_submission",
            related_invoice_id: invoiceId,
            related_submission_id: submissionId,
          },
        })
        .catch(() => {});

      const proofPath = buildPaymentProofPath({
        authUserId: preparedInput.authUserId,
        invoiceId,
        submissionId,
        mimeType: preparedInput.proofMimeType,
      });

      const uploadRes = await client.storage.from("payment-proofs").upload(proofPath, preparedInput.proofFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: preparedInput.proofFile.type,
      });

      if (uploadRes.error) {
        throw new Error(uploadRes.error.message);
      }

      const attachRes = await client.functions.invoke<AttachProofResponse>("attach-payment-proof", {
        body: {
          submissionId,
          proofPath,
          mimeType: preparedInput.proofFile.type,
          sizeBytes: preparedInput.proofFile.size,
        },
      });

      if (attachRes.error || !attachRes.data?.success) {
        throw new Error(readFunctionError(attachRes.data ?? null, attachRes.error?.message ?? "Gagal menyimpan metadata bukti."));
      }

      setProofFile(null);
      setNote("");
      setSuccessMessage("Bukti pembayaran berhasil dikirim. Status invoice: Menunggu verifikasi.");

      await onSubmitted();
    } catch (error) {
      if (submissionId) {
        await client.functions.invoke("cancel-payment-submission", {
          body: {
            submissionId,
            reason: "upload_failed",
          },
        });
      }

      setErrorMessage(error instanceof Error ? error.message : "Gagal mengirim bukti pembayaran.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kirim Bukti Transfer Manual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p>Nominal sisa tagihan saat ini: Rp {outstandingAmount.toLocaleString("id-ID")}</p>
          {canSubmit ? null : <p className="mt-1 text-xs text-red-600">Invoice ini saat ini tidak menerima submission baru.</p>}
        </div>

        {errorMessage ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
        {successMessage ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p> : null}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Nominal transfer</span>
            <Input
              type="number"
              min={1}
              max={Math.max(outstandingAmount, 1)}
              step={1}
              value={amountSubmitted}
              onChange={(event) => setAmountSubmitted(event.target.value)}
              disabled={saving || !canSubmit}
              required
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Rekening tujuan</span>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
              value={bankAccountId}
              onChange={(event) => setBankAccountId(event.target.value)}
              disabled={saving || loadingAccounts || !canSubmit}
              required
            >
              {bankAccounts.length === 0 ? <option value="">Tidak ada rekening aktif</option> : null}
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.is_default ? "[Default] " : ""}
                  {account.label} - {account.bank_name} {account.account_number} a/n {account.account_holder}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Bukti transfer (JPG, PNG, WEBP, PDF - max 5 MB)</span>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
              disabled={saving || !canSubmit}
              required
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Catatan (opsional)</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              disabled={saving || !canSubmit}
              placeholder="Catatan tambahan jika diperlukan"
            />
          </label>

          <Button type="submit" disabled={saving || !canSubmit || bankAccounts.length === 0}>
            {saving ? "Mengirim..." : "Kirim Bukti"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
