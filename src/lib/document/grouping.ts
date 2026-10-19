/**
 * Group / ungroup. Group children are stored relative to the group's top-left
 * corner (see schema.ts). Works on Immer drafts.
 */
import { current, isDraft, type Draft } from "immer";
import { createId } from "@/lib/id";
import { ElementSchema, type Element, type GroupElement, type Page } from "@/lib/schema";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const snapshot = <T>(value: T): T =>
  structuredClone(isDraft(value) ? (current(value as Draft<T>) as T) : value);
const round = (n: number) => Math.round(n * 100) / 100;
const normalizeAngle = (deg: number) => round(((deg % 360) + 360) % 360);

/** Axis-aligned bounding box of an element, taking its rotation into account. */
export function rotatedBounds(el: Pick<Element, "x" | "y" | "width" | "height" | "rotation">): Box {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = el.width / 2;
  const hh = el.height / 2;
  const corners = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => [cx + dx! * cos - dy! * sin, cy + dx! * sin + dy! * cos] as const);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Groups top-level, unlocked elements into one group placed where the topmost
 * of them was in the stack. Returns the new group's id (null if fewer than 2).
 */
export function groupElements(page: Page, ids: readonly string[]): string | null {
  const wanted = new Set(ids);
  const picked = page.elements.filter((e) => wanted.has(e.id) && !e.locked);
  if (picked.length < 2) return null;

  const boxes = picked.map(rotatedBounds);
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));

  const pickedIds = new Set(picked.map((e) => e.id));
  const topIndex = Math.max(...picked.map((e) => page.elements.indexOf(e)));
  // Where the group goes once the picked elements are taken out.
  const insertAt = page.elements.slice(0, topIndex).filter((e) => !pickedIds.has(e.id)).length;

  const children = picked.map((e) => {
    const child = snapshot(e);
    child.x = round(child.x - minX);
    child.y = round(child.y - minY);
    return child;
  });

  const group = ElementSchema.parse({
    id: createId(),
    type: "group",
    x: round(minX),
    y: round(minY),
    width: round(maxX - minX),
    height: round(maxY - minY),
    children,
  });

  page.elements = page.elements.filter((e) => !pickedIds.has(e.id));
  page.elements.splice(insertAt, 0, group);
  return group.id;
}

/**
 * Dissolves top-level groups back into their children, applying the group's
 * position, rotation, flips and opacity so nothing visibly moves.
 * Returns the ids of the released children.
 */
