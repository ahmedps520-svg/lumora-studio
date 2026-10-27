"use client";
/**
 * Draws a layer through a transform: free (scale + rotate), skew / distort /
 * perspective (a projective map onto four corners) or warp (a Bézier patch).
 * Previews use a triangle mesh (fast); the final result of a projective map
 * is sampled pixel by pixel.
 */
import {
  affineFromTriangles,
  applyH,
  bezierPatch,
  homography,
  meshFromQuad,
  perspectiveWarp,
  quadBounds,
  rectQuad,
  rotatedBox,
} from "./geometry";
import { copyCanvas, createCanvas, ctx2d, readImg, writeImg } from "./runtime";
import type { TransformMode, TransformState } from "./store";
import type { Pt } from "./types";

/** The free transform's box corners (document coordinates). */
export function freeQuad(t: TransformState): Pt[] {
  const src = t.original.canvas;
  const w = src.width * Math.abs(t.scaleX);
  const h = src.height * Math.abs(t.scaleY);
  const corners = rotatedBox(t.x + w / 2, t.y + h / 2, w, h, t.rotation);
  // Flipped axes swap the corners so the picture lands mirrored.
  const [tl, tr, br, bl] = corners as [Pt, Pt, Pt, Pt];
  if (t.scaleX < 0 && t.scaleY < 0) return [br, bl, tl, tr];
  if (t.scaleX < 0) return [tr, tl, bl, br];
  if (t.scaleY < 0) return [bl, br, tr, tl];
  return corners;
}

/** Draws one source triangle onto a destination triangle (affine), slightly enlarged to hide seams. */
function drawTriangle(g: CanvasRenderingContext2D, img: HTMLCanvasElement, s: Pt[], d: Pt[]) {
  const [s0, s1, s2] = s as [Pt, Pt, Pt];
  const [d0, d1, d2] = d as [Pt, Pt, Pt];
  const m = affineFromTriangles(s0, s1, s2, d0, d1, d2);
  if (!m) return;
  // Grow the clip triangle by ~0.6 px around its centre.
  const cx = (d0[0] + d1[0] + d2[0]) / 3;
  const cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p: Pt): Pt => {
    const vx = p[0] - cx;
    const vy = p[1] - cy;
    const len = Math.hypot(vx, vy) || 1;
    return [p[0] + (vx / len) * 0.6, p[1] + (vy / len) * 0.6];
  };
  const [a, b, c] = [grow(d0), grow(d1), grow(d2)];
  g.save();
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.lineTo(c[0], c[1]);
  g.closePath();
  g.clip();
  g.transform(...m);
  g.drawImage(img, 0, 0);
  g.restore();
}

/** Draws `src` through a mapping (u, v in 0–1 → document point) as an n × n mesh. */
function meshRender(src: HTMLCanvasElement, map: (u: number, v: number) => Pt, n: number) {
  const grid: Pt[][] = [];
  for (let r = 0; r <= n; r++) {
    const row: Pt[] = [];
    for (let c = 0; c <= n; c++) row.push(map(c / n, r / n));
    grid.push(row);
  }
  const b = quadBounds(grid.flat());
  const out = createCanvas(Math.max(1, b.width + 2), Math.max(1, b.height + 2));
  const g = ctx2d(out);
  g.imageSmoothingQuality = "high";
  const W = src.width;
  const H = src.height;
  const off = (p: Pt): Pt => [p[0] - b.x + 1, p[1] - b.y + 1];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const s00: Pt = [(c / n) * W, (r / n) * H];
      const s10: Pt = [((c + 1) / n) * W, (r / n) * H];
      const s01: Pt = [(c / n) * W, ((r + 1) / n) * H];
      const s11: Pt = [((c + 1) / n) * W, ((r + 1) / n) * H];
      const d00 = off(grid[r]![c]!);
      const d10 = off(grid[r]![c + 1]!);
      const d01 = off(grid[r + 1]![c]!);
      const d11 = off(grid[r + 1]![c + 1]!);
      drawTriangle(g, src, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(g, src, [s00, s11, s01], [d00, d11, d01]);
    }
  return { canvas: out, x: b.x - 1, y: b.y - 1 };
}

/** The transformed picture and where its top-left goes. */
export function renderTransform(t: TransformState, final: boolean) {
  const src = t.original.canvas;
  if (t.mode === "free") return renderFree(t);
  if (t.mode === "warp" && t.mesh) {
    const mesh = t.mesh;
    return meshRender(src, (u, v) => bezierPatch(mesh, u, v), final ? 40 : 14);
  }
  const quad = t.quad ?? freeQuad(t);
  if (final) {
    const warped = perspectiveWarp(readImg(src), quad);
    if (warped) {
      const c = createCanvas(warped.img.width, warped.img.height);
      writeImg(c, warped.img);
      return { canvas: c, x: warped.x, y: warped.y };
    }
  }
  const h = homography(rectQuad(0, 0, 1, 1), quad);
  if (!h) return { canvas: copyCanvas(src), x: t.original.x, y: t.original.y };
  return meshRender(src, (u, v) => applyH(h, u, v), final ? 32 : 12);
}

function renderFree(t: TransformState) {
  const src = t.original.canvas;
  const w = src.width * Math.abs(t.scaleX);
  const h = src.height * Math.abs(t.scaleY);
  const a = (t.rotation * Math.PI) / 180;
  const bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const out = createCanvas(Math.max(1, Math.ceil(bw)), Math.max(1, Math.ceil(bh)));
  const g = ctx2d(out);
  g.imageSmoothingQuality = "high";
  g.translate(out.width / 2, out.height / 2);
  g.rotate(a);
  g.scale(t.scaleX, t.scaleY);
  g.drawImage(src, -src.width / 2, -src.height / 2);
  const cx = t.x + w / 2;
  const cy = t.y + h / 2;
  return { canvas: out, x: Math.round(cx - out.width / 2), y: Math.round(cy - out.height / 2) };
}

/** Switches the transform to another mode, keeping the current shape. */
export function convertTransform(t: TransformState, mode: TransformMode): TransformState {
  if (mode === t.mode) return t;
  const quad = t.mode === "free" ? freeQuad(t) : (t.quad ?? freeQuad(t));
  if (mode === "warp") return { ...t, mode, quad, mesh: t.mesh ?? meshFromQuad(quad) };
  return { ...t, mode, quad, mesh: null };
}

/** True when nothing would change if the transform were applied. */
export function isIdentity(t: TransformState): boolean {
  const o = t.original;
  const rect = rectQuad(o.x, o.y, o.canvas.width, o.canvas.height);
  const same = (a: Pt[], b: Pt[]) =>
    a.every((p, i) => Math.hypot(p[0] - b[i]![0], p[1] - b[i]![1]) < 0.01);
  if (t.mode === "free")
    return t.x === o.x && t.y === o.y && t.scaleX === 1 && t.scaleY === 1 && t.rotation === 0;
  if (t.mode === "warp") return Boolean(t.mesh && same(t.mesh, meshFromQuad(rect)));
  return Boolean(t.quad && same(t.quad, rect));
}
