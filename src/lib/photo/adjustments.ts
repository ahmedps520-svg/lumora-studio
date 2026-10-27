/**
 * Colour and tone adjustments — the same code runs for adjustment layers
 * (non-destructive) and for Image → Adjustments (applied to pixels).
 * Each works in place on an `Img`.
 */
import { blurChannel, lumaChannel } from "./blur";
import {
  applyLut,
  clamp,
  clamp01,
  hexToRgb,
  hslToRgb,
  type Img,
  luma,
  lut,
  rgbToHsl,
} from "./pixels";
import type {
  Adjustment,
  AdjustmentType,
  Channel,
  CurvePoint,
  GradientStop,
  SelectiveRange,
} from "./types";

const levelsDefault = () => ({ inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 });
const SELECTIVE: SelectiveRange[] = [
  "reds",
  "yellows",
  "greens",
  "cyans",
  "blues",
  "magentas",
  "whites",
  "neutrals",
  "blacks",
];

/** A new adjustment of a type with neutral settings (no visible change). */
export function createAdjustment(type: AdjustmentType): Adjustment {
  switch (type) {
    case "brightnessContrast":
      return { type, brightness: 0, contrast: 0 };
    case "levels":
      return {
        type,
        channel: "rgb",
        levels: {
          rgb: levelsDefault(),
          r: levelsDefault(),
          g: levelsDefault(),
          b: levelsDefault(),
        },
      };
    case "curves": {
      const line = (): CurvePoint[] => [
        [0, 0],
        [255, 255],
      ];
      return { type, curves: { rgb: line(), r: line(), g: line(), b: line() } };
    }
    case "exposure":
      return { type, exposure: 0, offset: 0, gamma: 1 };
    case "vibrance":
      return { type, vibrance: 0, saturation: 0 };
    case "hueSaturation":
      return { type, hue: 0, saturation: 0, lightness: 0, colorize: false };
    case "colorBalance":
      return {
        type,
        shadows: [0, 0, 0],
        midtones: [0, 0, 0],
        highlights: [0, 0, 0],
        preserveLuminosity: true,
      };
    case "blackWhite":
      return {
        type,
        reds: 40,
        yellows: 60,
        greens: 40,
        cyans: 60,
        blues: 20,
        magentas: 80,
        tint: null,
      };
    case "photoFilter":
      return { type, color: "#EC8A00", density: 0.25, preserveLuminosity: true };
    case "channelMixer":
      return { type, red: [100, 0, 0], green: [0, 100, 0], blue: [0, 0, 100], monochrome: false };
    case "invert":
      return { type };
    case "posterize":
      return { type, levels: 4 };
    case "threshold":
      return { type, level: 128 };
    case "gradientMap":
      return {
        type,
        stops: [
          { offset: 0, color: "#000000" },
          { offset: 1, color: "#FFFFFF" },
        ],
        reverse: false,
      };
    case "selectiveColor":
      return {
        type,
        range: "reds",
        values: Object.fromEntries(SELECTIVE.map((r) => [r, [0, 0, 0, 0]])) as Record<
          SelectiveRange,
          [number, number, number, number]
        >,
        absolute: false,
      };
    case "shadowsHighlights":
      return { type, shadows: 35, highlights: 0 };
    case "desaturate":
      return { type };
    case "equalize":
      return { type };
    case "replaceColor":
      return { type, color: "#FF0000", fuzziness: 40, hue: 0, saturation: 0, lightness: 0 };
    case "develop":
      return {
        type,
        temperature: 0,
        tint: 0,
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
        texture: 0,
        clarity: 0,
        dehaze: 0,
        vibrance: 0,
        saturation: 0,
        vignette: 0,
        grain: 0,
      };
  }
}

