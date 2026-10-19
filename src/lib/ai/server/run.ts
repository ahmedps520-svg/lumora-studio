import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getFeatureFlags } from "@/lib/env";
import type { AiPrefs } from "../contract";
import { estimateCost, usageReport, type UsageReport } from "../cost";
import {
  MODEL_IDS,
  pickModel,
  supportsFallbacks,
  TASKS,
  type AiTask,
  type ModelId,
} from "../models";
import { createAiClient, resolveKey, type AiClient, type ResolvedKey } from "./client";
import { AiError } from "./errors";
import { allowRequest, clientKey, recordSpend, spentToday } from "./limits";

export interface AiContext {
  client: AiClient;
  key: ResolvedKey;
}

const MAX_BODY_BYTES = 200_000;

/** Reads and validates a JSON body (size-capped; requests carrying images may pass a larger cap). */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = MAX_BODY_BYTES,
): Promise<z.output<S>> {
  const raw = await request.text();
  if (raw.length > maxBytes) throw new AiError("invalid_request", "Request is too large.", 413);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AiError("invalid_request", "Request body must be JSON.", 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AiError(
      "invalid_request",
      `Invalid request: ${parsed.error.issues[0]?.message ?? "bad input"}`,
      400,
    );
  }
  return parsed.data;
}

/**
 * Checks before spending money: same-origin caller, rate limit, a usable key,
 * and (for the owner's key) the daily budget.
 */
export function guard(
  request: Request,
  task: AiTask,
  prefs: AiPrefs,
  inputChars: number,
  runs = 1,
): AiContext {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    throw new AiError("invalid_request", "Cross-site AI requests are not allowed.", 403);
  }
  const flags = getFeatureFlags();
  if (!allowRequest(clientKey(request.headers), flags.rateLimitPerMinute)) {
    throw new AiError("rate_limited", "Too many AI requests — please wait a moment.", 429);
  }
  const key = resolveKey(request.headers);
  if (key.source === "owner") {
    const estimate = estimateCost(task, prefs.quality, inputChars, runs).costUsd;
    if (spentToday() + estimate > flags.dailyBudgetUsd) {
      throw new AiError(
        "budget_exceeded",
        "Today's AI budget has been used up. It resets tomorrow.",
        402,
      );
    }
  }
  return { client: createAiClient(key.apiKey), key };
}

function settle(ctx: AiContext, usage: UsageReport) {
  if (ctx.key.source === "owner") recordSpend(usage.costUsd);
}

function knownModel(id: string, fallback: ModelId): ModelId {
  return (Object.values(MODEL_IDS) as string[]).includes(id) ? (id as ModelId) : fallback;
}

/**
 * Refusal safety net: on Sonnet/Opus a declined request is retried server-side
 * on Anthropic's recommended fallback model (Haiku has no fallback).
 */
