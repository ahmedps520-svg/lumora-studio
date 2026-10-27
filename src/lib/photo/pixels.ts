/**
 * Pixel helpers shared by adjustments, filters and blending. Everything works
 * on `Img` — the same shape as the browser's ImageData — so it runs (and is
 * tested) without a canvas.
 */

export interface Img {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function createImg(
  width: number,
  height: number,
  fill?: [number, number, number, number],
): Img {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) for (let i = 0; i < data.length; i += 4) data.set(fill, i);
  return { width, height, data };
}

export const cloneImg = (img: Img): Img => ({
  width: img.width,
  height: img.height,
  data: new Uint8ClampedArray(img.data),
});

export const clamp = (v: number, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Rec. 601 luma (0–255), as used for "luminosity" in most editors. */
export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => Math.round(clamp(v)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/** RGB (0–255) → HSL (h 0–360, s/l 0–1). */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** HSL (h 0–360, s/l 0–1) → RGB (0–255). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hueToRgb(p, q, h + 1 / 3) * 255,
    hueToRgb(p, q, h) * 255,
    hueToRgb(p, q, h - 1 / 3) * 255,
  ];
}

/** RGB → HSV (h 0–360, s/v 0–1). */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(((h * 60) % 360) + 360) % 360, max ? d / max : 0, max];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = v - c;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

/** Applies a 256-entry lookup table per channel (null = unchanged). */
export function applyLut(
  img: Img,
  r: Uint8Array | null,
  g: Uint8Array | null,
  b: Uint8Array | null,
) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (r) d[i] = r[d[i]!]!;
    if (g) d[i + 1] = g[d[i + 1]!]!;
    if (b) d[i + 2] = b[d[i + 2]!]!;
  }
}

export function lut(fn: (v: number) => number): Uint8Array {
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = clamp(Math.round(fn(i)));
  return out;
}

/** Histogram of each channel and luminosity (256 bins each). */
export function histogram(img: Img, step = 1) {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4 * step) {
    if (d[i + 3] === 0) continue;
    r[d[i]!]!++;
    g[d[i + 1]!]!++;
    b[d[i + 2]!]!++;
    l[Math.round(luma(d[i]!, d[i + 1]!, d[i + 2]!))]!++;
  }
  return { r, g, b, l };
}

/** Deterministic pseudo-random numbers (filters look the same every time). */
export function rng(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Mixes `after` into `before` by a 0–255 mask (selection), in place on `after`. */
export function maskMix(before: Img, after: Img, mask: Uint8ClampedArray | null, amount = 1) {
  if (!mask && amount === 1) return;
  const a = before.data;
  const b = after.data;
  const pixels = b.length / 4;
  for (let p = 0, i = 0; p < pixels; p++, i += 4) {
    const m = (mask ? mask[p]! / 255 : 1) * amount;
    if (m >= 1) continue;
    for (let c = 0; c < 4; c++) b[i + c] = a[i + c]! + (b[i + c]! - a[i + c]!) * m;
  }
}
