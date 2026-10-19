import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import packageJson from "./package.json";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Static security headers. The Content-Security-Policy is set per request in
// src/proxy.ts because it carries a fresh nonce every time.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Pin the project root (a stray package-lock.json higher up would confuse Turbopack).
  turbopack: { root: __dirname },
  reactStrictMode: true,
  // Native AI runtimes load from node_modules at run time (never bundled).
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  poweredByHeader: false,
  // Shown in Settings and on the health page.
  env: { NEXT_PUBLIC_APP_VERSION: packageJson.version },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
