/**
 * "Copy style / Paste style" (Ctrl+Alt+C / Ctrl+Alt+V). Same kind of element →
 * the whole look; different kinds → whatever makes sense (colour, border,
 * shadow, transparency). Works on Immer drafts.
 */
import type { Element, Fill, Shadow, Stroke, TextElement } from "@/lib/schema";
import { withTextStyle } from "./text";

export interface CopiedStyle {
  type: Element["type"];
  opacity: number;
  blendMode: Element["blendMode"];
  shadow: Shadow | null;
  fill?: Fill;
  stroke?: Stroke | null;
  /** Everything specific to the source kind (applied only to the same kind). */
  own: Record<string, unknown>;
}

const TEXT_KEYS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "italic",
  "underline",
  "strike",
  "align",
  "lineHeight",
  "letterSpacing",
  "backgroundColor",
  "textTransform",
  "extrude",
] as const;
const SHAPE_KEYS = ["cornerRadius"] as const;
const LINE_KEYS = ["startCap", "endCap", "lineCap"] as const;
const IMAGE_KEYS = ["cornerRadius", "filters"] as const;

const pick = (el: Record<string, unknown>, keys: readonly string[]) =>
  Object.fromEntries(keys.filter((k) => k in el).map((k) => [k, structuredClone(el[k])]));

export function extractStyle(el: Element): CopiedStyle {
  const style: CopiedStyle = {
    type: el.type,
    opacity: el.opacity,
    blendMode: el.blendMode,
    shadow: el.shadow ? { ...el.shadow } : null,
    own: {},
  };
  const record = el as unknown as Record<string, unknown>;
  if (el.type === "text") {
    style.fill = structuredClone(el.fill);
    style.stroke = el.stroke ? { ...el.stroke } : null;
    style.own = pick(record, TEXT_KEYS);
  } else if (el.type === "shape") {
    style.fill = structuredClone(el.fill);
    style.stroke = el.stroke ? { ...el.stroke } : null;
    style.own = pick(record, SHAPE_KEYS);
  } else if (el.type === "line") {
    style.stroke = { ...el.stroke };
    style.own = pick(record, LINE_KEYS);
  } else if (el.type === "image") {
    style.stroke = el.stroke ? { ...el.stroke } : null;
    style.own = pick(record, IMAGE_KEYS);
  }
  return style;
}

/** A colour for kinds that only take one (a gradient gives its first stop). */
function fillColor(fill: Fill | undefined): string | null {
  if (!fill) return null;
  if (fill.type === "solid") return fill.color;
  if (fill.type === "gradient") return fill.gradient.stops[0]?.color ?? null;
  return null;
}

export function applyStyle(el: Element, style: CopiedStyle): void {
  if (el.locked) return;
  el.opacity = style.opacity;
  el.blendMode = style.blendMode;
  el.shadow = style.shadow ? { ...style.shadow } : null;
  const same = el.type === style.type;

  if (el.type === "text") {
    const patch: Partial<TextElement> = same
      ? (structuredClone(style.own) as Partial<TextElement>)
      : {};
    if (style.fill && style.fill.type !== "none") patch.fill = structuredClone(style.fill);
    if (style.stroke !== undefined) patch.stroke = style.stroke ? { ...style.stroke } : null;
    Object.assign(el, withTextStyle(el, patch));
  } else if (el.type === "shape") {
    if (style.fill) el.fill = structuredClone(style.fill);
    if (style.stroke !== undefined) el.stroke = style.stroke ? { ...style.stroke } : null;
    if (same) Object.assign(el, structuredClone(style.own));
  } else if (el.type === "line") {
    const color = style.stroke?.color ?? fillColor(style.fill);
    if (same && style.stroke) el.stroke = { ...style.stroke };
    else if (color) el.stroke = { ...el.stroke, color };
    if (same) Object.assign(el, structuredClone(style.own));
  } else if (el.type === "image") {
    if (style.stroke !== undefined) el.stroke = style.stroke ? { ...style.stroke } : null;
    if (same) Object.assign(el, structuredClone(style.own));
  }
}
