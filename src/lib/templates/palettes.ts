/**
 * Colour palettes for templates, by role. Text colours on top of a colour are
 * chosen automatically for contrast (see `onColor`).
 */
import { contrastRatio } from "@/lib/engine/paint";

export interface Palette {
  id: string;
  /** Dark background (light text). */
  dark: boolean;
  /** Page background. */
  bg: string;
  /** A second background tone (bands, panels). */
  bg2: string;
  /** Cards and boxes. */
  surface: string;
  /** Main text on `bg`. */
  ink: string;
  /** Secondary text on `bg`. */
  soft: string;
  /** Brand colour: big shapes, buttons, highlights. */
  primary: string;
  secondary: string;
  accent: string;
}

const p = (
  id: string,
  dark: boolean,
  [bg, bg2, surface, ink, soft, primary, secondary, accent]: string[],
): Palette => ({
  id,
  dark,
  bg: bg!,
  bg2: bg2!,
  surface: surface!,
  ink: ink!,
  soft: soft!,
  primary: primary!,
  secondary: secondary!,
  accent: accent!,
});

export const PALETTES = {
  sunset: p("sunset", false, [
    "#FFF4EC",
    "#FFE1CC",
    "#FFFFFF",
    "#2A1A3E",
    "#6B5B7B",
    "#FF5E3A",
    "#FFB627",
    "#7C3AED",
  ]),
  midnight: p("midnight", true, [
    "#0F0C29",
    "#1F1B4D",
    "#262060",
    "#FFFFFF",
    "#B8B3E6",
    "#7C5CFF",
    "#FF4FD8",
    "#2CE6C5",
  ]),
  ocean: p("ocean", false, [
    "#EAF6FF",
    "#CFE9FB",
    "#FFFFFF",
    "#0B2545",
    "#4A6584",
    "#0077B6",
    "#00B4D8",
    "#FFB703",
  ]),
  forest: p("forest", false, [
    "#F1F5EC",
    "#DCE8D2",
    "#FFFFFF",
    "#1B3022",
    "#4F6B57",
    "#2D6A4F",
    "#95D5B2",
    "#E9C46A",
  ]),
  blush: p("blush", false, [
    "#FFF0F3",
    "#FFD6DF",
    "#FFFFFF",
    "#4A1D2C",
    "#8A5566",
    "#E63E6D",
    "#FF9EB5",
    "#C9A227",
  ]),
  luxe: p("luxe", true, [
    "#111111",
    "#1C1C1C",
    "#1E1E1E",
    "#F5EBD7",
    "#BFB39C",
    "#C9A35C",
    "#8C7340",
    "#F5EBD7",
  ]),
  citrus: p("citrus", false, [
    "#FFFBEA",
    "#FFF1B8",
    "#FFFFFF",
    "#1E2A1E",
    "#55624F",
    "#FF7A00",
    "#3BB273",
    "#E4572E",
  ]),
  mint: p("mint", false, [
    "#EFFFF8",
    "#C9F5E3",
    "#FFFFFF",
    "#073B3A",
    "#3E6E68",
    "#08876A",
    "#FFD166",
    "#EF476F",
  ]),
  electric: p("electric", true, [
    "#0A0A0F",
    "#16162A",
    "#1C1C34",
    "#FFFFFF",
    "#A9A9C8",
    "#00E5FF",
    "#FF2E88",
    "#B6FF00",
  ]),
  corporate: p("corporate", false, [
    "#FFFFFF",
    "#EEF2F8",
    "#F6F8FC",
    "#0F172A",
    "#475569",
    "#1E40AF",
    "#3B82F6",
    "#F59E0B",
  ]),
  terracotta: p("terracotta", false, [
    "#F7EFE6",
    "#EBD9C6",
    "#FFFDF9",
    "#3B2418",
    "#7A5C4A",
    "#C2593A",
    "#E8A87C",
    "#2F5D50",
  ]),
  lavender: p("lavender", false, [
    "#F5F1FF",
    "#E4DAFF",
    "#FFFFFF",
    "#241A4A",
    "#625A8C",
    "#6D4AFF",
    "#C8B6FF",
    "#FF8FAB",
  ]),
  mono: p("mono", false, [
    "#FFFFFF",
    "#F2F2F2",
    "#FFFFFF",
    "#0A0A0A",
    "#555555",
    "#0A0A0A",
    "#E5E5E5",
    "#FF3B30",
  ]),
  noir: p("noir", true, [
    "#0A0A0A",
    "#1A1A1A",
    "#161616",
    "#FFFFFF",
    "#A3A3A3",
    "#FFFFFF",
    "#2A2A2A",
    "#FACC15",
  ]),
  candy: p("candy", false, [
    "#FFF5FB",
    "#FFE0F0",
    "#FFFFFF",
    "#2B1240",
    "#6E4C80",
    "#FF4FA3",
    "#7DD3FC",
    "#FDE047",
  ]),
  retro: p("retro", false, [
    "#FDF0D5",
    "#F7D9A6",
    "#FFF8EA",
    "#2B2118",
    "#6E5A44",
    "#D62828",
    "#F77F00",
    "#003049",
  ]),
  royal: p("royal", true, [
    "#0B1D3A",
    "#132B52",
    "#17325E",
    "#FFFFFF",
    "#B9C7E0",
    "#F2C14E",
    "#4D7CC7",
    "#F2C14E",
  ]),
  crescent: p("crescent", true, [
    "#082B2E",
    "#0E3E42",
    "#10474C",
    "#FDF6E3",
    "#B9D3CF",
    "#E9B949",
    "#2A9D8F",
    "#F4E3B1",
  ]),
  sky: p("sky", false, [
    "#E0F2FE",
    "#BAE6FD",
    "#FFFFFF",
    "#082F49",
    "#36607A",
    "#0369A1",
    "#38BDF8",
    "#F97316",
  ]),
  berry: p("berry", true, [
    "#2B0B3F",
    "#45125F",
    "#4B1569",
    "#FFFFFF",
    "#E1C6F2",
    "#FF3D7F",
    "#FFB86B",
    "#7CF5FF",
  ]),
  sand: p("sand", false, [
    "#F4EDE4",
    "#E7DCCD",
    "#FFFDFA",
    "#2E2A25",
    "#6F665B",
    "#2E2A25",
    "#B08968",
    "#7F5539",
  ]),
  lime: p("lime", false, [
    "#F7FFE0",
    "#E6FAB0",
    "#FFFFFF",
    "#1A2E05",
    "#4D6127",
    "#1A2E05",
    "#84CC16",
    "#F43F5E",
  ]),
  coral: p("coral", false, [
    "#FFF1EC",
    "#FFD7C9",
    "#FFFFFF",
    "#3A1F1A",
    "#7D5850",
    "#F0502B",
    "#FFB4A2",
    "#2B9348",
  ]),
  emerald: p("emerald", true, [
    "#022C22",
    "#064E3B",
    "#065F46",
    "#ECFDF5",
    "#A7F3D0",
    "#34D399",
    "#FBBF24",
    "#F472B6",
  ]),
  peach: p("peach", false, [
    "#FFF7F0",
    "#FFE8D6",
    "#FFFFFF",
    "#3D2C2E",
    "#806566",
    "#E76F51",
    "#2A9D8F",
    "#F4A261",
  ]),
  arcade: p("arcade", true, [
    "#120015",
    "#2A0033",
    "#330040",
    "#FFFFFF",
    "#D6B4FF",
    "#FFD600",
    "#FF2E63",
    "#08F7FE",
  ]),
} satisfies Record<string, Palette>;

export type PaletteId = keyof typeof PALETTES;
export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

/** Readable text colour on top of `color` (white or the darkest ink available). */
export function onColor(color: string, dark = "#111111", light = "#FFFFFF"): string {
  const base = color.slice(0, 7);
  return contrastRatio(base, light) >= contrastRatio(base, dark) ? light : dark;
}

/** `#RRGGBB` + alpha (0–1) → `#RRGGBBAA`. */
export function alpha(color: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${color.slice(0, 7)}${v}`;
}

/** The five swatches that sum a palette up (for "change colours" buttons). */
export function swatches(p: Palette): string[] {
  return [p.bg, p.primary, p.secondary, p.accent, p.ink];
}
