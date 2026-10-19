/**
 * Photo filters: named looks (presets, with a strength) plus manual
 * adjustments that stack on top. Pure data, shared by the editor UI, the
 * renderer and the tests.
 */
import type { ImageElement } from "@/lib/schema";

export type ImageFilters = ImageElement["filters"];

/** What a look changes; every amount is at full strength. */
export interface Look {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  hue?: number;
  vignette?: number;
  blur?: number;
  /** 0–1 black-and-white mix. */
  mono?: number;
  /** 0–1 sepia mix. */
  sepia?: number;
}

export const IMAGE_PRESETS = {
  vivid: { saturation: 0.45, contrast: 0.18, brightness: 0.03 },
  bright: { brightness: 0.16, contrast: 0.08, saturation: 0.1 },
  warm: { warmth: 0.45, saturation: 0.12 },
  cool: { warmth: -0.45, contrast: 0.06 },
  sunset: { warmth: 0.6, saturation: 0.25, contrast: 0.12, vignette: 0.25 },
  dreamy: { brightness: 0.12, contrast: -0.22, saturation: -0.08, blur: 0.04, warmth: 0.12 },
  fade: { contrast: -0.3, brightness: 0.08, saturation: -0.3 },
  vintage: { sepia: 0.55, contrast: -0.08, warmth: 0.2, vignette: 0.4 },
  drama: { contrast: 0.45, saturation: -0.2, brightness: -0.05, vignette: 0.5 },
  mono: { mono: 1, contrast: 0.12 },
  noir: { mono: 1, contrast: 0.55, brightness: -0.08, vignette: 0.45 },
  retro: { hue: -12, saturation: 0.2, contrast: 0.1, sepia: 0.2, vignette: 0.2 },
} as const satisfies Record<string, Look>;

export type ImagePreset = keyof typeof IMAGE_PRESETS;
export const IMAGE_PRESET_IDS = Object.keys(IMAGE_PRESETS) as ImagePreset[];

export const isImagePreset = (id: string | null): id is ImagePreset =>
  id !== null && id in IMAGE_PRESETS;

/** Everything the renderer needs, preset and adjustments already combined. */
export interface ResolvedFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  hue: number;
  vignette: number;
  blur: number;
  mono: number;
  sepia: number;
  duotone: [string, string] | null;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function resolveFilters(f: ImageFilters): ResolvedFilters {
  const look: Look = isImagePreset(f.preset) ? IMAGE_PRESETS[f.preset] : {};
  const k = isImagePreset(f.preset) ? f.presetStrength : 0;
  const mix = (key: keyof Look, manual: number) => (look[key] ?? 0) * k + manual;
  return {
    brightness: clamp(mix("brightness", f.brightness), -1, 1),
    contrast: clamp(mix("contrast", f.contrast), -1, 1),
    saturation: clamp(mix("saturation", f.saturation), -1, 1),
    warmth: clamp(mix("warmth", f.warmth), -1, 1),
    hue: clamp(mix("hue", f.hue), -180, 180),
    vignette: clamp(mix("vignette", f.vignette), 0, 1),
    blur: clamp(mix("blur", f.blur), 0, 1),
    mono: clamp(mix("mono", f.grayscale ? 1 : 0), 0, 1),
    sepia: clamp(mix("sepia", f.sepia ? 1 : 0), 0, 1),
    duotone: f.duotone,
  };
}

/** True when the photo looks exactly like the original. */
export function isNeutral(r: ResolvedFilters): boolean {
  return (
    !r.duotone &&
    [
      r.brightness,
      r.contrast,
      r.saturation,
      r.warmth,
      r.hue,
      r.vignette,
      r.blur,
      r.mono,
      r.sepia,
    ].every((v) => Math.abs(v) < 0.001)
  );
}

/** A CSS `filter` that approximates a look (for quick previews on thumbnails). */
export function cssFilter(r: ResolvedFilters): string {
  const parts: string[] = [];
  if (r.brightness) parts.push(`brightness(${(1 + r.brightness * 0.6).toFixed(3)})`);
  if (r.contrast) parts.push(`contrast(${(1 + r.contrast * 0.8).toFixed(3)})`);
  if (r.saturation) parts.push(`saturate(${(1 + r.saturation).toFixed(3)})`);
  if (r.mono) parts.push(`grayscale(${r.mono.toFixed(3)})`);
  if (r.sepia) parts.push(`sepia(${r.sepia.toFixed(3)})`);
  if (r.warmth > 0) parts.push(`sepia(${(r.warmth * 0.35).toFixed(3)})`);
  if (r.warmth < 0) parts.push(`hue-rotate(${(r.warmth * -18).toFixed(1)}deg)`);
  if (r.hue) parts.push(`hue-rotate(${r.hue.toFixed(1)}deg)`);
  if (r.blur) parts.push(`blur(${(r.blur * 6).toFixed(2)}px)`);
  return parts.join(" ") || "none";
}

/** Picks a look (or none) and resets its strength; manual adjustments are kept. */
export function withPreset(f: ImageFilters, preset: ImagePreset | null): ImageFilters {
  return { ...f, preset, presetStrength: 1 };
}

/** Clears every manual adjustment (the look stays). */
export function resetAdjustments(f: ImageFilters): ImageFilters {
  return {
    ...f,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    warmth: 0,
    blur: 0,
    vignette: 0,
    grayscale: false,
    sepia: false,
    duotone: null,
  };
}
