/**
 * SVG path outlines for shapes Fabric doesn't draw natively.
 * Paths are generated in a 100×100 box; the engine scales them to the element's
 * width/height, so resizing never needs a new path.
 */
import type { ShapeElement } from "@/lib/schema";

export const UNIT_BOX = 100;

type Pt = [number, number];

const fmt = (n: number) => Number(n.toFixed(3));

/** Stretches points so their bounding box fills 0…100 on both axes. */
function fitToBox(points: Pt[]): Pt[] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1;
  const h = Math.max(...ys) - minY || 1;
  return points.map(([x, y]) => [((x - minX) / w) * UNIT_BOX, ((y - minY) / h) * UNIT_BOX]);
}

function pointsToPath(points: Pt[]): string {
  return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`).join(" ")} Z`;
}

export function polygonPoints(sides: number): Pt[] {
  const n = Math.max(3, Math.round(sides));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push([50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)]);
  }
  return fitToBox(pts);
}

export function starPoints(points: number, innerRadius: number): Pt[] {
  const n = Math.max(3, Math.round(points));
  const inner = Math.min(1, Math.max(0.05, innerRadius));
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 50 : 50 * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
  }
  return fitToBox(pts);
}

const STATIC_PATHS: Partial<Record<ShapeElement["kind"], string>> = {
  arrow: "M0 30 L60 30 L60 5 L100 50 L60 95 L60 70 L0 70 Z",
  diamond: "M50 0 L100 50 L50 100 L0 50 Z",
  heart:
    "M50 100 C22 78 0 60 0 34 C0 15 14 0 32 0 C41 0 47 5 50 12 C53 5 59 0 68 0 C86 0 100 15 100 34 C100 60 78 78 50 100 Z",
  speechBubble:
    "M10 0 L90 0 Q100 0 100 10 L100 64 Q100 74 90 74 L42 74 L20 100 L26 74 L10 74 Q0 74 0 64 L0 10 Q0 0 10 0 Z",
  blob: "M54 0 C78 0 100 16 100 42 C100 66 86 92 60 99 C36 106 8 92 2 66 C-4 42 8 16 28 6 C36 2 45 0 54 0 Z",
};

/**
 * Returns the outline for a path-based shape, or null for shapes Fabric draws
 * natively (rect, ellipse, triangle).
 */
export function shapePath(
  shape: Pick<ShapeElement, "kind" | "sides" | "innerRadius" | "pathData">,
): string | null {
  switch (shape.kind) {
    case "rect":
    case "ellipse":
    case "triangle":
      return null;
    case "polygon":
      return pointsToPath(polygonPoints(shape.sides));
    case "star":
      return pointsToPath(starPoints(shape.sides, shape.innerRadius));
    case "path":
      return shape.pathData ?? "M0 0 L100 0 L100 100 L0 100 Z";
    default:
      return STATIC_PATHS[shape.kind] ?? null;
  }
}