/** Monotone cubic interpolation through curve points → 256-entry table. */
export function curveLut(points: CurvePoint[]): Uint8Array {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  if (pts.length < 2) return lut((v) => v);
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++)
    d.push((ys[i + 1]! - ys[i]!) / Math.max(1e-6, xs[i + 1]! - xs[i]!));
  m.push(d[0]!);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  m.push(d[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }
  return lut((x) => {
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]!) i++;
    const h = xs[i + 1]! - xs[i]!;
    const t = (x - xs[i]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i]! +
      (t3 - 2 * t2 + t) * h * m[i]! +
      (-2 * t3 + 3 * t2) * ys[i + 1]! +
      (t3 - t2) * h * m[i + 1]!
    );
  });
}

function levelsLut(l: {
  inBlack: number;
  inWhite: number;
  gamma: number;
  outBlack: number;
  outWhite: number;
}) {
  const span = Math.max(1, l.inWhite - l.inBlack);
  return lut((v) => {
    const x = clamp01((v - l.inBlack) / span);
    return l.outBlack + (l.outWhite - l.outBlack) * Math.pow(x, 1 / Math.max(0.01, l.gamma));
  });
}

/** Sample a gradient (stops sorted by offset) at t ∈ [0, 1]. */
export function sampleGradient(stops: GradientStop[], t: number): [number, number, number] {
  const s = [...stops].sort((a, b) => a.offset - b.offset);
  if (t <= s[0]!.offset) return hexToRgb(s[0]!.color);
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]!;
    const b = s[i + 1]!;
    if (t <= b.offset) {
      const k = (t - a.offset) / Math.max(1e-6, b.offset - a.offset);
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      return [
        ca[0] + (cb[0] - ca[0]) * k,
        ca[1] + (cb[1] - ca[1]) * k,
        ca[2] + (cb[2] - ca[2]) * k,
      ];
    }
  }
  return hexToRgb(s[s.length - 1]!.color);
}

/** Restores each pixel's original brightness after a colour change. */
function keepLuma(r: number, g: number, b: number, target: number): [number, number, number] {
  const now = luma(r, g, b);
  const k = target - now;
  return [r + k, g + k, b + k];
}

/** Which selective-colour ranges a pixel belongs to, and how much (0–1). */
function selectiveWeights(
  r: number,
  g: number,
  b: number,
): Partial<Record<SelectiveRange, number>> {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const mid = r + g + b - max - min;
  const w: Partial<Record<SelectiveRange, number>> = {};
  const primary = (max - mid) / 255;
  const secondary = (mid - min) / 255;
  if (primary > 0) {
    if (max === r) w.reds = primary;
    else if (max === g) w.greens = primary;
    else w.blues = primary;
  }
  if (secondary > 0) {
    if (min === b) w.yellows = secondary;
    else if (min === r) w.cyans = secondary;
    else w.magentas = secondary;
  }
  w.whites = clamp01((min - 128) / 127);
  w.blacks = clamp01((127 - max) / 127);
  w.neutrals = clamp01(1 - (Math.abs(max - 128) + Math.abs(min - 128)) / 255);
  return w;
}

