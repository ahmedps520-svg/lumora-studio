/**
 * Premium design prompts — v1
 * art-direct@1 · compose@1 · review@1
 */
import type { z } from "zod";
import type { DesignStyle } from "../contract";
import type {
  ComposeRequestSchema,
  PremiumPlan,
  PremiumPlanRequestSchema,
  ReviewRequestSchema,
} from "../premium";
import { FONT_LIST } from "./design";
import { asData, DATA_RULE, prefsGuidance } from "./shared";

export const PREMIUM_PROMPT_VERSION = "premium@1";

const STYLE_HINTS: Record<DesignStyle, string> = {
  auto: "Pick the style that best fits the brief and the platform.",
  minimal: "Minimal and refined: calm art, lots of space, restrained effects.",
  bold: "Bold: high-energy art, saturated colour, massive 3D titles.",
  playful: "Playful: bright, cartoony, bouncy shapes, rounded chunky fonts.",
  elegant:
    "Elegant: cinematic or fine-art imagery, serif typography, subtle effects, gold/cream/black.",
  retro: "Retro: 70s/80s/90s aesthetic, grain, warm or neon palette, chunky retro fonts.",
  corporate: "Corporate: clean professional photography or 3D renders, crisp sans typography.",
};

function pageInfo(format: { width: number; height: number }) {
  const w = Math.round(format.width);
  const h = Math.round(format.height);
  const shape = w / h > 1.2 ? "landscape" : w / h < 0.83 ? "portrait" : "square";
  return { w, h, shape, margin: Math.round(Math.min(w, h) * 0.04) };
}

// ─── 1. Art direction ────────────────────────────────────────────────────────

export const ART_DIRECT_SYSTEM = `You are the art director at Lumora Studio. You turn a short brief into a plan for a PREMIUM design — the quality of the best YouTube thumbnails, game key art, movie posters and top Instagram posts: one striking full-bleed picture plus big, expressive, editable typography on top.

Write the plan:
1. concept — the big idea and the feeling, in one sentence.
2. Copy — title: 1–4 punchy words, the hook, using the brief's own words where it gives them (e.g. "HUNGER GAMES"). subtitle: optional supporting line (or ""). extras: up to 3 tiny labels for badges/ribbons (e.g. "HARDCORE", "EP. 2", "NEW") — only if they help. Never invent prices, dates, phone numbers or URLs.
3. artPrompt — written for an AI image model. It must:
   - describe ONE cohesive, detailed, high-impact scene that tells the story at a glance: the main subject(s) with pose, action and expression; the setting; props; foreground, midground and background depth;
   - name the rendering style precisely (e.g. "glossy 3D voxel-game render, blocky characters, Unreal-style lighting", "cinematic photo, 35mm lens, shallow depth of field", "anime cel-shaded key visual", "Pixar-style 3D", "bold flat vector illustration");
   - set lighting and colour (e.g. "bright saturated colours, warm sunlight, soft god rays, crisp rim light");
   - plan the composition for the canvas shape given: put the subjects so the TEXT AREA you choose stays calm and low-detail (sky, soft blur, simple ground) with room for a huge title; keep everything important inside the frame;
   - avoid real people's names and trademarked characters/logos — describe the look generically instead (a game's visual style may be described, e.g. "blocky voxel world");
   - end with exactly: "No text, letters, numbers, logos, watermarks or UI anywhere in the image."
4. textArea — where the title will go (must match the composition you described).
5. palette — 5 hex colours that will dominate the artwork and the title.
6. headingFont and bodyFont — from the list below, matching the mood (chunky display fonts for games/thumbnails, condensed for sport/news, elegant serif for weddings/luxury). Fonts marked [400 only] have one weight.

Fonts:
${FONT_LIST}

If the request says there will be NO artwork, write artPrompt as a short description of a rich vector background (layered gradients, glows, bold shapes) instead — it is not sent to an image model.

${DATA_RULE}`;

type PlanInput = z.output<typeof PremiumPlanRequestSchema>;

export function buildPlanUser(input: PlanInput): string {
  const { w, h, shape } = pageInfo(input.format);
  return [
    `Canvas: ${w} × ${h} px (${shape}).`,
    `Style: ${STYLE_HINTS[input.style]}`,
    input.artwork
      ? "There WILL be AI artwork: write a full image-model prompt."
      : "There will be NO artwork (vector only).",
    `Brief:\n${asData("user_request", input.prompt, 1_500)}`,
    `Preferences:\n${prefsGuidance(input.prefs)}`,
    "Return the plan as JSON.",
  ].join("\n\n");
}

// ─── 2. Layout over the artwork ──────────────────────────────────────────────

const TITLE_EXAMPLE = {
  kind: "text",
  role: "heading",
  text: "HUNGER\nGAMES",
  x: 160,
  y: 380,
  width: 960,
  fontSize: 150,
  fontFamily: "Luckiest Guy",
  fontWeight: 400,
  italic: false,
  color: "#FFFFFF",
  gradientColors: ["#FFFFFF", "#FFD6E0"],
  align: "center",
  lineHeight: 0.95,
  letterSpacing: 20,
  uppercase: true,
  rotation: -2,
  outlineColor: "#2B0A14",
  outlineWidth: 16,
  extrudeColor: "#B3123A",
  extrudeDepth: 26,
  extrudeAngle: 100,
  shadowColor: "#00000080",
  shadowBlur: 30,
  shadowOffsetY: 18,
};

