"use client";
/**
 * Photo editor state (Zustand). Document settings live here; pixels live in
 * the runtime registry. Every change goes through `transact`, which records
 * before/after snapshots of the layers it touched, for undo and the History panel.
 */
import { create } from "zustand";
import type { Mask, CombineMode } from "./selection";
import type { BlendMode, GradientKind, PhotoDoc, Pt } from "./types";
import { copyCanvas, getPixels, setPixels } from "./runtime";

export type ToolId =
  | "move"
  | "marqueeRect"
  | "marqueeEllipse"
  | "lasso"
  | "polyLasso"
  | "magicWand"
  | "crop"
  | "eyedropper"
  | "ruler"
  | "spotHeal"
  | "heal"
  | "redEye"
  | "brush"
  | "pencil"
  | "colorReplace"
  | "clone"
  | "historyBrush"
  | "eraser"
  | "magicEraser"
  | "gradient"
  | "bucket"
  | "blur"
  | "sharpen"
  | "smudge"
  | "dodge"
  | "burn"
  | "sponge"
  | "liquify"
  | "type"
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "polygon"
  | "line"
  | "pen"
  | "freeformPen"
  | "pathSelect"
  | "hand"
  | "zoom";

/** Toolbar groups: the first tool shows; the rest open from it. Key = shortcut. */
export const TOOL_GROUPS: { id: string; key: string; tools: ToolId[] }[] = [
  { id: "move", key: "V", tools: ["move"] },
  { id: "marquee", key: "M", tools: ["marqueeRect", "marqueeEllipse"] },
  { id: "lasso", key: "L", tools: ["lasso", "polyLasso"] },
  { id: "wand", key: "W", tools: ["magicWand"] },
  { id: "crop", key: "C", tools: ["crop"] },
  { id: "eyedropper", key: "I", tools: ["eyedropper", "ruler"] },
  { id: "heal", key: "J", tools: ["spotHeal", "heal", "redEye"] },
  { id: "brush", key: "B", tools: ["brush", "pencil", "colorReplace"] },
  { id: "clone", key: "S", tools: ["clone"] },
  { id: "historyBrush", key: "Y", tools: ["historyBrush"] },
  { id: "eraser", key: "E", tools: ["eraser", "magicEraser"] },
  { id: "gradient", key: "G", tools: ["gradient", "bucket"] },
  { id: "blur", key: "R", tools: ["blur", "sharpen", "smudge", "liquify"] },
  { id: "dodge", key: "O", tools: ["dodge", "burn", "sponge"] },
  { id: "type", key: "T", tools: ["type"] },
  { id: "shape", key: "U", tools: ["rectangle", "ellipse", "triangle", "polygon", "line"] },
  { id: "pen", key: "P", tools: ["pen", "freeformPen"] },
  { id: "pathSelect", key: "A", tools: ["pathSelect"] },
  { id: "hand", key: "H", tools: ["hand"] },
  { id: "zoom", key: "Z", tools: ["zoom"] },
];

export interface ToolOptions {
  size: number;
  hardness: number;
  opacity: number;
  flow: number;
  spacing: number;
  brushBlend: BlendMode;
  tolerance: number;
  contiguous: boolean;
  sampleAll: boolean;
  feather: number;
  selectionMode: CombineMode;
  cropRatio: "free" | "1:1" | "4:5" | "3:2" | "16:9" | "original";
  deleteCropped: boolean;
  gradientKind: GradientKind;
  gradientFade: "fgbg" | "fgTransparent";
  strength: number;
  exposure: number;
  range: "shadows" | "midtones" | "highlights";
  spongeMode: "saturate" | "desaturate";
  aligned: boolean;
  sampleSize: 1 | 3 | 5;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  shapeFill: string | null;
  shapeStroke: string | null;
  strokeWidth: number;
  radius: number;
  sides: number;
  liquifyMode: "push" | "pinch" | "bloat" | "restore";
}

export const DEFAULT_OPTIONS: ToolOptions = {
  size: 40,
  hardness: 0.8,
  opacity: 1,
  flow: 1,
  spacing: 0.15,
  brushBlend: "normal",
  tolerance: 32,
  contiguous: true,
  sampleAll: false,
  feather: 0,
  selectionMode: "new",
  cropRatio: "free",
  deleteCropped: true,
  gradientKind: "linear",
  gradientFade: "fgbg",
  strength: 0.5,
  exposure: 0.5,
  range: "midtones",
  spongeMode: "desaturate",
  aligned: true,
  sampleSize: 1,
  fontFamily: "Inter",
  fontSize: 72,
  fontWeight: 700,
  shapeFill: "#3A2E8F",
  shapeStroke: null,
  strokeWidth: 4,
  radius: 0,
  sides: 6,
  liquifyMode: "push",
};

