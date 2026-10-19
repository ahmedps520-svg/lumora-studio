import type { Background, Element, Fill, TextElement } from "@/lib/schema";

/** Representative colour of a fill/background (gradient → middle stop). */
export function representativeColor(fill: Fill | Background): string | null {
  if (fill.type === "solid") return fill.color;
  if (fill.type === "gradient") {
    const stops = fill.gradient.stops;
    return stops[Math.floor(stops.length / 2)]?.color ?? stops[0]?.color ?? null;
  }
  if (fill.type === "image") return fill.tint;
  return null;
}

/**
 * The colour visible behind element `index`'s centre: the top-most fairly
 * opaque shape below it that contains the point, else the page background.
 */
export function colorBehind(elements: Element[], index: number, background: Background): string {
  const el = elements[index]!;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  for (let k = index - 1; k >= 0; k--) {
    const below = elements[k]!;
    if (
      below.type === "shape" &&
      below.visible &&
      below.opacity >= 0.6 &&
      cx >= below.x &&
      cx <= below.x + below.width &&
      cy >= below.y &&
      cy <= below.y + below.height
    ) {
      const color = representativeColor(below.fill);
      if (color) return color;
    }
  }
  return representativeColor(background) ?? "#FFFFFF";
}

/** WCAG AA: 4.5:1 for normal text, 3:1 for large text (≥ 24px, or ≥ 18.5px bold). */
export function requiredContrast(el: Pick<TextElement, "fontSize" | "fontWeight">): number {
  const large = el.fontSize >= 24 || (el.fontSize >= 18.5 && el.fontWeight >= 700);
  return large ? 3 : 4.5;
}
