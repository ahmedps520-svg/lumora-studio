/**
 * Which Claude model handles which job, and what it costs.
 * Shared by server and browser (contains no secrets). Edit this one file to
 * change routing or prices.
 */

export const MODEL_IDS = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
} as const;

export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS];

/** User-facing quality switch (Settings → AI). */
export type AiQuality = "fast" | "balanced" | "best";
export const AI_QUALITIES: readonly AiQuality[] = ["fast", "balanced", "best"];

/** Everything Lumora asks Claude to do. */
export type AiTask =
  | "write"
  | "palette"
  | "design"
  | "assistant"
  | "critique"
  | "social"
  | "translate"
  // Premium design: art direction → layout over the artwork → self-review.
  | "artDirect"
  | "compose"
  | "review";

export type Effort = "low" | "medium" | "high";

interface TaskProfile {
  /** "quick" jobs use the cheapest model on Balanced; "smart" jobs use the middle tier. */
  tier: "quick" | "smart";
  maxTokens: number;
  effort: Effort;
}

export const TASKS: Record<AiTask, TaskProfile> = {
  write: { tier: "quick", maxTokens: 2_000, effort: "low" },
  palette: { tier: "quick", maxTokens: 2_000, effort: "low" },
  social: { tier: "quick", maxTokens: 3_000, effort: "low" },
  translate: { tier: "quick", maxTokens: 8_000, effort: "low" },
  critique: { tier: "smart", maxTokens: 4_000, effort: "medium" },
  assistant: { tier: "smart", maxTokens: 6_000, effort: "low" },
  design: { tier: "smart", maxTokens: 16_000, effort: "medium" },
  // Premium takes its time: deeper thinking, streamed answers.
  artDirect: { tier: "smart", maxTokens: 12_000, effort: "high" },
  compose: { tier: "smart", maxTokens: 32_000, effort: "high" },
  review: { tier: "smart", maxTokens: 32_000, effort: "high" },
};

/**
 * Routing (from the product brief):
 * - Fast:     Haiku for everything (cheapest)
 * - Balanced: Haiku for quick jobs, Sonnet for design + assistant (default)
 * - Best:     Opus for everything (most capable, most expensive)
 */
export function pickModel(task: AiTask, quality: AiQuality): ModelId {
  if (quality === "best") return MODEL_IDS.opus;
  if (quality === "fast") return MODEL_IDS.haiku;
  return TASKS[task].tier === "quick" ? MODEL_IDS.haiku : MODEL_IDS.sonnet;
}

/** Haiku has no server-side refusal fallback; Sonnet/Opus use Anthropic's default routing. */
export function supportsFallbacks(model: ModelId): boolean {
  return model !== MODEL_IDS.haiku;
}

/**
 * US$ per million tokens (Anthropic first-party prices, Oct 2026).
 * Cache writes cost 1.25× input; cache reads are much cheaper. Haiku's cache
 * price is an estimate (10% of input). Check https://www.anthropic.com/pricing.
 */
export const PRICING: Record<
  ModelId,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

export const MODEL_LABELS: Record<ModelId, string> = {
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-opus-5-5": "Claude Opus 5.5",
};
