"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openSignedArtifactUrl } from "@/lib/privateArtifact";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

interface SignedUrlResponse {
  signedUrl?: string;
  error?: string;
}

interface ProofPreviewButtonProps {
  submissionId: string;
  disabled?: boolean;
}

export function ProofPreviewButton({
  submissionId,
  disabled = false,
}: Readonly<ProofPreviewButtonProps>) {
  const client = getSupabaseBrowserClient();
  const [opening, setOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenProof = async () => {
    if (!client || opening || disabled) {
      return;
    }

    setOpening(true);
    setErrorMessage(null);

    const { data, error } = await client.functions.invoke<SignedUrlResponse>("get-proof-signed-url", {
      body: {
        submissionId,
      },
    });

    if (error || !data?.signedUrl) {
      setErrorMessage(data?.error ?? error?.message ?? "Gagal membuka bukti pembayaran.");
      setOpening(false);
      return;
    }

    try {
      await openSignedArtifactUrl(data.signedUrl);
    } catch {
      setErrorMessage("Gagal membuka bukti pembayaran.");
      setOpening(false);
      return;
    }

    setOpening(false);
  };

  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={disabled || opening} onClick={handleOpenProof}>
        <ExternalLink className="size-4" /> {opening ? "Membuka..." : "Buka Bukti"}
      </Button>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
