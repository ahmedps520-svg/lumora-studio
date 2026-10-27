/**
 * Filling holes from their surroundings (spot healing, content-aware fill)
 * and colour-matched cloning (healing brush). Local and free — no AI service.
 */
import { blurChannel } from "./blur";
import type { Img } from "./pixels";
import { rng } from "./pixels";

/**
 * Smooth fill: each hole pixel becomes a blend of the nearest known pixels
 * (multi-resolution "push-pull"). Good for small spots and as a base layer.
 */
export function smoothFill(img: Img, hole: Uint8Array) {
  const { width: w, height: h } = img;
  type Level = { w: number; h: number; c: Float32Array; a: Float32Array };
  const levels: Level[] = [];
  let cur: Level = { w, h, c: new Float32Array(w * h * 3), a: new Float32Array(w * h) };
  for (let p = 0; p < w * h; p++) {
    if (hole[p]) continue;
    cur.a[p] = 1;
    for (let c = 0; c < 3; c++) cur.c[p * 3 + c] = img.data[p * 4 + c]!;
  }
  levels.push(cur);
  // Push: halve until tiny, averaging known pixels.
  while (cur.w > 1 || cur.h > 1) {
    const nw = Math.max(1, Math.ceil(cur.w / 2));
    const nh = Math.max(1, Math.ceil(cur.h / 2));
    const next: Level = {
      w: nw,
      h: nh,
      c: new Float32Array(nw * nh * 3),
      a: new Float32Array(nw * nh),
    };
    for (let y = 0; y < cur.h; y++)
      for (let x = 0; x < cur.w; x++) {
        const p = y * cur.w + x;
        const q = (y >> 1) * nw + (x >> 1);
        const a = cur.a[p]!;
        next.a[q] += a;
        for (let c = 0; c < 3; c++) next.c[q * 3 + c] += cur.c[p * 3 + c]! * a;
      }
    for (let q = 0; q < nw * nh; q++) {
      const a = next.a[q]!;
      if (a > 0) for (let c = 0; c < 3; c++) next.c[q * 3 + c] = next.c[q * 3 + c]! / a;
      next.a[q] = Math.min(1, a);
    }
    levels.push(next);
    cur = next;
  }
  // Pull: fill unknowns from the coarser level, finest last.
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l]!;
    const coarse = levels[l + 1]!;
    for (let y = 0; y < fine.h; y++)
      for (let x = 0; x < fine.w; x++) {
        const p = y * fine.w + x;
        const a = fine.a[p]!;
        if (a >= 1) continue;
        const q = Math.min(coarse.h - 1, y >> 1) * coarse.w + Math.min(coarse.w - 1, x >> 1);
        for (let c = 0; c < 3; c++)
          fine.c[p * 3 + c] = fine.c[p * 3 + c]! * a + coarse.c[q * 3 + c]! * (1 - a);
        fine.a[p] = 1;
      }
  }
  const top = levels[0]!;
  for (let p = 0; p < w * h; p++) {
    if (!hole[p]) continue;
    for (let c = 0; c < 3; c++) img.data[p * 4 + c] = top.c[p * 3 + c]!;
    img.data[p * 4 + 3] = 255;
  }
}

/**
 * Texture-aware fill: hole pixels are filled from the outside in, each copied
 * from the best-matching patch nearby (with coherence, so texture continues).
 * Large holes are filled at a lower resolution first, then refined.
 */
