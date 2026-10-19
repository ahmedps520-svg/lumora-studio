import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": r("./src"),
      "@messages": r("./messages"),
      // "server-only" throws outside a React Server environment; tests run server code directly.
      "server-only": r("./tests/stubs/empty.ts"),
    },
  },
  test: {
    css: false,
    restoreMocks: true,
    unstubEnvs: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
          // The first test in a file also loads its server modules (AI SDK, accounts), which
          // can take a few seconds while the browser tests run alongside.
          testTimeout: 20_000,
        },
      },
      {
        // Canvas code runs in real Chromium so Fabric draws and measures for real.
        extends: true,
        // Pre-bundled up front so Vite doesn't reload the page mid-run.
        optimizeDeps: { include: ["fabric", "immer", "nanoid", "zod"] },
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.{ts,tsx}"],
          // Vitest's default port (63315) sits in a range Windows often reserves.
          api: { host: "127.0.0.1", port: 51_315, strictPort: false },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
