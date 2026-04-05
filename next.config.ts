import type { NextConfig } from "next";
import path from "path";

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: false,
  workboxOptions: {
    disableDevLogs: true,
  },
  register: false,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, ".."),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https: wss:",
    ].join("; ");

    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ];

    const prodHeaders = isProd
      ? [
          { key: "Content-Security-Policy", value: `${csp}; upgrade-insecure-requests` },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ]
      : [];

    return [
      {
        source: "/:path*",
        headers: [...baseHeaders, ...prodHeaders],
      },
    ];
  },
  typescript: {
    // We also ignore typescript errors just in case, though tsc passed locally.
    ignoreBuildErrors: false,
  }
};

const config = withPWA(nextConfig);

// Remove experimental.turbo if injected by next-pwa, as it causes errors in Next.js 16
if (config.experimental?.turbo) {
  delete config.experimental.turbo;
}

export default config;
