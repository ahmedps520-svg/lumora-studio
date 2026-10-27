/**
 * Pen-tool paths: anchors with Bézier handles, grouped into sub-paths.
 * Pure helpers — drawing, hit testing and turning freehand strokes into paths.
 */
import type { PathPoint, PhotoPath, Pt, SubPath } from "./types";

const fmt = (n: number) => Math.round(n * 100) / 100;

/** SVG path data for a path (usable with `new Path2D(d)`). */
export function pathD(path: Pick<PhotoPath, "subpaths">): string {
  const parts: string[] = [];
  for (const sp of path.subpaths) {
    const pts = sp.points;
    if (!pts.length) continue;
    parts.push(`M${fmt(pts[0]!.x)} ${fmt(pts[0]!.y)}`);
    const seg = (a: PathPoint, b: PathPoint) => {
      if (!a.out && !b.in) parts.push(`L${fmt(b.x)} ${fmt(b.y)}`);
      else {
        const c1 = a.out ?? [a.x, a.y];
        const c2 = b.in ?? [b.x, b.y];
        parts.push(
          `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(b.x)} ${fmt(b.y)}`,
        );
      }
    };
    for (let i = 1; i < pts.length; i++) seg(pts[i - 1]!, pts[i]!);
    if (sp.closed && pts.length > 1) {
      seg(pts[pts.length - 1]!, pts[0]!);
      parts.push("Z");
    }
  }
  return parts.join(" ");
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const s = 1 - t;
  const a = s * s * s;
  const b = 3 * s * s * t;
  const c = 3 * s * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** Points along a sub-path (curves sampled), for hit testing and bounds. */
export function samplePoints(sp: SubPath, steps = 16): Pt[] {
  const pts = sp.points;
  const out: Pt[] = [];
  if (!pts.length) return out;
  out.push([pts[0]!.x, pts[0]!.y]);
  const seg = (a: PathPoint, b: PathPoint) => {
    if (!a.out && !b.in) {
      out.push([b.x, b.y]);
      return;
    }
    const p0: Pt = [a.x, a.y];
    const p3: Pt = [b.x, b.y];
    const p1 = a.out ?? p0;
    const p2 = b.in ?? p3;
    for (let i = 1; i <= steps; i++) out.push(cubic(p0, p1, p2, p3, i / steps));
  };
  for (let i = 1; i < pts.length; i++) seg(pts[i - 1]!, pts[i]!);
  if (sp.closed && pts.length > 1) seg(pts[pts.length - 1]!, pts[0]!);
  return out;
}

export function pathBounds(path: Pick<PhotoPath, "subpaths">) {
  const pts = path.subpaths.flatMap((sp) => samplePoints(sp));
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export type PathPart = "anchor" | "in" | "out";
export interface PathHit {
  sub: number;
  index: number;
  part: PathPart;
}

/** The anchor or handle under a point (handles first, they sit on top). */
export function hitPath(path: PhotoPath, x: number, y: number, tolerance: number): PathHit | null {
  let best: PathHit | null = null;
  let bestD = tolerance;
  path.subpaths.forEach((sp, sub) =>
    sp.points.forEach((p, index) => {
      const tries: [PathPart, Pt | null][] = [
        ["in", p.in],
        ["out", p.out],
        ["anchor", [p.x, p.y]],
      ];
      for (const [part, at] of tries) {
        if (!at) continue;
        const d = Math.hypot(at[0] - x, at[1] - y);
        if (d <= bestD) {
          bestD = d;
          best = { sub, index, part };
        }
      }
    }),
  );
  return best;
}

/** Distance from a point to the nearest part of the path outline. */
export function distanceToPath(path: PhotoPath, x: number, y: number): number {
  let best = Infinity;
  for (const sp of path.subpaths) {
    const pts = samplePoints(sp);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
    }
  }
  return best;
}

/** Ramer–Douglas–Peucker: fewer points along a freehand line. */
export function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a]!;
    const [bx, by] = points[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let far = -1;
    let farD = tolerance;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]!;
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Smooth anchors through the given points (Catmull-Rom handles). */
export function smoothSubPath(points: Pt[], closed: boolean): SubPath {
  const n = points.length;
  const at = (i: number) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  return {
    closed,
    points: points.map(([x, y], i) => {
      const prev = at(i - 1);
      const next = at(i + 1);
      const tx = (next[0] - prev[0]) / 6;
      const ty = (next[1] - prev[1]) / 6;
      const end = !closed && (i === 0 || i === n - 1);
      return {
        x,
        y,
        in: end && i === 0 ? null : [x - tx, y - ty],
        out: end && i === n - 1 ? null : [x + tx, y + ty],
      };
    }),
  };
}

/** Moves an anchor (with its handles) or one handle; a smooth point's other handle mirrors. */
export function movePathPart(
  sp: SubPath,
  index: number,
  part: PathPart,
  x: number,
  y: number,
  mirror = true,
): SubPath {
  const points = sp.points.map((p) => ({ ...p }));
  const p = points[index]!;
  if (part === "anchor") {
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    if (p.in) p.in = [p.in[0] + dx, p.in[1] + dy];
    if (p.out) p.out = [p.out[0] + dx, p.out[1] + dy];
  } else {
    p[part] = [x, y];
    const other = part === "in" ? "out" : "in";
    if (mirror && p[other]) p[other] = [2 * p.x - x, 2 * p.y - y];
  }
  return { ...sp, points };
}
