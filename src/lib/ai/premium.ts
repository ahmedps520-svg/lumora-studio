/**
 * Premium design: the request/response shapes shared by the browser and the
 * server. The pipeline (see components/ai/premium.ts):
 *   1. art direction (Claude)    → copy + a detailed artwork prompt
 *   2. artwork (Gemini)          → full-bleed illustration, no text
 *   3. layout (Claude + vision)  → titles with 3D/outline effects over the art
 *   4. review (Claude + vision)  → looks at the real render and fixes it (1–3×)
 */
import { z } from "zod";
import { AiPrefsSchema, DESIGN_STYLES } from "./contract";
import { AiDesignSchema } from "./design-format";

const Hex = z.string().describe("Hex colour, e.g. #FF7A3D");

export const TEXT_AREAS = [
  "top",
  "bottom",
  "left",
  "right",
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export const PremiumPlanSchema = z.object({
  concept: z.string().describe("One sentence: the big idea and the feeling"),
  title: z.string().describe("The main title — short and punchy (ideally 1–4 words)"),
  subtitle: z.string().describe("A secondary line, or an empty string"),
  extras: z
    .array(z.string())
    .describe("At most 3 short extra texts (badge, tag, call to action); may be empty"),
  artPrompt: z
    .string()
    .describe("The full prompt for the image model (see the rules). English, 80–220 words."),
  textArea: z.enum(TEXT_AREAS).describe("Where the art leaves calm space for the title"),
  palette: z.array(Hex).describe("5 colours taken from the planned artwork"),
  headingFont: z.string(),
  bodyFont: z.string(),
});
export type PremiumPlan = z.output<typeof PremiumPlanSchema>;

const FormatSchema = z.object({
  width: z.number().min(16).max(20_000),
  height: z.number().min(16).max(20_000),
});

/** A downscaled image (artwork or render) as a data URL — at most ~2.5 MB. */
const ImageDataUrl = z
  .string()
  .max(3_500_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,/, "Expected an image data URL");

export const PremiumPlanRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(1_500),
  format: FormatSchema,
  style: z.enum(DESIGN_STYLES).default("auto"),
  /** False when no artwork can be generated (no Google key): plan a vector design. */
  artwork: z.boolean(),
  prefs: AiPrefsSchema.prefault({}),
});

export const ImageQualitySchema = z.enum(["standard", "pro"]);
export type ImageQuality = z.output<typeof ImageQualitySchema>;
export type ImageSize = "1K" | "2K";

/** US$ per artwork image (Google pricing, Oct 2026): Nano Banana 2.1 / Nano Banana Pro. */
export const IMAGE_PRICES: Record<ImageQuality, Record<ImageSize, number>> = {
  standard: { "1K": 0.0336, "2K": 0.0504 },
  pro: { "1K": 0.134, "2K": 0.134 },
};

export const ImageRequestSchema = z.object({
  prompt: z.string().trim().min(10).max(6_000),
  width: z.number().min(16).max(20_000),
  height: z.number().min(16).max(20_000),
  quality: ImageQualitySchema.default("standard"),
  size: z.enum(["1K", "2K"]).default("2K"),
});

export const ComposeRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(1_500),
  format: FormatSchema,
  plan: PremiumPlanSchema,
  artwork: ImageDataUrl.nullable(),
  prefs: AiPrefsSchema.prefault({}),
});

export const ReviewRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(1_500),
  format: FormatSchema,
  plan: PremiumPlanSchema,
  design: AiDesignSchema,
  render: ImageDataUrl,
  hasArtwork: z.boolean(),
  round: z.number().int().min(1).max(5),
  prefs: AiPrefsSchema.prefault({}),
});

export const ReviewResultSchema = z.object({
  verdict: z.enum(["good", "improve"]),
  notes: z.string().describe("What you checked/changed, one or two short sentences"),
  design: AiDesignSchema.describe("The complete design (unchanged if verdict is good)"),
});
