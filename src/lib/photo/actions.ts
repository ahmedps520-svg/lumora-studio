"use client";
/**
 * Every command of the photo editor (menus, panels, shortcuts). Each is one
 * undo step. Pixel work happens on the layer canvases in the runtime registry.
 */
import { applyAdjustment, autoLevels, createAdjustment } from "./adjustments";
import { FILTER_BY_ID, type Params } from "./filters";
import { contentAwareFill } from "./inpaint";
import { cloneImg, hexToRgb, type Img, maskMix } from "./pixels";
import {
  copyCanvas,
  composite,
  createCanvas,
  ctx2d,
  ensureCovers,
  flatten,
  getPixels,
  newMask,
  readImg,
  refreshLayer,
  setPixels,
  writeImg,
} from "./runtime";
import { pathD, simplify } from "./paths";
import * as sel from "./selection";
import { newLayer } from "./storage";
import { activeLayer, get, set, transact, type TransformMode } from "./store";
import { convertTransform, isIdentity, renderTransform } from "./transform";
import * as tree from "./tree";
import type {
  Adjustment,
  AdjustmentType,
  FillProps,
  Layer,
  PhotoDoc,
  PhotoPath,
  ShapeProps,
  TextProps,
} from "./types";

const doc = () => get().doc!;
const layerById = (d: PhotoDoc, id: string) => d.layers.find((l) => l.id === id);

// ─── Pixel targets ───────────────────────────────────────────────────────────

/** The selection clipped to a rectangle of the document (or null = everything). */
export function selectionIn(x: number, y: number, w: number, h: number): Uint8ClampedArray | null {
  const s = get().selection;
  if (!s) return null;
  const out = new Uint8ClampedArray(w * h);
  for (let yy = 0; yy < h; yy++) {
    const dy = y + yy;
    if (dy < 0 || dy >= s.height) continue;
    for (let xx = 0; xx < w; xx++) {
      const dx = x + xx;
      if (dx < 0 || dx >= s.width) continue;
      out[yy * w + xx] = s.data[dy * s.width + dx]!;
    }
  }
  return out;
}

/** Turns a text/shape/fill layer into plain pixels (inside a transaction draft). */
function rasterizeInDraft(d: PhotoDoc, id: string) {
  const i = d.layers.findIndex((l) => l.id === id);
  const l = d.layers[i];
  if (!l || l.kind === "pixel" || l.kind === "adjustment") return;
  const {
    text: _t,
    shape: _s,
    fill: _f,
    ...rest
  } = l as Layer & { text?: unknown; shape?: unknown; fill?: unknown };
  d.layers[i] = { ...(rest as Omit<Layer, "kind">), kind: "pixel" } as Layer;
}

/**
 * Edits the active layer's pixels (or its mask in mask-edit mode) through
 * `fn`, limited to the selection. Text/shape/fill layers are rasterized first.
 */
export function editPixels(
  label: string,
  fn: (img: Img, origin: { x: number; y: number }) => void,
) {
  const layer = activeLayer();
  if (
    !layer ||
    layer.kind === "adjustment" ||
    layer.kind === "group" ||
    layer.locks.all ||
    layer.locks.pixels
  )
    return false;
  transact(label, [layer.id], (d) => {
    const p = getPixels(layer.id);
    const onMask = get().maskEdit && p.mask;
    if (!onMask) {
      rasterizeInDraft(d, layer.id);
      const draftLayer = layerById(d, layer.id)!;
      ensureCovers(draftLayer, { x: 0, y: 0, width: d.width, height: d.height });
    }
    const target = onMask ? p.mask! : p.canvas;
    const ox = onMask ? 0 : layerById(d, layer.id)!.x;
    const oy = onMask ? 0 : layerById(d, layer.id)!.y;
    const img = readImg(target);
    const before = cloneImg(img);
    fn(img, { x: ox, y: oy });
    const s = selectionIn(ox, oy, img.width, img.height);
    if (s) maskMix(before, img, s);
    if (layer.locks.transparency && !onMask)
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = before.data[i]!;
    writeImg(target, img);
  });
  return true;
}

// ─── Layers ──────────────────────────────────────────────────────────────────

/** Adds a layer above the active one, in the same group (or into an open active group). */
function insertAbove(d: PhotoDoc, layer: Layer) {
  const s = get();
  const idx = d.layers.findIndex((l) => l.id === s.activeId);
  const active = d.layers[idx];
  if (!active) {
    layer.parentId = null;
    d.layers.push(layer);
    return;
  }
  if (active.kind === "group" && !active.collapsed) {
    layer.parentId = active.id;
    d.layers.splice(idx, 0, layer);
    return;
  }
  layer.parentId = active.parentId ?? null;
  d.layers.splice(idx + 1, 0, layer);
}

const nextName = (base: string) => {
  const n = doc().layers.length + 1;
  return `${base} ${n}`;
};

export function addPixelLayer(name = nextName("Layer")) {
  const layer = newLayer("pixel", name);
  setPixels(layer.id, { canvas: createCanvas(doc().width, doc().height), mask: null });
  transact("newLayer", [], (d) => insertAbove(d, layer));
  set({ activeId: layer.id, maskEdit: false });
  return layer.id;
}

export function addTextLayer(at: { x: number; y: number }, text: string) {
  const o = get().options;
  const props: TextProps = {
    text,
    font: o.fontFamily,
    size: o.fontSize,
    weight: o.fontWeight,
    italic: false,
    color: get().fg,
    align: "left",
    lineHeight: 1.2,
    tracking: 0,
    width: 0,
  };
  const layer = newLayer("text", text.slice(0, 40) || "Text", {
    text: props,
    x: Math.round(at.x),
    y: Math.round(at.y),
  });
  getPixels(layer.id);
  refreshLayer(layer, doc());
  transact("newText", [], (d) => insertAbove(d, layer));
  set({ activeId: layer.id, maskEdit: false });
  return layer.id;
}

export function addShapeLayer(
  shape: ShapeProps["shape"],
  rect: { x: number; y: number; width: number; height: number },
) {
  const o = get().options;
  const props: ShapeProps = {
    shape,
    width: Math.max(2, Math.round(rect.width)),
    height: Math.max(shape === "line" ? 2 : 2, Math.round(rect.height)),
    fill: shape === "line" ? null : o.shapeFill,
    stroke: shape === "line" ? (o.shapeStroke ?? o.shapeFill ?? get().fg) : o.shapeStroke,
    strokeWidth: o.strokeWidth,
    radius: o.radius,
    sides: o.sides,
  };
  const layer = newLayer("shape", nextName("Shape"), {
    shape: props,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
  });
  getPixels(layer.id);
  refreshLayer(layer, doc());
  transact("newShape", [], (d) => insertAbove(d, layer));
  set({ activeId: layer.id, maskEdit: false });
}

