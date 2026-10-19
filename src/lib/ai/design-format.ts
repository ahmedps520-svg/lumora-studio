/**
 * Magic Design: the simple JSON shape Claude writes, its conversion into real
 * scene elements, and a deterministic "auto-fix" pass that repairs common
 * layout problems (off-page text, overflow, poor contrast, hidden text).
 */
import { z } from "zod";
import { createId } from "@/lib/id";
import { contrastRatio, normalizeHex } from "@/lib/engine/paint";
import { colorBehind, requiredContrast } from "@/lib/document/contrast";
import { directionPatch } from "@/lib/document/text";
import { STARTER_FONTS, usableWeight } from "@/lib/fonts/catalog";
import {
  BackgroundSchema,
  ElementSchema,
  type Background,
  type Element,
  type Fill,
  type Shadow,
  type ShapeKind,
  type TextElement,
} from "@/lib/schema";

// ─── What Claude returns (kept simple and flat; numbers are clamped in code) ───

const Hex = z.string().describe("Hex colour, e.g. #FF7A3D");

const AiGradientSchema = z.object({
  angle: z.number().describe("CSS degrees: 90 = left→right, 180 = top→bottom"),
  colors: z.array(Hex).describe("2–3 colours"),
});

const shadowFields = {
  shadowColor: z.string().describe('Drop shadow: "" for none, else hex with alpha, e.g. #00000080'),
  shadowBlur: z.number().describe("0 = hard shadow"),
  shadowOffsetY: z.number(),
};

const AiTextSchema = z.object({
  kind: z.literal("text"),
  role: z.enum(["heading", "subheading", "body", "caption", "other"]),
  text: z.string().describe("The words. Use \\n for line breaks."),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  fontSize: z.number(),
  fontFamily: z.string(),
  fontWeight: z.number().describe("100–900"),
  italic: z.boolean(),
  color: Hex,
  // Effects are flat fields (a nested optional object per effect makes the output grammar too big).
  gradientColors: z
    .array(Hex)
    .describe("Gradient letters, top to bottom: [] for none, else 2–3 colours (overrides color)"),
  align: z.enum(["left", "center", "right"]),
  lineHeight: z.number().describe("e.g. 1.1 for headings, 1.4 for body"),
  letterSpacing: z.number().describe("thousandths of an em, e.g. 0, 50, 200"),
  uppercase: z.boolean(),
  rotation: z.number(),
  outlineColor: z.string().describe('Outline around the letters: "" for none, else a hex colour'),
  outlineWidth: z.number().describe("px; ~8–12% of fontSize for chunky titles, 0 for none"),
  extrudeColor: z.string().describe('Solid 3D sides: "" for none, else a darker shade (hex)'),
  extrudeDepth: z.number().describe("px; ~14–22% of fontSize for titles, 0 for none"),
  extrudeAngle: z.number().describe("Direction of the 3D sides: 90 = down, 110 = down-left"),
  ...shadowFields,
});

