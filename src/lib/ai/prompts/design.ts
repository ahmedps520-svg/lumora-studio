/**
 * Magic Design prompt — v2
 * v2: text effects (outline, 3D extrusion, shadow, gradient letters), font moods.
 */
import type { z } from "zod";
import { STARTER_FONTS } from "@/lib/fonts/catalog";
import type { DesignRequestSchema, DesignStyle } from "../contract";
import { asData, DATA_RULE, prefsGuidance, sanitize } from "./shared";

export const DESIGN_PROMPT_VERSION = "design@2";

/** Fonts with what they suit, so Claude can match the mood of the brief. */
export const FONT_LIST = STARTER_FONTS.map(
  (f) =>
    `${f.family}${f.arabic ? " (Arabic)" : ""}${f.singleWeight ? " [400 only]" : ""}${f.mood ? ` — ${f.mood}` : ""}`,
).join("\n");

/** A complete, valid example (1080×1080) — teaches the format and the quality bar. */
const RAW_EXAMPLE = {
  concept: "Bold summer sale post: warm sunset gradient, oversized headline, playful sun motif.",
  palette: ["#1F1235", "#D4145A", "#FF7A3D", "#FFD166", "#FFF8F0"],
  headingFont: "Anton",
  bodyFont: "Inter",
  background: { color: "#FF7A3D", gradient: { angle: 160, colors: ["#FF7A3D", "#D4145A"] } },
  elements: [
    {
      kind: "shape",
      shape: "ellipse",
      x: 640,
      y: -160,
      width: 600,
      height: 600,
      color: "#FFD166",
      gradient: null,
      opacity: 0.9,
      cornerRadius: 0,
      rotation: 0,
      strokeColor: null,
      strokeWidth: 0,
    },
    {
      kind: "shape",
      shape: "blob",
      x: -140,
      y: 760,
      width: 520,
      height: 460,
      color: "#1F1235",
      gradient: null,
      opacity: 0.25,
      cornerRadius: 0,
      rotation: 12,
      strokeColor: null,
      strokeWidth: 0,
    },
    {
      kind: "text",
      role: "caption",
      text: "LIMITED TIME",
      x: 96,
      y: 260,
      width: 600,
      fontSize: 34,
      fontFamily: "Inter",
      fontWeight: 700,
      italic: false,
      color: "#FFF8F0",
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 300,
      uppercase: true,
      rotation: 0,
    },
    {
      kind: "text",
      role: "heading",
      text: "Summer\nSale",
      x: 92,
      y: 320,
      width: 820,
      fontSize: 210,
      fontFamily: "Anton",
      fontWeight: 400,
      italic: false,
      color: "#FFF8F0",
      align: "left",
      lineHeight: 0.95,
      letterSpacing: 0,
      uppercase: true,
      rotation: 0,
    },
    {
      kind: "text",
      role: "subheading",
      text: "Up to 50% off everything",
      x: 96,
      y: 760,
      width: 700,
      fontSize: 48,
      fontFamily: "Inter",
      fontWeight: 600,
      italic: false,
      color: "#1F1235",
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0,
      uppercase: false,
      rotation: 0,
    },
    {
      kind: "shape",
      shape: "rect",
      x: 96,
      y: 868,
      width: 300,
      height: 92,
      color: "#1F1235",
      gradient: null,
      opacity: 1,
      cornerRadius: 46,
      rotation: 0,
      strokeColor: null,
      strokeWidth: 0,
    },
    {
      kind: "text",
      role: "other",
      text: "Shop now",
      x: 96,
      y: 892,
      width: 300,
      fontSize: 36,
      fontFamily: "Inter",
      fontWeight: 700,
      italic: false,
      color: "#FFF8F0",
      align: "center",
      lineHeight: 1.2,
      letterSpacing: 20,
      uppercase: false,
      rotation: 0,
    },
  ],
};

/** Every element lists every field (structured output); effects are off unless set. */
const NO_SHADOW = { shadowColor: "", shadowBlur: 0, shadowOffsetY: 0 };

const EXAMPLE = {
  ...RAW_EXAMPLE,
  elements: RAW_EXAMPLE.elements.map((el) =>
    el.kind === "text"
      ? {
          gradientColors: [],
          outlineColor: "",
          outlineWidth: 0,
          extrudeColor: "",
          extrudeDepth: 0,
          extrudeAngle: 90,
          ...NO_SHADOW,
          ...el,
          ...(el.role === "heading"
            ? {
                outlineColor: "#1F1235",
                outlineWidth: 14,
                extrudeColor: "#1F1235",
                extrudeDepth: 18,
                extrudeAngle: 100,
                shadowColor: "#1F123566",
                shadowBlur: 24,
                shadowOffsetY: 18,
              }
            : {}),
        }
      : { ...NO_SHADOW, ...el },
  ),
};

