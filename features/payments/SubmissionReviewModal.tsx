"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/format";

export interface SubmissionReviewTarget {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  kavlingCode: string;
  amountSubmitted: number;
}

interface SubmissionReviewModalProps {
  open: boolean;
  mode: "approve" | "reject";
  target: SubmissionReviewTarget | null;
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (inputText: string | null) => Promise<void> | void;
}

export function SubmissionReviewModal({
  open,
  mode,
  target,
  saving,
  errorMessage,
  onClose,
  onConfirm,
}: Readonly<SubmissionReviewModalProps>) {
  const [textValue, setTextValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTextValue("");
      setValidationError(null);
    }
  }, [open, mode, target?.id]);

  const title = mode === "approve" ? "Setujui Submission" : "Tolak Submission";
  const description = useMemo(() => {
    if (mode === "approve") {
      return "Catatan admin opsional. Sistem akan membuat payment, hitung ulang status invoice, dan tulis audit log.";
    }
    return "Alasan penolakan wajib minimal 3 karakter.";
  }, [mode]);

  if (!open || !target) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = textValue.trim();
    if (mode === "reject" && trimmed.length < 3) {
      setValidationError("Alasan penolakan minimal 3 karakter.");
      return;
    }

    setValidationError(null);
    await onConfirm(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <Card className="w-full max-w-xl border-slate-200">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span>{title}</span>
            <Badge variant={mode === "approve" ? "success" : "destructive"}>{mode === "approve" ? "Approve" : "Reject"}</Badge>
          </CardTitle>
          <div className="space-y-1 text-sm text-slate-600">
            <p>
              Invoice <span className="font-medium text-slate-900">{target.invoiceNumber}</span> / Kavling{" "}
              <span className="font-medium text-slate-900">{target.kavlingCode}</span>
            </p>
            <p>
              Nominal submission: <span className="font-medium text-slate-900">{formatRupiah(target.amountSubmitted)}</span>
            </p>
            <p>{description}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="space-y-2 text-sm text-slate-700">
              <span>{mode === "approve" ? "Catatan admin (opsional)" : "Alasan penolakan"}</span>
              <Input
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
                placeholder={mode === "approve" ? "Misal: nominal sesuai mutasi" : "Misal: bukti transfer tidak terbaca"}
                maxLength={500}
              />
            </label>
            {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" variant={mode === "approve" ? "default" : "destructive"} disabled={saving}>
                {saving ? "Menyimpan..." : mode === "approve" ? "Setujui" : "Tolak"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
