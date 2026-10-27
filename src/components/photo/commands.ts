"use client";
/**
 * Every menu command with its shortcut, shared by the menu bar, the
 * keyboard handler and the shortcuts dialog. Labels come from photo.cmd.<id>.
 */
import { ADJUSTMENT_TYPES } from "@/lib/photo/adjustments";
import * as A from "@/lib/photo/actions";
import { defaultParams, FILTER_BY_ID } from "@/lib/photo/filters";
import { saveNow } from "@/lib/photo/session";
import { docFromFile, savePhoto } from "@/lib/photo/storage";
import {
  activeLayer,
  get,
  goToHistory,
  redo,
  set,
  undo,
  usePhoto,
  type DialogState,
  type PanelId,
} from "@/lib/photo/store";
import { selectTool, toggleQuickMask, zoomAt } from "@/lib/photo/tools";
import type { AdjustmentType } from "@/lib/photo/types";
import { startTour } from "./tour/tour";
import { fitOnScreen } from "./viewport";

export interface Command {
  run: () => void;
  /** "Mod" = Ctrl (Windows/Linux) or ⌘ (Mac). */
  keys?: string;
  enabled?: () => boolean;
  checked?: () => boolean;
}

let navigate: (href: string) => void = (href) => window.location.assign(href);
export const setNavigator = (fn: (href: string) => void) => {
  navigate = fn;
};

const dialog = (d: DialogState) => () => set({ dialog: d });
const hasDoc = () => Boolean(get().doc);
const hasSelection = () => Boolean(get().selection);
const hasLayer = () => Boolean(activeLayer());
/** A layer with pixels of its own (not an adjustment layer or a group). */
const pixelish = () => {
  const l = activeLayer();
  return Boolean(l && l.kind !== "adjustment" && l.kind !== "group");
};
/** Anything effects can go on (groups included). */
const styleable = () => {
  const l = activeLayer();
  return Boolean(l && l.kind !== "adjustment");
};
const isGroup = () => activeLayer()?.kind === "group";
const hasPath = () => Boolean(A.activePath());
const hasMask = () => Boolean(activeLayer()?.mask);
const toggleView = (key: keyof ReturnType<typeof get>["view"]) => () =>
  set({ view: { ...get().view, [key]: !get().view[key] } });

/** Opens a file picker for images. */
export function pickImage(onFile: (file: File) => void, multiple = false) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif";
  input.multiple = multiple;
  input.onchange = () => {
    for (const f of Array.from(input.files ?? [])) onFile(f);
  };
  input.click();
}

export async function openImageFile(file: File) {
  const doc = await docFromFile(file);
  await savePhoto(doc);
  navigate(`/photo/${doc.id}`);
}

/** Runs a filter: straight away when it has no settings, else opens its dialog. */
export function runFilter(id: string) {
  const def = FILTER_BY_ID.get(id);
  if (!def) return;
  if (id === "develop") {
    set({ dialog: { type: "adjustment", adjustment: "develop", target: "pixels" } });
    return;
  }
  if (!def.params.length) A.applyFilter(id, defaultParams(def));
  else set({ dialog: { type: "filter", id } });
}

