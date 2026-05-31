import type { NextConfig } from "next";

function buildSecurityHeaders() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const connectSources = new Set<string>([
    "'self'",
    "https:",
    "wss:",
  ]);

  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      connectSources.add(parsed.origin);
      if (parsed.protocol === "https:") {
        connectSources.add(`wss://${parsed.host}`);
      }
      if (parsed.protocol === "http:") {
        connectSources.add(`ws://${parsed.host}`);
      }
    } catch {
      // Ignore malformed local env values and fall back to broad https/wss rules.
    }
  }

  const headers = [
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push(
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline'",
          `connect-src ${Array.from(connectSources).join(" ")}`,
          "frame-src 'self' https:",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "upgrade-insecure-requests",
        ].join("; "),
      },
    );
  }

  return headers;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["10.25.12.221", "localhost", "127.0.0.1"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
