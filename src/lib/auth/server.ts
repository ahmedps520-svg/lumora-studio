import "server-only";
/**
 * Accounts: email + password sign-up with email confirmation, log in, and
 * password reset, using Better Auth (https://better-auth.com). Accounts are
 * stored in a SQLite file (Node's built-in driver) — `.data/lumora.db` by
 * default — and the tables are created on first use. Passwords are hashed
 * with scrypt; sessions are signed, HTTP-only cookies.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { sendEmail } from "@/lib/email/send";
import { emailLocale, renderEmail, type EmailKind } from "@/lib/email/templates";
import { getServerEnv } from "@/lib/env";

const DATA_DIR = path.join(process.cwd(), ".data");

function databasePath(): string {
  return getServerEnv().AUTH_DATABASE_PATH ?? path.join(DATA_DIR, "lumora.db");
}

/**
 * The secret that signs sessions: BETTER_AUTH_SECRET, or (for local use) one
 * made once and kept in .data/auth-secret, so logins survive restarts.
 */
function sessionSecret(): string {
  const fromEnv = getServerEnv().BETTER_AUTH_SECRET;
  if (fromEnv) return fromEnv;
  if (databasePath() === ":memory:") return randomBytes(32).toString("base64url");
  if (process.env.NODE_ENV === "production") {
    console.warn("[auth] BETTER_AUTH_SECRET is not set; using a secret stored in .data/.");
  }
  const file = path.join(DATA_DIR, "auth-secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(DATA_DIR, { recursive: true });
  const secret = randomBytes(32).toString("base64url");
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

/** The site's address for links in emails: BETTER_AUTH_URL, else the request's origin. */
function siteUrl(request?: Request): string | undefined {
  const fromEnv = getServerEnv().BETTER_AUTH_URL;
  if (fromEnv) return fromEnv;
  return request ? new URL(request.url).origin : undefined;
}

async function mail(
  kind: EmailKind,
  user: { email: string; name?: string | null },
  url: string | undefined,
  request?: Request,
) {
  const { subject, html, text } = renderEmail(kind, emailLocale(request), {
    name: user.name ?? "",
    url,
  });
  await sendEmail({ to: user.email, subject, html, text, kind });
}

export function authOptions(database: DatabaseSync): BetterAuthOptions {
  return {
    appName: "Lumora Studio",
    database,
    secret: sessionSecret(),
    baseURL: getServerEnv().BETTER_AUTH_URL,
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }, request) => mail("reset", user, url, request),
    },
    emailVerification: {
      sendOnSignUp: true,
      // Trying to log in before confirming sends a fresh link.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: ({ user, url }, request) => mail("verify", user, url, request),
      afterEmailVerification: (user, request) => mail("welcome", user, siteUrl(request), request),
    },
    // Must be last: lets server actions set the session cookie.
    plugins: [nextCookies()],
  };
}

function createAuth(database: DatabaseSync) {
  return betterAuth(authOptions(database));
}
export type Auth = ReturnType<typeof createAuth>;

let instance: Promise<Auth> | null = null;

/** The accounts service (opens the database and creates its tables the first time). */
export function getAuth(): Promise<Auth> {
  instance ??= (async () => {
    const file = databasePath();
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    const database = new DatabaseSync(file);
    const { runMigrations } = await getMigrations(authOptions(database));
    await runMigrations();
    return createAuth(database);
  })();
  // A failed start (e.g. a locked file) is retried on the next request.
  instance.catch(() => {
    instance = null;
  });
  return instance;
}

/** Test helper: start over with a fresh database. */
export function resetAuth() {
  instance = null;
}
