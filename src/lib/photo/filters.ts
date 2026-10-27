/**
 * Filters. Each one is a pure function on an `Img` (whole layer), with a list
 * of parameters the dialog turns into sliders. They run in place.
 */
import { applyAdjustment } from "./adjustments";
import {
  blurChannel,
  boxBlur,
  boxBlurChannel,
  gaussianBlur,
  joinChannels,
  lumaChannel,
  splitChannels,
} from "./blur";
import {
  clamp,
  clamp01,
  cloneImg,
  hexToRgb,
  type Img,
  luma,
  rgbToHsl,
  rgbToHsv,
  rng,
} from "./pixels";

export type FilterCategory =
  | "blur"
  | "blurGallery"
  | "distort"
  | "noise"
  | "pixelate"
  | "render"
  | "sharpen"
  | "stylize"
  | "other"
  | "lens"
  | "neural";

export type ParamDef =
  | {
      key: string;
      type: "range";
      min: number;
      max: number;
      step?: number;
      default: number;
      unit?: "px" | "%" | "°";
    }
  | { key: string; type: "select"; options: string[]; default: string }
  | { key: string; type: "bool"; default: boolean };

export type Params = Record<string, number | string | boolean>;

export interface FilterContext {
  /** Foreground and background colours (for Clouds, Fibers…). */
  fg: string;
  bg: string;
  seed: number;
}

export interface FilterDef {
  id: string;
  category: FilterCategory;
  params: ParamDef[];
  apply: (img: Img, p: Params, ctx: FilterContext) => void;
}

const num = (p: Params, k: string) => Number(p[k] ?? 0);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 3×3 / 5×5 convolution (alpha kept). */
export function convolve(img: Img, kernel: number[], size: number, divisor = 1, offset = 0) {
  const { width: w, height: h } = img;
  const src = cloneImg(img).data;
  const d = img.data;
  const half = size >> 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = 0; ky < size; ky++) {
        const yy = Math.min(h - 1, Math.max(0, y + ky - half));
        for (let kx = 0; kx < size; kx++) {
          const xx = Math.min(w - 1, Math.max(0, x + kx - half));
          const k = kernel[ky * size + kx]!;
          if (!k) continue;
          const j = (yy * w + xx) * 4;
          r += src[j]! * k;
          g += src[j + 1]! * k;
          b += src[j + 2]! * k;
        }
      }
      const i = (y * w + x) * 4;
      d[i] = r / divisor + offset;
      d[i + 1] = g / divisor + offset;
      d[i + 2] = b / divisor + offset;
    }
}

/** Bilinear sample of `src` at (x, y); out of range → clamped edge. */
function sample(src: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: number[]) {
  x = Math.min(w - 1, Math.max(0, x));
  y = Math.min(h - 1, Math.max(0, y));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  for (let c = 0; c < 4; c++) {
    const a = src[(y0 * w + x0) * 4 + c]!;
    const b = src[(y0 * w + x1) * 4 + c]!;
    const cc = src[(y1 * w + x0) * 4 + c]!;
    const dd = src[(y1 * w + x1) * 4 + c]!;
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + dd * fx) * fy;
  }
}

/** Geometric warp: every output pixel reads from `map(x, y)`. */
export function warp(img: Img, map: (x: number, y: number) => [number, number]) {
  const { width: w, height: h } = img;
  const src = cloneImg(img).data;
  const d = img.data;
  const px = [0, 0, 0, 0];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [sx, sy] = map(x, y);
      sample(src, w, h, sx, sy, px);
      const i = (y * w + x) * 4;
      d[i] = px[0]!;
      d[i + 1] = px[1]!;
      d[i + 2] = px[2]!;
      d[i + 3] = px[3]!;
    }
}

/** Per-channel rank filter (median, minimum, maximum) in a square window. */
function rankFilter(img: Img, radius: number, rank: "median" | "min" | "max") {
  const r = Math.max(1, Math.round(radius));
  const { width: w, height: h } = img;
  const src = cloneImg(img).data;
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < h; y++) {
      hist.fill(0);
      let count = 0;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      // Prime the window for x = 0.
      for (let yy = y0; yy <= y1; yy++)
        for (let xx = 0; xx <= Math.min(w - 1, r); xx++) {
          hist[src[(yy * w + xx) * 4 + c]!]!++;
          count++;
        }
      for (let x = 0; x < w; x++) {
        let v = 0;
        if (rank === "min") while (v < 255 && !hist[v]) v++;
        else if (rank === "max") {
          v = 255;
          while (v > 0 && !hist[v]) v--;
        } else {
          let acc = 0;
          const half = count / 2;
          while (v < 255 && (acc += hist[v]!) < half) v++;
        }
        d[(y * w + x) * 4 + c] = v;
        const out = x - r;
        const inn = x + r + 1;
        for (let yy = y0; yy <= y1; yy++) {
          if (out >= 0) {
            hist[src[(yy * w + out) * 4 + c]!]!--;
            count--;
          }
          if (inn < w) {
            hist[src[(yy * w + inn) * 4 + c]!]!++;
            count++;
          }
        }
      }
    }
  }
}

/** Unsharp mask on luminance-ish (all channels): v + amount × (v − blur). */
export function unsharp(img: Img, amount: number, radius: number, threshold = 0) {
  const blurred = cloneImg(img);
  gaussianBlur(blurred, radius);
  const d = img.data;
  const b = blurred.data;
  for (let i = 0; i < d.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const diff = d[i + c]! - b[i + c]!;
      if (Math.abs(diff) < threshold) continue;
      d[i + c] = d[i + c]! + diff * amount;
    }
}

