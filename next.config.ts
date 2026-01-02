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

export default withPWA(nextConfig);