export function addFillLayer(kind: "solid" | "gradient") {
  const s = get();
  const fill: FillProps =
    kind === "solid"
      ? { type: "solid", color: s.fg }
      : {
          type: "gradient",
          kind: "linear",
          angle: 90,
          stops: [
            { offset: 0, color: s.fg },
            { offset: 1, color: s.bg },
          ],
        };
  const layer = newLayer("fill", kind === "solid" ? "Color Fill" : "Gradient Fill", { fill });
  getPixels(layer.id);
  refreshLayer(layer, doc());
  if (s.selection) getPixels(layer.id).mask = selectionCanvas(s.selection);
  transact("newFill", [], (d) => {
    insertAbove(d, { ...layer, mask: s.selection ? { enabled: true } : null });
  });
  set({ activeId: layer.id });
}

export function addAdjustmentLayer(type: AdjustmentType) {
  const s = get();
  const layer = newLayer("adjustment", type, { adjustment: createAdjustment(type) });
  const p = getPixels(layer.id);
  p.mask = s.selection ? selectionCanvas(s.selection) : newMask(doc(), true);
  transact("newAdjustment", [], (d) => insertAbove(d, { ...layer, mask: { enabled: true } }));
  set({ activeId: layer.id, maskEdit: false });
  return layer.id;
}

/** Updates a layer's settings (redraws text/shape/fill layers). */
export function updateLayer(id: string, patch: Partial<Layer>, label = "layerProps") {
  transact(label, [id], (d) => {
    const i = d.layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    d.layers[i] = { ...d.layers[i]!, ...patch } as Layer;
    refreshLayer(d.layers[i]!, d);
  });
}

/** Live change without an undo step (slider dragging); call `updateLayer` at the end. */
export function previewLayer(id: string, patch: Partial<Layer>) {
  const d = structuredClone(doc());
  const i = d.layers.findIndex((l) => l.id === id);
  if (i < 0) return;
  d.layers[i] = { ...d.layers[i]!, ...patch } as Layer;
  refreshLayer(d.layers[i]!, d);
  set({ doc: d, rev: get().rev + 1 });
}

export function duplicateLayer(id = get().activeId!) {
  const d0 = doc();
  const block = tree.blockOf(d0.layers, id);
  if (!block.length) return;
  // New ids for the layer and everything inside it.
  const ids = new Map(block.map((l) => [l.id, newLayer("pixel", "").id]));
  const copies = block.map((l) => {
    const c = structuredClone(l) as Layer;
    c.id = ids.get(l.id)!;
    if (c.parentId && ids.has(c.parentId)) c.parentId = ids.get(c.parentId);
    const px = getPixels(l.id);
    setPixels(c.id, { canvas: copyCanvas(px.canvas), mask: px.mask ? copyCanvas(px.mask) : null });
    return c;
  });
  const top = copies[copies.length - 1]!;
  top.name = `${block[block.length - 1]!.name} copy`;
  transact("duplicateLayer", [], (d) => {
    const i = d.layers.findIndex((l) => l.id === id);
    d.layers.splice(i + 1, 0, ...copies);
  });
  set({ activeId: top.id, selectedIds: [top.id] });
}

export function deleteLayer(id = get().activeId!) {
  const d0 = doc();
  const block = tree.blockOf(d0.layers, id);
  const remaining = d0.layers.filter((l) => !block.includes(l) && l.kind !== "group");
  if (!block.length || !remaining.length) return;
  const gone = new Set(block.map((l) => l.id));
  transact("deleteLayer", [...gone], (d) => {
    d.layers = d.layers.filter((l) => !gone.has(l.id));
  });
  const layers = doc().layers;
  const [start] = tree.blockRange(d0.layers, id);
  const next =
    layers[Math.min(Math.max(0, start - 1), layers.length - 1)] ?? layers[layers.length - 1]!;
  set({ activeId: next.id, selectedIds: [next.id], maskEdit: false });
}

/** Drag and drop in the Layers panel: above/below another layer, or into a group. */
export function moveLayerTo(id: string, targetId: string, where: tree.Drop) {
  if (id === targetId || tree.isInside(doc().layers, targetId, id)) return;
  transact("moveLayer", [], (d) => {
    d.layers = tree.moveBlock(d.layers, id, targetId, where);
  });
}

export function arrange(how: "front" | "forward" | "backward" | "back") {
  const id = get().activeId;
  if (!id) return;
  const before = doc()
    .layers.map((l) => l.id)
    .join();
  const next = tree.arrangeBlock(structuredClone(doc().layers), id, how);
  if (next.map((l) => l.id).join() === before) return;
  transact("moveLayer", [], (d) => {
    d.layers = tree.arrangeBlock(d.layers, id, how);
  });
}

// ─── Groups ──────────────────────────────────────────────────────────────────

/** The layers the next group / merge acts on: the picked ones, else the active one. */
export function pickedIds(): string[] {
  const s = get();
  const ids = s.selectedIds.filter((id) => s.doc?.layers.some((l) => l.id === id));
  return ids.length ? ids : s.activeId ? [s.activeId] : [];
}

/** Layer → Group Layers (Ctrl+G). */
export function groupLayers(ids = pickedIds()) {
  if (!ids.length) return;
  const n = doc().layers.filter((l) => l.kind === "group").length + 1;
  const group = newLayer("group", `Group ${n}`, { collapsed: false, passThrough: true });
  transact("group", [], (d) => {
    d.layers = tree.groupInto(d.layers, ids, group);
  });
  set({ activeId: group.id, selectedIds: [group.id], maskEdit: false });
}

/** A new, empty group above the active layer. */
export function newGroup() {
  const n = doc().layers.filter((l) => l.kind === "group").length + 1;
  const group = newLayer("group", `Group ${n}`, { collapsed: false, passThrough: true });
  transact("group", [], (d) => insertAbove(d, group));
  set({ activeId: group.id, selectedIds: [group.id], maskEdit: false });
}

/** Layer → Ungroup Layers (Ctrl+Shift+G). */
export function ungroupLayers(id = get().activeId) {
  const g = id ? layerById(doc(), id) : null;
  if (!g || g.kind !== "group") return;
  const first = tree.descendantsOf(doc().layers, g.id).at(-1);
  transact("ungroup", [g.id], (d) => {
    d.layers = tree.ungroup(d.layers, g.id);
  });
  set({ activeId: first?.id ?? doc().layers.at(-1)!.id, selectedIds: [], maskEdit: false });
}

/** Opens or closes a group in the Layers panel (not an undo step). */
export function setCollapsed(id: string, collapsed: boolean) {
  const d = structuredClone(doc());
  const g = layerById(d, id);
  if (g?.kind !== "group") return;
  g.collapsed = collapsed;
  set({ doc: d, dirty: true });
}

