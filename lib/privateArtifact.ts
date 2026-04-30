export async function openSignedArtifactUrl(signedUrl: string): Promise<void> {
  const popup = globalThis.open("", "_blank");
  if (popup) {
    popup.opener = null;
    popup.document.write("<p style=\"font-family: sans-serif; padding: 16px;\">Memuat dokumen...</p>");
  }

  try {
    const parsedUrl = new URL(signedUrl);
    const response = await fetch(signedUrl, {
      method: "GET",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`Failed to load artifact: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.arrayBuffer();
    const blob = parsedUrl.pathname.endsWith(".html")
      ? new Blob([body], { type: "text/html;charset=utf-8" })
      : new Blob([body], { type: contentType || "application/octet-stream" });
    const objectUrl = URL.createObjectURL(blob);

    if (popup && !popup.closed) {
      popup.location.replace(objectUrl);
    } else {
      globalThis.open(objectUrl, "_blank", "noopener,noreferrer");
    }

    globalThis.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60_000);
  } catch (error) {
    if (popup && !popup.closed) {
      popup.close();
    }
    throw error;
  }
}