export type PanelId =
  | "layers"
  | "adjustments"
  | "properties"
  | "history"
  | "color"
  | "swatches"
  | "navigator"
  | "histogram"
  | "info"
  | "character"
  | "paths";

export interface Snapshot {
  doc: PhotoDoc;
  pixels: Map<string, { canvas: HTMLCanvasElement; mask: HTMLCanvasElement | null }>;
  selection: Mask | null;
}

export interface HistoryEntry {
  /** Translation key under photo.history. */
  label: string;
  before: Snapshot;
  after: Snapshot;
}

export type DialogState =
  | { type: "filter"; id: string }
  | { type: "adjustment"; adjustment: string; target: "layer" | "pixels" }
  | { type: "imageSize" }
  | { type: "canvasSize" }
  | { type: "newDocument" }
  | { type: "export" }
  | { type: "fill" }
  | { type: "stroke" }
  | { type: "modify"; op: "expand" | "contract" | "feather" | "border" | "smooth" }
  | { type: "colorRange" }
  | { type: "generativeFill" }
  | { type: "layerStyle"; layerId: string }
  | { type: "newGuide" }
  | { type: "shortcuts" };

export type TransformMode = "free" | "skew" | "distort" | "perspective" | "warp";

export interface TransformState {
  mode: TransformMode;
  /** Corners (top-left, top-right, bottom-right, bottom-left) for skew/distort/perspective. */
  quad: Pt[] | null;
  /** 16 Bézier control points (4 × 4, row by row) for warp. */
  mesh: Pt[] | null;
  layerId: string;
  /** Original placement, for cancel. */
  original: { x: number; y: number; canvas: HTMLCanvasElement };
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface PhotoState {
  doc: PhotoDoc | null;
  /** Bumped whenever pixels change (redraw the canvas). */
  rev: number;
  activeId: string | null;
  /** Layers picked in the Layers panel (Ctrl/Shift-click); includes the active one. */
  selectedIds: string[];
  /** The path shown and edited by the pen tools. */
  activePathId: string | null;
  tool: ToolId;
  /** Tool shown for each toolbar group. */
  groupTool: Record<string, ToolId>;
  options: ToolOptions;
  fg: string;
  bg: string;
  swatches: string[];
  selection: Mask | null;
  lastSelection: Mask | null;
  savedSelection: Mask | null;
  quickMask: boolean;
  /** Paint on the active layer's mask instead of its pixels. */
  maskEdit: boolean;
  zoom: number;
  pan: { x: number; y: number };
  view: { rulers: boolean; grid: boolean; guides: boolean; snap: boolean; edges: boolean };
  panels: Record<PanelId, boolean>;
  /** The tab shown in each panel group of the dock. */
  panelTabs: Record<string, PanelId>;
  hidePanels: boolean;
  history: HistoryEntry[];
  /** How many history entries are applied (the rest can be redone). */
  historyIndex: number;
  dirty: boolean;
  /** Live previews: layer id → canvas shown instead of its content. */
  overrides: Map<string, HTMLCanvasElement> | null;
  adjustmentOverride: { layerId: string; adjustment: unknown } | null;
  dialog: DialogState | null;
  transform: TransformState | null;
  cursor: { x: number; y: number; rgba: [number, number, number, number] | null } | null;
  /** The image as it was opened (for the history brush). */
  original: HTMLCanvasElement | null;
  busy: string | null;
  /** Filter → Last Filter. */
  lastFilter: { id: string; params: Record<string, number | string | boolean> } | null;
}

export const usePhoto = create<PhotoState>(() => ({
  doc: null,
  rev: 0,
  activeId: null,
  selectedIds: [],
  activePathId: null,
  tool: "brush",
  groupTool: Object.fromEntries(TOOL_GROUPS.map((g) => [g.id, g.tools[0]!])),
  options: DEFAULT_OPTIONS,
  fg: "#000000",
  bg: "#FFFFFF",
  swatches: [
    "#000000",
    "#FFFFFF",
    "#FF3B30",
    "#FF9500",
    "#FFCC00",
    "#34C759",
    "#00C7BE",
    "#007AFF",
    "#5856D6",
    "#AF52DE",
    "#FF2D55",
    "#A2845E",
    "#8E8E93",
    "#3A2E8F",
    "#F72585",
    "#FF7A3D",
  ],
  selection: null,
  lastSelection: null,
  savedSelection: null,
  quickMask: false,
  maskEdit: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  view: { rulers: true, grid: false, guides: true, snap: true, edges: true },
  panels: {
    layers: true,
    adjustments: true,
    properties: true,
    history: true,
    color: true,
    swatches: true,
    navigator: true,
    histogram: true,
    info: true,
    character: true,
    paths: true,
  },
  panelTabs: { top: "color", middle: "properties", bottom: "layers" },
  hidePanels: false,
  history: [],
  historyIndex: 0,
  dirty: false,
  overrides: null,
  adjustmentOverride: null,
  dialog: null,
  transform: null,
  cursor: null,
  original: null,
  busy: null,
  lastFilter: null,
}));

export const get = () => usePhoto.getState();
export const set = usePhoto.setState;

export const MAX_HISTORY = 40;

/** Copies of the touched layers' pixels plus the document settings. */
export function snapshot(ids: string[] | "all"): Snapshot {
  const s = get();
  const doc = structuredClone(s.doc!);
  const list = ids === "all" ? doc.layers.map((l) => l.id) : ids;
  const pixels = new Map<string, { canvas: HTMLCanvasElement; mask: HTMLCanvasElement | null }>();
  for (const id of list) {
    const p = getPixels(id);
    pixels.set(id, { canvas: copyCanvas(p.canvas), mask: p.mask ? copyCanvas(p.mask) : null });
  }
  return { doc, pixels, selection: s.selection };
}

let changedLayers: Set<string> | "all" = new Set();

/** Remembers layers whose pixels changed (so a save re-encodes only those). */
export function noteChanged(ids: Iterable<string> | "all") {
  if (changedLayers === "all") return;
  if (ids === "all") {
    changedLayers = "all";
    return;
  }
  for (const id of ids) changedLayers.add(id);
}

/** The layers changed since the last call ("all" = assume everything). */
export function takeChanged(): Set<string> | "all" {
  const c = changedLayers;
  changedLayers = new Set();
  return c;
}

export function restore(snap: Snapshot) {
  noteChanged(snap.pixels.keys());
  for (const [id, p] of snap.pixels)
    setPixels(id, { canvas: copyCanvas(p.canvas), mask: p.mask ? copyCanvas(p.mask) : null });
  const doc = structuredClone(snap.doc);
  const activeId = doc.layers.some((l) => l.id === get().activeId)
    ? get().activeId
    : (doc.layers[doc.layers.length - 1]?.id ?? null);
  set({ doc, selection: snap.selection, activeId, rev: get().rev + 1, dirty: true });
}

/**
 * Runs a change as one undo step. `fn` may mutate the draft document and
 * the pixels of `ids` (and create new layers, which are captured afterwards).
 */
export function transact(label: string, ids: string[] | "all", fn: (doc: PhotoDoc) => void) {
  const s = get();
  if (!s.doc) return;
  const before = snapshot(ids);
  const draft = structuredClone(s.doc);
  fn(draft);
  set({ doc: draft });
  // Capture the touched layers plus any the change created.
  const created = draft.layers
    .map((l) => l.id)
    .filter((id) => !s.doc!.layers.some((l) => l.id === id));
  const after = snapshot(ids === "all" ? "all" : [...ids, ...created]);
  noteChanged(ids === "all" ? "all" : [...ids, ...created]);
  for (const id of created)
    if (!before.pixels.has(id)) before.pixels.set(id, after.pixels.get(id)!);
  const history = [...s.history.slice(0, s.historyIndex), { label, before, after }].slice(
    -MAX_HISTORY,
  );
  set({ history, historyIndex: history.length, rev: get().rev + 1, dirty: true });
}

/** Records a change that already happened (strokes: `before` taken at the start). */
export function commit(label: string, before: Snapshot) {
  const s = get();
  const after = snapshot([...before.pixels.keys()]);
  noteChanged(before.pixels.keys());
  const history = [...s.history.slice(0, s.historyIndex), { label, before, after }].slice(
    -MAX_HISTORY,
  );
  set({ history, historyIndex: history.length, rev: s.rev + 1, dirty: true });
}

export function undo() {
  const s = get();
  if (s.historyIndex <= 0 || s.transform) return;
  restore(s.history[s.historyIndex - 1]!.before);
  set({ historyIndex: s.historyIndex - 1 });
}

export function redo() {
  const s = get();
  if (s.historyIndex >= s.history.length) return;
  restore(s.history[s.historyIndex]!.after);
  set({ historyIndex: s.historyIndex + 1 });
}

/** Jumps to a history state (0 = as opened). */
export function goToHistory(index: number) {
  while (get().historyIndex > index) undo();
  while (get().historyIndex < index) redo();
}

export const activeLayer = () => {
  const s = get();
  return s.doc?.layers.find((l) => l.id === s.activeId) ?? null;
};