export const COMMANDS = {
  // File
  newDoc: { run: dialog({ type: "newDocument" }), keys: "Mod+N" },
  open: { run: () => pickImage((f) => void openImageFile(f)), keys: "Mod+O" },
  place: {
    run: () => pickImage((f) => void A.placeFile(f), true),
    enabled: hasDoc,
    keys: "Mod+Shift+P",
  },
  save: { run: () => void saveNow({ final: true }), keys: "Mod+S", enabled: hasDoc },
  exportAs: { run: dialog({ type: "export" }), keys: "Mod+Shift+Alt+W", enabled: hasDoc },
  quickExport: {
    run: () => void A.exportImage("png", 1, 1),
    keys: "Mod+Shift+Alt+E",
    enabled: hasDoc,
  },
  close: {
    run: () => {
      void saveNow({ final: true }).then(() => navigate("/photo"));
    },
    keys: "Mod+W",
  },
  home: { run: () => void saveNow({ final: true }).then(() => navigate("/")) },
  revert: { run: () => goToHistory(0), keys: "F12", enabled: () => get().historyIndex > 0 },

  // Edit
  undo: { run: undo, keys: "Mod+Z", enabled: () => get().historyIndex > 0 },
  redo: {
    run: redo,
    keys: "Mod+Shift+Z",
    enabled: () => get().historyIndex < get().history.length,
  },
  stepBackward: { run: undo, keys: "Mod+Alt+Z", enabled: () => get().historyIndex > 0 },
  cut: { run: () => void A.cut(), keys: "Mod+X", enabled: pixelish },
  copy: { run: () => void A.copy(false), keys: "Mod+C", enabled: pixelish },
  copyMerged: { run: () => void A.copy(true), keys: "Mod+Shift+C", enabled: hasDoc },
  paste: { run: () => void A.paste(false), keys: "Mod+V", enabled: hasDoc },
  pasteInPlace: { run: () => void A.paste(true), keys: "Mod+Shift+V", enabled: hasDoc },
  clear: { run: () => A.clearSelectionPixels(), keys: "Delete", enabled: pixelish },
  fill: { run: dialog({ type: "fill" }), keys: "Shift+F5", enabled: pixelish },
  stroke: { run: dialog({ type: "stroke" }), enabled: hasSelection },
  contentAwareFill: { run: A.contentAwareFillSelection, enabled: hasSelection },
  generativeFill: { run: dialog({ type: "generativeFill" }), enabled: hasDoc },
  freeTransform: { run: () => A.startTransform(), keys: "Mod+T", enabled: pixelish },
  skew: { run: () => A.setTransformMode("skew"), enabled: pixelish },
  distort: { run: () => A.setTransformMode("distort"), enabled: pixelish },
  perspective: { run: () => A.setTransformMode("perspective"), enabled: pixelish },
  warp: { run: () => A.setTransformMode("warp"), enabled: pixelish },
  flipLayerH: { run: () => A.transformLayer("flipH"), enabled: pixelish },
  flipLayerV: { run: () => A.transformLayer("flipV"), enabled: pixelish },
  rotateLayerCw: { run: () => A.transformLayer("rotate90"), enabled: pixelish },
  rotateLayerCcw: { run: () => A.transformLayer("rotate-90"), enabled: pixelish },
  rotateLayer180: { run: () => A.transformLayer("rotate180"), enabled: pixelish },
  shortcuts: { run: dialog({ type: "shortcuts" }), keys: "Mod+Shift+Alt+K" },
  tutorial: { run: () => startTour(), keys: "F1" },

  // Image
  grayscale: {
    run: A.grayscaleMode,
    enabled: hasDoc,
    checked: () => Boolean(get().doc?.grayscale),
  },
  autoTone: { run: () => A.auto("tone"), keys: "Mod+Shift+L", enabled: pixelish },
  autoContrast: { run: () => A.auto("contrast"), keys: "Mod+Shift+Alt+L", enabled: pixelish },
  autoColor: { run: () => A.auto("color"), keys: "Mod+Shift+B", enabled: pixelish },
  imageSize: { run: dialog({ type: "imageSize" }), keys: "Mod+Alt+I", enabled: hasDoc },
  canvasSize: { run: dialog({ type: "canvasSize" }), keys: "Mod+Alt+C", enabled: hasDoc },
  rotate180: { run: () => A.rotateCanvas("180"), enabled: hasDoc },
  rotate90cw: { run: () => A.rotateCanvas("90"), enabled: hasDoc },
  rotate90ccw: { run: () => A.rotateCanvas("-90"), enabled: hasDoc },
  flipCanvasH: { run: () => A.rotateCanvas("flipH"), enabled: hasDoc },
  flipCanvasV: { run: () => A.rotateCanvas("flipV"), enabled: hasDoc },
  cropToSelection: { run: A.cropToSelection, enabled: hasSelection },
  trim: { run: () => A.trim("transparent"), enabled: hasDoc },
  trimTopLeft: { run: () => A.trim("topLeft"), enabled: hasDoc },
  revealAll: { run: A.revealAll, enabled: hasDoc },
  duplicateDoc: {
    run: () => {
      const d = get().doc;
      if (!d) return;
      void saveNow()
        .then(() => A.duplicateDocument(`${d.name} copy`))
        .then((id) => navigate(`/photo/${id}`));
    },
    enabled: hasDoc,
  },
  removeBackground: {
    run: () => void A.removeBackgroundToMask(),
    enabled: () => pixelish() && !hasMask(),
  },

  // Layer
  newLayer: { run: () => A.addPixelLayer(), keys: "Mod+Shift+N", enabled: hasDoc },
  duplicateLayer: { run: () => A.duplicateLayer(), enabled: hasLayer },
  deleteLayer: {
    run: () => A.deleteLayer(),
    enabled: () => hasLayer() && (get().doc?.layers.length ?? 0) > 1,
  },
  layerViaCopy: {
    run: () => (get().selection ? A.layerVia(false) : A.duplicateLayer()),
    keys: "Mod+J",
    enabled: pixelish,
  },
  layerViaCut: {
    run: () => A.layerVia(true),
    keys: "Mod+Shift+J",
    enabled: () => pixelish() && hasSelection(),
  },
  layerStyle: {
    run: () => {
      const l = activeLayer();
      if (l) set({ dialog: { type: "layerStyle", layerId: l.id } });
    },
    enabled: styleable,
  },
  fillSolid: { run: () => A.addFillLayer("solid"), enabled: hasDoc },
  fillGradient: { run: () => A.addFillLayer("gradient"), enabled: hasDoc },
  maskReveal: { run: () => A.addMask("reveal"), enabled: () => hasLayer() && !hasMask() },
  maskHide: { run: () => A.addMask("hide"), enabled: () => hasLayer() && !hasMask() },
  maskSelection: {
    run: () => A.addMask("selection"),
    enabled: () => hasLayer() && !hasMask() && hasSelection(),
  },
  maskDelete: { run: () => A.deleteMask(false), enabled: hasMask },
  maskApply: {
    run: () => A.deleteMask(true),
    enabled: () => hasMask() && activeLayer()?.kind !== "adjustment",
  },
  maskToggle: {
    run: A.toggleMask,
    enabled: hasMask,
    checked: () => activeLayer()?.mask?.enabled === false,
  },
  maskToSelection: { run: A.maskToSelection, enabled: hasMask },
  clippingMask: {
    run: () => {
      const l = activeLayer();
      if (l) A.updateLayer(l.id, { clip: !l.clip }, "clip");
    },
    keys: "Mod+Alt+G",
    enabled: () => (get().doc?.layers.findIndex((l) => l.id === get().activeId) ?? 0) > 0,
    checked: () => Boolean(activeLayer()?.clip),
  },
  bringToFront: { run: () => A.arrange("front"), keys: "Mod+Shift+]", enabled: hasLayer },
  bringForward: { run: () => A.arrange("forward"), keys: "Mod+]", enabled: hasLayer },
  sendBackward: { run: () => A.arrange("backward"), keys: "Mod+[", enabled: hasLayer },
  sendToBack: { run: () => A.arrange("back"), keys: "Mod+Shift+[", enabled: hasLayer },
  alignLeft: { run: () => A.alignLayer("left"), enabled: pixelish },
  alignCenterH: { run: () => A.alignLayer("centerH"), enabled: pixelish },
  alignRight: { run: () => A.alignLayer("right"), enabled: pixelish },
  alignTop: { run: () => A.alignLayer("top"), enabled: pixelish },
  alignMiddle: { run: () => A.alignLayer("middle"), enabled: pixelish },
  alignBottom: { run: () => A.alignLayer("bottom"), enabled: pixelish },
  rasterize: {
    run: () => A.rasterize(),
    enabled: () => ["text", "shape", "fill"].includes(activeLayer()?.kind ?? ""),
  },
  mergeDown: {
    run: A.mergeDown,
    keys: "Mod+E",
    enabled: () => (get().doc?.layers.findIndex((l) => l.id === get().activeId) ?? 0) > 0,
  },
  mergeVisible: {
    run: A.mergeVisible,
    keys: "Mod+Shift+E",
    enabled: () => (get().doc?.layers.length ?? 0) > 1,
  },
  flatten: { run: A.flattenImage, enabled: hasDoc },
  newGroup: { run: A.newGroup, enabled: hasDoc },
  group: { run: () => A.groupLayers(), keys: "Mod+G", enabled: hasLayer },
  ungroup: { run: () => A.ungroupLayers(), keys: "Mod+Shift+G", enabled: isGroup },
  mergeGroup: { run: () => A.mergeGroup(), enabled: isGroup },

  // Type
  typeTool: { run: () => selectTool("type"), enabled: hasDoc },
  rasterizeType: { run: () => A.rasterize(), enabled: () => activeLayer()?.kind === "text" },
  biggerText: {
    run: () => {
      const l = activeLayer();
      if (l?.kind === "text")
        A.updateLayer(l.id, { text: { ...l.text, size: l.text.size * 1.1 } } as never, "character");
    },
    keys: "Mod+Shift+.",
    enabled: () => activeLayer()?.kind === "text",
  },
  smallerText: {
    run: () => {
      const l = activeLayer();
      if (l?.kind === "text")
        A.updateLayer(l.id, { text: { ...l.text, size: l.text.size / 1.1 } } as never, "character");
    },
    keys: "Mod+Shift+,",
    enabled: () => activeLayer()?.kind === "text",
  },

  // Select
  selectAll: { run: A.selectAll, keys: "Mod+A", enabled: hasDoc },
  deselect: { run: A.deselect, keys: "Mod+D", enabled: hasSelection },
  reselect: { run: A.reselect, keys: "Mod+Shift+D", enabled: () => Boolean(get().lastSelection) },
  inverse: { run: A.inverseSelection, keys: "Mod+Shift+I", enabled: hasDoc },
  selectSubject: { run: () => void A.selectSubject(), enabled: () => hasDoc() && !get().busy },
  colorRange: { run: dialog({ type: "colorRange" }), enabled: hasDoc },
  border: { run: dialog({ type: "modify", op: "border" }), enabled: hasSelection },
  smooth: { run: dialog({ type: "modify", op: "smooth" }), enabled: hasSelection },
  expand: { run: dialog({ type: "modify", op: "expand" }), enabled: hasSelection },
  contract: { run: dialog({ type: "modify", op: "contract" }), enabled: hasSelection },
  feather: {
    run: dialog({ type: "modify", op: "feather" }),
    keys: "Shift+F6",
    enabled: hasSelection,
  },
  grow: { run: () => A.growSimilar(true), enabled: hasSelection },
  similar: { run: () => A.growSimilar(false), enabled: hasSelection },
  quickMask: { run: toggleQuickMask, keys: "Q", enabled: hasDoc, checked: () => get().quickMask },
  saveSelection: { run: A.saveSelection, enabled: hasSelection },
  loadSelection: { run: A.loadSelection, enabled: () => Boolean(get().savedSelection) },
  selectionToPath: { run: A.selectionToPath, enabled: hasSelection },

  // Paths
  pathToSelection: { run: () => A.pathToSelection(), keys: "Mod+Enter", enabled: hasPath },
  fillPath: { run: () => A.paintPath("fill"), enabled: () => hasPath() && pixelish() },
  strokePath: { run: () => A.paintPath("stroke"), enabled: () => hasPath() && pixelish() },
  newPath: { run: () => A.newPath(), enabled: hasDoc },
  deletePath: { run: () => A.deletePath(), enabled: hasPath },

  // Filter
  lastFilter: {
    run: () => {
      const last = get().lastFilter;
      if (last) A.applyFilter(last.id, last.params);
    },
    keys: "Mod+Alt+F",
    enabled: () => Boolean(get().lastFilter) && pixelish(),
  },
  developFilter: { run: () => runFilter("develop"), keys: "Mod+Shift+A", enabled: pixelish },

  // View
  zoomIn: {
    run: () => {
      const d = get().doc;
      if (d) zoomAt(centerPoint(), 1.25);
    },
    keys: "Mod+=",
    enabled: hasDoc,
  },
  zoomOut: {
    run: () => {
      const d = get().doc;
      if (d) zoomAt(centerPoint(), 0.8);
    },
    keys: "Mod+-",
    enabled: hasDoc,
  },
  fitOnScreen: { run: fitOnScreen, keys: "Mod+0", enabled: hasDoc },
  actualPixels: {
    run: () => {
      const c = centerPoint();
      zoomAt(c, 1 / get().zoom);
    },
    keys: "Mod+1",
    enabled: hasDoc,
  },
  rulers: { run: toggleView("rulers"), keys: "Mod+R", checked: () => get().view.rulers },
  grid: { run: toggleView("grid"), keys: "Mod+'", checked: () => get().view.grid },
  snap: { run: toggleView("snap"), keys: "Mod+Shift+;", checked: () => get().view.snap },
  guides: { run: toggleView("guides"), keys: "Mod+;", checked: () => get().view.guides },
  extras: { run: toggleView("edges"), keys: "Mod+H", checked: () => get().view.edges },
  newGuide: { run: dialog({ type: "newGuide" }), enabled: hasDoc },
  clearGuides: {
    run: A.clearGuides,
    enabled: () =>
      Boolean(
        get().doc && (get().doc!.guides.horizontal.length || get().doc!.guides.vertical.length),
      ),
  },

  // Window
  resetWorkspace: {
    run: () => {
      const initial = usePhoto.getInitialState();
      set({ panels: initial.panels, panelTabs: initial.panelTabs, hidePanels: false });
    },
  },
  hidePanels: {
    run: () => set({ hidePanels: !get().hidePanels }),
    keys: "Tab",
    checked: () => get().hidePanels,
  },
} satisfies Record<string, Command>;