/** Smooth value noise in [0, 1] (for clouds and fibers). */
function valueNoise(w: number, h: number, scale: number, octaves: number, seed: number) {
  const out = new Float32Array(w * h);
  const rand = rng(seed);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cell = Math.max(2, scale / 2 ** o);
    const gw = Math.ceil(w / cell) + 2;
    const gh = Math.ceil(h / cell) + 2;
    const grid = new Float32Array(gw * gh).map(() => rand());
    for (let y = 0; y < h; y++) {
      const gy = y / cell;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < w; x++) {
        const gx = x / cell;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const a = grid[y0 * gw + x0]!;
        const b = grid[y0 * gw + x0 + 1]!;
        const c = grid[(y0 + 1) * gw + x0]!;
        const dd = grid[(y0 + 1) * gw + x0 + 1]!;
        out[y * w + x] +=
          ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + dd * sx) * sy) * amp;
      }
    }
    total += amp;
    amp /= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / total;
  return out;
}

/** Cell centres for crystallize/pointillize (jittered grid). */
function cells(w: number, h: number, size: number, seed: number) {
  const rand = rng(seed);
  const cols = Math.ceil(w / size);
  const rows = Math.ceil(h / size);
  const pts: [number, number][] = [];
  for (let gy = 0; gy < rows; gy++)
    for (let gx = 0; gx < cols; gx++) pts.push([(gx + rand()) * size, (gy + rand()) * size]);
  return { pts, cols, rows };
}

function nearestCell(c: ReturnType<typeof cells>, size: number, x: number, y: number) {
  const gx = Math.floor(x / size);
  const gy = Math.floor(y / size);
  let best = 0;
  let bestD = Infinity;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = gx + dx;
      const cy = gy + dy;
      if (cx < 0 || cy < 0 || cx >= c.cols || cy >= c.rows) continue;
      const idx = cy * c.cols + cx;
      const [px, py] = c.pts[idx]!;
      const dd = (px - x) ** 2 + (py - y) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = idx;
      }
    }
  return best;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

const range = (
  key: string,
  min: number,
  max: number,
  def: number,
  unit?: "px" | "%" | "°",
  step?: number,
): ParamDef => ({
  key,
  type: "range",
  min,
  max,
  default: def,
  unit,
  step,
});

