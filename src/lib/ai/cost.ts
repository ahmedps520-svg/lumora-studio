import { PRICING, TASKS, pickModel, type AiQuality, type AiTask, type ModelId } from "./models";

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface UsageReport {
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const PER_TOKEN = 1 / 1_000_000;

/** Exact cost of a finished request from the API's usage numbers. */
export function costFromUsage(model: ModelId, usage: TokenUsage): number {
  const p = PRICING[model];
  const cost =
    usage.input_tokens * p.input * PER_TOKEN +
    usage.output_tokens * p.output * PER_TOKEN +
    (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite * PER_TOKEN +
    (usage.cache_read_input_tokens ?? 0) * p.cacheRead * PER_TOKEN;
  return Math.round(cost * 1e6) / 1e6;
}

export function usageReport(model: ModelId, usage: TokenUsage): UsageReport {
  return {
    model,
    inputTokens:
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
    costUsd: costFromUsage(model, usage),
  };
}

/**
 * Typical output size per task (incl. thinking) — used for the "≈ cost" hint
 * shown before a request. Calibrated against real requests (Oct 2026): a
 * Magic Design on Sonnet ≈ $0.02, an assistant edit ≈ $0.017, a Magic Write
 * ≈ $0.0001, a palette set ≈ $0.0004.
 */
const TYPICAL_OUTPUT: Record<AiTask, number> = {
  write: 150,
  palette: 600,
  social: 600,
  translate: 800,
  critique: 1_000,
  assistant: 1_000,
  design: 2_000,
  artDirect: 2_500,
  compose: 6_000,
  review: 6_000,
};
/** Head-room so the hint errs slightly high rather than low. */
const ESTIMATE_MARGIN = 1.2;

/** Fixed prompt overhead per task (system prompt + examples), in tokens. */
const PROMPT_OVERHEAD: Record<AiTask, number> = {
  write: 700,
  palette: 600,
  social: 700,
  translate: 900,
  critique: 1_500,
  assistant: 2_600,
  design: 3_200,
  artDirect: 2_500,
  // These include one image (~1,600 tokens).
  compose: 6_500,
  review: 8_000,
};

/**
 * Rough pre-request estimate: ~4 characters per token for the user's input,
 * plus the task's prompt overhead and typical answer length (including thinking).
 */
export function estimateCost(
  task: AiTask,
  quality: AiQuality,
  inputChars: number,
  runs = 1,
): { model: ModelId; costUsd: number } {
  const model = pickModel(task, quality);
  const inputTokens = PROMPT_OVERHEAD[task] + Math.ceil(inputChars / 4);
  const outputTokens = Math.min(TYPICAL_OUTPUT[task] * ESTIMATE_MARGIN, TASKS[task].maxTokens);
  const costUsd = costFromUsage(model, { input_tokens: inputTokens, output_tokens: outputTokens });
  return { model, costUsd: Math.round(costUsd * runs * 1e6) / 1e6 };
}

/** "$0.0012", "<$0.0001", "$1.25" */
export function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.0001) return "<$0.0001";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}
