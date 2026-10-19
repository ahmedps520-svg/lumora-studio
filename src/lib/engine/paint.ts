/**
 * Colour and gradient helpers shared by the engine and (later) exporters.
 * Gradient angles follow CSS: 0° points up, 90° points right.
 */
import type { Fill, Gradient } from "@/lib/schema";

export interface PercentLinearCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** CSS angle → start/end points in a 0…1 box. */
export function angleToCoords(angle: number): PercentLinearCoords {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { x1: round(0.5 - dx), y1: round(0.5 - dy), x2: round(0.5 + dx), y2: round(0.5 + dy) };
}

/** Start/end points in a 0…1 box → CSS angle (0…359). */
export function coordsToAngle({ x1, y1, x2, y2 }: PercentLinearCoords): number {
  const deg = (Math.atan2(x2 - x1, -(y2 - y1)) * 180) / Math.PI;
  return Math.round(((deg % 360) + 360) % 360);
}

export function normalizeAngle(angle: number): number {
  return Math.round(((angle % 360) + 360) % 360);
}

/** CSS linear-gradient string — used for UI swatches and page backgrounds. */
export function gradientToCss(gradient: Gradient): string {
  const stops = gradient.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
  return gradient.kind === "radial"
    ? `radial-gradient(circle, ${stops})`
    : `linear-gradient(${gradient.angle}deg, ${stops})`;
}

export function fillToCss(fill: Fill): string {
  if (fill.type === "solid") return fill.color;
  if (fill.type === "gradient") return gradientToCss(fill.gradient);
  return "transparent";
}

/** A representative solid colour for a fill (first gradient stop). */
export function fillPrimaryColor(fill: Fill): string | null {
  if (fill.type === "solid") return fill.color;
  if (fill.type === "gradient") return fill.gradient.stops[0]?.color ?? null;
  return null;
}

/** Expands #RGB/#RGBA and upper-cases, e.g. "#f0a" → "#FF00AA". */
export function normalizeHex(hex: string): string {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  return `#${h.toUpperCase()}`;
}

/** Relative luminance (WCAG 2.x). */
export function luminance(hex: string): number {
  const h = normalizeHex(hex).slice(1, 7);
  const channel = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** WCAG contrast ratio between two colours (1…21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