export const FILTERS: FilterDef[] = [
  // Blur
  {
    id: "average",
    category: "blur",
    params: [],
    apply: (img) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        r += d[i]!;
        g += d[i + 1]!;
        b += d[i + 2]!;
        n++;
      }
      if (!n) return;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        d[i] = r / n;
        d[i + 1] = g / n;
        d[i + 2] = b / n;
      }
    },
  },
  {
    id: "blur",
    category: "blur",
    params: [],
    apply: (img) => convolve(img, [1, 2, 1, 2, 4, 2, 1, 2, 1], 3, 16),
  },
  { id: "blurMore", category: "blur", params: [], apply: (img) => gaussianBlur(img, 3) },
  {
    id: "boxBlur",
    category: "blur",
    params: [range("radius", 1, 200, 8, "px")],
    apply: (img, p) => boxBlur(img, num(p, "radius")),
  },
  {
    id: "gaussianBlur",
    category: "blur",
    params: [range("radius", 0.5, 250, 6, "px", 0.5)],
    apply: (img, p) => gaussianBlur(img, num(p, "radius")),
  },
  {
    id: "motionBlur",
    category: "blur",
    params: [range("angle", -180, 180, 0, "°"), range("distance", 1, 400, 20, "px")],
    apply: (img, p) => {
      const steps = Math.max(2, Math.round(num(p, "distance")));
      const a = (num(p, "angle") * Math.PI) / 180;
      const dx = Math.cos(a);
      const dy = -Math.sin(a);
      const { width: w, height: h } = img;
      const src = cloneImg(img).data;
      const d = img.data;
      const px = [0, 0, 0, 0];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const acc = [0, 0, 0, 0];
          for (let s = 0; s < steps; s++) {
            const t = s / (steps - 1) - 0.5;
            sample(src, w, h, x + dx * t * steps, y + dy * t * steps, px);
            for (let c = 0; c < 4; c++) acc[c] += px[c]!;
          }
          const i = (y * w + x) * 4;
          for (let c = 0; c < 4; c++) d[i + c] = acc[c]! / steps;
        }
    },
  },
  {
    id: "radialBlur",
    category: "blur",
    params: [
      { key: "method", type: "select", options: ["spin", "zoom"], default: "spin" },
      range("amount", 1, 100, 15),
      range("centerX", 0, 100, 50, "%"),
      range("centerY", 0, 100, 50, "%"),
    ],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const cx = (num(p, "centerX") / 100) * w;
      const cy = (num(p, "centerY") / 100) * h;
      const amount = num(p, "amount") / 100;
      const spin = p.method !== "zoom";
      const steps = 24;
      const src = cloneImg(img).data;
      const d = img.data;
      const px = [0, 0, 0, 0];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const acc = [0, 0, 0, 0];
          const ddx = x - cx;
          const ddy = y - cy;
          for (let s = 0; s < steps; s++) {
            const t = (s / (steps - 1) - 0.5) * amount;
            let sx: number;
            let sy: number;
            if (spin) {
              const a = t * 0.6;
              sx = cx + ddx * Math.cos(a) - ddy * Math.sin(a);
              sy = cy + ddx * Math.sin(a) + ddy * Math.cos(a);
            } else {
              const k = 1 + t * 0.5;
              sx = cx + ddx * k;
              sy = cy + ddy * k;
            }
            sample(src, w, h, sx, sy, px);
            for (let c = 0; c < 4; c++) acc[c] += px[c]!;
          }
          const i = (y * w + x) * 4;
          for (let c = 0; c < 4; c++) d[i + c] = acc[c]! / steps;
        }
    },
  },
  {
    id: "surfaceBlur",
    category: "blur",
    params: [range("radius", 1, 30, 5, "px"), range("threshold", 2, 255, 15)],
    apply: (img, p) => surfaceBlur(img, num(p, "radius"), num(p, "threshold")),
  },
  // Blur gallery
  {
    id: "tiltShift",
    category: "blurGallery",
    params: [
      range("focus", 0, 100, 50, "%"),
      range("width", 2, 80, 20, "%"),
      range("blur", 1, 60, 15, "px"),
    ],
    apply: (img, p) => {
      const blurred = cloneImg(img);
      gaussianBlur(blurred, num(p, "blur"));
      const { width: w, height: h } = img;
      const center = (num(p, "focus") / 100) * h;
      const half = ((num(p, "width") / 100) * h) / 2;
      for (let y = 0; y < h; y++) {
        const k = clamp01((Math.abs(y - center) - half) / Math.max(1, half));
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 4; c++)
            img.data[i + c] = img.data[i + c]! * (1 - k) + blurred.data[i + c]! * k;
        }
      }
    },
  },
  {
    id: "irisBlur",
    category: "blurGallery",
    params: [
      range("centerX", 0, 100, 50, "%"),
      range("centerY", 0, 100, 50, "%"),
      range("radius", 5, 90, 30, "%"),
      range("blur", 1, 60, 15, "px"),
    ],
    apply: (img, p) => {
      const blurred = cloneImg(img);
      gaussianBlur(blurred, num(p, "blur"));
      const { width: w, height: h } = img;
      const cx = (num(p, "centerX") / 100) * w;
      const cy = (num(p, "centerY") / 100) * h;
      const r = (num(p, "radius") / 100) * Math.min(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const k = clamp01((Math.hypot(x - cx, y - cy) - r) / Math.max(1, r * 0.6));
          const i = (y * w + x) * 4;
          for (let c = 0; c < 4; c++)
            img.data[i + c] = img.data[i + c]! * (1 - k) + blurred.data[i + c]! * k;
        }
    },
  },
  // Distort
  {
    id: "pinch",
    category: "distort",
    params: [range("amount", -100, 100, 50, "%")],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const amt = num(p, "amount") / 100;
      warp(img, (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= r || d === 0) return [x, y];
        const k = Math.pow(Math.sin((Math.PI / 2) * (d / r)), -amt);
        return [cx + dx * k, cy + dy * k];
      });
    },
  },
  {
    id: "polarCoordinates",
    category: "distort",
    params: [
      {
        key: "mode",
        type: "select",
        options: ["rectToPolar", "polarToRect"],
        default: "rectToPolar",
      },
    ],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(cx, cy);
      if (p.mode === "polarToRect")
        warp(img, (x, y) => {
          const a = (x / w) * Math.PI * 2 - Math.PI / 2;
          const r = (1 - y / h) * maxR;
          return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        });
      else
        warp(img, (x, y) => {
          const a = Math.atan2(y - cy, x - cx) + Math.PI / 2;
          const r = Math.hypot(x - cx, y - cy) / maxR;
          return [((((a / (Math.PI * 2)) % 1) + 1) % 1) * w, (1 - r) * h];
        });
    },
  },
  {
    id: "ripple",
    category: "distort",
    params: [
      range("amount", -999, 999, 100),
      { key: "size", type: "select", options: ["small", "medium", "large"], default: "medium" },
    ],
    apply: (img, p) => {
      const len = p.size === "small" ? 8 : p.size === "large" ? 40 : 18;
      const amp = (num(p, "amount") / 100) * 4;
      warp(img, (x, y) => [x + Math.sin(y / len) * amp, y + Math.sin(x / len) * amp]);
    },
  },
  {
    id: "spherize",
    category: "distort",
    params: [range("amount", -100, 100, 100, "%")],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const amt = num(p, "amount") / 100;
      warp(img, (x, y) => {
        const dx = (x - cx) / r;
        const dy = (y - cy) / r;
        const d = Math.hypot(dx, dy);
        if (d >= 1 || d === 0) return [x, y];
        const sphere = Math.asin(d) / (Math.PI / 2) / d;
        const k = 1 + (sphere - 1) * amt;
        return [cx + dx * r * k, cy + dy * r * k];
      });
    },
  },
  {
    id: "twirl",
    category: "distort",
    params: [range("angle", -999, 999, 50, "°")],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const a0 = (num(p, "angle") * Math.PI) / 180;
      warp(img, (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= r) return [x, y];
        const a = a0 * (1 - d / r);
        return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
      });
    },
  },
  {
    id: "wave",
    category: "distort",
    params: [
      range("wavelength", 4, 400, 60, "px"),
      range("amplitude", 1, 200, 12, "px"),
      { key: "type", type: "select", options: ["sine", "triangle", "square"], default: "sine" },
    ],
    apply: (img, p) => {
      const len = num(p, "wavelength");
      const amp = num(p, "amplitude");
      const shape = (t: number) => {
        const s = Math.sin(t);
        if (p.type === "square") return Math.sign(s);
        if (p.type === "triangle") return (2 / Math.PI) * Math.asin(s);
        return s;
      };
      warp(img, (x, y) => [
        x + shape((y / len) * Math.PI * 2) * amp,
        y + shape((x / len) * Math.PI * 2) * amp,
      ]);
    },
  },
  {
    id: "zigzag",
    category: "distort",
    params: [range("amount", -100, 100, 30), range("ridges", 1, 20, 5)],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const amt = num(p, "amount") / 100;
      const ridges = num(p, "ridges");
      warp(img, (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= r || d === 0) return [x, y];
        const k = 1 + Math.sin((d / r) * ridges * Math.PI * 2) * amt * 0.1 * (1 - d / r);
        return [cx + dx * k, cy + dy * k];
      });
    },
  },
  // Noise
  {
    id: "addNoise",
    category: "noise",
    params: [
      range("amount", 0, 100, 12, "%"),
      {
        key: "distribution",
        type: "select",
        options: ["uniform", "gaussian"],
        default: "gaussian",
      },
      { key: "monochromatic", type: "bool", default: true },
    ],
    apply: (img, p, ctx) => {
      const rand = rng(ctx.seed);
      const amt = num(p, "amount") * 2.55;
      const gauss = () => (rand() + rand() + rand() + rand() - 2) * 0.866;
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const draw = () => (p.distribution === "gaussian" ? gauss() : rand() * 2 - 1) * amt;
        const m = draw();
        d[i] = d[i]! + (p.monochromatic ? m : draw());
        d[i + 1] = d[i + 1]! + (p.monochromatic ? m : draw());
        d[i + 2] = d[i + 2]! + (p.monochromatic ? m : draw());
      }
    },
  },
  { id: "despeckle", category: "noise", params: [], apply: (img) => surfaceBlur(img, 2, 18) },
  {
    id: "dustScratches",
    category: "noise",
    params: [range("radius", 1, 20, 2, "px"), range("threshold", 0, 255, 10)],
    apply: (img, p) => {
      const med = cloneImg(img);
      rankFilter(med, num(p, "radius"), "median");
      const t = num(p, "threshold");
      const d = img.data;
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; c++)
          if (Math.abs(d[i + c]! - med.data[i + c]!) > t) d[i + c] = med.data[i + c]!;
    },
  },
  {
    id: "median",
    category: "noise",
    params: [range("radius", 1, 20, 2, "px")],
    apply: (img, p) => rankFilter(img, num(p, "radius"), "median"),
  },
  {
    id: "reduceNoise",
    category: "noise",
    params: [range("strength", 1, 10, 6), range("preserveDetails", 0, 100, 60, "%")],
    apply: (img, p) => {
      const before = cloneImg(img);
      surfaceBlur(img, 1 + num(p, "strength") / 2, 6 + num(p, "strength") * 4);
      const keep = num(p, "preserveDetails") / 100;
      const d = img.data;
      for (let i = 0; i < d.length; i++)
        if ((i & 3) !== 3) d[i] = d[i]! + (before.data[i]! - d[i]!) * keep * 0.4;
    },
  },
  // Pixelate
  {
    id: "colorHalftone",
    category: "pixelate",
    params: [range("maxRadius", 4, 60, 8, "px")],
    apply: (img, p) => {
      const cell = Math.max(4, Math.round(num(p, "maxRadius")) * 2);
      const { width: w, height: h } = img;
      const src = cloneImg(img).data;
      const d = img.data;
      // One dot grid per channel, rotated like printing screens.
      const angles = [(108 * Math.PI) / 180, (162 * Math.PI) / 180, (90 * Math.PI) / 180];
      for (let c = 0; c < 3; c++) {
        const a = angles[c]!;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const u = x * cos + y * sin;
            const v = -x * sin + y * cos;
            const cu = (Math.floor(u / cell) + 0.5) * cell;
            const cv = (Math.floor(v / cell) + 0.5) * cell;
            const sx = Math.round(cu * cos - cv * sin);
            const sy = Math.round(cu * sin + cv * cos);
            const sv =
              src[
                (Math.min(h - 1, Math.max(0, sy)) * w + Math.min(w - 1, Math.max(0, sx))) * 4 + c
              ]!;
            const radius = (1 - sv / 255) * cell * 0.7;
            const dist = Math.hypot(u - cu, v - cv);
            d[(y * w + x) * 4 + c] = dist < radius ? 0 : 255;
          }
      }
    },
  },
  {
    id: "crystallize",
    category: "pixelate",
    params: [range("cellSize", 3, 300, 18, "px")],
    apply: (img, p, ctx) => cellFill(img, num(p, "cellSize"), ctx.seed, false),
  },
  {
    id: "fragment",
    category: "pixelate",
    params: [],
    apply: (img) => {
      const copy = cloneImg(img);
      const { width: w, height: h } = img;
      const d = img.data;
      d.fill(0);
      const offsets = [
        [-4, -4],
        [4, -4],
        [-4, 4],
        [4, 4],
      ];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const acc = [0, 0, 0, 0];
          for (const [ox, oy] of offsets) {
            const xx = Math.min(w - 1, Math.max(0, x + ox!));
            const yy = Math.min(h - 1, Math.max(0, y + oy!));
            const j = (yy * w + xx) * 4;
            for (let c = 0; c < 4; c++) acc[c] += copy.data[j + c]!;
          }
          const i = (y * w + x) * 4;
          for (let c = 0; c < 4; c++) d[i + c] = acc[c]! / 4;
        }
    },
  },
  {
    id: "mezzotint",
    category: "pixelate",
    params: [
      { key: "type", type: "select", options: ["dots", "lines", "strokes"], default: "dots" },
    ],
    apply: (img, p, ctx) => {
      const rand = rng(ctx.seed);
      const { width: w } = img;
      const d = img.data;
      for (let i = 0, px = 0; i < d.length; i += 4, px++) {
        const x = px % w;
        for (let c = 0; c < 3; c++) {
          const r =
            p.type === "lines"
              ? ((x * 7919) % 97) / 97
              : p.type === "strokes"
                ? (rand() + ((x * 31) % 17) / 17) / 2
                : rand();
          d[i + c] = d[i + c]! / 255 > r ? 255 : 0;
        }
      }
    },
  },
  {
    id: "mosaic",
    category: "pixelate",
    params: [range("cellSize", 2, 200, 16, "px")],
    apply: (img, p) => {
      const s = Math.max(2, Math.round(num(p, "cellSize")));
      const { width: w, height: h } = img;
      const d = img.data;
      for (let by = 0; by < h; by += s)
        for (let bx = 0; bx < w; bx += s) {
          const acc = [0, 0, 0, 0];
          let n = 0;
          for (let y = by; y < Math.min(h, by + s); y++)
            for (let x = bx; x < Math.min(w, bx + s); x++) {
              const i = (y * w + x) * 4;
              for (let c = 0; c < 4; c++) acc[c] += d[i + c]!;
              n++;
            }
          for (let y = by; y < Math.min(h, by + s); y++)
            for (let x = bx; x < Math.min(w, bx + s); x++) {
              const i = (y * w + x) * 4;
              for (let c = 0; c < 4; c++) d[i + c] = acc[c]! / n;
            }
        }
    },
  },
  {
    id: "pointillize",
    category: "pixelate",
    params: [range("cellSize", 3, 300, 10, "px")],
    apply: (img, p, ctx) => cellFill(img, num(p, "cellSize"), ctx.seed, true, ctx.bg),
  },
  // Render
  {
    id: "clouds",
    category: "render",
    params: [],
    apply: (img, _p, ctx) => renderNoise(img, ctx, false),
  },
  {
    id: "differenceClouds",
    category: "render",
    params: [],
    apply: (img, _p, ctx) => renderNoise(img, ctx, true),
  },
  {
    id: "fibers",
    category: "render",
    params: [range("variance", 1, 64, 16), range("strength", 1, 64, 4)],
    apply: (img, p, ctx) => {
      const { width: w, height: h } = img;
      const noise = valueNoise(
        w,
        Math.max(2, Math.round(h / num(p, "strength"))),
        num(p, "variance"),
        3,
        ctx.seed,
      );
      const nh = Math.max(2, Math.round(h / num(p, "strength")));
      const fg = hexToRgb(ctx.fg);
      const bg = hexToRgb(ctx.bg);
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const t = noise[Math.min(nh - 1, Math.floor((y / h) * nh)) * w + x]!;
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) d[i + c] = bg[c]! + (fg[c]! - bg[c]!) * t;
          d[i + 3] = 255;
        }
    },
  },
  {
    id: "lensFlare",
    category: "render",
    params: [
      range("centerX", 0, 100, 30, "%"),
      range("centerY", 0, 100, 30, "%"),
      range("brightness", 10, 300, 100, "%"),
    ],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const fx = (num(p, "centerX") / 100) * w;
      const fy = (num(p, "centerY") / 100) * h;
      const k = num(p, "brightness") / 100;
      const size = Math.min(w, h);
      const ghosts = [0.4, 0.7, 1.2, 1.6].map((t) => [
        w / 2 + (w / 2 - fx) * t,
        h / 2 + (h / 2 - fy) * t,
        size * (0.03 + 0.04 * t),
      ]);
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const dist = Math.hypot(x - fx, y - fy) / size;
          let light = Math.exp(-dist * 9) * 255 * k + Math.exp(-dist * 30) * 255 * k;
          const ring = Math.exp(-Math.pow((dist - 0.12) * 60, 2)) * 60 * k;
          light += ring;
          for (const [gx, gy, gr] of ghosts)
            light += Math.exp(-Math.pow(Math.hypot(x - gx!, y - gy!) / gr!, 2)) * 40 * k;
          const i = (y * w + x) * 4;
          d[i] = d[i]! + light;
          d[i + 1] = d[i + 1]! + light * 0.92;
          d[i + 2] = d[i + 2]! + light * 0.75;
        }
    },
  },
  {
    id: "vignette",
    category: "render",
    params: [range("amount", -100, 100, -50), range("midpoint", 0, 100, 50, "%")],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const amt = num(p, "amount") / 100;
      const mid = num(p, "midpoint") / 100;
      const cx = w / 2;
      const cy = h / 2;
      const max = Math.hypot(cx, cy);
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const t = clamp01((Math.hypot(x - cx, y - cy) / max - mid * 0.6) / (1 - mid * 0.6));
          const v = t * t * amt * 255;
          const i = (y * w + x) * 4;
          d[i] = d[i]! + v;
          d[i + 1] = d[i + 1]! + v;
          d[i + 2] = d[i + 2]! + v;
        }
    },
  },
  // Sharpen
  {
    id: "sharpen",
    category: "sharpen",
    params: [],
    apply: (img) => convolve(img, [0, -1, 0, -1, 6, -1, 0, -1, 0], 3, 2),
  },
  {
    id: "sharpenMore",
    category: "sharpen",
    params: [],
    apply: (img) => convolve(img, [-1, -1, -1, -1, 12, -1, -1, -1, -1], 3, 4),
  },
  { id: "sharpenEdges", category: "sharpen", params: [], apply: (img) => unsharp(img, 1, 1.2, 12) },
  {
    id: "unsharpMask",
    category: "sharpen",
    params: [
      range("amount", 1, 500, 100, "%"),
      range("radius", 0.1, 100, 1.5, "px", 0.1),
      range("threshold", 0, 255, 0),
    ],
    apply: (img, p) => unsharp(img, num(p, "amount") / 100, num(p, "radius"), num(p, "threshold")),
  },
  {
    id: "smartSharpen",
    category: "sharpen",
    params: [
      range("amount", 1, 500, 150, "%"),
      range("radius", 0.1, 64, 1, "px", 0.1),
      range("reduceNoise", 0, 100, 10, "%"),
    ],
    apply: (img, p) => {
      if (num(p, "reduceNoise") > 0) surfaceBlur(img, 1, 4 + num(p, "reduceNoise") / 4);
      unsharp(img, num(p, "amount") / 100, num(p, "radius"), 2);
    },
  },
  // Stylize
  {
    id: "diffuse",
    category: "stylize",
    params: [
      {
        key: "mode",
        type: "select",
        options: ["normal", "darkenOnly", "lightenOnly"],
        default: "normal",
      },
    ],
    apply: (img, p, ctx) => {
      const rand = rng(ctx.seed);
      const { width: w, height: h } = img;
      const src = cloneImg(img).data;
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const xx = Math.min(w - 1, Math.max(0, x + Math.round(rand() * 4 - 2)));
          const yy = Math.min(h - 1, Math.max(0, y + Math.round(rand() * 4 - 2)));
          const i = (y * w + x) * 4;
          const j = (yy * w + xx) * 4;
          const take =
            p.mode === "darkenOnly"
              ? luma(src[j]!, src[j + 1]!, src[j + 2]!) < luma(src[i]!, src[i + 1]!, src[i + 2]!)
              : p.mode === "lightenOnly"
                ? luma(src[j]!, src[j + 1]!, src[j + 2]!) > luma(src[i]!, src[i + 1]!, src[i + 2]!)
                : true;
          if (take) for (let c = 0; c < 4; c++) d[i + c] = src[j + c]!;
        }
    },
  },
  {
    id: "emboss",
    category: "stylize",
    params: [
      range("angle", -180, 180, 135, "°"),
      range("height", 1, 10, 3, "px"),
      range("amount", 1, 500, 100, "%"),
    ],
    apply: (img, p) => {
      const a = (num(p, "angle") * Math.PI) / 180;
      const hgt = num(p, "height");
      const amt = num(p, "amount") / 100;
      const { width: w, height: h } = img;
      const L = lumaChannel(img);
      const dx = Math.cos(a) * hgt;
      const dy = -Math.sin(a) * hgt;
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const x1 = Math.min(w - 1, Math.max(0, Math.round(x + dx)));
          const y1 = Math.min(h - 1, Math.max(0, Math.round(y + dy)));
          const x2 = Math.min(w - 1, Math.max(0, Math.round(x - dx)));
          const y2 = Math.min(h - 1, Math.max(0, Math.round(y - dy)));
          const v = 128 + (L[y1 * w + x1]! - L[y2 * w + x2]!) * amt;
          const i = (y * w + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
    },
  },
  {
    id: "findEdges",
    category: "stylize",
    params: [],
    apply: (img) => {
      const { width: w, height: h } = img;
      const L = lumaChannel(img);
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const at = (xx: number, yy: number) =>
            L[Math.min(h - 1, Math.max(0, yy)) * w + Math.min(w - 1, Math.max(0, xx))]!;
          const gx =
            -at(x - 1, y - 1) -
            2 * at(x - 1, y) -
            at(x - 1, y + 1) +
            at(x + 1, y - 1) +
            2 * at(x + 1, y) +
            at(x + 1, y + 1);
          const gy =
            -at(x - 1, y - 1) -
            2 * at(x, y - 1) -
            at(x + 1, y - 1) +
            at(x - 1, y + 1) +
            2 * at(x, y + 1) +
            at(x + 1, y + 1);
          const v = 255 - Math.min(255, Math.hypot(gx, gy));
          const i = (y * w + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
    },
  },
  {
    id: "oilPaint",
    category: "stylize",
    params: [range("radius", 1, 10, 4, "px"), range("levels", 4, 64, 20)],
    apply: (img, p) => oilPaint(img, num(p, "radius"), num(p, "levels")),
  },
  {
    id: "solarize",
    category: "stylize",
    params: [],
    apply: (img) => {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; c++) if (d[i + c]! > 127) d[i + c] = 255 - d[i + c]!;
    },
  },
  {
    id: "tiles",
    category: "stylize",
    params: [range("tiles", 2, 60, 10), range("offset", 0, 50, 10, "%")],
    apply: (img, p, ctx) => {
      const rand = rng(ctx.seed);
      const { width: w, height: h } = img;
      const n = Math.max(2, Math.round(num(p, "tiles")));
      const size = Math.ceil(Math.min(w, h) / n);
      const maxOff = (num(p, "offset") / 100) * size;
      const src = cloneImg(img).data;
      const d = img.data;
      const bg = hexToRgb(ctx.bg);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = bg[0];
        d[i + 1] = bg[1];
        d[i + 2] = bg[2];
        d[i + 3] = 255;
      }
      for (let ty = 0; ty < h; ty += size)
        for (let tx = 0; tx < w; tx += size) {
          const ox = Math.round((rand() * 2 - 1) * maxOff);
          const oy = Math.round((rand() * 2 - 1) * maxOff);
          for (let y = ty; y < Math.min(h, ty + size); y++)
            for (let x = tx; x < Math.min(w, tx + size); x++) {
              const nx = x + ox;
              const ny = y + oy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const i = (ny * w + nx) * 4;
              const j = (y * w + x) * 4;
              for (let c = 0; c < 4; c++) d[i + c] = src[j + c]!;
            }
        }
    },
  },
  {
    id: "traceContour",
    category: "stylize",
    params: [range("level", 0, 255, 128)],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const level = num(p, "level");
      const src = cloneImg(img).data;
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const j = (Math.min(h - 1, y + 1) * w + Math.min(w - 1, x + 1)) * 4;
          for (let c = 0; c < 3; c++)
            d[i + c] = src[i + c]! >= level !== src[j + c]! >= level ? 0 : 255;
        }
    },
  },
  {
    id: "wind",
    category: "stylize",
    params: [
      { key: "method", type: "select", options: ["wind", "blast", "stagger"], default: "wind" },
      {
        key: "direction",
        type: "select",
        options: ["fromRight", "fromLeft"],
        default: "fromRight",
      },
    ],
    apply: (img, p, ctx) => {
      const rand = rng(ctx.seed);
      const { width: w, height: h } = img;
      const len = p.method === "blast" ? 40 : p.method === "stagger" ? 24 : 14;
      const dir = p.direction === "fromLeft" ? 1 : -1;
      const L = lumaChannel(img);
      const d = img.data;
      for (let y = 0; y < h; y++) {
        let carry = 0;
        let color = [0, 0, 0];
        for (let s = 0; s < w; s++) {
          const x = dir > 0 ? s : w - 1 - s;
          const i = (y * w + x) * 4;
          const edge = Math.abs(L[y * w + x]! - L[y * w + Math.min(w - 1, Math.max(0, x - dir))]!);
          if (edge > 30 && rand() < 0.6) {
            carry = Math.round(len * (0.5 + rand()));
            color = [d[i]!, d[i + 1]!, d[i + 2]!];
          } else if (carry > 0) {
            const k = carry / len;
            for (let c = 0; c < 3; c++) d[i + c] = d[i + c]! + (color[c]! - d[i + c]!) * k * 0.6;
            carry--;
          }
        }
      }
    },
  },
  // Other
  {
    id: "custom",
    category: "other",
    params: [
      range("center", -50, 50, 5),
      range("neighbors", -20, 20, -1),
      range("scale", 1, 50, 1),
      range("offset", -255, 255, 0),
    ],
    apply: (img, p) => {
      const c = num(p, "center");
      const nb = num(p, "neighbors");
      convolve(img, [0, nb, 0, nb, c, nb, 0, nb, 0], 3, num(p, "scale") || 1, num(p, "offset"));
    },
  },
  {
    id: "highPass",
    category: "other",
    params: [range("radius", 0.1, 250, 10, "px", 0.1)],
    apply: (img, p) => {
      const blurred = cloneImg(img);
      gaussianBlur(blurred, num(p, "radius"));
      const d = img.data;
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; c++) d[i + c] = 128 + d[i + c]! - blurred.data[i + c]!;
    },
  },
  {
    id: "hsbHsl",
    category: "other",
    params: [{ key: "mode", type: "select", options: ["hsb", "hsl"], default: "hsb" }],
    apply: (img, p) => {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const [h, s, v] =
          p.mode === "hsl"
            ? rgbToHsl(d[i]!, d[i + 1]!, d[i + 2]!)
            : rgbToHsv(d[i]!, d[i + 1]!, d[i + 2]!);
        d[i] = (h / 360) * 255;
        d[i + 1] = s * 255;
        d[i + 2] = v * 255;
      }
    },
  },
  {
    id: "maximum",
    category: "other",
    params: [range("radius", 1, 50, 2, "px")],
    apply: (img, p) => rankFilter(img, num(p, "radius"), "max"),
  },
  {
    id: "minimum",
    category: "other",
    params: [range("radius", 1, 50, 2, "px")],
    apply: (img, p) => rankFilter(img, num(p, "radius"), "min"),
  },
  {
    id: "offset",
    category: "other",
    params: [
      range("horizontal", -2000, 2000, 50, "px"),
      range("vertical", -2000, 2000, 50, "px"),
      { key: "wrap", type: "bool", default: true },
    ],
    apply: (img, p) => {
      const { width: w, height: h } = img;
      const ox = Math.round(num(p, "horizontal"));
      const oy = Math.round(num(p, "vertical"));
      const src = cloneImg(img).data;
      const d = img.data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let sx = x - ox;
          let sy = y - oy;
          if (p.wrap) {
            sx = ((sx % w) + w) % w;
            sy = ((sy % h) + h) % h;
          } else {
            sx = Math.min(w - 1, Math.max(0, sx));
            sy = Math.min(h - 1, Math.max(0, sy));
          }
          const i = (y * w + x) * 4;
          const j = (sy * w + sx) * 4;
          for (let c = 0; c < 4; c++) d[i + c] = src[j + c]!;
        }
    },
  },
  // Lens correction
  {
    id: "lensCorrection",
    category: "lens",
    params: [range("distortion", -100, 100, 0), range("vignette", -100, 100, 0)],
    apply: (img, p) => {
      const k = num(p, "distortion") / 250;
      if (k) {
        const { width: w, height: h } = img;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.hypot(cx, cy);
        warp(img, (x, y) => {
          const dx = (x - cx) / r;
          const dy = (y - cy) / r;
          const f = 1 + k * (dx * dx + dy * dy);
          return [cx + dx * r * f, cy + dy * r * f];
        });
      }
      if (num(p, "vignette"))
        FILTER_BY_ID.get("vignette")!.apply(
          img,
          { amount: num(p, "vignette"), midpoint: 40 },
          { fg: "#000", bg: "#fff", seed: 1 },
        );
    },
  },
  // "Neural" (local) filters
  {
    id: "skinSmoothing",
    category: "neural",
    params: [range("blur", 1, 20, 6, "px"), range("smoothness", 0, 100, 60, "%")],
    apply: (img, p) => {
      const before = cloneImg(img);
      surfaceBlur(img, num(p, "blur"), 22);
      const k = num(p, "smoothness") / 100;
      const d = img.data;
      for (let i = 0; i < d.length; i++)
        if ((i & 3) !== 3) d[i] = before.data[i]! + (d[i]! - before.data[i]!) * k;
    },
  },
  {
    id: "develop",
    category: "lens",
    params: [],
    apply: () => undefined, // Opens the Develop dialog instead (an adjustment).
  },
];