/** Turns a group into one pixel layer (Merge Group). */
export function mergeGroup(id = get().activeId!) {
  const d0 = doc();
  const g = layerById(d0, id);
  if (!g || g.kind !== "group") return;
  const block = tree.blockOf(d0.layers, id);
  // The group's picture on its own (its opacity and blend stay on the new layer).
  const merged = mergeOf(
    block.map((l) =>
      l.id === id
        ? { ...l, opacity: 1, fillOpacity: 1, blend: "normal" as const, mask: null, clip: false }
        : l,
    ),
  );
  const keep = newLayer("pixel", g.name, {
    parentId: g.parentId ?? null,
    opacity: g.opacity,
    blend: g.blend,
    clip: g.clip,
    visible: g.visible,
    mask: g.mask,
  });
  const mask = getPixels(id).mask;
  setPixels(keep.id, { canvas: merged, mask: mask ? copyCanvas(mask) : null });
  const gone = new Set(block.map((l) => l.id));
  transact("mergeGroup", [...gone], (d) => {
    const at = tree.blockRange(d.layers, id)[0];
    d.layers = d.layers.filter((l) => !gone.has(l.id));
    d.layers.splice(at, 0, keep);
  });
  set({ activeId: keep.id, selectedIds: [keep.id] });
}

/** A temporary document with some layers, for merging. */
function mergeOf(layers: Layer[], background: string | null = null) {
  const d = { ...doc(), layers };
  return flatten(d, background);
}

export function mergeDown() {
  const d = doc();
  const active = activeLayer();
  if (active?.kind === "group") return mergeGroup(active.id);
  const i = d.layers.findIndex((l) => l.id === get().activeId);
  if (i <= 0) return;
  const upper = d.layers[i]!;
  const sibs = tree.siblingsOf(d.layers, upper.id);
  const lower = sibs[sibs.findIndex((l) => l.id === upper.id) - 1];
  if (!lower || lower.kind === "adjustment" || lower.kind === "group") return;
  const merged = mergeOf([{ ...lower, opacity: 1, blend: "normal", clip: false }, upper]);
  transact("mergeDown", [lower.id, upper.id], (dr) => {
    rasterizeInDraft(dr, lower.id);
    const base = layerById(dr, lower.id)!;
    base.x = 0;
    base.y = 0;
    base.mask = null;
    setPixels(lower.id, { canvas: merged, mask: null });
    dr.layers = dr.layers.filter((l) => l.id !== upper.id);
  });
  set({ activeId: lower.id });
}

export function mergeVisible() {
  const d = doc();
  const visible = d.layers.filter((l) => l.visible);
  if (visible.length < 2) return;
  const merged = mergeOf(d.layers);
  const keep = newLayer("pixel", "Merged");
  setPixels(keep.id, { canvas: merged, mask: null });
  transact("mergeVisible", "all", (dr) => {
    // Hidden layers stay (outside any group); everything shown becomes one layer.
    const hidden = dr.layers.filter((l) => l.kind !== "group" && !tree.shownInTree(dr.layers, l));
    for (const l of hidden) l.parentId = null;
    dr.layers = [...hidden, keep];
  });
  set({ activeId: keep.id });
}

export function flattenImage() {
  const merged = mergeOf(doc().layers, "#FFFFFF");
  const keep = newLayer("pixel", "Background");
  setPixels(keep.id, { canvas: merged, mask: null });
  transact("flatten", "all", (dr) => {
    dr.layers = [keep];
  });
  set({ activeId: keep.id });
}

export function rasterize(id = get().activeId!) {
  if (layerById(doc(), id)?.kind === "group") return mergeGroup(id);
  transact("rasterize", [id], (d) => rasterizeInDraft(d, id));
}

/** New layer from the selection's pixels (Layer via Copy / via Cut). */
export function layerVia(cut: boolean) {
  const s = get();
  const layer = activeLayer();
  if (!layer || layer.kind === "adjustment" || layer.kind === "group") return;
  const p = getPixels(layer.id);
  const content = copyCanvas(p.canvas);
  const piece = createCanvas(doc().width, doc().height);
  ctx2d(piece).drawImage(content, layer.x, layer.y);
  if (s.selection) {
    const g = ctx2d(piece);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(selectionCanvas(s.selection), 0, 0);
  }
  const fresh = newLayer("pixel", cut ? `${layer.name} cut` : `${layer.name} copy`, {
    parentId: layer.parentId ?? null,
  });
  setPixels(fresh.id, { canvas: piece, mask: null });
  transact(cut ? "layerViaCut" : "layerViaCopy", [layer.id], (d) => {
    if (cut && s.selection) {
      rasterizeInDraft(d, layer.id);
      const g = ctx2d(getPixels(layer.id).canvas);
      g.globalCompositeOperation = "destination-out";
      g.drawImage(selectionCanvas(s.selection), -layer.x, -layer.y);
      g.globalCompositeOperation = "source-over";
    }
    const i = d.layers.findIndex((l) => l.id === layer.id);
    d.layers.splice(i + 1, 0, fresh);
  });
  set({ activeId: fresh.id });
}

// ─── Masks ───────────────────────────────────────────────────────────────────

/** A selection drawn as a mask canvas (alpha = selected). */
export function selectionCanvas(m: sel.Mask): HTMLCanvasElement {
  const c = createCanvas(m.width, m.height);
  const img = ctx2d(c).createImageData(m.width, m.height);
  for (let p = 0; p < m.data.length; p++) {
    img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = 255;
    img.data[p * 4 + 3] = m.data[p]!;
  }
  ctx2d(c).putImageData(img, 0, 0);
  return c;
}

export function addMask(mode: "reveal" | "hide" | "selection") {
  const layer = activeLayer();
  if (!layer || layer.mask) return;
  const s = get();
  transact("addMask", [layer.id], (d) => {
    const p = getPixels(layer.id);
    p.mask =
      mode === "selection" && s.selection
        ? selectionCanvas(s.selection)
        : newMask(d, mode !== "hide");
    layerById(d, layer.id)!.mask = { enabled: true };
  });
  set({ maskEdit: true });
}

export function deleteMask(apply: boolean) {
  const layer = activeLayer();
  if (!layer?.mask) return;
  transact(apply ? "applyMask" : "deleteMask", [layer.id], (d) => {
    const p = getPixels(layer.id);
    if (apply && p.mask) {
      rasterizeInDraft(d, layer.id);
      const g = ctx2d(p.canvas);
      g.globalCompositeOperation = "destination-in";
      g.drawImage(p.mask, -layerById(d, layer.id)!.x, -layerById(d, layer.id)!.y);
      g.globalCompositeOperation = "source-over";
    }
    p.mask = null;
    layerById(d, layer.id)!.mask = null;
  });
  set({ maskEdit: false });
}

