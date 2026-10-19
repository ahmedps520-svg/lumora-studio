/**
 * `npm run check-env` — friendly check of your local setup.
 * Prints which features are on/off. NEVER prints the value of a key.
 * Exits with code 1 only when something is actually wrong (bad format, leaked secret).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  ENV_DESCRIPTIONS,
  findLeakedSecrets,
  serverEnvSchema,
  type ServerEnv,
} from "../src/lib/env-schema";

const root = path.resolve(import.meta.dirname, "..");
loadEnvConfig(root, false, { info: () => {}, error: console.error });

const ok = (msg: string) => console.log(`  ✔ ${msg}`);
const info = (msg: string) => console.log(`  ○ ${msg}`);
const fail = (msg: string) => console.log(`  ✖ ${msg}`);

let problems = 0;
console.log("\nLumora Studio — environment check\n");

// 1. Node.js version
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major > 20 || (major === 20 && minor >= 12)) ok(`Node.js ${process.versions.node}`);
else {
  fail(`Node.js ${process.versions.node} is too old — please install Node 20.12 or newer`);
  problems++;
}

// 2. Env files
const envLocal = path.join(root, ".env.local");
if (existsSync(envLocal)) ok(".env.local found");
else info(".env.local not found (fine — copy .env.example to .env.local when you add keys)");

// 3. Each variable: set / not set / invalid (values are never printed)
const parsed = serverEnvSchema.safeParse(process.env);
const invalid = new Map<string, string>();
if (!parsed.success) {
  for (const issue of parsed.error.issues) invalid.set(String(issue.path[0]), issue.message);
}
console.log("");
for (const name of Object.keys(ENV_DESCRIPTIONS) as (keyof ServerEnv)[]) {
  const description = ENV_DESCRIPTIONS[name];
  const raw = process.env[name];
  if (invalid.has(name)) {
    fail(`${name} is set but invalid: ${invalid.get(name)}  (${description})`);
    problems++;
  } else if (raw && raw.trim() !== "") {
    ok(`${name} is set  (${description})`);
  } else {
    info(`${name} not set  (${description})`);
  }
}

// 4. Secrets accidentally exposed to the browser
const leaked = findLeakedSecrets(process.env);
console.log("");
if (leaked.length === 0) ok("No secret keys are exposed to the browser (NEXT_PUBLIC_ prefix)");
else {
  for (const name of leaked) {
    fail(
      `${name} looks like a secret but starts with NEXT_PUBLIC_ — it would be sent to every visitor. Rename it.`,
    );
  }
  problems += leaked.length;
}

// 5. Summary
console.log("");
if (!process.env.ANTHROPIC_API_KEY) {
  info("AI features are off until you add ANTHROPIC_API_KEY to .env.local");
  info("(or paste your own key in the app under Settings → AI → Bring your own key).");
}
if (problems > 0) {
  console.log(`\n${problems} problem(s) found. Fix them in .env.local and run this again.\n`);
  process.exit(1);
}
console.log("\nAll good! ✨\n");