const STYLE_NOTES: Record<DesignStyle, string> = {
  auto: "Choose the style that best fits the request.",
  minimal:
    "Minimal: lots of white space, 1 accent colour, thin lines, refined small typography, very few elements.",
  bold: "Bold: oversized condensed headlines, strong contrast, saturated colours, big geometric shapes.",
  playful:
    "Playful: rounded shapes, blobs, stars, bright friendly colours, slightly rotated elements, fun fonts.",
  elegant:
    "Elegant: serif headings, muted luxurious palette (cream, black, gold, deep green), generous spacing, thin dividers.",
  retro:
    "Retro: warm 70s colours (orange, mustard, brown, cream), chunky display type, circles and stripes.",
  corporate:
    "Corporate: clean grid, navy/blue palette, sans-serif fonts, clear hierarchy, professional and calm.",
};

export const DESIGN_SYSTEM = `You are a senior graphic designer working inside Lumora Studio. You turn a short brief into a complete, beautiful, editable layout described as JSON.

Coordinate system: pixels, origin at the top-left of the page. x/y is the top-left corner of each element's box before rotation. Elements are listed bottom to top (first = furthest back).

Element kinds you can use:
- "text": a text box. width is the box width (text wraps inside it). Use \\n for deliberate line breaks.
- "shape": rect (use cornerRadius for pills/cards/buttons), ellipse, triangle, polygon (hexagon), star, arrow, diamond, heart, speechBubble, blob. Optional gradient (2–3 colours).
- "line": a straight divider; thickness in px; rotate it for diagonals.

Layout rules:
- Keep ALL text inside a safe margin of 5% of the smaller page side. Decorative shapes may bleed off the edges.
- Establish clear hierarchy: one dominant heading, then supporting text. Heading size roughly 8–16% of the page's smaller side; body text roughly 3–4%; never smaller than 2.2%.
- Text must be readable: strong contrast between text colour and whatever is behind it (WCAG AA). Never put text over a busy area without a solid shape behind it.
- Don't let shapes cover text: put shapes BEFORE (below) the text they sit behind.
- Align elements to a consistent grid and margins; leave breathing room. 4–16 elements is usually right.
- Buttons = a rounded rect plus a centred text box with the same x and width, placed after the rect.
- Use 3–5 colours from a coherent palette. Use at most 2 font families, ONLY from this list (use weight 400 for fonts marked [400 only]):
${FONT_LIST}

Text effects (use them to make headlines pop — they are what makes a design look premium):
- outlineColor/outlineWidth: a thick dark outline around the letters (≈8–12% of fontSize for chunky titles, 2–4% for a subtle edge).
- extrudeColor/extrudeDepth/extrudeAngle: solid 3D sides for game/thumbnail/poster titles (depth ≈12–22% of fontSize, a darker shade of the letters or outline, angle 90–110).
- shadowColor/shadowBlur/shadowOffsetY: soft drop shadow for lift (alpha colour like #00000066, blur 10–40) or a hard offset shadow (blur 0). Shapes can have shadows too.
- gradientColors: gradient letters, top to bottom (e.g. white → pale tint, or gold tones).
Use effects on the 1–2 most important lines only; body text stays clean (colours "", sizes 0, gradientColors []).
- Only write text the brief supports. Use realistic, concise copy. Never invent prices, dates, phone numbers or URLs; leave them out unless given.
- If the brief is in Arabic (or asks for Arabic), write Arabic text, use fonts marked (Arabic), and align text "right".

Example of a complete answer for a 1080×1080 page (brief: "summer sale post, bold"):
${JSON.stringify(EXAMPLE)}

${DATA_RULE}`;

type DesignInput = z.output<typeof DesignRequestSchema>;

export function buildDesignUser(input: DesignInput, style: DesignStyle): string {
  const { width, height } = input.format;
  const margin = Math.round(Math.min(width, height) * 0.05);
  const parts = [
    `Page size: ${Math.round(width)} × ${Math.round(height)} px (safe margin ${margin}px).`,
    `Style: ${STYLE_NOTES[style]}`,
    `Brief:\n${asData("user_request", input.prompt, 1_500)}`,
  ];
  if (input.palette.length > 0) {
    parts.push(
      `Use these brand colours (you may add white/black for text): ${input.palette.join(", ")}`,
    );
  }
  if (input.headingFont || input.bodyFont) {
    parts.push(
      `Preferred fonts: heading ${sanitize(input.headingFont ?? "any", 60)}, body ${sanitize(input.bodyFont ?? "any", 60)}.`,
    );
  }
  parts.push(`Preferences:\n${prefsGuidance(input.prefs)}`);
  parts.push("Return the complete JSON layout.");
  return parts.join("\n\n");
}
