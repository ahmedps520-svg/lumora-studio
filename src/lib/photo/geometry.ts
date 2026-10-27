/**
 * Geometry for skew / distort / perspective (projective maps between a
 * rectangle and any four-cornered shape) and warp (a 4×4 Bézier patch).
 * Pure functions; the canvas drawing lives in `transform.ts`.
 */
import type { Img } from "./pixels";
import type { Pt } from "./types";

/** 3×3 matrix, row by row. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Solves A·x = b (n×n) by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r;
    if (Math.abs(m[p]![c]!) < 1e-12) return null;
    [m[c], m[p]] = [m[p]!, m[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** The projective map sending four source points onto four destination points. */
export function homography(src: Pt[], dst: Pt[]): Mat3 | null {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]!;
    const [u, v] = dst[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  return h ? ([...h, 1] as Mat3) : null;
}

export function applyH(m: Mat3, x: number, y: number): Pt {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

export function invert3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k,
    -(b * i - c * h) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    -(a * f - c * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ];
}

/**
 * The affine map (canvas `transform(a, b, c, d, e, f)` order) sending source
 * triangle s0 s1 s2 onto destination triangle d0 d1 d2.
 */
export function affineFromTriangles(
  s0: Pt,
  s1: Pt,
  s2: Pt,
  d0: Pt,
  d1: Pt,
  d2: Pt,
): [number, number, number, number, number, number] | null {
  const dx1 = s1[0] - s0[0];
  const dy1 = s1[1] - s0[1];
  const dx2 = s2[0] - s0[0];
  const dy2 = s2[1] - s0[1];
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-12) return null;
  const du1 = d1[0] - d0[0];
  const dv1 = d1[1] - d0[1];
  const du2 = d2[0] - d0[0];
  const dv2 = d2[1] - d0[1];
  const a = (du1 * dy2 - du2 * dy1) / det;
  const c = (du2 * dx1 - du1 * dx2) / det;
  const b = (dv1 * dy2 - dv2 * dy1) / det;
  const d = (dv2 * dx1 - dv1 * dx2) / det;
  return [a, b, c, d, d0[0] - a * s0[0] - c * s0[1], d0[1] - b * s0[0] - d * s0[1]];
}

/** Corners of a rectangle: top-left, top-right, bottom-right, bottom-left. */
export const rectQuad = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

export function quadBounds(pts: Pt[]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs));
  const y = Math.floor(Math.min(...ys));
  return { x, y, width: Math.ceil(Math.max(...xs)) - x, height: Math.ceil(Math.max(...ys)) - y };
}

/**
 * Renders `src` mapped onto `quad` (document coordinates) into a picture
 * covering the quad's bounds, sampling each output pixel back through the
 * inverse map (bilinear). Returns the picture and where it goes.
 */
export function perspectiveWarp(src: Img, quad: Pt[]): { img: Img; x: number; y: number } | null {
  const h = homography(rectQuad(0, 0, src.width, src.height), quad);
  const inv = h && invert3(h);
  if (!inv) return null;
  const b = quadBounds(quad);
  const w = Math.max(1, b.width);
  const hh = Math.max(1, b.height);
  const out = new Uint8ClampedArray(w * hh * 4);
  const s = src.data;
  const sw = src.width;
  const sh = src.height;
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const [u, v] = applyH(inv, b.x + x + 0.5, b.y + y + 0.5);
      const fx = u - 0.5;
      const fy = v - 0.5;
      if (fx < -0.5 || fy < -0.5 || fx > sw - 0.5 || fy > sh - 0.5) continue;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const xa = x0 < 0 ? 0 : x0 >= sw ? sw - 1 : x0;
      const xb = x0 + 1 >= sw ? sw - 1 : x0 + 1 < 0 ? 0 : x0 + 1;
      const ya = y0 < 0 ? 0 : y0 >= sh ? sh - 1 : y0;
      const yb = y0 + 1 >= sh ? sh - 1 : y0 + 1 < 0 ? 0 : y0 + 1;
      const i00 = (ya * sw + xa) * 4;
      const i10 = (ya * sw + xb) * 4;
      const i01 = (yb * sw + xa) * 4;
      const i11 = (yb * sw + xb) * 4;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = s[i00 + c]! * (1 - tx) + s[i10 + c]! * tx;
        const bot = s[i01 + c]! * (1 - tx) + s[i11 + c]! * tx;
        out[o + c] = top * (1 - ty) + bot * ty;
      }
    }
  return { img: { width: w, height: hh, data: out }, x: b.x, y: b.y };
}

/** A point inside a four-cornered shape by bilinear blending (u, v in 0–1). */
export function bilinear(q: Pt[], u: number, v: number): Pt {
  const [a, b, c, d] = q as [Pt, Pt, Pt, Pt];
  const top: Pt = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const bot: Pt = [d[0] + (c[0] - d[0]) * u, d[1] + (c[1] - d[1]) * u];
  return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
}

/** 16 warp control points (4 × 4, row by row) spread evenly over a shape. */
export const meshFromQuad = (q: Pt[]): Pt[] =>
  [0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => bilinear(q, c / 3, r / 3)));

const bern = (t: number): [number, number, number, number] => {
  const s = 1 - t;
  return [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];
};

/** A point on the bicubic Bézier patch defined by 16 control points. */
export function bezierPatch(ctrl: Pt[], u: number, v: number): Pt {
  const bu = bern(u);
  const bv = bern(v);
  let x = 0;
  let y = 0;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const k = bv[r]! * bu[c]!;
      const p = ctrl[r * 4 + c]!;
      x += p[0] * k;
      y += p[1] * k;
    }
  return [x, y];
}

/** The corners of an axis-aligned box after a free transform (scale + rotation about its centre). */
export function rotatedBox(cx: number, cy: number, w: number, h: number, angleDeg: number): Pt[] {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return (
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ] as Pt[]
  ).map(([u, v]) => [cx + u * cos - v * sin, cy + u * sin + v * cos] as Pt);
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
