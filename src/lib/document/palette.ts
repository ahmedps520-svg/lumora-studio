/**
 * "Apply palette to design": remaps every colour on a page to a new palette
 * while keeping the light/dark structure (darkest stays darkest, etc.), then
 * repairs any text that lost contrast.
 */
import { contrastRatio, luminance, normalizeHex } from "@/lib/engine/paint";
import type { Fill, Page } from "@/lib/schema";
import { colorBehind, requiredContrast } from "./contrast";
import { flattenElements } from "./tree";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Splits #RRGGBBAA into the colour and its alpha suffix so alpha survives remapping. */
function splitAlpha(hex: string): [string, string] {
  const full = normalizeHex(hex);
  return full.length === 9 ? [full.slice(0, 7), full.slice(7)] : [full, ""];
}

function fillColors(fill: Fill): string[] {
  if (fill.type === "solid") return [fill.color];
  if (fill.type === "gradient") return fill.gradient.stops.map((s) => s.color);
  return [];
}

/** Every distinct colour used on the page (background, fills, strokes, text). */
export function collectColors(page: Page): string[] {
  const colors: string[] = [];
  const bg = page.background;
  if (bg.type === "solid") colors.push(bg.color);
  if (bg.type === "gradient") colors.push(...bg.gradient.stops.map((s) => s.color));
  for (const el of flattenElements(page.elements)) {
    if (el.type === "shape" || el.type === "text") colors.push(...fillColors(el.fill));
    if ((el.type === "shape" || el.type === "text" || el.type === "image") && el.stroke) {
      colors.push(el.stroke.color);
    }
    if (el.type === "line") colors.push(el.stroke.color);
    if (el.type === "text") {
      for (const run of el.runs) if (run.style.color) colors.push(run.style.color);
    }
  }
  return [...new Set(colors.filter((c) => HEX.test(c)).map((c) => splitAlpha(c)[0]))];
}

/** Builds old→new colour mapping by luminance rank. */
export function buildColorMap(oldColors: string[], palette: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const targets = [
    ...new Set(palette.filter((c) => HEX.test(c)).map((c) => splitAlpha(c)[0])),
  ].sort((a, b) => luminance(a) - luminance(b));
  if (targets.length === 0 || oldColors.length === 0) return map;
  const sorted = [...oldColors].sort((a, b) => luminance(a) - luminance(b));
  sorted.forEach((color, rank) => {
    const t = sorted.length === 1 ? 0.5 : rank / (sorted.length - 1);
    map.set(color, targets[Math.round(t * (targets.length - 1))]!);
  });
  return map;
}

/** Applies the palette to a page (works on Immer drafts). Returns the mapping used. */
export function applyPalette(page: Page, palette: string[]): Map<string, string> {
  const map = buildColorMap(collectColors(page), palette);
  const swap = (hex: string) => {
    const [base, alpha] = splitAlpha(hex);
    const next = map.get(base);
    return next ? `${next}${alpha}` : hex;
  };
  const swapFill = (fill: Fill) => {
    if (fill.type === "solid") fill.color = swap(fill.color);
    if (fill.type === "gradient") fill.gradient.stops.forEach((s) => (s.color = swap(s.color)));
  };

  if (page.background.type === "solid") page.background.color = swap(page.background.color);
  if (page.background.type === "gradient") {
    page.background.gradient.stops.forEach((s) => (s.color = swap(s.color)));
  }
  for (const el of flattenElements(page.elements)) {
    if (el.type === "shape" || el.type === "text") swapFill(el.fill);
    if ((el.type === "shape" || el.type === "text" || el.type === "image") && el.stroke) {
      el.stroke.color = swap(el.stroke.color);
    }
    if (el.type === "line") el.stroke.color = swap(el.stroke.color);
    if (el.type === "text") {
      for (const run of el.runs) if (run.style.color) run.style.color = swap(run.style.color);
    }
  }

  // Keep text readable against whatever sits behind it.
  const options = [...map.values(), "#FFFFFF", "#0F172A"];
  page.elements.forEach((el, index) => {
    if (el.type !== "text" || el.fill.type !== "solid") return;
    const behind = colorBehind(page.elements, index, page.background);
    if (contrastRatio(el.fill.color, behind) >= requiredContrast(el)) return;
    el.fill.color = options.reduce((best, c) =>
      contrastRatio(c, behind) > contrastRatio(best, behind) ? c : best,
    );
  });
  return map;
}
