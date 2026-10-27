/**
 * Layer blending. The browser's canvas does 16 of the 27 modes natively (fast);
 * the other 11 are computed here per pixel with the W3C compositing formula.
 */
import { luma, type Img } from "./pixels";
import type { BlendMode } from "./types";

/** Canvas `globalCompositeOperation` for each mode the browser can do itself. */
export const NATIVE_BLEND: Partial<Record<BlendMode, GlobalCompositeOperation>> = {
  normal: "source-over",
  darken: "darken",
  multiply: "multiply",
  colorBurn: "color-burn",
  lighten: "lighten",
  screen: "screen",
  colorDodge: "color-dodge",
  linearDodge: "lighter",
  overlay: "overlay",
  softLight: "soft-light",
  hardLight: "hard-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

type Separable = (b: number, s: number) => number;

const burn: Separable = (b, s) => (b === 1 ? 1 : s === 0 ? 0 : 1 - Math.min(1, (1 - b) / s));
const dodge: Separable = (b, s) => (b === 0 ? 0 : s === 1 ? 1 : Math.min(1, b / (1 - s)));
const softLight: Separable = (b, s) => {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
};

/** Separable modes as functions of backdrop b and source s (both 0–1). */
export const SEPARABLE: Partial<Record<BlendMode, Separable>> = {
  normal: (_b, s) => s,
  darken: Math.min,
  multiply: (b, s) => b * s,
  colorBurn: burn,
  linearBurn: (b, s) => Math.max(0, b + s - 1),
  lighten: Math.max,
  screen: (b, s) => b + s - b * s,
  colorDodge: dodge,
  linearDodge: (b, s) => Math.min(1, b + s),
  overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  softLight,
  hardLight: (b, s) => (s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  vividLight: (b, s) => (s <= 0.5 ? burn(b, 2 * s) : dodge(b, 2 * s - 1)),
  linearLight: (b, s) => Math.min(1, Math.max(0, b + 2 * s - 1)),
  pinLight: (b, s) => (s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)),
  hardMix: (b, s) => (b + s >= 1 ? 1 : 0),
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s,
  subtract: (b, s) => Math.max(0, b - s),
  divide: (b, s) => (s === 0 ? 1 : Math.min(1, b / s)),
};

/**
 * Blends `src` onto `dst` (same size) in place: `opacity` 0–1 scales the
 * source alpha; `seed` drives Dissolve's dither.
 */
export function blendInto(dst: Img, src: Img, mode: BlendMode, opacity = 1, seed = 7) {
  const D = dst.data;
  const S = src.data;
  const fn = SEPARABLE[mode];
  let s = seed >>> 0 || 1;
  for (let i = 0; i < D.length; i += 4) {
    let as = (S[i + 3]! / 255) * opacity;
    if (as <= 0) continue;
    const ab = D[i + 3]! / 255;
    const sr = S[i]! / 255;
    const sg = S[i + 1]! / 255;
    const sb = S[i + 2]! / 255;
    const br = D[i]! / 255;
    const bg = D[i + 1]! / 255;
    const bb = D[i + 2]! / 255;
    let r: number;
    let g: number;
    let b: number;
    if (mode === "dissolve") {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      if ((s >>> 0) / 4294967296 >= as) continue;
      as = 1;
      r = sr;
      g = sg;
      b = sb;
    } else if (mode === "darkerColor" || mode === "lighterColor") {
      const darker = luma(sr, sg, sb) < luma(br, bg, bb);
      const pickSrc = mode === "darkerColor" ? darker : !darker;
      [r, g, b] = pickSrc ? [sr, sg, sb] : [br, bg, bb];
    } else if (fn) {
      r = fn(br, sr);
      g = fn(bg, sg);
      b = fn(bb, sb);
    } else {
      // Non-separable modes are always native; fall back to normal.
      r = sr;
      g = sg;
      b = sb;
    }
    // W3C: mix the blended colour by the backdrop's alpha, then source-over.
    const cr = (1 - ab) * sr + ab * r;
    const cg = (1 - ab) * sg + ab * g;
    const cb = (1 - ab) * sb + ab * b;
    const ao = as + ab * (1 - as);
    D[i] = ((cr * as + br * ab * (1 - as)) / ao) * 255;
    D[i + 1] = ((cg * as + bg * ab * (1 - as)) / ao) * 255;
    D[i + 2] = ((cb * as + bb * ab * (1 - as)) / ao) * 255;
    D[i + 3] = ao * 255;
  }
}
