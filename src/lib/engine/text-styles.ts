/**
 * Converts between Lumora rich text (`runs`) and Fabric's per-character style
 * map (`styles[line][charIndex]`, indexed by hard line breaks and graphemes).
 * Pure functions — no Fabric import — so they are easy to test.
 */
import type { TextRun, TextStyle } from "@/lib/schema";

/** Fabric's per-character style keys that we use. */
export interface FabricCharStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: string;
  underline?: boolean;
  linethrough?: boolean;
  fill?: unknown;
  textBackgroundColor?: string;
}

export type FabricStyleMap = Record<number, Record<number, FabricCharStyle>>;

export type GraphemeSplitter = (text: string) => string[];

/** Default splitter (code points). The engine passes Fabric's own splitter so indexes match exactly. */
export const splitCodePoints: GraphemeSplitter = (text) => Array.from(text);

export function runStyleToFabric(style: TextStyle): FabricCharStyle {
  const out: FabricCharStyle = {};
  if (style.fontFamily !== undefined) out.fontFamily = style.fontFamily;
  if (style.fontSize !== undefined) out.fontSize = style.fontSize;
  if (style.fontWeight !== undefined) out.fontWeight = style.fontWeight;
  if (style.italic !== undefined) out.fontStyle = style.italic ? "italic" : "normal";
  if (style.underline !== undefined) out.underline = style.underline;
  if (style.strike !== undefined) out.linethrough = style.strike;
  if (style.color !== undefined) out.fill = style.color;
  if (style.backgroundColor !== undefined) out.textBackgroundColor = style.backgroundColor;
  return out;
}

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function fabricStyleToRun(style: FabricCharStyle | undefined): TextStyle {
  const out: TextStyle = {};
  if (!style) return out;
  if (typeof style.fontFamily === "string" && style.fontFamily) out.fontFamily = style.fontFamily;
  if (typeof style.fontSize === "number") out.fontSize = style.fontSize;
  if (style.fontWeight !== undefined) {
    const w =
      typeof style.fontWeight === "number" ? style.fontWeight : fontWeightNumber(style.fontWeight);
    if (w) out.fontWeight = w;
  }
  if (style.fontStyle !== undefined) out.italic = style.fontStyle === "italic";
  if (style.underline !== undefined) out.underline = Boolean(style.underline);
  if (style.linethrough !== undefined) out.strike = Boolean(style.linethrough);
  if (typeof style.fill === "string" && HEX.test(style.fill)) out.color = style.fill;
  if (typeof style.textBackgroundColor === "string" && HEX.test(style.textBackgroundColor)) {
    out.backgroundColor = style.textBackgroundColor;
  }
  return out;
}

export function fontWeightNumber(weight: string | number | undefined): number | undefined {
  if (typeof weight === "number") return weight;
  if (weight === "bold") return 700;
  if (weight === "normal") return 400;
  const n = Number(weight);
  return Number.isFinite(n) && n >= 100 && n <= 900 ? Math.round(n / 100) * 100 : undefined;
}

export function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join("");
}

export function runsToFabric(
  runs: TextRun[],
  split: GraphemeSplitter = splitCodePoints,
): { text: string; styles: FabricStyleMap } {
  const styles: FabricStyleMap = {};
  let line = 0;
  let char = 0;
  for (const run of runs) {
    const fabricStyle = runStyleToFabric(run.style);
    const hasStyle = Object.keys(fabricStyle).length > 0;
    // Split on hard line breaks first so each line's graphemes are counted like Fabric does.
    const parts = run.text.split("\n");
    parts.forEach((part, partIndex) => {
      if (partIndex > 0) {
        line++;
        char = 0;
      }
      for (const _grapheme of split(part)) {
        if (hasStyle) (styles[line] ??= {})[char] = { ...fabricStyle };
        char++;
      }
    });
  }
  return { text: runsToPlainText(runs), styles };
}

function sameStyle(a: TextStyle, b: TextStyle): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof TextStyle>;
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

/** Merges neighbouring runs with identical style and drops empty ones. */
export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    if (run.text === "") continue;
    const last = out.at(-1);
    if (last && sameStyle(last.style, run.style)) last.text += run.text;
    else out.push({ text: run.text, style: { ...run.style } });
  }
  return out.length > 0 ? out : [{ text: "", style: {} }];
}

export function fabricToRuns(
  text: string,
  styles: FabricStyleMap | undefined,
  split: GraphemeSplitter = splitCodePoints,
): TextRun[] {
  const runs: TextRun[] = [];
  const lines = text.split("\n");
  lines.forEach((lineText, lineIndex) => {
    if (lineIndex > 0) {
      // Line breaks join the run before them (any style is fine for "\n").
      const last = runs.at(-1);
      if (last) last.text += "\n";
      else runs.push({ text: "\n", style: {} });
    }
    split(lineText).forEach((grapheme, charIndex) => {
      runs.push({ text: grapheme, style: fabricStyleToRun(styles?.[lineIndex]?.[charIndex]) });
    });
  });
  return normalizeRuns(runs);
}