export type CommandId = keyof typeof COMMANDS;

/** The document point in the middle of the window. */
function centerPoint() {
  const el = document.querySelector<HTMLElement>("[data-testid=photo-viewport]");
  const s = get();
  const w = el?.clientWidth ?? 800;
  const h = el?.clientHeight ?? 600;
  return { x: (w / 2 - s.pan.x) / s.zoom, y: (h / 2 - s.pan.y) / s.zoom };
}

export const PANEL_IDS: PanelId[] = [
  "layers",
  "adjustments",
  "properties",
  "history",
  "color",
  "swatches",
  "navigator",
  "histogram",
  "info",
  "character",
  "paths",
];

/** Panel groups of the dock, top to bottom; each shows one tab at a time. */
export const PANEL_GROUPS: { id: string; panels: PanelId[] }[] = [
  { id: "top", panels: ["color", "swatches", "navigator", "histogram", "info"] },
  { id: "middle", panels: ["properties", "adjustments", "character"] },
  { id: "bottom", panels: ["layers", "paths", "history"] },
];

/** Window menu: opens a panel (and brings its tab forward) or closes it. */
export function togglePanel(id: PanelId) {
  const s = get();
  const open = !s.panels[id];
  const group = PANEL_GROUPS.find((g) => g.panels.includes(id))!;
  set({
    panels: { ...s.panels, [id]: open },
    panelTabs: open ? { ...s.panelTabs, [group.id]: id } : s.panelTabs,
    hidePanels: false,
  });
}

