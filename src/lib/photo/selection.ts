/**
 * Selections are 8-bit masks the size of the document (255 = selected,
 * in-between = feathered). All operations return new masks.
 */
import { blurChannel } from "./blur";
import { hexToRgb, type Img } from "./pixels";

export interface Mask {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type CombineMode = "new" | "add" | "subtract" | "intersect";

export const emptyMask = (width: number, height: number): Mask => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height),
});

export const fullMask = (width: number, height: number): Mask => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height).fill(255),
});

export const cloneMask = (m: Mask): Mask => ({ ...m, data: new Uint8ClampedArray(m.data) });

export function isEmpty(m: Mask | null): boolean {
  if (!m) return true;
  for (let i = 0; i < m.data.length; i++) if (m.data[i]! > 0) return false;
  return true;
}

/** Bounding box of selected pixels, or null. */
export function maskBounds(
  m: Mask,
): { x: number; y: number; width: number; height: number } | null {
  let x0 = m.width;
  let y0 = m.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++)
      if (m.data[y * m.width + x]! > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

export function rectMask(w: number, h: number, x: number, y: number, rw: number, rh: number): Mask {
  const m = emptyMask(w, h);
  const xa = Math.max(0, Math.round(Math.min(x, x + rw)));
  const xb = Math.min(w, Math.round(Math.max(x, x + rw)));
  const ya = Math.max(0, Math.round(Math.min(y, y + rh)));
  const yb = Math.min(h, Math.round(Math.max(y, y + rh)));
  for (let yy = ya; yy < yb; yy++) m.data.fill(255, yy * w + xa, yy * w + xb);
  return m;
}

export function ellipseMask(
  w: number,
  h: number,
  x: number,
  y: number,
  rw: number,
  rh: number,
): Mask {
  const m = emptyMask(w, h);
  const cx = x + rw / 2;
  const cy = y + rh / 2;
  const ax = Math.abs(rw / 2);
  const ay = Math.abs(rh / 2);
  if (ax < 0.5 || ay < 0.5) return m;
  const y0 = Math.max(0, Math.floor(cy - ay - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + ay + 1));
  for (let yy = y0; yy <= y1; yy++)
    for (
      let xx = Math.max(0, Math.floor(cx - ax - 1));
      xx <= Math.min(w - 1, Math.ceil(cx + ax + 1));
      xx++
    ) {
      // Anti-aliased edge: distance from the ellipse boundary in pixels.
      const dx = (xx + 0.5 - cx) / ax;
      const dy = (yy + 0.5 - cy) / ay;
      const dist = (1 - Math.sqrt(dx * dx + dy * dy)) * Math.min(ax, ay);
      m.data[yy * w + xx] = Math.max(0, Math.min(255, (dist + 0.5) * 255));
    }
  return m;
}

/** Polygon (lasso) fill with the even-odd rule, 4× vertical supersampling for smooth edges. */
export function polygonMask(w: number, h: number, pts: [number, number][]): Mask {
  const m = emptyMask(w, h);
  if (pts.length < 3) return m;
  const acc = new Float32Array(w * h);
  const sub = 4;
  const ys = pts.map((p) => p[1]);
  const yMin = Math.max(0, Math.floor(Math.min(...ys)));
  const yMax = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  const xs: number[] = [];
  for (let y = yMin; y <= yMax; y++)
    for (let s = 0; s < sub; s++) {
      const sy = y + (s + 0.5) / sub;
      xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > sy !== yj > sy) xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, xs[k]!);
        const xb = Math.min(w, xs[k + 1]!);
        if (xb <= xa) continue;
        const ia = Math.floor(xa);
        const ib = Math.floor(xb);
        if (ia === ib) {
          acc[y * w + ia] += (xb - xa) / sub;
          continue;
        }
        acc[y * w + ia] += (ia + 1 - xa) / sub;
        for (let x = ia + 1; x < ib; x++) acc[y * w + x] += 1 / sub;
        if (ib < w) acc[y * w + ib] += (xb - ib) / sub;
      }
    }
  for (let i = 0; i < acc.length; i++) m.data[i] = Math.min(255, acc[i]! * 255);
  return m;
}

export function combine(base: Mask | null, next: Mask, mode: CombineMode): Mask {
  if (mode === "new" || !base)
    return mode === "subtract" ? emptyMask(next.width, next.height) : next;
  const out = cloneMask(base);
  const a = out.data;
  const b = next.data;
  for (let i = 0; i < a.length; i++) {
    if (mode === "add") a[i] = Math.max(a[i]!, b[i]!);
    else if (mode === "subtract") a[i] = (a[i]! * (255 - b[i]!)) / 255;
    else a[i] = (a[i]! * b[i]!) / 255;
  }
  return out;
}