function fallbackParams(model: ModelId) {
  return supportsFallbacks(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

function cachedSystem(text: string): Anthropic.Beta.BetaTextBlockParam[] {
  // Static system prompts are cached (cheaper repeat calls once long enough to qualify).
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

export interface StructuredOptions<S extends z.ZodType> {
  task: AiTask;
  prefs: AiPrefs;
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
}

/** One request with Zod-validated JSON output. */
export async function runStructured<S extends z.ZodType>(
  ctx: AiContext,
  opts: StructuredOptions<S>,
): Promise<{ data: z.output<S>; usage: UsageReport }> {
  const model = pickModel(opts.task, opts.prefs.quality);
  const response = await ctx.client.beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? TASKS[opts.task].maxTokens,
    system: cachedSystem(opts.system),
    messages: [{ role: "user", content: opts.user }],
    output_config: { effort: TASKS[opts.task].effort, format: betaZodOutputFormat(opts.schema) },
    ...fallbackParams(model),
  });
  const usage = usageReport(knownModel(response.model, model), response.usage);
  settle(ctx, usage);
  if (response.stop_reason === "refusal")
    throw new AiError("refused", "Claude declined this request.", 422);
  if (response.stop_reason === "max_tokens" || response.parsed_output == null) {
    throw new AiError("invalid_output", "The answer was incomplete. Please try again.", 502);
  }
  return { data: response.parsed_output as z.output<S>, usage };
}

export interface RichOptions<S extends z.ZodType> {
  task: AiTask;
  prefs: AiPrefs;
  system: string;
  /** Text and image blocks (e.g. the artwork or a render to critique). */
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
}

/** The JSON object in an answer (tolerates a stray code fence or sentence around it). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("No JSON object found");
  return JSON.parse(text.slice(start, end + 1));
}

const schemaCache = new WeakMap<z.ZodType, string>();
function schemaText(schema: z.ZodType): string {
  let text = schemaCache.get(schema);
  if (!text) {
    const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
    text = JSON.stringify(json);
    schemaCache.set(schema, text);
  }
  return text;
}

/**
 * For big layouts and the slow, careful jobs (Magic/Premium design): adaptive
 * thinking at the task's effort, images allowed, streamed so long answers never
 * time out. The JSON Schema goes in the (cached) system prompt rather than a
 * compiled output grammar — large layout schemas exceed the grammar limit — and
 * every answer is validated with Zod, with one repair round if it doesn't fit.
 */
export async function runRich<S extends z.ZodType>(
  ctx: AiContext,
  opts: RichOptions<S>,
): Promise<{ data: z.output<S>; usage: UsageReport }> {
  const model = pickModel(opts.task, opts.prefs.quality);
  const system = cachedSystem(
    `${opts.system}\n\nAnswer with ONLY one JSON object — no prose, no code fences — that matches this JSON Schema exactly (every property is required):\n${schemaText(opts.schema)}`,
  );
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.content }];
  let total: UsageReport | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await ctx.client.beta.messages
      .stream({
        model,
        max_tokens: TASKS[opts.task].maxTokens,
        system,
        messages,
        thinking: { type: "adaptive" },
        output_config: { effort: TASKS[opts.task].effort },
        ...fallbackParams(model),
      })
      .finalMessage();
    const usage = usageReport(knownModel(message.model, model), message.usage);
    settle(ctx, usage);
    total = total
      ? {
          ...usage,
          inputTokens: total.inputTokens + usage.inputTokens,
          outputTokens: total.outputTokens + usage.outputTokens,
          costUsd: Math.round((total.costUsd + usage.costUsd) * 1e6) / 1e6,
        }
      : usage;
    if (message.stop_reason === "refusal")
      throw new AiError("refused", "Claude declined this request.", 422);
    if (message.stop_reason === "max_tokens") {
      throw new AiError("invalid_output", "The answer was incomplete. Please try again.", 502);
    }
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let problem: string;
    try {
      const parsed = opts.schema.safeParse(extractJson(text));
      if (parsed.success) return { data: parsed.data as z.output<S>, usage: total };
      problem = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n");
    } catch {
      problem = "The answer was not a single valid JSON object.";
    }
    // One repair round: show Claude exactly what didn't fit.
    messages.push(
      {
        role: "assistant",
        content: message.content.filter(
          (b) => b.type === "text" || b.type === "thinking" || b.type === "redacted_thinking",
        ) as Anthropic.Beta.BetaContentBlockParam[],
      },
      {
        role: "user",
        content: `That JSON doesn't match the schema:\n${problem}\nReply with the corrected, complete JSON object only.`,
      },
    );
  }
  throw new AiError("invalid_output", "The answer had the wrong shape. Please try again.", 502);
}

/** An image block for Claude from a data URL (JPEG/PNG/WebP). */
export function imageBlock(dataUrl: string): Anthropic.Beta.BetaImageBlockParam {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new AiError("invalid_request", "Images must be JPEG, PNG or WebP.", 400);
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: match[1] as "image/jpeg" | "image/png" | "image/webp",
      data: match[2]!,
    },
  };
}

export interface ToolRunOptions {
  task: AiTask;
  prefs: AiPrefs;
  system: string;
  tools: Anthropic.Beta.BetaToolUnion[];
  messages: Anthropic.Beta.BetaMessageParam[];
}

/** One request where Claude may call tools; returns text + raw tool calls. */
export async function runTools(
  ctx: AiContext,
  opts: ToolRunOptions,
): Promise<{ text: string; toolCalls: { name: string; input: unknown }[]; usage: UsageReport }> {
  const model = pickModel(opts.task, opts.prefs.quality);
  const response = await ctx.client.beta.messages.create({
    model,
    max_tokens: TASKS[opts.task].maxTokens,
    system: cachedSystem(opts.system),
    tools: opts.tools,
    tool_choice: { type: "auto" },
    messages: opts.messages,
    output_config: { effort: TASKS[opts.task].effort },
    ...fallbackParams(model),
  });
  const usage = usageReport(knownModel(response.model, model), response.usage);
  settle(ctx, usage);
  if (response.stop_reason === "refusal")
    throw new AiError("refused", "Claude declined this request.", 422);
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  // A tool call cut off by max_tokens may be truncated — never apply it.
  const toolCalls =
    response.stop_reason === "max_tokens"
      ? []
      : response.content
          .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
          .map((b) => ({ name: b.name, input: b.input }));
  return { text, toolCalls, usage };
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...init?.headers },
  });
}