export function openAdjustment(type: AdjustmentType, target: "layer" | "pixels") {
  if (target === "layer") {
    A.addAdjustmentLayer(type);
    set({ panels: { ...get().panels, properties: true } });
    return;
  }
  if (type === "invert" || type === "desaturate" || type === "equalize") {
    A.applyAdjustmentToPixels({ type } as never);
    return;
  }
  set({ dialog: { type: "adjustment", adjustment: type, target } });
}

export { ADJUSTMENT_TYPES };

/** "Mod+Shift+Z" → "Ctrl+Shift+Z" (or "⌘⇧Z" on a Mac). */
export function formatKeys(keys: string) {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  if (!mac) return keys.replace("Mod", "Ctrl");
  return keys
    .replace("Mod+", "⌘")
    .replace("Shift+", "⇧")
    .replace("Alt+", "⌥")
    .replace("Ctrl+", "⌃");
}

/** The pressed combination in the same form as `keys` ("Mod+Shift+Z"). */
export function comboOf(e: KeyboardEvent) {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Mod");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  // Shifted punctuation reports the shifted character; map back to the key.
  const shifted: Record<string, string> = {
    "}": "]",
    "{": "[",
    ">": ".",
    "<": ",",
    "+": "=",
    _: "-",
    '"': "'",
    ":": ";",
  };
  key = shifted[key] ?? key;
  if (key === "Backspace") key = "Delete";
  parts.push(key);
  return parts.join("+");
}

const byKeys = new Map<string, CommandId>();
for (const [id, c] of Object.entries(COMMANDS) as [CommandId, Command][])
  if (c.keys) byKeys.set(c.keys.toUpperCase(), id);

export function commandForCombo(combo: string): CommandId | null {
  return byKeys.get(combo.toUpperCase()) ?? null;
}

export function runCommand(id: CommandId) {
  const c: Command = COMMANDS[id];
  if (c.enabled && !c.enabled()) return false;
  c.run();
  return true;
}
