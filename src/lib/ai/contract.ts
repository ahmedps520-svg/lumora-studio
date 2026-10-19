/**
 * The contract between the browser and /api/ai/* routes.
 * Every request body is validated with these schemas on the server.
 */
import { z } from "zod";
import { ColorSchema } from "@/lib/schema";
import type { AiQuality } from "./models";

export const TONES = [
  "auto",
  "professional",
  "friendly",
  "witty",
  "persuasive",
  "formal",
  "playful",
  "luxury",
  "inspiring",
] as const;
export type Tone = (typeof TONES)[number];

export const CREATIVITY = ["safe", "balanced", "bold"] as const;
export type Creativity = (typeof CREATIVITY)[number];

/** User-tunable AI behaviour, sent with every request (Settings → AI). */
export const AiPrefsSchema = z.object({
  quality: z.enum(["fast", "balanced", "best"] satisfies readonly AiQuality[]).default("balanced"),
  creativity: z.enum(CREATIVITY).default("balanced"),
  tone: z.enum(TONES).default("auto"),
  /** Output language: "auto" = same as the input / UI. */
  language: z.string().trim().max(40).default("auto"),
  /** Free-text brand voice, e.g. "warm, confident, no jargon". */
  brandVoice: z.string().trim().max(600).default(""),
  /** Who the content is for, e.g. "students", "busy parents". */
  audience: z.string().trim().max(200).default(""),
});
export type AiPrefs = z.output<typeof AiPrefsSchema>;

// ─── Magic Write ─────────────────────────────────────────────────────────────

export const WRITE_ACTIONS = [
  "write",
  "rewrite",
  "shorten",
  "expand",
  "fix",
  "simplify",
  "tone",
  "translate",
  "continue",
  "headlines",
  "hashtags",
  "caption",
  "cta",
  "emojify",
] as const;
export type WriteAction = (typeof WRITE_ACTIONS)[number];

export const WriteRequestSchema = z.object({
  action: z.enum(WRITE_ACTIONS),
  text: z.string().max(6_000).default(""),
  /** Extra instruction, or the prompt for action "write". */
  instruction: z.string().trim().max(600).default(""),
  targetTone: z.enum(TONES).optional(),
  targetLanguage: z.string().trim().max(40).optional(),
  count: z.number().int().min(1).max(5).default(3),
  prefs: AiPrefsSchema.prefault({}),
});
export type WriteRequest = z.input<typeof WriteRequestSchema>;

export const WriteResultSchema = z.object({
  results: z.array(z.string()),
});

// ─── Palettes & font pairing ─────────────────────────────────────────────────

export const PaletteRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(600),
  count: z.number().int().min(1).max(6).default(4),
  /** Colours already in the design, for "something that goes with this". */
  currentColors: z.array(ColorSchema).max(12).default([]),
  prefs: AiPrefsSchema.prefault({}),
});
export type PaletteRequest = z.input<typeof PaletteRequestSchema>;

export const PaletteSchema = z.object({
  name: z.string(),
  mood: z.string(),
  colors: z.array(z.string()),
  headingFont: z.string(),
  bodyFont: z.string(),
});
export type AiPalette = z.output<typeof PaletteSchema>;

export const PaletteResultSchema = z.object({ palettes: z.array(PaletteSchema) });

// ─── Magic Design ────────────────────────────────────────────────────────────

export const DESIGN_STYLES = [
  "auto",
  "minimal",
  "bold",
  "playful",
  "elegant",
  "retro",
  "corporate",
] as const;
export type DesignStyle = (typeof DESIGN_STYLES)[number];

export const DesignRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(1_500),
  format: z.object({
    width: z.number().min(16).max(20_000),
    height: z.number().min(16).max(20_000),
    presetId: z.string().max(60).nullable().default(null),
  }),
  style: z.enum(DESIGN_STYLES).default("auto"),
  /** Optional colours the design must use (brand kit / chosen palette). */
  palette: z.array(ColorSchema).max(8).default([]),
  headingFont: z.string().trim().max(60).optional(),
  bodyFont: z.string().trim().max(60).optional(),
  prefs: AiPrefsSchema.prefault({}),
});
export type DesignRequest = z.input<typeof DesignRequestSchema>;

// ─── Design Assistant ────────────────────────────────────────────────────────

export const AssistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4_000) }))
    .max(12)
    .default([]),
  /** Compact description of the current page (built by the client). */
  scene: z.string().max(60_000),
  selection: z.array(z.string().max(64)).max(200).default([]),
  format: z.object({ width: z.number(), height: z.number() }),
  prefs: AiPrefsSchema.prefault({}),
});
export type AssistantRequest = z.input<typeof AssistantRequestSchema>;

// ─── Errors ──────────────────────────────────────────────────────────────────

export const AI_ERROR_CODES = [
  "no_key",
  "invalid_key",
  "budget_exceeded",
  "rate_limited",
  "refused",
  "invalid_request",
  "invalid_output",
  "overloaded",
  "server_error",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export interface AiErrorBody {
  error: { code: AiErrorCode; message: string };
}

/** Header carrying a user's own key (bring-your-own-key). Never stored server-side. */
export const BYOK_HEADER = "x-lumora-api-key";

/** Header carrying a user's own Google AI key (for artwork). Never stored server-side. */
export const GOOGLE_BYOK_HEADER = "x-lumora-google-key";
