import "server-only";
import {
  DEFAULT_DAILY_BUDGET_USD,
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  serverEnvSchema,
  type ServerEnv,
} from "./env-schema";

let cached: ServerEnv | undefined;

/**
 * Parsed server environment. Invalid values are logged and treated as "not set"
 * so a typo in .env.local never takes the whole app down.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const result = serverEnvSchema.safeParse(process.env);
  if (result.success) {
    cached = result.data;
    return cached;
  }
  const bad = new Set(result.error.issues.map((issue) => String(issue.path[0])));
  console.error(
    `[env] Ignoring invalid environment variables: ${[...bad].join(", ")}. Run "npm run check-env" for details.`,
  );
  const cleaned = Object.fromEntries(Object.entries(process.env).filter(([k]) => !bad.has(k)));
  cached = serverEnvSchema.parse(cleaned);
  return cached;
}

/** Which optional features are switched on. Booleans only — never expose values. */
export function getFeatureFlags() {
  const env = getServerEnv();
  return {
    aiOwnerKey: Boolean(env.ANTHROPIC_API_KEY),
    imageOwnerKey: Boolean(env.GEMINI_API_KEY),
    unsplash: Boolean(env.UNSPLASH_ACCESS_KEY),
    pexels: Boolean(env.PEXELS_API_KEY),
    pixabay: Boolean(env.PIXABAY_API_KEY),
    cloudSync:
      env.NEXT_PUBLIC_ENABLE_CLOUD_SYNC === "true" &&
      Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    dailyBudgetUsd: env.AI_DAILY_BUDGET_USD ?? DEFAULT_DAILY_BUDGET_USD,
    rateLimitPerMinute: env.AI_RATE_LIMIT_PER_MINUTE ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
  };
}

export type FeatureFlags = ReturnType<typeof getFeatureFlags>;