export function applyAdjustment(img: Img, adj: Adjustment) {
  const d = img.data;
  const n = d.length;
  switch (adj.type) {
    case "brightnessContrast": {
      const c = clamp(adj.contrast, -100, 100) * 1.27;
      const f = (259 * (c + 255)) / (255 * (259 - c));
      const table = lut((v) => f * (v + adj.brightness - 128) + 128);
      applyLut(img, table, table, table);
      return;
    }
    case "levels": {
      const master = levelsLut(adj.levels.rgb);
      const chans = (["r", "g", "b"] as Channel[]).map((ch) => {
        const own = levelsLut(adj.levels[ch]);
        return lut((v) => master[own[v]!]!);
      });
      applyLut(img, chans[0]!, chans[1]!, chans[2]!);
      return;
    }
    case "curves": {
      const master = curveLut(adj.curves.rgb);
      const chans = (["r", "g", "b"] as Channel[]).map((ch) => {
        const own = curveLut(adj.curves[ch]);
        return lut((v) => master[own[v]!]!);
      });
      applyLut(img, chans[0]!, chans[1]!, chans[2]!);
      return;
    }
    case "exposure": {
      const k = Math.pow(2, adj.exposure);
      const g = 1 / Math.max(0.01, adj.gamma);
      const table = lut((v) => {
        const lin = Math.pow(v / 255, 2.2) * k + adj.offset;
        return Math.pow(clamp01(Math.pow(Math.max(0, lin), 1 / 2.2)), g) * 255;
      });
      applyLut(img, table, table, table);
      return;
    }
    case "vibrance": {
      const vib = adj.vibrance / 100;
      const sat = adj.saturation / 100;
      for (let i = 0; i < n; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const l = luma(r, g, b);
        const max = Math.max(r, g, b);
        const s = max ? (max - Math.min(r, g, b)) / max : 0;
        const amt = 1 + sat + vib * (1 - s);
        d[i] = l + (r - l) * amt;
        d[i + 1] = l + (g - l) * amt;
        d[i + 2] = l + (b - l) * amt;
      }
      return;
    }
    case "hueSaturation": {
      for (let i = 0; i < n; i += 4) {
        let [h, s, l] = rgbToHsl(d[i]!, d[i + 1]!, d[i + 2]!);
        if (adj.colorize) {
          h = adj.hue < 0 ? adj.hue + 360 : adj.hue;
          s = clamp01((adj.saturation + 100) / 200);
        } else {
          h += adj.hue;
          s = clamp01(s * (1 + adj.saturation / 100));
        }
        l =
          adj.lightness >= 0 ? l + (1 - l) * (adj.lightness / 100) : l * (1 + adj.lightness / 100);
        const [r, g, b] = hslToRgb(h, s, clamp01(l));
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }
      return;
    }
    case "colorBalance": {
      for (let i = 0; i < n; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const l = luma(r, g, b) / 255;
        const ws = clamp01(1 - l * 3);
        const wm = clamp01(1 - Math.abs(l - 0.5) * 2.5);
        const wh = clamp01(l * 3 - 2);
        const shift = [0, 1, 2].map(
          (c) => (adj.shadows[c]! * ws + adj.midtones[c]! * wm + adj.highlights[c]! * wh) * 1.2,
        );
        let out: [number, number, number] = [r + shift[0]!, g + shift[1]!, b + shift[2]!];
        if (adj.preserveLuminosity) out = keepLuma(out[0], out[1], out[2], luma(r, g, b));
        d[i] = out[0];
        d[i + 1] = out[1];
        d[i + 2] = out[2];
      }
      return;
    }
    case "blackWhite": {
      const tint = adj.tint ? rgbToHsl(...hexToRgb(adj.tint)) : null;
      for (let i = 0; i < n; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const mid = r + g + b - max - min;
        const primary = max === r ? adj.reds : max === g ? adj.greens : adj.blues;
        const secondary = min === b ? adj.yellows : min === r ? adj.cyans : adj.magentas;
        let gray = min + ((mid - min) * secondary) / 100 + ((max - mid) * primary) / 100;
        gray = clamp(gray);
        if (tint) {
          const [tr, tg, tb] = hslToRgb(tint[0], tint[1] * 0.6, gray / 255);
          d[i] = tr;
          d[i + 1] = tg;
          d[i + 2] = tb;
        } else {
          d[i] = d[i + 1] = d[i + 2] = gray;
        }
      }
      return;
    }
    case "photoFilter": {
      const [fr, fg, fb] = hexToRgb(adj.color);
      const k = clamp01(adj.density);
      for (let i = 0; i < n; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        let out: [number, number, number] = [
          r + ((r * fr) / 255 - r) * k + (fr - 128) * k * 0.35,
          g + ((g * fg) / 255 - g) * k + (fg - 128) * k * 0.35,
          b + ((b * fb) / 255 - b) * k + (fb - 128) * k * 0.35,
        ];
        if (adj.preserveLuminosity) out = keepLuma(out[0], out[1], out[2], luma(r, g, b));
        d[i] = out[0];
        d[i + 1] = out[1];
        d[i + 2] = out[2];
      }
      return;
    }
    case "channelMixer": {
      const R = adj.red;
      const G = adj.green;
      const B = adj.blue;
      for (let i = 0; i < n; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const nr = (r * R[0] + g * R[1] + b * R[2]) / 100;
        if (adj.monochrome) {
          d[i] = d[i + 1] = d[i + 2] = nr;
          continue;
        }
        d[i] = nr;
        d[i + 1] = (r * G[0] + g * G[1] + b * G[2]) / 100;
        d[i + 2] = (r * B[0] + g * B[1] + b * B[2]) / 100;
      }
      return;
    }
    case "invert": {
      for (let i = 0; i < n; i += 4) {
        d[i] = 255 - d[i]!;
        d[i + 1] = 255 - d[i + 1]!;
        d[i + 2] = 255 - d[i + 2]!;
      }
      return;
    }
    case "posterize": {
      const steps = Math.max(2, Math.min(255, Math.round(adj.levels)));
      const table = lut((v) => (Math.round((v / 255) * (steps - 1)) / (steps - 1)) * 255);
      applyLut(img, table, table, table);
      return;
    }
    case "threshold": {
      for (let i = 0; i < n; i += 4) {
        const v = luma(d[i]!, d[i + 1]!, d[i + 2]!) >= adj.level ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      return;
    }
    case "gradientMap": {
      const table: [number, number, number][] = [];
      for (let v = 0; v < 256; v++) {
        const t = v / 255;
        table.push(sampleGradient(adj.stops, adj.reverse ? 1 - t : t));
      }
      for (let i = 0; i < n; i += 4) {
        const c = table[Math.round(luma(d[i]!, d[i + 1]!, d[i + 2]!))]!;
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
      }
      return;
    }
    case "selectiveColor": {
      for (let i = 0; i < n; i += 4) {
        const w = selectiveWeights(d[i]!, d[i + 1]!, d[i + 2]!);
        const out = [d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255];
        for (const [range, weight] of Object.entries(w) as [SelectiveRange, number][]) {
          if (!weight) continue;
          const [c, m, y, k] = adj.values[range];
          if (!c && !m && !y && !k) continue;
          // Cyan, magenta and yellow ink take away red, green and blue; black darkens all three.
          const inks = [c / 100, m / 100, y / 100];
          for (let ch = 0; ch < 3; ch++) {
            const ink = 1 - out[ch]!;
            const delta = (inks[ch]! + k / 100) * weight * (adj.absolute ? 1 : ink);
            out[ch] = 1 - clamp01(ink + delta);
          }
        }
        d[i] = out[0]! * 255;
        d[i + 1] = out[1]! * 255;
        d[i + 2] = out[2]! * 255;
      }
      return;
    }
    case "shadowsHighlights": {
      const L = lumaChannel(img);
      blurChannel(L, img.width, img.height, Math.max(2, Math.min(img.width, img.height) / 60));
      const s = adj.shadows / 100;
      const h = adj.highlights / 100;
      for (let p = 0, i = 0; i < n; p++, i += 4) {
        const local = L[p]! / 255;
        const lift = s * Math.pow(1 - local, 2) * 120 - h * Math.pow(local, 2) * 120;
        d[i] = d[i]! + lift;
        d[i + 1] = d[i + 1]! + lift;
        d[i + 2] = d[i + 2]! + lift;
      }
      return;
    }
    case "desaturate": {
      for (let i = 0; i < n; i += 4) d[i] = d[i + 1] = d[i + 2] = luma(d[i]!, d[i + 1]!, d[i + 2]!);
      return;
    }
    case "equalize": {
      const hist = new Uint32Array(256);
      let count = 0;
      for (let i = 0; i < n; i += 4) {
        if (!d[i + 3]) continue;
        hist[Math.round(luma(d[i]!, d[i + 1]!, d[i + 2]!))]!++;
        count++;
      }
      if (!count) return;
      const cdf = new Float32Array(256);
      let acc = 0;
      for (let v = 0; v < 256; v++) {
        acc += hist[v]!;
        cdf[v] = acc / count;
      }
      for (let i = 0; i < n; i += 4) {
        const l = luma(d[i]!, d[i + 1]!, d[i + 2]!);
        const target = cdf[Math.round(l)]! * 255;
        const k = l > 0 ? target / l : 1;
        if (l > 0) {
          d[i] = d[i]! * k;
          d[i + 1] = d[i + 1]! * k;
          d[i + 2] = d[i + 2]! * k;
        } else d[i] = d[i + 1] = d[i + 2] = target;
      }
      return;
    }
    case "replaceColor": {
      const [tr, tg, tb] = hexToRgb(adj.color);
      const fuzz = Math.max(1, adj.fuzziness) * 2;
      for (let i = 0; i < n; i += 4) {
        const dist = Math.hypot(d[i]! - tr, d[i + 1]! - tg, d[i + 2]! - tb);
        const w = clamp01(1 - dist / fuzz);
        if (!w) continue;
        let [h, s, l] = rgbToHsl(d[i]!, d[i + 1]!, d[i + 2]!);
        h += adj.hue * w;
        s = clamp01(s * (1 + (adj.saturation / 100) * w));
        l = clamp01(l + (adj.lightness / 200) * w);
        const [r, g, b] = hslToRgb(h, s, l);
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }
      return;
    }
    case "develop":
      develop(img, adj);
      return;
  }
}

/** The "Develop" (raw-style) panel: white balance, tone, presence, effects. */
function develop(img: Img, a: Extract<Adjustment, { type: "develop" }>) {
  const d = img.data;
  const n = d.length;
  const w = img.width;
  const h = img.height;
  const needLocal = a.texture || a.clarity || a.dehaze;
  let fine: Float32Array | null = null;
  let coarse: Float32Array | null = null;
  if (needLocal) {
    const L = lumaChannel(img);
    fine = Float32Array.from(L);
    blurChannel(fine, w, h, 2);
    coarse = Float32Array.from(L);
    blurChannel(coarse, w, h, Math.max(4, Math.min(w, h) / 50));
  }
  const exp = Math.pow(2, a.exposure);
  const contrast = 1 + a.contrast / 100;
  const temp = a.temperature / 100;
  const tint = a.tint / 100;
  const rnd = rngNoise();
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);
  for (let p = 0, i = 0; i < n; p++, i += 4) {
    let r = d[i]!;
    let g = d[i + 1]!;
    let b = d[i + 2]!;
    // White balance.
    r += temp * 40;
    b -= temp * 40;
    g -= tint * 30;
    r += tint * 12;
    b += tint * 12;
    // Exposure and contrast.
    r = (r * exp - 128) * contrast + 128;
    g = (g * exp - 128) * contrast + 128;
    b = (b * exp - 128) * contrast + 128;
    // Tone regions.
    const l = clamp01(luma(r, g, b) / 255);
    const tone =
      (a.highlights / 100) * smooth(l, 0.5, 1) * 60 +
      (a.shadows / 100) * (1 - smooth(l, 0, 0.5)) * 60 +
      (a.whites / 100) * smooth(l, 0.75, 1) * 50 +
      (a.blacks / 100) * (1 - smooth(l, 0, 0.25)) * 50;
    r += tone;
    g += tone;
    b += tone;
    // Local contrast: texture (fine), clarity (medium), dehaze (contrast + saturation).
    if (fine && coarse) {
      const lv = luma(r, g, b);
      const detail =
        (lv - fine[p]!) * (a.texture / 100) * 1.2 + (lv - coarse[p]!) * (a.clarity / 100) * 0.9;
      r += detail;
      g += detail;
      b += detail;
      if (a.dehaze) {
        const k = 1 + a.dehaze / 150;
        const base = coarse[p]! * (a.dehaze / 400);
        r = (r - 128) * k + 128 - base;
        g = (g - 128) * k + 128 - base;
        b = (b - 128) * k + 128 - base;
      }
    }
    // Presence.
    const lum = luma(r, g, b);
    const max = Math.max(r, g, b);
    const sat = max > 0 ? (max - Math.min(r, g, b)) / max : 0;
    const amt = 1 + a.saturation / 100 + (a.vibrance / 100) * (1 - sat) + a.dehaze / 300;
    r = lum + (r - lum) * amt;
    g = lum + (g - lum) * amt;
    b = lum + (b - lum) * amt;
    // Effects.
    if (a.vignette) {
      const x = p % w;
      const y = (p / w) | 0;
      const dist = Math.hypot(x - cx, y - cy) / maxR;
      const v = Math.pow(dist, 2) * (a.vignette / 100) * 160;
      r += v;
      g += v;
      b += v;
    }
    if (a.grain) {
      const gr = (rnd() - 0.5) * a.grain * 0.9;
      r += gr;
      g += gr;
      b += gr;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}

const smooth = (x: number, lo: number, hi: number) => {
  const t = clamp01((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};

function rngNoise() {
  let s = 12345;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Auto Tone / Auto Contrast / Auto Color: stretch levels, clipping 0.1%. */
export function autoLevels(img: Img, mode: "tone" | "contrast" | "color") {
  const d = img.data;
  const hists = [
    new Uint32Array(256),
    new Uint32Array(256),
    new Uint32Array(256),
    new Uint32Array(256),
  ];
  let count = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    hists[0]![d[i]!]!++;
    hists[1]![d[i + 1]!]!++;
    hists[2]![d[i + 2]!]!++;
    hists[3]![Math.round(luma(d[i]!, d[i + 1]!, d[i + 2]!))]!++;
    count++;
  }
  if (!count) return;
  const clip = count * 0.001;
  const range = (hist: Uint32Array) => {
    let lo = 0;
    let acc = 0;
    while (lo < 255 && (acc += hist[lo]!) <= clip) lo++;
    let hi = 255;
    acc = 0;
    while (hi > 0 && (acc += hist[hi]!) <= clip) hi--;
    return hi > lo ? [lo, hi] : [0, 255];
  };
  const stretch = ([lo, hi]: number[]) => lut((v) => ((v - lo!) / (hi! - lo!)) * 255);
  if (mode === "contrast") {
    const t = stretch(range(hists[3]!));
    applyLut(img, t, t, t);
  } else {
    const tables = [0, 1, 2].map((c) => stretch(range(hists[c]!)));
    applyLut(img, tables[0]!, tables[1]!, tables[2]!);
  }
  if (mode === "color") {
    // Neutralise the midtones: pull the average colour towards gray.
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let i = 0; i < d.length; i += 4) {
      sr += d[i]!;
      sg += d[i + 1]!;
      sb += d[i + 2]!;
    }
    const pixels = d.length / 4;
    const avg = (sr + sg + sb) / (3 * pixels);
    const gains = [
      avg / Math.max(1, sr / pixels),
      avg / Math.max(1, sg / pixels),
      avg / Math.max(1, sb / pixels),
    ];
    const tables = gains.map((k) => lut((v) => v * (0.5 + 0.5 * k)));
    applyLut(img, tables[0]!, tables[1]!, tables[2]!);
  }
}

export const ADJUSTMENT_TYPES: AdjustmentType[] = [
  "brightnessContrast",
  "levels",
  "curves",
  "exposure",
  "vibrance",
  "hueSaturation",
  "colorBalance",
  "blackWhite",
  "photoFilter",
  "channelMixer",
  "invert",
  "posterize",
  "threshold",
  "gradientMap",
  "selectiveColor",
  "shadowsHighlights",
  "desaturate",
  "equalize",
  "replaceColor",
  "develop",
];
