/**
 * A compact, token-cheap description of a page for the Design Assistant.
 * Only what Claude needs to reason about layout — no image data, short text.
 */
import type { Element, Format, Page } from "@/lib/schema";

const r = (n: number) => Math.round(n);

function colorOf(el: Element): string | undefined {
  if (el.type === "shape" || el.type === "text") {
    if (el.fill.type === "solid") return el.fill.color;
    if (el.fill.type === "gradient") return el.fill.gradient.stops.map((s) => s.color).join("→");
  }
  if (el.type === "line") return el.stroke.color;
  return undefined;
}

/** `offset` turns group-relative coordinates into page coordinates. */
export function summarizeElement(el: Element, selected: boolean, offset = { x: 0, y: 0 }) {
  const base: Record<string, unknown> = {
    id: el.id,
    type: el.type === "shape" ? el.kind : el.type,
    x: r(el.x + offset.x),
    y: r(el.y + offset.y),
    w: r(el.width),
    h: r(el.height),
  };
  if (el.rotation) base.rot = r(el.rotation);
  if (el.opacity < 1) base.opacity = Math.round(el.opacity * 100) / 100;
  const color = colorOf(el);
  if (color) base.color = color;
  if (el.type === "text") {
    const text = el.runs.map((run) => run.text).join("");
    base.text = text.length > 160 ? `${text.slice(0, 160)}…` : text;
    base.font = `${el.fontFamily} ${el.fontWeight} ${r(el.fontSize)}px`;
    base.align = el.align;
    if (el.role !== "other") base.role = el.role;
  }
  if (el.name) base.name = el.name;
  if (el.locked) base.locked = true;
  if (!el.visible) base.hidden = true;
  if (selected) base.selected = true;
  if (el.type === "group") {
    const inner = { x: offset.x + el.x, y: offset.y + el.y };
    base.children = el.children.slice(-40).map((c) => summarizeElement(c, false, inner));
  }
  return base;
}

export function summarizePage(page: Page, format: Format, selection: string[]): string {
  const bg = page.background;
  const background =
    bg.type === "solid"
      ? bg.color
      : bg.type === "gradient"
        ? `gradient ${bg.gradient.angle}° ${bg.gradient.stops.map((s) => s.color).join("→")}`
        : "image";
  return JSON.stringify({
    page: { width: format.width, height: format.height, background },
    elements: page.elements
      .slice(-150)
      .map((el) => summarizeElement(el, selection.includes(el.id))),
  });
}