export function toggleMask() {
  const layer = activeLayer();
  if (!layer?.mask) return;
  updateLayer(layer.id, { mask: { enabled: !layer.mask.enabled } }, "toggleMask");
}

/** The mask (or the selection) as a selection. */
export function maskToSelection() {
  const layer = activeLayer();
  const p = layer ? getPixels(layer.id) : null;
  if (!p?.mask) return;
  const img = readImg(p.mask);
  const m = sel.emptyMask(img.width, img.height);
  for (let i = 0; i < m.data.length; i++) m.data[i] = img.data[i * 4 + 3]!;
  setSelection(m);
}

// ─── Selections ──────────────────────────────────────────────────────────────

export function setSelection(
  next: sel.Mask | null,
  mode: sel.CombineMode = "new",
  label = "select",
) {
  const s = get();
  let result = next ? sel.combine(s.selection, next, mode) : null;
  if (result && sel.isEmpty(result)) result = null;
  transact(label, [], () => undefined);
  // The transaction captured the old selection; now store the new one.
  const entries = get().history;
  const last = entries[entries.length - 1];
  if (last) last.after = { ...last.after, selection: result };
  set({ selection: result, lastSelection: s.selection ?? s.lastSelection });
}

export const selectAll = () =>
  setSelection(sel.fullMask(doc().width, doc().height), "new", "selectAll");
export const deselect = () => setSelection(null, "new", "deselect");
export const reselect = () => {
  const last = get().lastSelection;
  if (last) setSelection(last, "new", "reselect");
};
export const inverseSelection = () => {
  const s = get().selection;
  setSelection(s ? sel.invert(s) : sel.fullMask(doc().width, doc().height), "new", "inverse");
};

export function modifySelection(
  op: "expand" | "contract" | "feather" | "border" | "smooth",
  amount: number,
) {
  const s = get().selection;
  if (!s) return;
  const next =
    op === "expand"
      ? sel.expand(s, amount)
      : op === "contract"
        ? sel.expand(s, -amount)
        : op === "feather"
          ? sel.feather(s, amount)
          : op === "border"
            ? sel.border(s, amount)
            : sel.smooth(s, amount);
  setSelection(next, "new", op);
}

/** What the magic wand / color tools sample: the active layer or all layers. */
export function sampleImage(all: boolean): Img {
  const d = doc();
  if (all) return readImg(flatten(d));
  const layer = activeLayer();
  if (layer?.kind === "group") return readImg(mergeOf(tree.blockOf(d.layers, layer.id)));
  const c = createCanvas(d.width, d.height);
  if (layer && layer.kind !== "adjustment")
    ctx2d(c).drawImage(getPixels(layer.id).canvas, layer.x, layer.y);
  return readImg(c);
}

export function growSimilar(contiguous: boolean) {
  const s = get().selection;
  if (!s) return;
  setSelection(
    sel.growSimilar(sampleImage(true), s, get().options.tolerance, contiguous),
    "new",
    contiguous ? "grow" : "similar",
  );
}

export function colorRange(color: string, fuzziness: number, mode: sel.CombineMode = "new") {
  setSelection(sel.colorRange(sampleImage(true), color, fuzziness), mode, "colorRange");
}

export function saveSelection() {
  set({ savedSelection: get().selection });
}
export function loadSelection() {
  const s = get().savedSelection;
  if (s) setSelection(s, "new", "loadSelection");
}

/** Select Subject: the on-device subject model (same as the background remover). */
export async function selectSubject(): Promise<boolean> {
  const { removeBackground } = await import("@/lib/background/remove-background");
  const { useAiSettings } = await import("@/lib/ai/settings-store");
  const d = doc();
  const flat = flatten(d, "#FFFFFF");
  const blob = await new Promise<Blob>((resolve) => flat.toBlob((b) => resolve(b!), "image/png"));
  set({ busy: "selectSubject" });
  try {
    const result = await removeBackground(blob, {
      model: useAiSettings.getState().backgroundModel,
    });
    const bitmap = await createImageBitmap(result.image);
    const c = createCanvas(d.width, d.height);
    ctx2d(c).drawImage(bitmap, 0, 0, d.width, d.height);
    const img = readImg(c);
    const m = sel.emptyMask(d.width, d.height);
    for (let i = 0; i < m.data.length; i++) m.data[i] = img.data[i * 4 + 3]!;
    setSelection(m, get().options.selectionMode, "selectSubject");
    return true;
  } finally {
    set({ busy: null });
  }
}

/** Remove Background: a mask from the subject on the active layer. */
export async function removeBackgroundToMask() {
  const ok = await selectSubject();
  if (!ok) return;
  const layer = activeLayer();
  if (!layer || layer.mask) return;
  addMask("selection");
  deselect();
}

// ─── Edit ────────────────────────────────────────────────────────────────────

let clipboard: { canvas: HTMLCanvasElement; x: number; y: number } | null = null;

function selectionPixels(merged: boolean) {
  const s = get();
  const d = doc();
  const src = createCanvas(d.width, d.height);
  if (merged) ctx2d(src).drawImage(flatten(d), 0, 0);
  else {
    const layer = activeLayer();
    if (!layer || layer.kind === "adjustment") return null;
    if (layer.kind === "group")
      ctx2d(src).drawImage(mergeOf(tree.blockOf(d.layers, layer.id)), 0, 0);
    else ctx2d(src).drawImage(getPixels(layer.id).canvas, layer.x, layer.y);
  }
  const bounds = s.selection
    ? sel.maskBounds(s.selection)
    : { x: 0, y: 0, width: d.width, height: d.height };
  if (!bounds) return null;
  if (s.selection) {
    const g = ctx2d(src);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(selectionCanvas(s.selection), 0, 0);
  }
  const out = createCanvas(bounds.width, bounds.height);
  ctx2d(out).drawImage(src, -bounds.x, -bounds.y);
  return { canvas: out, x: bounds.x, y: bounds.y };
}