export function contentAwareFill(img: Img, hole: Uint8Array, seed = 1) {
  smoothFill(img, hole);
  const { width: w, height: h } = img;
  let holeCount = 0;
  for (let p = 0; p < hole.length; p++) if (hole[p]) holeCount++;
  if (!holeCount) return;
  const rand = rng(seed);
  const R = 3; // 7×7 patches
  const known = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) known[p] = hole[p] ? 0 : 1;
  // Onion-peel order: distance from the hole's edge.
  const order: number[] = [];
  const dist = new Int32Array(w * h).fill(-1);
  let frontier: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!hole[p]) continue;
    const x = p % w;
    const y = (p / w) | 0;
    if (
      (x > 0 && !hole[p - 1]) ||
      (x < w - 1 && !hole[p + 1]) ||
      (y > 0 && !hole[p - w]) ||
      (y < h - 1 && !hole[p + w])
    ) {
      dist[p] = 0;
      frontier.push(p);
    }
  }
  while (frontier.length) {
    order.push(...frontier);
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % w;
      const y = (p / w) | 0;
      for (const q of [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ])
        if (q >= 0 && hole[q] && dist[q] < 0) {
          dist[q] = dist[p]! + 1;
          next.push(q);
        }
    }
    frontier = next;
  }
  // Source offsets chosen for each filled pixel (for coherence).
  const offX = new Int32Array(w * h);
  const offY = new Int32Array(w * h);
  const chosen = new Uint8Array(w * h);
  const search = Math.max(24, Math.min(160, Math.sqrt(holeCount) * 3));
  const d = img.data;
  const ssd = (px: number, py: number, sx: number, sy: number, best: number) => {
    let sum = 0;
    let n = 0;
    for (let dy = -R; dy <= R; dy++) {
      const ty = py + dy;
      const ry = sy + dy;
      if (ty < 0 || ty >= h || ry < 0 || ry >= h) continue;
      for (let dx = -R; dx <= R; dx++) {
        const tx = px + dx;
        const rx = sx + dx;
        if (tx < 0 || tx >= w || rx < 0 || rx >= w) continue;
        const t = ty * w + tx;
        const r = ry * w + rx;
        if (!known[t] || !known[r] || hole[r]) continue;
        const a = t * 4;
        const b = r * 4;
        const e0 = d[a]! - d[b]!;
        const e1 = d[a + 1]! - d[b + 1]!;
        const e2 = d[a + 2]! - d[b + 2]!;
        sum += e0 * e0 + e1 * e1 + e2 * e2;
        n++;
        if (n > 8 && sum / n > best) return Infinity;
      }
    }
    return n ? sum / n : Infinity;
  };
  for (const p of order) {
    const px = p % w;
    const py = (p / w) | 0;
    let bestScore = Infinity;
    let bx = -1;
    let by = -1;
    const tryAt = (sx: number, sy: number) => {
      sx = Math.round(sx);
      sy = Math.round(sy);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
      const s = sy * w + sx;
      if (hole[s]) return;
      const score = ssd(px, py, sx, sy, bestScore);
      if (score < bestScore) {
        bestScore = score;
        bx = sx;
        by = sy;
      }
    };
    // Coherence: continue the offsets of already-filled neighbours.
    for (const q of [p - 1, p + 1, p - w, p + w])
      if (q >= 0 && q < w * h && chosen[q]) tryAt(px + offX[q]!, py + offY[q]!);
    for (let k = 0; k < 40; k++) {
      const a = rand() * Math.PI * 2;
      const r = dist[p]! + 2 + rand() * search;
      tryAt(px + Math.cos(a) * r, py + Math.sin(a) * r);
    }
    if (bx < 0) continue;
    const s = (by * w + bx) * 4;
    d[p * 4] = d[s]!;
    d[p * 4 + 1] = d[s + 1]!;
    d[p * 4 + 2] = d[s + 2]!;
    d[p * 4 + 3] = 255;
    known[p] = 1;
    chosen[p] = 1;
    offX[p] = bx - px;
    offY[p] = by - py;
  }
}

/**
 * Healing: `src` pixels pasted into `dst` keep their texture but take on the
 * destination's colour and brightness (low frequencies swapped).
 */
export function healBlend(dst: Img, src: Img, radius = 6) {
  const { width: w, height: h } = dst;
  for (let c = 0; c < 3; c++) {
    const a = new Float32Array(w * h);
    const b = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) {
      a[p] = dst.data[p * 4 + c]!;
      b[p] = src.data[p * 4 + c]!;
    }
    blurChannel(a, w, h, radius);
    blurChannel(b, w, h, radius);
    for (let p = 0; p < w * h; p++) src.data[p * 4 + c] = src.data[p * 4 + c]! - b[p]! + a[p]!;
  }
}

/** Red-eye fix: pulls strongly red pixels down to the darker of green/blue. */
export function redEye(img: Img, mask: Uint8Array, darken = 0.5) {
  const d = img.data;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const i = p * 4;
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    if (r > 1.4 * ((g + b) / 2) && r > 60) {
      const v = Math.min(g, b) * (1 - darken * 0.5);
      d[i] = v;
      d[i + 1] = g * (1 - darken * 0.3);
      d[i + 2] = b * (1 - darken * 0.3);
    }
  }
}
