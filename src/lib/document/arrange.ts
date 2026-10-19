/**
 * Align & distribute (axis-aligned boxes; rotation is ignored, like most editors
 * do for simple alignment). Pure functions that mutate elements in place.
 */
import type { Element } from "@/lib/schema";

export type Alignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function boundsOf(elements: Pick<Element, "x" | "y" | "width" | "height">[]): Bounds {
  const minX = Math.min(...elements.map((e) => e.x));
  const minY = Math.min(...elements.map((e) => e.y));
  const maxX = Math.max(...elements.map((e) => e.x + e.width));
  const maxY = Math.max(...elements.map((e) => e.y + e.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Aligns elements to the page, or to their combined bounds when `target` is
 * "selection" (a single element always aligns to the page).
 */
export function alignElements(
  elements: Element[],
  alignment: Alignment,
  page: { width: number; height: number },
  target: "page" | "selection" = "page",
) {
  if (elements.length === 0) return;
  const frame =
    target === "selection" && elements.length > 1
      ? boundsOf(elements)
      : { x: 0, y: 0, width: page.width, height: page.height };
  for (const el of elements) {
    if (el.locked) continue;
    if (alignment === "left") el.x = frame.x;
    if (alignment === "center") el.x = frame.x + (frame.width - el.width) / 2;
    if (alignment === "right") el.x = frame.x + frame.width - el.width;
    if (alignment === "top") el.y = frame.y;
    if (alignment === "middle") el.y = frame.y + (frame.height - el.height) / 2;
    if (alignment === "bottom") el.y = frame.y + frame.height - el.height;
    el.x = Math.round(el.x * 100) / 100;
    el.y = Math.round(el.y * 100) / 100;
  }
}

/** Spaces 3+ elements evenly between the first and last along an axis. */
export function distributeElements(elements: Element[], direction: "horizontal" | "vertical") {
  const movable = elements.filter((e) => !e.locked);
  if (movable.length < 3) return;
  const horizontal = direction === "horizontal";
  const sorted = [...movable].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const first = sorted[0]!;
  const last = sorted.at(-1)!;
  const start = horizontal ? first.x : first.y;
  const end = horizontal ? last.x + last.width : last.y + last.height;
  const total = sorted.reduce((sum, e) => sum + (horizontal ? e.width : e.height), 0);
  const gap = (end - start - total) / (sorted.length - 1);
  let cursor = start;
  for (const el of sorted) {
    if (horizontal) el.x = Math.round(cursor * 100) / 100;
    else el.y = Math.round(cursor * 100) / 100;
    cursor += (horizontal ? el.width : el.height) + gap;
  }
}