export async function copy(merged = false) {
  const piece = selectionPixels(merged);
  if (!piece) return;
  clipboard = piece;
  try {
    const blob = await new Promise<Blob | null>((r) => piece.canvas.toBlob(r, "image/png"));
    if (blob && navigator.clipboard?.write)
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch {
    // The in-app clipboard still has it.
  }
}

export async function cut() {
  await copy(false);
  clearSelectionPixels("cut");
}

export function clearSelectionPixels(label = "clear") {
  editPixels(label, (img) => {
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 0;
  });
}

/** Pastes an image (system clipboard first, then the in-app one) as a new layer. */
export async function paste(inPlace = false, image?: Blob) {
  let canvas: HTMLCanvasElement | null = null;
  let x = 0;
  let y = 0;
  const d = doc();
  if (image) {
    const { fileToCanvas } = await import("./storage");
    canvas = await fileToCanvas(image);
  } else if (clipboard) {
    canvas = copyCanvas(clipboard.canvas);
    x = clipboard.x;
    y = clipboard.y;
  }
  if (!canvas) return;
  if (!inPlace || image) {
    x = Math.round((d.width - canvas.width) / 2);
    y = Math.round((d.height - canvas.height) / 2);
  }
  const layer = newLayer("pixel", nextName("Layer"), { x, y });
  setPixels(layer.id, { canvas, mask: null });
  transact("paste", [], (dr) => insertAbove(dr, layer));
  set({ activeId: layer.id, maskEdit: false });
}

export type FillWith =
  "foreground" | "background" | "black" | "white" | "gray" | "contentAware" | { color: string };

export function fill(what: FillWith, opacity = 1) {
  const s = get();
  if (what === "contentAware") {
    contentAwareFillSelection();
    return;
  }
  const color =
    typeof what === "object"
      ? what.color
      : what === "foreground"
        ? s.fg
        : what === "background"
          ? s.bg
          : what === "black"
            ? "#000000"
            : what === "white"
              ? "#FFFFFF"
              : "#808080";
  const [r, g, b] = hexToRgb(color);
  editPixels("fill", (img) => {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i]! + (r - d[i]!) * opacity;
      d[i + 1] = d[i + 1]! + (g - d[i + 1]!) * opacity;
      d[i + 2] = d[i + 2]! + (b - d[i + 2]!) * opacity;
      d[i + 3] = d[i + 3]! + (255 - d[i + 3]!) * opacity;
    }
  });
}

export function contentAwareFillSelection() {
  const s = get().selection;
  if (!s) return;
  editPixels("contentAwareFill", (img, origin) => {
    const hole = new Uint8Array(img.width * img.height);
    const m = selectionIn(origin.x, origin.y, img.width, img.height)!;
    for (let i = 0; i < hole.length; i++) hole[i] = m[i]! > 20 ? 1 : 0;
    contentAwareFill(img, hole);
  });
}

export function strokeSelection(
  width: number,
  color: string,
  position: "inside" | "center" | "outside",
) {
  const s = get().selection;
  if (!s) return;
  const band =
    position === "outside"
      ? sel.combine(sel.expand(s, width), s, "subtract")
      : position === "inside"
        ? sel.combine(s, sel.expand(s, -width), "subtract")
        : sel.border(s, width);
  const [r, g, b] = hexToRgb(color);
  const layer = activeLayer();
  if (!layer || layer.kind === "adjustment") return;
  // Stroke ignores the selection limit (it's drawn around it).
  const saved = get().selection;
  set({ selection: band });
  editPixels("stroke", (img) => {
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  });
  set({ selection: saved });
}

// ─── Transform ───────────────────────────────────────────────────────────────

export function startTransform(mode: TransformMode = "free") {
  const layer = activeLayer();
  if (
    !layer ||
    layer.kind === "adjustment" ||
    layer.kind === "group" ||
    layer.locks.position ||
    layer.locks.all
  )
    return;
  const p = getPixels(layer.id);
  const t: NonNullable<ReturnType<typeof get>["transform"]> = {
    layerId: layer.id,
    original: { x: layer.x, y: layer.y, canvas: copyCanvas(p.canvas) },
    x: layer.x,
    y: layer.y,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    mode: "free",
    quad: null,
    mesh: null,
  };
  set({ transform: convertTransform(t, mode) });
}

/** Options bar / Edit → Transform: switch between free, skew, distort, perspective and warp. */
export function setTransformMode(mode: TransformMode) {
  const t = get().transform;
  if (!t) return startTransform(mode);
  if (t.mode === mode) return;
  if (mode === "free") {
    // A distorted shape has no free-transform box: apply it and start again.
    commitTransform();
    startTransform("free");
    return;
  }
  if (t.mode === "warp") {
    commitTransform();
    startTransform(mode);
    return;
  }
  set({ transform: convertTransform(t, mode) });
}

/** The transformed picture and its new top-left (preview quality unless `final`). */
export function transformed(t: NonNullable<ReturnType<typeof get>["transform"]>, final = false) {
  return renderTransform(t, final);
}

export function commitTransform() {
  const t = get().transform;
  if (!t) return;
  const layer = layerById(doc(), t.layerId);
  set({ transform: null, overrides: null });
  if (!layer || isIdentity(t)) return;
  const result = renderTransform(t, true);
  transact("transform", [layer.id], (d) => {
    const dl = layerById(d, layer.id)!;
    if (
      dl.kind === "text" &&
      t.mode === "free" &&
      t.rotation === 0 &&
      t.scaleX === t.scaleY &&
      t.scaleX > 0
    ) {
      dl.text = { ...dl.text, size: dl.text.size * t.scaleX, width: dl.text.width * t.scaleX };
      dl.x = t.x;
      dl.y = t.y;
      refreshLayer(dl, d);
      return;
    }
    rasterizeInDraft(d, layer.id);
    const p = getPixels(layer.id);
    p.canvas = result.canvas;
    const nl = layerById(d, layer.id)!;
    nl.x = result.x;
    nl.y = result.y;
  });
}

export function cancelTransform() {
  set({ transform: null, overrides: null, rev: get().rev + 1 });
}

/** Rotates or flips the active layer around its centre. */
export function transformLayer(op: "rotate90" | "rotate180" | "rotate-90" | "flipH" | "flipV") {
  const layer = activeLayer();
  if (!layer || layer.kind === "adjustment" || layer.kind === "group") return;
  transact("transform", [layer.id], (d) => {
    rasterizeInDraft(d, layer.id);
    const p = getPixels(layer.id);
    const src = p.canvas;
    const swap = op === "rotate90" || op === "rotate-90";
    const out = createCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
    const g = ctx2d(out);
    g.translate(out.width / 2, out.height / 2);
    if (op === "rotate90") g.rotate(Math.PI / 2);
    if (op === "rotate-90") g.rotate(-Math.PI / 2);
    if (op === "rotate180") g.rotate(Math.PI);
    if (op === "flipH") g.scale(-1, 1);
    if (op === "flipV") g.scale(1, -1);
    g.drawImage(src, -src.width / 2, -src.height / 2);
    const l = layerById(d, layer.id)!;
    const cx = l.x + src.width / 2;
    const cy = l.y + src.height / 2;
    p.canvas = out;
    l.x = Math.round(cx - out.width / 2);
    l.y = Math.round(cy - out.height / 2);
  });
}

