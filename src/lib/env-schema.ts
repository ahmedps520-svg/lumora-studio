import { z } from "zod";

/**
 * Every environment variable Lumora understands, in one place.
 * Shared by the server (src/lib/env.ts) and `npm run check-env`.
 * Everything is optional: the app runs with zero keys, features simply switch off.
 */

/** Treat blank values in .env files ("KEY=") as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema.optional(),
  );

export const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: optional(
    z.string().regex(/^sk-ant-[A-Za-z0-9_-]{20,}$/, "should start with sk-ant-"),
  ),
  GEMINI_API_KEY: optional(
    z.string().regex(/^[A-Za-z0-9_-]{30,}$/, "should look like AIza… (Google AI Studio key)"),
  ),
  GEMINI_IMAGE_MODEL: optional(z.string().regex(/^[a-z0-9.-]{3,60}$/)),
  BACKGROUND_REMOVAL_SERVER: optional(z.enum(["on", "off"])),
  UNSPLASH_ACCESS_KEY: optional(z.string().min(20, "looks too short")),
  PEXELS_API_KEY: optional(z.string().min(20, "looks too short")),
  PIXABAY_API_KEY: optional(z.string().min(10, "looks too short")),
  AI_DAILY_BUDGET_USD: optional(z.coerce.number().positive().max(1000)),
  AI_RATE_LIMIT_PER_MINUTE: optional(z.coerce.number().int().positive().max(10_000)),
  NEXT_PUBLIC_ENABLE_CLOUD_SYNC: optional(z.enum(["true", "false"])),
  NEXT_PUBLIC_SUPABASE_URL: optional(z.url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(z.string().min(20)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Human-readable notes used by the env check script and the README. */
export const ENV_DESCRIPTIONS: Record<keyof ServerEnv, string> = {
  ANTHROPIC_API_KEY: "Claude API key — powers all AI features (owner key mode)",
  GEMINI_API_KEY: "Google AI Studio key — AI artwork for Premium designs (Gemini image models)",
  GEMINI_IMAGE_MODEL: "Override the Gemini image model (default gemini-nano-banana-2.1)",
  BACKGROUND_REMOVAL_SERVER:
    "HD background removal on this server: on/off (default: on, except on serverless hosts)",
  UNSPLASH_ACCESS_KEY: "Unsplash stock photos",
  PEXELS_API_KEY: "Pexels stock photos",
  PIXABAY_API_KEY: "Pixabay stock photos",
  AI_DAILY_BUDGET_USD: "Server-side daily AI spending cap in US dollars (default 1)",
  AI_RATE_LIMIT_PER_MINUTE: "Max AI requests per visitor per minute (default 20)",
  NEXT_PUBLIC_ENABLE_CLOUD_SYNC: "Turn on optional Supabase cloud sync (default false)",
  NEXT_PUBLIC_SUPABASE_URL: "Supabase project URL (only for cloud sync)",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase public anon key (only for cloud sync)",
};

/**
 * Variables starting with NEXT_PUBLIC_ are copied into the browser bundle.
 * These names must never carry a secret.
 */
export const SECRET_NAME_PATTERN =
  /(API_KEY|SECRET|ACCESS_KEY|PRIVATE|SERVICE_ROLE|PASSWORD|TOKEN)/i;

export function findLeakedSecrets(env: Record<string, string | undefined>): string[] {
  return Object.keys(env).filter(
    (name) =>
      name.startsWith("NEXT_PUBLIC_") &&
      name !== "NEXT_PUBLIC_SUPABASE_ANON_KEY" && // designed to be public
      SECRET_NAME_PATTERN.test(name) &&
      Boolean(env[name]),
  );
}

export const DEFAULT_DAILY_BUDGET_USD = 1;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 20;