export const FILTER_BY_ID = new Map(FILTERS.map((f) => [f.id, f]));

export const FILTER_CATEGORIES: FilterCategory[] = [
  "blur",
  "blurGallery",
  "distort",
  "noise",
  "pixelate",
  "render",
  "sharpen",
  "stylize",
  "other",
  "lens",
  "neural",
];

export function defaultParams(def: FilterDef): Params {
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]));
}

// ─── Larger helpers ──────────────────────────────────────────────────────────

/** Edge-preserving blur: neighbours only count when their colour is close. */
export function surfaceBlur(img: Img, radius: number, threshold: number) {
  const r = Math.max(1, Math.round(radius));
  const { width: w, height: h } = img;
  const src = cloneImg(img).data;
  const d = img.data;
  const step = r > 6 ? 2 : 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const acc = [0, 0, 0];
      const wsum = [0, 0, 0];
      for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy += step)
        for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx += step) {
          const j = (yy * w + xx) * 4;
          for (let c = 0; c < 3; c++) {
            const diff = Math.abs(src[j + c]! - src[i + c]!);
            const wt = Math.max(0, 1 - diff / (2.5 * threshold));
            acc[c] += src[j + c]! * wt;
            wsum[c] += wt;
          }
        }
      for (let c = 0; c < 3; c++) d[i + c] = wsum[c]! ? acc[c]! / wsum[c]! : src[i + c]!;
    }
}