// ─── Image ───────────────────────────────────────────────────────────────────

/** Image → Adjustments: applies an adjustment to the active layer's pixels. */
export function applyAdjustmentToPixels(adj: Adjustment) {
  editPixels(adj.type, (img) => applyAdjustment(img, adj));
}

export function auto(mode: "tone" | "contrast" | "color") {
  editPixels(`auto_${mode}`, (img) => autoLevels(img, mode));
}

let filterSeed = 1;
export function applyFilter(id: string, params: Params) {
  const def = FILTER_BY_ID.get(id);
  if (!def) return;
  const s = get();
  editPixels(id, (img) => def.apply(img, params, { fg: s.fg, bg: s.bg, seed: filterSeed++ }));
  set({ lastFilter: { id, params } });
}

/** The filtered active layer without committing (dialog preview). */
export function previewFilter(id: string, params: Params): boolean {
  const def = FILTER_BY_ID.get(id);
  const layer = activeLayer();
  if (!def || !layer || layer.kind === "adjustment" || layer.kind === "group") return false;
  const s = get();
  const p = getPixels(layer.id);
  const img = readImg(p.canvas);
  const before = cloneImg(img);
  def.apply(img, params, { fg: s.fg, bg: s.bg, seed: filterSeed });
  const m = selectionIn(layer.x, layer.y, img.width, img.height);
  if (m) maskMix(before, img, m);
  const c = createCanvas(img.width, img.height);
  writeImg(c, img);
  set({ overrides: new Map([[layer.id, c]]), rev: s.rev + 1 });
  return true;
}

export function clearPreview() {
  set({ overrides: null, adjustmentOverride: null, rev: get().rev + 1 });
}

function resample(src: HTMLCanvasElement, w: number, h: number) {
  const out = createCanvas(w, h);
  const g = ctx2d(out);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  return out;
}

export function imageSize(width: number, height: number, resolution?: number) {
  const d = doc();
  const kx = width / d.width;
  const ky = height / d.height;
  transact("imageSize", "all", (dr) => {
    for (const l of dr.layers) {
      const p = getPixels(l.id);
      if (l.kind === "pixel")
        p.canvas = resample(
          p.canvas,
          Math.max(1, Math.round(p.canvas.width * kx)),
          Math.max(1, Math.round(p.canvas.height * ky)),
        );
      if (p.mask) p.mask = resample(p.mask, Math.round(width), Math.round(height));
      l.x = Math.round(l.x * kx);
      l.y = Math.round(l.y * ky);
      if (l.kind === "text")
        l.text = { ...l.text, size: l.text.size * Math.min(kx, ky), width: l.text.width * kx };
      if (l.kind === "shape")
        l.shape = { ...l.shape, width: l.shape.width * kx, height: l.shape.height * ky };
    }
    dr.width = Math.round(width);
    dr.height = Math.round(height);
    if (resolution) dr.resolution = resolution;
    for (const l of dr.layers) refreshLayer(l, dr);
  });
  set({ selection: null });
}

/** Canvas Size: grows/shrinks the document around an anchor (0–1 each way). */
export function canvasSize(
  width: number,
  height: number,
  anchor: [number, number],
  extension: string | null,
) {
  const d = doc();
  const dx = Math.round((width - d.width) * anchor[0]);
  const dy = Math.round((height - d.height) * anchor[1]);
  transact("canvasSize", "all", (dr) => {
    for (const l of dr.layers) {
      l.x += dx;
      l.y += dy;
      const p = getPixels(l.id);
      if (p.mask) {
        const m = createCanvas(width, height);
        const g = ctx2d(m);
        // New area keeps the mask's edge state: reveal by default.
        g.fillStyle = "#FFFFFF";
        g.fillRect(0, 0, width, height);
        g.clearRect(dx, dy, d.width, d.height);
        g.drawImage(p.mask, dx, dy);
        p.mask = m;
      }
    }
    dr.width = Math.round(width);
    dr.height = Math.round(height);
    const bottom = dr.layers[0];
    if (extension && bottom?.kind === "pixel") {
      ensureCovers(bottom, { x: 0, y: 0, width, height });
      const p = getPixels(bottom.id);
      const g = ctx2d(p.canvas);
      g.globalCompositeOperation = "destination-over";
      g.fillStyle = extension;
      g.fillRect(0, 0, p.canvas.width, p.canvas.height);
      g.globalCompositeOperation = "source-over";
    }
    for (const l of dr.layers) if (l.kind === "fill") refreshLayer(l, dr);
  });
  set({ selection: null });
}

export function rotateCanvas(op: "90" | "-90" | "180" | "flipH" | "flipV") {
  const d = doc();
  const swap = op === "90" || op === "-90";
  const W = swap ? d.height : d.width;
  const H = swap ? d.width : d.height;
  const mapCanvas = (src: HTMLCanvasElement, x: number, y: number) => {
    // Place on the full document first, then turn the whole document.
    const full = createCanvas(d.width, d.height);
    ctx2d(full).drawImage(src, x, y);
    const out = createCanvas(W, H);
    const g = ctx2d(out);
    g.translate(W / 2, H / 2);
    if (op === "90") g.rotate(Math.PI / 2);
    if (op === "-90") g.rotate(-Math.PI / 2);
    if (op === "180") g.rotate(Math.PI);
    if (op === "flipH") g.scale(-1, 1);
    if (op === "flipV") g.scale(1, -1);
    g.drawImage(full, -d.width / 2, -d.height / 2);
    return out;
  };
  transact("rotateCanvas", "all", (dr) => {
    for (const l of dr.layers) {
      const p = getPixels(l.id);
      if (l.kind === "pixel") {
        p.canvas = mapCanvas(p.canvas, l.x, l.y);
        l.x = 0;
        l.y = 0;
      } else if (l.kind === "text" || l.kind === "shape") {
        // Move vector layers' centres; they stay upright.
        const cx = l.x + p.canvas.width / 2;
        const cy = l.y + p.canvas.height / 2;
        const [nx, ny] =
          op === "90"
            ? [d.height - cy, cx]
            : op === "-90"
              ? [cy, d.width - cx]
              : op === "180"
                ? [d.width - cx, d.height - cy]
                : op === "flipH"
                  ? [d.width - cx, cy]
                  : [cx, d.height - cy];
        l.x = Math.round(nx - p.canvas.width / 2);
        l.y = Math.round(ny - p.canvas.height / 2);
      }
      if (p.mask) p.mask = mapCanvas(p.mask, 0, 0);
    }
    dr.width = W;
    dr.height = H;
    for (const l of dr.layers) if (l.kind === "fill") refreshLayer(l, dr);
  });
  set({ selection: null });
}