export function invert(m: Mask): Mask {
  const out = cloneMask(m);
  for (let i = 0; i < out.data.length; i++) out.data[i] = 255 - out.data[i]!;
  return out;
}

export function feather(m: Mask, radius: number): Mask {
  if (radius <= 0) return m;
  const f = Float32Array.from(m.data);
  blurChannel(f, m.width, m.height, radius / 2);
  return { ...m, data: Uint8ClampedArray.from(f) };
}

/** Grows (positive) or shrinks (negative) the selection by `r` pixels (round brush). */
export function expand(m: Mask, r: number): Mask {
  const radius = Math.round(Math.abs(r));
  if (!radius) return m;
  const grow = r > 0;
  const { width: w, height: h } = m;
  const src = m.data;
  const out = new Uint8ClampedArray(src.length);
  const offsets: [number, number][] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = grow ? 0 : 255;
      for (const [dx, dy] of offsets) {
        const xx = x + dx;
        const yy = y + dy;
        const s = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : src[yy * w + xx]!;
        v = grow ? Math.max(v, s) : Math.min(v, s);
        if (grow ? v === 255 : v === 0) break;
      }
      out[y * w + x] = v;
    }
  return { ...m, data: out };
}

/** A band `width` pixels wide along the selection edge. */
export function border(m: Mask, width: number): Mask {
  const half = Math.max(1, width / 2);
  const outer = expand(m, half);
  const inner = expand(m, -half);
  return combine(outer, inner, "subtract");
}

/** Rounds off corners and removes specks. */
export function smooth(m: Mask, radius: number): Mask {
  const blurred = feather(m, radius * 2);
  const out = cloneMask(blurred);
  for (let i = 0; i < out.data.length; i++) out.data[i] = out.data[i]! >= 128 ? 255 : 0;
  return out;
}

const colorDistance = (
  d: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
  a: number,
) =>
  Math.max(
    Math.abs(d[i]! - r),
    Math.abs(d[i + 1]! - g),
    Math.abs(d[i + 2]! - b),
    Math.abs(d[i + 3]! - a),
  );

/** Magic wand: pixels within `tolerance` of the clicked colour (flood fill when contiguous). */
export function magicWand(
  img: Img,
  x: number,
  y: number,
  tolerance: number,
  contiguous: boolean,
): Mask {
  const { width: w, height: h, data: d } = img;
  const m = emptyMask(w, h);
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return m;
  const i0 = (y * w + x) * 4;
  const [r, g, b, a] = [d[i0]!, d[i0 + 1]!, d[i0 + 2]!, d[i0 + 3]!];
  const near = (p: number) => colorDistance(d, p * 4, r, g, b, a) <= tolerance;
  if (!contiguous) {
    for (let p = 0; p < w * h; p++) if (near(p)) m.data[p] = 255;
    return m;
  }
  const stack = [y * w + x];
  m.data[y * w + x] = 255;
  while (stack.length) {
    const p = stack.pop()!;
    const px = p % w;
    const py = (p / w) | 0;
    const around = [
      px > 0 ? p - 1 : -1,
      px < w - 1 ? p + 1 : -1,
      py > 0 ? p - w : -1,
      py < h - 1 ? p + w : -1,
    ];
    for (const q of around)
      if (q >= 0 && !m.data[q] && near(q)) {
        m.data[q] = 255;
        stack.push(q);
      }
  }
  return m;
}

/** Color Range: every pixel near a colour, softly by `fuzziness`. */
export function colorRange(img: Img, color: string, fuzziness: number): Mask {
  const [r, g, b] = hexToRgb(color);
  const m = emptyMask(img.width, img.height);
  const d = img.data;
  const f = Math.max(1, fuzziness);
  for (let p = 0, i = 0; p < m.data.length; p++, i += 4) {
    const dist = Math.hypot(d[i]! - r, d[i + 1]! - g, d[i + 2]! - b);
    m.data[p] = Math.max(0, Math.min(255, (1 - dist / (f * 2)) * 255 * 1.5));
  }
  return m;
}