export function ungroupElements(page: Page, ids: readonly string[]): string[] {
  const released: string[] = [];
  for (const id of ids) {
    const index = page.elements.findIndex((e) => e.id === id);
    const group = page.elements[index];
    if (!group || group.type !== "group" || group.locked) continue;

    const gcx = group.x + group.width / 2;
    const gcy = group.y + group.height / 2;
    const rad = (group.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const children = group.children.map((original) => {
      const child = snapshot(original);
      // Child centre relative to the group centre, in the group's own frame.
      let lx = child.x + child.width / 2 - group.width / 2;
      let ly = child.y + child.height / 2 - group.height / 2;
      if (group.flipX) {
        lx = -lx;
        child.flipX = !child.flipX;
        child.rotation = -child.rotation;
      }
      if (group.flipY) {
        ly = -ly;
        child.flipY = !child.flipY;
        child.rotation = -child.rotation;
      }
      const ax = gcx + lx * cos - ly * sin;
      const ay = gcy + lx * sin + ly * cos;
      child.x = round(ax - child.width / 2);
      child.y = round(ay - child.height / 2);
      child.rotation = normalizeAngle(child.rotation + group.rotation);
      child.opacity = round(child.opacity * group.opacity);
      if (!group.visible) child.visible = false;
      return child;
    });

    page.elements.splice(index, 1, ...children);
    released.push(...children.map((c) => c.id));
  }
  return released;
}

/**
 * Scales a group's children after the group itself was resized by (sx, sy).
 * Text grows by its font size; line thickness is kept.
 */
export function scaleChildren(children: Element[], sx: number, sy: number): Element[] {
  return children.map((original) => {
    const child = structuredClone(original);
    child.x = round(child.x * sx);
    child.y = round(child.y * sy);
    child.width = round(child.width * sx);
    if (child.type === "line") {
      // Keep the line centred on its (scaled) position; thickness stays the same.
      child.y = round(original.y * sy + (original.height * sy - original.height) / 2);
      return child;
    }
    child.height = round(child.height * sy);
    if (child.type === "text") {
      const k = Math.min(sx, sy);
      child.fontSize = Math.max(1, Math.round(child.fontSize * k * 10) / 10);
      if (child.stroke) child.stroke = { ...child.stroke, width: round(child.stroke.width * k) };
      if (child.extrude)
        child.extrude = { ...child.extrude, depth: round(child.extrude.depth * k) };
      child.runs = child.runs.map((run) =>
        run.style.fontSize
          ? {
              ...run,
              style: { ...run.style, fontSize: Math.round(run.style.fontSize * k * 10) / 10 },
            }
          : run,
      );
    }
    if (child.type === "shape") child.cornerRadius = round(child.cornerRadius * Math.min(sx, sy));
    if (child.type === "group") child.children = scaleChildren(child.children, sx, sy);
    return child;
  });
}

/** Sum of the positions of every group enclosing `id` (children are stored relative to them). */
export function ancestorOffset(
  elements: readonly Element[],
  id: string,
  base = { x: 0, y: 0 },
): { x: number; y: number } | null {
  for (const el of elements) {
    if (el.id === id) return base;
    if (el.type === "group") {
      const found = ancestorOffset(el.children, id, { x: base.x + el.x, y: base.y + el.y });
      if (found) return found;
    }
  }
  return null;
}

/**
 * Shrinks/grows a group's box to fit its children again (after a child was
 * moved, resized or deleted) without anything moving on the page.
 * Returns false when the group has no children left.
 */
export function refitGroup(group: GroupElement): boolean {
  // Inner groups first; empty ones disappear.
  for (let i = group.children.length - 1; i >= 0; i--) {
    const child = group.children[i]!;
    if (child.type === "group" && !refitGroup(child)) group.children.splice(i, 1);
  }
  if (group.children.length === 0) return false;
  const boxes = group.children.map(rotatedBounds);
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const width = Math.max(...boxes.map((b) => b.x + b.width)) - minX;
  const height = Math.max(...boxes.map((b) => b.y + b.height)) - minY;
  if (
    Math.abs(minX) < 0.5 &&
    Math.abs(minY) < 0.5 &&
    Math.abs(width - group.width) < 0.5 &&
    Math.abs(height - group.height) < 0.5
  ) {
    return true;
  }
  // How far the box centre moves in the group's own frame, then on the page.
  let dx = minX + width / 2 - group.width / 2;
  let dy = minY + height / 2 - group.height / 2;
  if (group.flipX) dx = -dx;
  if (group.flipY) dy = -dy;
  const rad = (group.rotation * Math.PI) / 180;
  const cx = group.x + group.width / 2 + dx * Math.cos(rad) - dy * Math.sin(rad);
  const cy = group.y + group.height / 2 + dx * Math.sin(rad) + dy * Math.cos(rad);
  for (const child of group.children) {
    child.x = round(child.x - minX);
    child.y = round(child.y - minY);
  }
  group.width = round(width);
  group.height = round(height);
  group.x = round(cx - width / 2);
  group.y = round(cy - height / 2);
  return true;
}

/** Refits every group on the page; empty groups are removed and one-child groups dissolved. */
export function tidyGroups(page: Page) {
  for (let i = page.elements.length - 1; i >= 0; i--) {
    const el = page.elements[i]!;
    if (el.type !== "group") continue;
    if (!refitGroup(el)) page.elements.splice(i, 1);
    else if (el.children.length === 1) ungroupElements(page, [el.id]);
  }
}
