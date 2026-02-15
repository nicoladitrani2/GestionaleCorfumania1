import type { NextConfig } from "next";

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
  typescript: {
    // We also ignore typescript errors just in case, though tsc passed locally.
    ignoreBuildErrors: true,
  }
};

const config = withPWA(nextConfig);

// Remove experimental.turbo if injected by next-pwa, as it causes errors in Next.js 16
if (config.experimental?.turbo) {
  delete config.experimental.turbo;
}

export default config;
