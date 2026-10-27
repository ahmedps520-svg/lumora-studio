/**
 * Layer groups. The document keeps one flat list (bottom → top); a group is a
 * layer whose descendants sit directly below it in that list, each pointing
 * at its parent with `parentId`. These helpers keep that invariant.
 */
import type { Layer } from "./types";

const parentOf = (l: Layer) => l.parentId ?? null;

/** True when `id` is `ancestorId` or somewhere inside it. */
export function isInside(layers: Layer[], id: string, ancestorId: string): boolean {
  const byId = new Map(layers.map((l) => [l.id, l]));
  let cur: Layer | undefined = byId.get(id);
  while (cur) {
    if (cur.id === ancestorId) return true;
    const p = parentOf(cur);
    cur = p ? byId.get(p) : undefined;
  }
  return false;
}

/** Index range [start, end] of a layer and everything inside it (end = the layer itself). */
export function blockRange(layers: Layer[], id: string): [number, number] {
  const end = layers.findIndex((l) => l.id === id);
  if (end < 0) return [-1, -1];
  let start = end;
  while (start > 0 && isInside(layers, layers[start - 1]!.id, id)) start--;
  return [start, end];
}

/** The layer and everything inside it, bottom → top. */
export const blockOf = (layers: Layer[], id: string): Layer[] => {
  const [s, e] = blockRange(layers, id);
  return s < 0 ? [] : layers.slice(s, e + 1);
};

/** Everything inside a group (not the group itself). */
export const descendantsOf = (layers: Layer[], id: string): Layer[] =>
  blockOf(layers, id).slice(0, -1);

export const childrenOf = (layers: Layer[], parentId: string | null): Layer[] =>
  layers.filter((l) => parentOf(l) === parentId);

export function depthOf(layers: Layer[], layer: Layer): number {
  const byId = new Map(layers.map((l) => [l.id, l]));
  let d = 0;
  let p = parentOf(layer);
  while (p) {
    d++;
    p = byId.get(p) ? parentOf(byId.get(p)!) : null;
  }
  return d;
}

/** Visible on screen: the layer and all the groups around it are switched on. */
export function shownInTree(layers: Layer[], layer: Layer): boolean {
  const byId = new Map(layers.map((l) => [l.id, l]));
  let cur: Layer | undefined = layer;
  while (cur) {
    if (!cur.visible) return false;
    const p = parentOf(cur);
    cur = p ? byId.get(p) : undefined;
  }
  return true;
}

/** Hidden in the Layers panel because a group around it is collapsed. */
export function folded(layers: Layer[], layer: Layer): boolean {
  const byId = new Map(layers.map((l) => [l.id, l]));
  let p = parentOf(layer);
  while (p) {
    const g = byId.get(p);
    if (!g) return false;
    if (g.kind === "group" && g.collapsed) return true;
    p = parentOf(g);
  }
  return false;
}

export type Drop = "above" | "below" | "into";

/**
 * Moves a layer (with its contents, if it's a group) above or below another
 * layer, or to the top of a group. Returns the new list; `parentId`s of the
 * moved layer are updated in place.
 */
export function moveBlock(layers: Layer[], id: string, targetId: string, where: Drop): Layer[] {
  if (id === targetId || isInside(layers, targetId, id)) return layers;
  const target = layers.find((l) => l.id === targetId);
  const moving = layers.find((l) => l.id === id);
  if (!target || !moving) return layers;
  if (where === "into" && target.kind !== "group") return layers;
  const [s, e] = blockRange(layers, id);
  const block = layers.slice(s, e + 1);
  const rest = [...layers.slice(0, s), ...layers.slice(e + 1)];
  const ti = rest.findIndex((l) => l.id === targetId);
  let at: number;
  if (where === "into") {
    moving.parentId = target.id;
    at = ti; // just below the group's own row = top of its contents
  } else if (where === "above") {
    moving.parentId = parentOf(target);
    at = ti + 1;
  } else {
    moving.parentId = parentOf(target);
    at = blockRange(rest, targetId)[0];
  }
  rest.splice(at, 0, ...block);
  return rest;
}

/** Puts layers (and their contents) into a new group placed where the topmost one was. */
export function groupInto(layers: Layer[], ids: string[], group: Layer): Layer[] {
  const chosen = new Set(ids);
  // Only the outermost chosen layers move; their contents come along.
  const roots = layers.filter(
    (l) =>
      chosen.has(l.id) &&
      !layers.some((o) => o.id !== l.id && chosen.has(o.id) && isInside(layers, l.id, o.id)),
  );
  if (!roots.length) return layers;
  const top = roots[roots.length - 1]!;
  group.parentId = parentOf(top);
  const moved = new Set(roots.flatMap((r) => blockOf(layers, r.id).map((l) => l.id)));
  const topIndex = layers.findIndex((l) => l.id === top.id);
  const block = layers.filter((l) => moved.has(l.id));
  const rest = layers.filter((l) => !moved.has(l.id));
  const at = layers.slice(0, topIndex).filter((l) => !moved.has(l.id)).length;
  for (const r of roots) r.parentId = group.id;
  rest.splice(at, 0, ...block, group);
  return rest;
}

/** Removes a group and leaves its contents in place. */
export function ungroup(layers: Layer[], groupId: string): Layer[] {
  const g = layers.find((l) => l.id === groupId);
  if (!g || g.kind !== "group") return layers;
  for (const l of layers) if (parentOf(l) === groupId) l.parentId = parentOf(g);
  return layers.filter((l) => l.id !== groupId);
}

/** Siblings of a layer (same parent), bottom → top. */
export const siblingsOf = (layers: Layer[], id: string): Layer[] => {
  const l = layers.find((x) => x.id === id);
  return l ? childrenOf(layers, parentOf(l)) : [];
};

/** Arrange within the layer's own group: to the front/back or one step. */
export function arrangeBlock(
  layers: Layer[],
  id: string,
  how: "front" | "forward" | "backward" | "back",
): Layer[] {
  const sibs = siblingsOf(layers, id);
  const i = sibs.findIndex((l) => l.id === id);
  if (i < 0) return layers;
  if ((how === "front" || how === "forward") && i === sibs.length - 1) return layers;
  if ((how === "back" || how === "backward") && i === 0) return layers;
  const target =
    how === "front"
      ? sibs[sibs.length - 1]!
      : how === "forward"
        ? sibs[i + 1]!
        : how === "backward"
          ? sibs[i - 1]!
          : sibs[0]!;
  return moveBlock(layers, id, target.id, how === "front" || how === "forward" ? "above" : "below");
}

/** Checks the flat-list invariant (each group's contents directly below it). */
export function isWellFormed(layers: Layer[]): boolean {
  const ids = new Set(layers.map((l) => l.id));
  for (const l of layers) {
    const p = parentOf(l);
    if (p && (!ids.has(p) || layers.find((x) => x.id === p)!.kind !== "group")) return false;
  }
  for (const g of layers) {
    if (g.kind !== "group") continue;
    const [s, e] = blockRange(layers, g.id);
    const inside = layers.filter((l) => l.id !== g.id && isInside(layers, l.id, g.id)).length;
    if (e - s !== inside) return false;
  }
  return true;
}