/** Select → Grow / Similar: adds pixels close to the colours already selected. */
export function growSimilar(img: Img, m: Mask, tolerance: number, contiguous: boolean): Mask {
  const { width: w, height: h, data: d } = img;
  // The average selected colour stands in for "the selected colours".
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let p = 0; p < m.data.length; p++)
    if (m.data[p]! >= 128) {
      r += d[p * 4]!;
      g += d[p * 4 + 1]!;
      b += d[p * 4 + 2]!;
      n++;
    }
  if (!n) return m;
  r /= n;
  g /= n;
  b /= n;
  const near = (p: number) =>
    Math.max(Math.abs(d[p * 4]! - r), Math.abs(d[p * 4 + 1]! - g), Math.abs(d[p * 4 + 2]! - b)) <=
    tolerance;
  const out = cloneMask(m);
  if (!contiguous) {
    for (let p = 0; p < out.data.length; p++) if (near(p)) out.data[p] = 255;
    return out;
  }
  const stack: number[] = [];
  for (let p = 0; p < out.data.length; p++) if (out.data[p]! >= 128) stack.push(p);
  while (stack.length) {
    const p = stack.pop()!;
    const px = p % w;
    const py = (p / w) | 0;
    for (const q of [
      px > 0 ? p - 1 : -1,
      px < w - 1 ? p + 1 : -1,
      py > 0 ? p - w : -1,
      py < h - 1 ? p + w : -1,
    ])
      if (q >= 0 && out.data[q]! < 128 && near(q)) {
        out.data[q] = 255;
        stack.push(q);
      }
  }
  return out;
}

/** Moves a mask by (dx, dy) pixels. */
export function translate(m: Mask, dx: number, dy: number): Mask {
  const out = emptyMask(m.width, m.height);
  const ix = Math.round(dx);
  const iy = Math.round(dy);
  for (let y = 0; y < m.height; y++) {
    const sy = y - iy;
    if (sy < 0 || sy >= m.height) continue;
    for (let x = 0; x < m.width; x++) {
      const sx = x - ix;
      if (sx < 0 || sx >= m.width) continue;
      out.data[y * m.width + x] = m.data[sy * m.width + sx]!;
    }
  }
  return out;
}

/**
 * The selection's outline as line segments between selected and unselected
 * pixels (for the "marching ants"), merged into runs.
 */
export function outline(m: Mask, threshold = 128): number[] {
  const { width: w, height: h, data } = m;
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && data[y * w + x]! >= threshold;
  const segs: number[] = [];
  // Horizontal edges.
  for (let y = 0; y <= h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const edge = x < w && on(x, y - 1) !== on(x, y);
      if (edge && start < 0) start = x;
      if (!edge && start >= 0) {
        segs.push(start, y, x, y);
        start = -1;
      }
    }
  }
  // Vertical edges.
  for (let x = 0; x <= w; x++) {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      const edge = y < h && on(x - 1, y) !== on(x, y);
      if (edge && start < 0) start = y;
      if (!edge && start >= 0) {
        segs.push(x, start, x, y);
        start = -1;
      }
    }
  }
  return segs;
}

/**
 * The selection's outline as closed rings of corner points (pixel edges
 * chained end to end), for turning a selection into a path.
 */
export function outlineRings(m: Mask, threshold = 128): [number, number][][] {
  const segs = outline(m, threshold);
  const n = segs.length / 4;
  const at = new Map<string, number[]>();
  const key = (x: number, y: number) => `${x},${y}`;
  for (let i = 0; i < n; i++) {
    for (const [x, y] of [
      [segs[i * 4]!, segs[i * 4 + 1]!],
      [segs[i * 4 + 2]!, segs[i * 4 + 3]!],
    ] as const) {
      const k = key(x, y);
      const list = at.get(k);
      if (list) list.push(i);
      else at.set(k, [i]);
    }
  }
  const used = new Uint8Array(n);
  const rings: [number, number][][] = [];
  for (let s = 0; s < n; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const ring: [number, number][] = [[segs[s * 4]!, segs[s * 4 + 1]!]];
    let cx = segs[s * 4 + 2]!;
    let cy = segs[s * 4 + 3]!;
    const sx = ring[0]![0];
    const sy = ring[0]![1];
    for (let guard = 0; guard < n + 1 && !(cx === sx && cy === sy); guard++) {
      ring.push([cx, cy]);
      const next = (at.get(key(cx, cy)) ?? []).find((i) => !used[i]);
      if (next === undefined) break;
      used[next] = 1;
      const ax = segs[next * 4]!;
      const ay = segs[next * 4 + 1]!;
      [cx, cy] = ax === cx && ay === cy ? [segs[next * 4 + 2]!, segs[next * 4 + 3]!] : [ax, ay];
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}