function oilPaint(img: Img, radius: number, levels: number) {
  const r = Math.max(1, Math.round(radius));
  const L = Math.max(4, Math.round(levels));
  const { width: w, height: h } = img;
  const src = cloneImg(img).data;
  const d = img.data;
  const count = new Uint32Array(L);
  const sr = new Float32Array(L);
  const sg = new Float32Array(L);
  const sb = new Float32Array(L);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      count.fill(0);
      sr.fill(0);
      sg.fill(0);
      sb.fill(0);
      for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++)
        for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
          const j = (yy * w + xx) * 4;
          const bin = Math.min(
            L - 1,
            Math.floor((luma(src[j]!, src[j + 1]!, src[j + 2]!) / 256) * L),
          );
          count[bin]!++;
          sr[bin] += src[j]!;
          sg[bin] += src[j + 1]!;
          sb[bin] += src[j + 2]!;
        }
      let best = 0;
      for (let b = 1; b < L; b++) if (count[b]! > count[best]!) best = b;
      const i = (y * w + x) * 4;
      const n = count[best]!;
      d[i] = sr[best]! / n;
      d[i + 1] = sg[best]! / n;
      d[i + 2] = sb[best]! / n;
    }
}

function cellFill(img: Img, size: number, seed: number, dots: boolean, bg = "#FFFFFF") {
  const s = Math.max(3, size);
  const { width: w, height: h } = img;
  const c = cells(w, h, s, seed);
  const src = img.data;
  const sums = new Float32Array(c.pts.length * 4);
  const counts = new Uint32Array(c.pts.length);
  const owner = new Int32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = nearestCell(c, s, x, y);
      owner[y * w + x] = k;
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 4; ch++) sums[k * 4 + ch] += src[i + ch]!;
      counts[k]!++;
    }
  const back = hexToRgb(bg);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = owner[y * w + x]!;
      const i = (y * w + x) * 4;
      if (dots) {
        const [px, py] = c.pts[k]!;
        if (Math.hypot(px - x, py - y) > s * 0.45) {
          src[i] = back[0];
          src[i + 1] = back[1];
          src[i + 2] = back[2];
          src[i + 3] = 255;
          continue;
        }
      }
      for (let ch = 0; ch < 4; ch++) src[i + ch] = sums[k * 4 + ch]! / counts[k]!;
    }
}

function renderNoise(img: Img, ctx: FilterContext, difference: boolean) {
  const { width: w, height: h } = img;
  const noise = valueNoise(w, h, Math.max(w, h) / 3, 6, ctx.seed);
  const fg = hexToRgb(ctx.fg);
  const bg = hexToRgb(ctx.bg);
  const d = img.data;
  for (let p = 0, i = 0; i < d.length; p++, i += 4) {
    const t = noise[p]!;
    for (let c = 0; c < 3; c++) {
      const v = bg[c]! + (fg[c]! - bg[c]!) * t;
      d[i + c] = difference ? Math.abs(d[i + c]! - v) : v;
    }
    if (!difference) d[i + 3] = 255;
  }
}

// Re-exported for tools (blur brush) and the Develop dialog.
export { blurChannel, boxBlurChannel, joinChannels, splitChannels, applyAdjustment, clamp };