export function crop(
  rect: { x: number; y: number; width: number; height: number },
  deletePixels = true,
) {
  const r = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
  transact("crop", "all", (dr) => {
    for (const l of dr.layers) {
      const p = getPixels(l.id);
      l.x -= r.x;
      l.y -= r.y;
      if (l.kind === "pixel" && deletePixels) {
        const c = createCanvas(r.width, r.height);
        ctx2d(c).drawImage(p.canvas, l.x, l.y);
        p.canvas = c;
        l.x = 0;
        l.y = 0;
      }
      if (p.mask) {
        const m = createCanvas(r.width, r.height);
        ctx2d(m).drawImage(p.mask, -r.x, -r.y);
        p.mask = m;
      }
    }
    dr.width = r.width;
    dr.height = r.height;
    dr.guides = { horizontal: [], vertical: [] };
    for (const l of dr.layers) if (l.kind === "fill") refreshLayer(l, dr);
  });
  set({ selection: null });
}

export function cropToSelection() {
  const s = get().selection;
  const b = s ? sel.maskBounds(s) : null;
  if (b) crop(b);
}

export function trim(basedOn: "transparent" | "topLeft") {
  const img = readImg(flatten(doc()));
  const { width: w, height: h, data } = img;
  const ref = [data[0]!, data[1]!, data[2]!, data[3]!];
  const keep = (i: number) =>
    basedOn === "transparent"
      ? data[i + 3]! > 0
      : Math.max(
          Math.abs(data[i]! - ref[0]!),
          Math.abs(data[i + 1]! - ref[1]!),
          Math.abs(data[i + 2]! - ref[2]!),
          Math.abs(data[i + 3]! - ref[3]!),
        ) > 2;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (keep((y * w + x) * 4)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 >= 0) crop({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
}

export function revealAll() {
  const d = doc();
  let x0 = 0;
  let y0 = 0;
  let x1 = d.width;
  let y1 = d.height;
  for (const l of d.layers) {
    if (l.kind !== "pixel") continue;
    const p = getPixels(l.id);
    x0 = Math.min(x0, l.x);
    y0 = Math.min(y0, l.y);
    x1 = Math.max(x1, l.x + p.canvas.width);
    y1 = Math.max(y1, l.y + p.canvas.height);
  }
  if (x0 === 0 && y0 === 0 && x1 === d.width && y1 === d.height) return;
  crop({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, false);
}

export function grayscaleMode() {
  transact("grayscale", "all", (dr) => {
    for (const l of dr.layers) {
      if (l.kind !== "pixel") continue;
      const p = getPixels(l.id);
      const img = readImg(p.canvas);
      applyAdjustment(img, { type: "desaturate" });
      writeImg(p.canvas, img);
    }
    dr.grayscale = true;
  });
}

// ─── Guides ──────────────────────────────────────────────────────────────────

export function addGuide(axis: "horizontal" | "vertical", at: number) {
  transact("guide", [], (d) => {
    d.guides[axis] = [...d.guides[axis], Math.round(at)];
  });
}

export function clearGuides() {
  transact("guide", [], (d) => {
    d.guides = { horizontal: [], vertical: [] };
  });
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function exportImage(format: "png" | "jpeg" | "webp", quality: number, scale: number) {
  const d = doc();
  const flat = flatten(d, format === "jpeg" ? "#FFFFFF" : null);
  const out =
    scale === 1 ? flat : resample(flat, Math.round(d.width * scale), Math.round(d.height * scale));
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, `image/${format}`, quality));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${d.name || "photo"}.${format === "jpeg" ? "jpg" : format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/** Places an image file as a new layer (File → Place). */
export async function placeFile(file: Blob) {
  await paste(false, file);
}

export { composite };

/** Alt-click on the eye: show only this layer (or everything again). */
export function soloLayer(id: string) {
  transact("visibility", [], (d) => {
    const keep = (l: Layer) =>
      tree.isInside(d.layers, id, l.id) || tree.isInside(d.layers, l.id, id);
    const solo = d.layers.every((l) => keep(l) || !l.visible);
    for (const l of d.layers) l.visible = keep(l) ? true : solo;
  });
}

/** Mask properties: invert or soften the active layer's mask. */
export function editMask(op: "invert" | "feather", amount = 0) {
  const layer = activeLayer();
  if (!layer?.mask) return;
  transact(op === "invert" ? "invertMask" : "featherMask", [layer.id], () => {
    const p = getPixels(layer.id);
    if (!p.mask) return;
    const img = readImg(p.mask);
    if (op === "invert")
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255 - img.data[i]!;
    else {
      const m = sel.emptyMask(img.width, img.height);
      for (let i = 0; i < m.data.length; i++) m.data[i] = img.data[i * 4 + 3]!;
      const f = sel.feather(m, amount);
      for (let i = 0; i < f.data.length; i++) img.data[i * 4 + 3] = f.data[i]!;
    }
    writeImg(p.mask, img);
  });
}

/** Sets an adjustment layer's settings (one undo step). */
export function setAdjustment(id: string, adjustment: Adjustment) {
  transact("adjustLayer", [id], (d) => {
    const l = layerById(d, id);
    if (l?.kind === "adjustment") l.adjustment = adjustment;
  });
}

/** Image → Adjustments preview on the active layer (dialog open). */
export function previewAdjustment(adj: Adjustment): boolean {
  const layer = activeLayer();
  if (!layer || layer.kind === "adjustment" || layer.kind === "group") return false;
  const p = getPixels(layer.id);
  const img = readImg(p.canvas);
  const before = cloneImg(img);
  applyAdjustment(img, adj);
  const m = selectionIn(layer.x, layer.y, img.width, img.height);
  if (m) maskMix(before, img, m);
  const c = createCanvas(img.width, img.height);
  writeImg(c, img);
  set({ overrides: new Map([[layer.id, c]]), rev: get().rev + 1 });
  return true;
}

/** Layer Style dialog: sets every effect at once (one undo step). */
export function setStyles(id: string, styles: Layer["styles"]) {
  transact("layerStyle", [id], (d) => {
    const l = layerById(d, id);
    if (l) l.styles = styles;
  });
}

/** Adds a finished picture as a new layer (Generative Fill results). */
export function addPictureLayer(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  name: string,
  mask: HTMLCanvasElement | null,
  label = "generativeFill",
) {
  const layer = newLayer("pixel", name.slice(0, 80), {
    x: Math.round(x),
    y: Math.round(y),
    mask: mask ? { enabled: true } : null,
  });
  setPixels(layer.id, { canvas, mask });
  transact(label, [], (d) => insertAbove(d, layer));
  set({ activeId: layer.id, maskEdit: false });
  return layer.id;
}

/** Box of a layer's non-transparent pixels in document coordinates (null if empty). */
export function contentBounds(
  layer: Layer,
): { x: number; y: number; width: number; height: number } | null {
  if (layer.kind === "adjustment") return null;
  if (layer.kind === "group") {
    let box: ReturnType<typeof contentBounds> = null;
    for (const l of tree.descendantsOf(doc().layers, layer.id)) {
      const b = contentBounds(l);
      if (!b) continue;
      if (!box) box = { ...b };
      else {
        const x1 = Math.max(box.x + box.width, b.x + b.width);
        const y1 = Math.max(box.y + box.height, b.y + b.height);
        box.x = Math.min(box.x, b.x);
        box.y = Math.min(box.y, b.y);
        box.width = x1 - box.x;
        box.height = y1 - box.y;
      }
    }
    return box;
  }
  const c = getPixels(layer.id).canvas;
  const img = readImg(c);
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (img.data[(y * c.width + x) * 4 + 3]! > 0) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  return { x: layer.x + x0, y: layer.y + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Moves a layer — or every layer inside a group — by (dx, dy) as one step. */
export function offsetLayer(id: string, dx: number, dy: number, label = "move") {
  if (!dx && !dy) return;
  const ids = tree
    .blockOf(doc().layers, id)
    .filter((l) => l.kind !== "group" && l.kind !== "adjustment" && l.kind !== "fill")
    .map((l) => l.id);
  transact(label, ids, (d) => {
    for (const l of d.layers)
      if (ids.includes(l.id)) {
        l.x += dx;
        l.y += dy;
      }
  });
}

/** Layer → Align to the canvas (uses the visible pixels; groups use everything inside). */
export function alignLayer(how: "left" | "centerH" | "right" | "top" | "middle" | "bottom") {
  const layer = activeLayer();
  if (!layer || layer.kind === "adjustment" || layer.locks.position || layer.locks.all) return;
  const d = doc();
  const b = contentBounds(layer);
  if (!b) return;
  let dx = 0;
  let dy = 0;
  if (how === "left") dx = -b.x;
  if (how === "centerH") dx = Math.round((d.width - b.width) / 2) - b.x;
  if (how === "right") dx = d.width - b.width - b.x;
  if (how === "top") dy = -b.y;
  if (how === "middle") dy = Math.round((d.height - b.height) / 2) - b.y;
  if (how === "bottom") dy = d.height - b.height - b.y;
  offsetLayer(layer.id, dx, dy, "align");
}

/** Image → Duplicate: a copy of the whole document, saved as a new photo. */
export async function duplicateDocument(name: string): Promise<string> {
  const { createId } = await import("@/lib/id");
  const { savePhoto } = await import("./storage");
  const copy: PhotoDoc = { ...structuredClone(doc()), id: createId(), name: name.slice(0, 120) };
  // Layer ids can repeat across documents: each one loads into its own registry.
  await savePhoto(copy);
  return copy.id;
}

// ─── Paths ───────────────────────────────────────────────────────────────────

export const activePath = (): PhotoPath | null => {
  const s = get();
  return s.doc?.paths?.find((p) => p.id === s.activePathId) ?? null;
};

export function newPath(name?: string) {
  const id = newLayer("pixel", "").id;
  const n = (doc().paths?.length ?? 0) + 1;
  transact("newPath", [], (d) => {
    d.paths = [...(d.paths ?? []), { id, name: name ?? `Path ${n}`, subpaths: [] }];
  });
  set({ activePathId: id });
  return id;
}

export function deletePath(id = get().activePathId) {
  if (!id) return;
  transact("deletePath", [], (d) => {
    d.paths = (d.paths ?? []).filter((p) => p.id !== id);
  });
  set({ activePathId: null });
}

export function renamePath(id: string, name: string) {
  transact("renamePath", [], (d) => {
    const p = d.paths?.find((x) => x.id === id);
    if (p) p.name = name.slice(0, 80);
  });
}

/** A path drawn into a document-size canvas (filled or stroked). */
function pathCanvas(path: PhotoPath, how: "fill" | "stroke", color: string, width = 1) {
  const d = doc();
  const c = createCanvas(d.width, d.height);
  const g = ctx2d(c);
  const p2 = new Path2D(pathD(path));
  if (how === "fill") {
    g.fillStyle = color;
    g.fill(p2, "nonzero");
  } else {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, width);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.stroke(p2);
  }
  return c;
}

/** Paths panel: load the path as a selection (Ctrl+Enter with the pen tools). */
export function pathToSelection(mode: sel.CombineMode = "new") {
  const path = activePath();
  if (!path || !path.subpaths.some((sp) => sp.points.length > 2)) return;
  const img = readImg(pathCanvas(path, "fill", "#FFFFFF"));
  const m = sel.emptyMask(img.width, img.height);
  for (let i = 0; i < m.data.length; i++) m.data[i] = img.data[i * 4 + 3]!;
  let mask = m;
  if (get().options.feather) mask = sel.feather(mask, get().options.feather);
  setSelection(mask, mode, "pathToSelection");
}

/** Paths panel: fill the path with the foreground colour, or stroke it with the brush size. */
export function paintPath(how: "fill" | "stroke") {
  const path = activePath();
  if (!path) return;
  const s = get();
  const c = pathCanvas(path, how, s.fg, s.options.size);
  const painted = readImg(c);
  editPixels(how === "fill" ? "fillPath" : "strokePath", (img, origin) => {
    const op = s.options.opacity;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const dx = x + origin.x;
        const dy = y + origin.y;
        if (dx < 0 || dy < 0 || dx >= painted.width || dy >= painted.height) continue;
        const j = (dy * painted.width + dx) * 4;
        const k = (painted.data[j + 3]! / 255) * op;
        if (!k) continue;
        const i = (y * img.width + x) * 4;
        const a0 = img.data[i + 3]! / 255;
        const a = k + a0 * (1 - k);
        for (let ch = 0; ch < 3; ch++)
          img.data[i + ch] = (painted.data[j + ch]! * k + img.data[i + ch]! * a0 * (1 - k)) / a;
        img.data[i + 3] = a * 255;
      }
  });
}

/** Select → Make Work Path: turns the selection's outline into a path. */
export function selectionToPath() {
  const m = get().selection;
  if (!m) return;
  const rings = sel
    .outlineRings(m)
    .map((r) => simplify(r, 1))
    .filter((r) => r.length >= 3);
  if (!rings.length) return;
  const id = newLayer("pixel", "").id;
  transact("newPath", [], (d) => {
    d.paths = [
      ...(d.paths ?? []),
      {
        id,
        name: "Work Path",
        subpaths: rings.map((ring) => ({
          closed: true,
          points: ring.map(([x, y]) => ({ x, y, in: null, out: null })),
        })),
      },
    ];
  });
  set({ activePathId: id });
}