const AiShapeSchema = z.object({
  kind: z.literal("shape"),
  shape: z.enum([
    "rect",
    "ellipse",
    "triangle",
    "polygon",
    "star",
    "arrow",
    "diamond",
    "heart",
    "speechBubble",
    "blob",
  ]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  color: Hex,
  gradient: AiGradientSchema.nullable(),
  opacity: z.number().describe("0–1"),
  cornerRadius: z.number(),
  rotation: z.number(),
  strokeColor: Hex.nullable(),
  strokeWidth: z.number(),
  ...shadowFields,
});

const AiLineSchema = z.object({
  kind: z.literal("line"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  color: Hex,
  thickness: z.number(),
  dashed: z.boolean(),
  rotation: z.number(),
});

export const AiElementSchema = z.union([AiTextSchema, AiShapeSchema, AiLineSchema]);

export const AiDesignSchema = z.object({
  concept: z.string().describe("One sentence: the idea behind the design"),
  palette: z.array(Hex).describe("The 5 colours used"),
  headingFont: z.string(),
  bodyFont: z.string(),
  background: z.object({
    color: Hex,
    gradient: AiGradientSchema.nullable(),
  }),
  elements: z.array(AiElementSchema).describe("Bottom to top (first = furthest back)"),
});

export type AiDesign = z.output<typeof AiDesignSchema>;
export type AiElement = z.output<typeof AiElementSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
const round = (v: number, step = 1) => Math.round(v / step) * step;

export function safeHex(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
  return HEX.test(v) ? normalizeHex(v) : fallback;
}

/** Fonts the editor can load — anything else falls back to a safe pairing. */
export const DESIGN_FONTS = new Set(STARTER_FONTS.map((f) => f.family));

export function safeFont(name: string | undefined, fallback: string): string {
  if (!name) return fallback;
  const match = [...DESIGN_FONTS].find((f) => f.toLowerCase() === name.trim().toLowerCase());
  return match ?? fallback;
}

/** Rough text block height (the editor re-measures precisely after insertion). */
export function estimateTextHeight(
  text: string,
  fontSize: number,
  width: number,
  lineHeight: number,
  letterSpacing = 0,
): number {
  const avgChar = fontSize * (0.56 + letterSpacing / 1000);
  const perLine = Math.max(1, Math.floor(width / Math.max(1, avgChar)));
  const lines = text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return lines * fontSize * lineHeight;
}

function gradientFill(g: { angle: number; colors: string[] }, fallback: string): Fill {
  const colors = g.colors.map((c) => safeHex(c, fallback)).slice(0, 4);
  if (colors.length < 2) return { type: "solid", color: colors[0] ?? fallback };
  return {
    type: "gradient",
    gradient: {
      kind: "linear",
      angle: clamp(Math.round(g.angle), -360, 360),
      stops: colors.map((color, i) => ({ offset: i / (colors.length - 1), color })),
    },
  };
}

function safeShadow(
  s: { shadowColor: string; shadowBlur: number; shadowOffsetY: number },
  pageSize: number,
): Shadow | null {
  if (!s.shadowColor) return null;
  const limit = pageSize * 0.1;
  return {
    color: safeHex(s.shadowColor, "#00000066"),
    blur: Math.round(clamp(s.shadowBlur, 0, 200)),
    offsetX: 0,
    offsetY: Math.round(clamp(s.shadowOffsetY, -limit, limit)),
  };
}

// ─── Conversion ──────────────────────────────────────────────────────────────

export interface ConvertedPage {
  background: Background;
  elements: Element[];
}

export function aiDesignToPage(
  ai: AiDesign,
  format: { width: number; height: number },
): ConvertedPage {
  const W = format.width;
  const H = format.height;
  const maxDim = Math.max(W, H) * 2;
  const headingFont = safeFont(ai.headingFont, "Sora");
  const bodyFont = safeFont(ai.bodyFont, "Inter");
  const bgColor = safeHex(ai.background.color, "#FFFFFF");

  const background: Background = BackgroundSchema.parse(
    ai.background.gradient && ai.background.gradient.colors.length >= 2
      ? {
          type: "gradient",
          gradient: (
            gradientFill(ai.background.gradient, bgColor) as Extract<Fill, { type: "gradient" }>
          ).gradient,
        }
      : { type: "solid", color: bgColor },
  );

  const elements: Element[] = [];
  for (const item of ai.elements.slice(0, 40)) {
    const x = clamp(item.x, -W, W * 2);
    const y = clamp(item.y, -H, H * 2);
    const rotation = clamp(Math.round(item.rotation || 0), -360, 360);

    if (item.kind === "text") {
      // The canvas does not render textTransform yet, so bake capitals into the text.
      const raw = item.text.trim().slice(0, 2_000);
      const text = item.uppercase ? raw.toLocaleUpperCase() : raw;
      if (!text) continue;
      const fontSize = clamp(item.fontSize, 8, Math.min(W, H) * 0.35);
      const width = clamp(item.width, fontSize * 2, W);
      const lineHeight = clamp(item.lineHeight || 1.2, 0.8, 2.5);
      const letterSpacing = clamp(Math.round(item.letterSpacing || 0), -100, 800);
      const fallbackFont =
        item.role === "heading" || item.role === "subheading" ? headingFont : bodyFont;
      const fontFamily = safeFont(item.fontFamily, fallbackFont);
      const color = safeHex(item.color, "#0F172A");
      const outlineWidth = item.outlineColor ? clamp(item.outlineWidth, 0, fontSize * 0.3) : 0;
      const depth = item.extrudeColor ? clamp(item.extrudeDepth, 0, fontSize * 0.5) : 0;
      const textElement = ElementSchema.parse({
        id: createId(),
        type: "text",
        role: item.role,
        x,
        y,
        width,
        height: estimateTextHeight(text, fontSize, width, lineHeight, letterSpacing),
        rotation,
        runs: [{ text }],
        fontFamily,
        fontSize: Math.round(fontSize),
        fontWeight: usableWeight(fontFamily, clamp(round(item.fontWeight || 400, 100), 100, 900)),
        italic: Boolean(item.italic),
        align: item.align,
        lineHeight,
        letterSpacing,
        fill:
          item.gradientColors.length >= 2
            ? gradientFill({ angle: 180, colors: item.gradientColors }, color)
            : { type: "solid", color },
        stroke:
          outlineWidth >= 1
            ? { color: safeHex(item.outlineColor, "#000000"), width: Math.round(outlineWidth) }
            : null,
        extrude:
          depth >= 1
            ? {
                depth: Math.round(depth),
                color: safeHex(item.extrudeColor, "#000000"),
                angle: clamp(Math.round(item.extrudeAngle || 90), -360, 360),
              }
            : null,
        shadow: safeShadow(item, Math.min(W, H)),
      }) as TextElement;
      // Arabic/Hebrew copy reads right-to-left and needs a font with those letters.
      Object.assign(textElement, directionPatch(textElement, text));
      elements.push(textElement);
    } else if (item.kind === "shape") {
      const color = safeHex(
        item.color,
        ai.palette[0] ? safeHex(ai.palette[0], "#7C6CF2") : "#7C6CF2",
      );
      const width = clamp(item.width, 4, maxDim);
      const height = clamp(item.height, 4, maxDim);
      const strokeWidth = clamp(item.strokeWidth || 0, 0, 100);
      elements.push(
        ElementSchema.parse({
          id: createId(),
          type: "shape",
          kind: item.shape as ShapeKind,
          x,
          y,
          width,
          height,
          rotation,
          opacity: clamp(item.opacity ?? 1, 0.05, 1),
          cornerRadius:
            item.shape === "rect"
              ? clamp(item.cornerRadius || 0, 0, Math.min(width, height) / 2)
              : 0,
          sides: item.shape === "polygon" ? 6 : 5,
          fill: item.gradient ? gradientFill(item.gradient, color) : { type: "solid", color },
          stroke:
            item.strokeColor && strokeWidth > 0
              ? { color: safeHex(item.strokeColor, "#0F172A"), width: strokeWidth }
              : null,
          shadow: safeShadow(item, Math.min(W, H)),
        }),
      );
    } else {
      const thickness = clamp(item.thickness || 4, 1, 60);
      elements.push(
        ElementSchema.parse({
          id: createId(),
          type: "line",
          x,
          y,
          width: clamp(item.width, 8, maxDim),
          height: thickness,
          rotation,
          stroke: {
            color: safeHex(item.color, "#0F172A"),
            width: thickness,
            dash: item.dashed ? [thickness * 3, thickness * 2] : [],
          },
          lineCap: item.dashed ? "butt" : "round",
        }),
      );
    }
  }
  return { background, elements };
}

// ─── Auto-fix ────────────────────────────────────────────────────────────────

export type FixKind = "keptInside" | "shrankText" | "contrast" | "unhidText" | "snapped";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

function textHeight(el: TextElement) {
  const text = el.runs.map((r) => r.text).join("");
  return estimateTextHeight(text, el.fontSize, el.width, el.lineHeight, el.letterSpacing);
}

export { requiredContrast };

/**
 * Repairs a generated page in place and reports what changed:
 * 1. snaps geometry to a 4px grid
 * 2. keeps text inside a safe margin and shrinks text that would overflow
 * 3. moves decorative shapes that left the page back so ≥ 25% stays visible
 * 4. lifts text above shapes that would hide it
 * 5. fixes text colours that fail WCAG AA contrast against what's behind them
 */
export function autoFixPage(
  page: ConvertedPage,
  format: { width: number; height: number },
  palette: string[] = [],
): { page: ConvertedPage; fixes: FixKind[] } {
  const W = format.width;
  const H = format.height;
  const margin = Math.round(Math.min(W, H) * 0.05);
  const fixes = new Set<FixKind>();
  const elements = page.elements.map((e) => structuredClone(e));

  // 1. Snap to a 4px grid.
  for (const el of elements) {
    const before = [el.x, el.y, el.width];
    el.x = round(el.x, 4);
    el.y = round(el.y, 4);
    if (el.type !== "line") el.width = Math.max(4, round(el.width, 4));
    if (el.type === "shape") el.height = Math.max(4, round(el.height, 4));
    if (before.some((v, i) => v !== [el.x, el.y, el.width][i])) fixes.add("snapped");
  }

  // 2. Text: inside the safe area and not overflowing it.
  for (const el of elements) {
    if (el.type !== "text") continue;
    const maxWidth = W - margin * 2;
    if (el.width > maxWidth) {
      el.width = maxWidth;
      fixes.add("keptInside");
    }
    let height = textHeight(el);
    while (height > H - margin * 2 && el.fontSize > 12) {
      el.fontSize = Math.max(12, Math.round(el.fontSize * 0.9));
      el.runs = el.runs.map((r) => ({ ...r, style: { ...r.style, fontSize: undefined } }));
      height = textHeight(el);
      fixes.add("shrankText");
    }
    el.height = Math.round(height);
    const nx = clamp(el.x, margin, W - margin - el.width);
    const ny = clamp(el.y, margin, Math.max(margin, H - margin - height));
    if (nx !== el.x || ny !== el.y) {
      el.x = nx;
      el.y = ny;
      fixes.add("keptInside");
    }
  }

  // 3. Shapes and lines: at least a quarter must remain on the page.
  for (const el of elements) {
    if (el.type === "text") continue;
    const visible = overlapArea(el, { x: 0, y: 0, width: W, height: H });
    const area = Math.max(1, el.width * Math.max(el.height, 1));
    if (visible / area < 0.25) {
      el.x = clamp(el.x, -el.width * 0.5, W - el.width * 0.5);
      el.y = clamp(el.y, -el.height * 0.5, H - el.height * 0.5);
      fixes.add("keptInside");
    }
  }

  // 4. Shapes stacked above text and covering a big part of it move below it.
  for (let i = 0; i < elements.length; i++) {
    const text = elements[i]!;
    if (text.type !== "text") continue;
    for (let j = i + 1; j < elements.length; j++) {
      const above = elements[j]!;
      if (above.type === "text") continue;
      const covered = overlapArea(text, above) / Math.max(1, text.width * text.height);
      const opaque = above.opacity >= 0.5;
      if (covered > 0.3 && opaque) {
        elements.splice(j, 1);
        elements.splice(i, 0, above);
        fixes.add("unhidText");
        i++; // the text moved one slot up
      }
    }
  }

  // 5. Contrast against whatever sits behind each text.
  const candidates = [
    ...new Set([...palette.filter((c) => HEX.test(c)), "#FFFFFF", "#0F172A", "#000000"]),
  ];
  elements.forEach((el, index) => {
    if (el.type !== "text" || el.fill.type !== "solid") return;
    const behind = colorBehind(elements, index, page.background);
    const need = requiredContrast(el);
    if (contrastRatio(el.fill.color, behind) >= need) return;
    const best = candidates
      .map((c) => ({ c, ratio: contrastRatio(c, behind) }))
      .sort((a, b) => b.ratio - a.ratio);
    // Prefer an on-brand colour that passes; else the highest-contrast option.
    const pick = best.find((b) => b.ratio >= need && palette.includes(b.c)) ?? best[0]!;
    el.fill = { type: "solid", color: pick.c };
    el.runs = el.runs.map((r) => ({ ...r, style: { ...r.style, color: undefined } }));
    fixes.add("contrast");
  });

  return { page: { background: page.background, elements }, fixes: [...fixes] };
}