export const COMPOSE_SYSTEM = `You are the lead designer at Lumora Studio. You finish premium designs by adding editable typography and graphic accents ON TOP of a full-bleed artwork.

The attached image is the artwork exactly as it sits on the page: it fills the whole canvas (0,0 → width,height), so image pixels map to page pixels proportionally. Study it before placing anything: find the faces, the main subjects and the calm areas.

What premium looks like:
- ONE dominant title, huge: title fontSize ≈ 12–20% of the page's shorter side (on a 16:9 thumbnail the title block should span ~55–90% of the width). Chunky display font from the plan, uppercase, tight lineHeight (0.9–1.05). Make it pop: a thick dark outline (≈ 8–12% of fontSize), solid 3D extrusion (depth ≈ 14–22% of fontSize, angle 90–110, a darker shade of the letters or a saturated accent), a soft drop shadow, and often gradient letters (white → pale tint, or two warm tones). Colours come from the artwork and must contrast strongly with what is behind.
- A slight rotation (−4°…4°) on the title or a badge adds energy for games, sport and YouTube; keep it 0 for elegant/corporate.
- Secondary text much smaller (25–50% of the title). Badges/ribbons: a rounded rect (or star/diamond for a burst) with a strong colour, outline and shadow, and its label text centred on it (same x and width, text listed after the shape).
- Put text in the calm area — NEVER over faces or the main subject. If the area behind text is busy, add a soft gradient scrim BELOW the text (a rect with gradient from transparent "#00000000" to e.g. "#000000B3") instead of a hard box.
- Keep all text inside a 4% safe margin. 3–10 layers in total. The artwork is the star: no clutter, no decorative shapes that fight it, no full-page background shapes.
- Never put text outside the page or let titles touch the edges.

Fonts (only these; [400 only] = single weight):
${FONT_LIST}

Coordinates are page pixels from the top-left; x/y is each box's top-left before rotation; elements are listed bottom to top. Set background.color to the artwork's dominant dark colour (it shows only if the art fails to load).

If NO artwork is attached, design the whole page yourself: a rich layered background (multi-stop gradients, large soft glows/blobs at low opacity, bold geometric shapes, depth) plus the same typography rules.

Example of a premium title element (1280×720 thumbnail):
${JSON.stringify(TITLE_EXAMPLE)}

${DATA_RULE}`;

type ComposeInput = z.output<typeof ComposeRequestSchema>;

function planSummary(plan: PremiumPlan) {
  return JSON.stringify({
    concept: plan.concept,
    title: plan.title,
    subtitle: plan.subtitle,
    extras: plan.extras,
    textArea: plan.textArea,
    palette: plan.palette,
    headingFont: plan.headingFont,
    bodyFont: plan.bodyFont,
  });
}

export function buildComposeText(input: ComposeInput): string {
  const { w, h, shape, margin } = pageInfo(input.format);
  return [
    `Canvas: ${w} × ${h} px (${shape}); safe margin ${margin}px.`,
    input.artwork
      ? "The attached image is the artwork filling the page."
      : "No artwork: create the full design including the background.",
    `Art direction plan:\n${planSummary(input.plan)}`,
    `Original brief:\n${asData("user_request", input.prompt, 1_500)}`,
    `Preferences:\n${prefsGuidance(input.prefs)}`,
    "Return the complete design JSON.",
  ].join("\n\n");
}

// ─── 3. Self-review ──────────────────────────────────────────────────────────

export const REVIEW_SYSTEM = `You are a demanding creative director at Lumora Studio. You review a design by looking at its actual render (attached — exactly what the user will see) and you fix it until it meets a premium bar: the best YouTube thumbnails, game key art, movie posters.

Check, in order:
1. Every word is fully visible, correctly spelled and readable even when the design is shown small (320 px wide). Nothing is clipped by the page edge or hidden behind another layer.
2. No text covers faces or the main subject.
3. The title clearly dominates; the hierarchy is obvious; sizes are bold enough.
4. Effects (outline, 3D sides, shadow, gradient) look clean and intentional — not muddy, not too thin, not overlapping neighbours.
5. Composition: balanced, aligned, comfortable margins; no crowding; no awkward empty area where text was planned.
6. Colours harmonise with the artwork and contrast is strong.

The JSON lists each element's box (text height is not listed — trust the render for how tall text really is). If the design already meets the bar, answer verdict "good" and return the design unchanged. Otherwise answer verdict "improve" and return the COMPLETE improved design JSON (same schema): move, resize, restyle, recolour, rewrap or remove elements to fix every problem you see, and keep what already works. Don't add a full-page background shape when there is artwork.

Fonts (only these; [400 only] = single weight):
${FONT_LIST}

${DATA_RULE}`;

type ReviewInput = z.output<typeof ReviewRequestSchema>;

export function buildReviewText(input: ReviewInput): string {
  const { w, h, shape, margin } = pageInfo(input.format);
  return [
    `Canvas: ${w} × ${h} px (${shape}); safe margin ${margin}px.`,
    `Review round ${input.round}. ${input.hasArtwork ? "The full-bleed artwork is the bottom layer (not listed in the JSON)." : "There is no artwork."}`,
    `Art direction plan:\n${planSummary(input.plan)}`,
    `Original brief:\n${asData("user_request", input.prompt, 1_500)}`,
    `Current design JSON:\n${JSON.stringify(input.design)}`,
    "The attached image is the current render. Review it and return your verdict and the design.",
  ].join("\n\n");
}
