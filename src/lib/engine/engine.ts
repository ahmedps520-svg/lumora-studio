/**
 * CanvasEngine — the only code that talks to Fabric interactively.
 *
 * Data flows one way: the editor store hands the engine a Page, the engine
 * reconciles Fabric objects to match (by element id, skipping unchanged
 * elements thanks to Immer's structural sharing). User gestures on the canvas
 * are reported back through callbacks; the store applies them as undoable
 * changes, and the new page flows back in.
 */
import {
  ActiveSelection,
  PencilBrush,
  type Path,
  Canvas,
  Point,
  Rect,
  Textbox,
  cache,
  type FabricObject,
  type TPointerEventInfo,
} from "fabric";
import { fontFacesOf, usesFontFamily } from "@/lib/document/fonts";
import { loadFont, onFontLoaded } from "@/lib/fonts/loader";
import type { Background, DrawingElement, Element, Format, Page, TextElement } from "@/lib/schema";
import {
  SELECTION_COLOR,
  applyElement,
  canUpdateInPlace,
  createObject,
  getObjectId,
  readElement,
} from "./mapping";
import { rgba, strokeToDrawing, type DrawTool } from "./drawing";
import { PageBackground } from "./background";
import { SmartGuides } from "./guides";

export type DrawMode =
  { tool: DrawTool; color: string; width: number; opacity: number } | { tool: "eraser" } | null;

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];

export interface ElementPatch {
  id: string;
  patch: Partial<Element>;
}

export interface ViewportInfo {
  zoom: number;
  /** The page's rectangle on screen, in CSS px relative to the canvas element. */
  pageRect: { x: number; y: number; width: number; height: number };
}

export interface EngineCallbacks {
  /** The user changed the selection on the canvas. */
  onSelectionChange: (ids: string[]) => void;
  /** The user moved / resized / rotated objects (one undo step). */
  onTransform: (changes: ElementPatch[]) => void;
  /** Inline text editing finished. `null` element = the text was emptied (delete it). */
  onTextCommit: (id: string, element: TextElement | null) => void;
  onTextEditing: (id: string | null) => void;
  /** Values Fabric computed (e.g. text height) that should be stored without an undo step. */
  onDerived: (changes: ElementPatch[]) => void;
  onViewport: (info: ViewportInfo) => void;
  /** A freehand stroke was finished (drawing mode). */
  onDrawn?: (element: DrawingElement) => void;
  /** The eraser went over these drawings. */
  onErase?: (ids: string[]) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Shallow diff: keys whose values differ (deep-compared via JSON for objects). */
function diffElement(base: Element, next: Element): Partial<Element> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof Element)[]) {
    const a = base[key];
    const b = next[key];
    if (a === b) continue;
    if (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b)) {
      continue;
    }
    patch[key] = b;
  }
  return patch as Partial<Element>;
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable),
  );
}

export class CanvasEngine {
  readonly canvas: Canvas;
  private readonly objects = new Map<string, FabricObject>();
  private readonly applied = new Map<string, Element>();
  private readonly textHeights = new WeakMap<FabricObject, number>();
  private readonly pageBackground: PageBackground;
  private readonly guides: SmartGuides;
  private page: Page | null = null;
  private format: Format | null = null;
  private selectionMuted = 0;
  private drawMode: DrawMode = null;
  private erasing = false;
  private readonly erased = new Set<string>();
  /** > 0 while the engine itself is changing objects (renderPage / rebuilds). */
  private rendering = 0;
  private spaceDown = false;
  private panning: { x: number; y: number } | null = null;
  /** True until the user zooms or pans manually; while true, resizing re-fits. */
  private autoFit = true;
  private readonly cleanups: (() => void)[] = [];
  private disposed = false;

  constructor(
    canvasElement: HTMLCanvasElement,
    private readonly container: HTMLElement,
    private readonly callbacks: EngineCallbacks,
    private readonly options: { loadFonts?: boolean } = {},
  ) {
    this.canvas = new Canvas(canvasElement, {
      width: container.clientWidth,
      height: container.clientHeight,
      preserveObjectStacking: true,
      selectionColor: "rgba(109, 93, 246, 0.08)",
      selectionBorderColor: SELECTION_COLOR,
      selectionLineWidth: 1,
      fireMiddleClick: true,
      // The editor shows its own right-click menu (it prevents the browser one).
      stopContextMenu: false,
      controlsAboveOverlay: true,
      targetFindTolerance: 6,
    });

    this.pageBackground = new PageBackground({
      // Redrawn directly: a page-sized cache would cost a lot of memory.
      objectCaching: false,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: "default",
      strokeWidth: 0,
      fill: "#FFFFFF",
    });
    this.canvas.add(this.pageBackground);

    this.bindCanvasEvents();
    this.bindDomEvents();
    this.guides = new SmartGuides(
      this.canvas,
      () => this.format,
      (o) => o === this.pageBackground,
    );
    this.cleanups.push(this.guides.bind());
    this.cleanups.push(onFontLoaded((family) => this.refreshFont(family)));
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Makes the canvas match `page`. Cheap to call on every store change. */
  renderPage(page: Page, format: Format) {
    if (this.disposed) return;
    this.rendering++;
    try {
      this.reconcile(page, format);
    } finally {
      this.rendering--;
    }
  }

  private reconcile(page: Page, format: Format) {
    const pageChanged = this.page?.id !== page.id;
    const formatChanged =
      !this.format || this.format.width !== format.width || this.format.height !== format.height;
    this.format = format;

    if (pageChanged) this.clearObjects();
    if (formatChanged) this.updatePageBounds();
    if (pageChanged || this.page?.background !== page.background) {
      this.applyBackground(page.background);
    }

    // Objects inside a multi-selection use group-relative coordinates; release
    // the selection before repositioning them, then restore it.
    const active = this.canvas.getActiveObject();
    const selectionToRestore =
      active instanceof ActiveSelection &&
      active.getObjects().some((o) => {
        const id = getObjectId(o);
        const next = id ? page.elements.find((e) => e.id === id) : undefined;
        return next !== undefined && next !== this.applied.get(id!);
      })
        ? this.canvas.getActiveObjects().map(getObjectId)
        : null;
    if (selectionToRestore) this.muted(() => this.canvas.discardActiveObject());

    const seen = new Set<string>();
    const textToMeasure: string[] = [];
    page.elements.forEach((element, index) => {
      seen.add(element.id);
      const previous = this.applied.get(element.id);
      let obj = this.objects.get(element.id);

      if (obj && previous === element) {
        // Unchanged (same object reference) — nothing to do.
      } else if (obj && previous && canUpdateInPlace(previous, element)) {
        applyElement(obj, element, { skipContent: obj instanceof Textbox && obj.isEditing });
      } else {
        const wasActive = obj ? this.canvas.getActiveObjects().includes(obj) : false;
        if (obj) this.muted(() => this.canvas.remove(obj!));
        obj = createObject(element);
        if (this.drawMode) obj.selectable = false;
        this.objects.set(element.id, obj);
        this.canvas.add(obj);
        if (wasActive) this.muted(() => this.canvas.setActiveObject(obj!));
      }
      this.applied.set(element.id, element);
      if (previous !== element) {
        if (element.type === "text") textToMeasure.push(element.id);
        this.ensureFonts(element);
      }

      // Stacking: index 0 is the page background.
      if (this.canvas.getObjects()[index + 1] !== obj) this.canvas.moveObjectTo(obj, index + 1);
    });

    for (const [id, obj] of this.objects) {
      if (!seen.has(id)) {
        this.muted(() => this.canvas.remove(obj));
        this.objects.delete(id);
        this.applied.delete(id);
      }
    }

    this.page = page;
    if (selectionToRestore) this.setSelection(selectionToRestore.filter(Boolean) as string[]);
    this.canvas.requestRenderAll();
    if (textToMeasure.length > 0) this.reportDerived(textToMeasure);
  }

  /** Mirrors the store selection onto the canvas. */
  setSelection(ids: string[]) {
    const current = this.canvas.getActiveObjects().map(getObjectId);
    if (current.length === ids.length && ids.every((id) => current.includes(id))) return;
    const editing = this.canvas.getActiveObject();
    if (editing instanceof Textbox && editing.isEditing) return;

    const objs = ids
      .map((id) => this.objects.get(id))
      .filter((o): o is FabricObject => Boolean(o && o.visible));
    this.muted(() => {
      this.canvas.discardActiveObject();
      if (objs.length === 1) this.canvas.setActiveObject(objs[0]!);
      else if (objs.length > 1) {
        const selection = new ActiveSelection(objs, { canvas: this.canvas });
        selection.set({
          borderColor: SELECTION_COLOR,
          cornerColor: "#FFFFFF",
          cornerStrokeColor: SELECTION_COLOR,
          cornerStyle: "circle",
          transparentCorners: false,
          cornerSize: 11,
          borderScaleFactor: 1.5,
          lockScalingFlip: true,
        });
        this.canvas.setActiveObject(selection);
      }
    });
    this.canvas.requestRenderAll();
  }

  /** Starts inline editing of a text element (e.g. after adding one). */
  editText(id: string, selectAll = true) {
    const obj = this.objects.get(id);
    if (!(obj instanceof Textbox)) return;
    this.muted(() => this.canvas.setActiveObject(obj));
    obj.enterEditing();
    if (selectAll) obj.selectAll();
    this.canvas.requestRenderAll();
  }

  get zoom() {
    return this.canvas.getZoom();
  }

  /** Zooms so the whole page fits with some breathing room. */
  fit(padding = 48) {
    if (!this.format) return;
    const { width: cw, height: ch } = this.canvas;
    const zoom = clamp(
      Math.min((cw - padding * 2) / this.format.width, (ch - padding * 2) / this.format.height),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    this.canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      (cw - this.format.width * zoom) / 2,
      (ch - this.format.height * zoom) / 2,
    ]);
    this.autoFit = true;
    this.afterViewportChange();
  }

  /** Zooms so the page fills the viewport width (may scroll vertically). */
  fill() {
    if (!this.format) return;
    const zoom = clamp(this.canvas.width / this.format.width, MIN_ZOOM, MAX_ZOOM);
    this.canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 24]);
    this.autoFit = false;
    this.afterViewportChange();
  }

  /** Sets an absolute zoom, keeping `screenPoint` (default: viewport centre) still. */
  setZoom(zoom: number, screenPoint?: { x: number; y: number }) {
    const point = screenPoint ?? { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    this.canvas.zoomToPoint(new Point(point.x, point.y), clamp(zoom, MIN_ZOOM, MAX_ZOOM));
    this.autoFit = false;
    this.afterViewportChange();
  }

  zoomIn() {
    const next = ZOOM_STEPS.find((z) => z > this.zoom + 1e-3) ?? MAX_ZOOM;
    this.setZoom(next);
  }

  zoomOut() {
    const next = [...ZOOM_STEPS].reverse().find((z) => z < this.zoom - 1e-3) ?? MIN_ZOOM;
    this.setZoom(next);
  }

  /** Reads every object on the canvas back into scene elements (bottom → top). */
  exportElements(): Element[] {
    return this.canvas
      .getObjects()
      .map((obj) => {
        const id = getObjectId(obj);
        const base = id ? this.applied.get(id) : undefined;
        return base ? readElement(obj, base) : null;
      })
      .filter((e): e is Element => e !== null);
  }

  /** Small preview of the current page (data URL), for thumbnails. */
  snapshot(maxSize = 480, mimeType: "jpeg" | "png" = "jpeg"): string | null {
    if (!this.format || this.disposed) return null;
    const vpt = this.canvas.viewportTransform;
    const zoom = vpt[0];
    const multiplier =
      Math.min(1, maxSize / Math.max(this.format.width, this.format.height)) / zoom;
    try {
      return this.canvas.toDataURL({
        format: mimeType,
        quality: 0.82,
        left: vpt[4],
        top: vpt[5],
        width: this.format.width * zoom,
        height: this.format.height * zoom,
        multiplier,
      });
    } catch {
      return null;
    }
  }

  /** Call when the container changes size. */
  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    const dx = (width - this.canvas.width) / 2;
    const dy = (height - this.canvas.height) / 2;
    this.canvas.setDimensions({ width, height });
    if (this.autoFit) this.fit();
    else {
      this.canvas.relativePan(new Point(dx, dy));
      this.afterViewportChange();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanups.forEach((fn) => fn());
    void this.canvas.dispose();
  }

  /** Snapping to the page and other elements while dragging (on by default). */
  setSnapping(enabled: boolean) {
    this.guides.enabled = enabled;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /** Pen / marker / highlighter / eraser, or null to go back to selecting. */
  setDrawMode(mode: DrawMode) {
    const c = this.canvas;
    this.drawMode = mode;
    if (mode && mode.tool !== "eraser") {
      const brush = new PencilBrush(c);
      brush.color = rgba(mode.color, mode.opacity);
      brush.width = mode.width;
      brush.strokeLineCap = mode.tool === "highlighter" ? "square" : "round";
      brush.strokeLineJoin = "round";
      brush.straightLineKey = "shiftKey";
      brush.decimate = 1;
      c.freeDrawingBrush = brush;
    }
    if (mode) this.muted(() => c.discardActiveObject());
    c.isDrawingMode = Boolean(mode && mode.tool !== "eraser");
    c.selection = !mode;
    // The eraser hits objects but never selects or moves them.
    for (const [id, obj] of this.objects) {
      obj.selectable = !mode;
      const element = this.applied.get(id);
      obj.hoverCursor =
        mode?.tool === "eraser"
          ? element?.type === "drawing"
            ? "pointer"
            : "default"
          : element?.locked
            ? "default"
            : "move";
    }
    c.defaultCursor = mode?.tool === "eraser" ? "crosshair" : "default";
    c.setCursor(c.defaultCursor);
    c.requestRenderAll();
  }

  private eraseAt(target: FabricObject | undefined, e: Event) {
    const id = target ? getObjectId(target) : undefined;
    const element = id ? this.applied.get(id) : undefined;
    if (!target || !id || element?.type !== "drawing" || element.locked) return;
    // Only the ink counts, not the empty space inside the stroke's box.
    const point = this.canvas.getViewportPoint(e as MouseEvent);
    if (this.canvas.isTargetTransparent(target, point.x, point.y)) return;
    target.visible = false;
    this.erased.add(id);
    this.canvas.requestRenderAll();
  }

  private muted(fn: () => void) {
    this.selectionMuted++;
    try {
      fn();
    } finally {
      this.selectionMuted--;
    }
  }

  private clearObjects() {
    this.muted(() => this.canvas.discardActiveObject());
    for (const obj of this.objects.values()) this.canvas.remove(obj);
    this.objects.clear();
    this.applied.clear();
  }

  private updatePageBounds() {
    if (!this.format) return;
    const { width, height } = this.format;
    this.pageBackground.set({ left: width / 2, top: height / 2, width, height });
    this.pageBackground.setCoords();
    // Everything outside the page is clipped away (selection handles still show).
    this.canvas.clipPath = new Rect({
      left: width / 2,
      top: height / 2,
      width,
      height,
      absolutePositioned: true,
    });
    if (this.autoFit) this.fit();
  }

  private applyBackground(background: Background) {
    this.pageBackground.setBackground(background);
  }

  private afterViewportChange() {
    this.canvas.requestRenderAll();
    const vpt = this.canvas.viewportTransform;
    const zoom = vpt[0];
    this.callbacks.onViewport({
      zoom,
      pageRect: {
        x: vpt[4],
        y: vpt[5],
        width: (this.format?.width ?? 0) * zoom,
        height: (this.format?.height ?? 0) * zoom,
      },
    });
  }

  private emitSelection() {
    if (this.selectionMuted > 0) return;
    const ids = this.canvas
      .getActiveObjects()
      .map(getObjectId)
      .filter((id): id is string => Boolean(id));
    this.callbacks.onSelectionChange(ids);
  }

  /** Starts loading every font face the element draws with (text, tables, charts, groups). */
  private ensureFonts(element: Element) {
    if (this.options.loadFonts === false) return;
    for (const face of fontFacesOf(element)) void loadFont(face.family, face.weight, face.italic);
  }

  /** A web font finished loading: re-measure every text using it. */
  private refreshFont(family: string) {
    if (this.disposed) return;
    cache.clearFontCache(family);
    const ids: string[] = [];
    for (const [id, obj] of this.objects) {
      if (obj instanceof Textbox) {
        obj.initDimensions();
        obj.setCoords();
        obj.dirty = true;
        ids.push(id);
      }
    }
    // Groups, tables and charts lay their text out once when built; rebuild those using this font.
    for (const [id, element] of this.applied) {
      if (element.type !== "text" && usesFontFamily(element, family)) this.rebuildObject(id);
    }
    this.canvas.requestRenderAll();
    this.reportDerived(ids);
  }

  /** Replaces an object with a freshly built one, keeping its stacking and selection. */
  private rebuildObject(id: string) {
    const element = this.applied.get(id);
    const old = this.objects.get(id);
    if (!element || !old) return;
    const selectedIds = this.canvas.getActiveObjects().map(getObjectId);
    const wasSelected = this.canvas.getActiveObjects().includes(old);
    if (wasSelected) this.muted(() => this.canvas.discardActiveObject());
    const index = this.canvas.getObjects().indexOf(old);
    this.rendering++;
    try {
      this.muted(() => this.canvas.remove(old));
      const obj = createObject(element);
      this.objects.set(id, obj);
      this.canvas.insertAt(Math.max(1, index), obj);
    } finally {
      this.rendering--;
    }
    if (wasSelected) this.setSelection(selectedIds.filter((s): s is string => Boolean(s)));
  }

  /** Reports text boxes whose real size (as laid out by Fabric) differs from the stored one. */
  private reportDerived(ids: string[]) {
    const changes: ElementPatch[] = [];
    for (const id of ids) {
      const obj = this.objects.get(id);
      const element = this.applied.get(id);
      if (!(obj instanceof Textbox) || element?.type !== "text" || obj.isEditing) continue;
      const height = Math.round(obj.height * 100) / 100;
      const width = Math.round(obj.width * 100) / 100;
      const patch: Partial<TextElement> = {};
      // The top edge stays put; the box grows/shrinks downwards.
      if (Math.abs(height - element.height) > 0.5) patch.height = height;
      if (width - element.width > 0.5) patch.width = width;
      if (Object.keys(patch).length > 0) changes.push({ id, patch });
    }
    if (changes.length > 0) queueMicrotask(() => this.callbacks.onDerived(changes));
  }

  private collectTransform(target: FabricObject | undefined): ElementPatch[] {
    if (!target) return [];
    const objs = target instanceof ActiveSelection ? target.getObjects() : [target];
    const changes: ElementPatch[] = [];
    for (const obj of objs) {
      const id = getObjectId(obj);
      const base = id ? this.applied.get(id) : undefined;
      if (!id || !base) continue;
      const patch = diffElement(base, readElement(obj, base));
      if (Object.keys(patch).length > 0) changes.push({ id, patch });
    }
    return changes;
  }

  private bindCanvasEvents() {
    const c = this.canvas;
    c.on("selection:created", () => this.emitSelection());
    c.on("selection:updated", () => this.emitSelection());
    c.on("selection:cleared", () => this.emitSelection());

    // Right-click selects what is under the pointer first (empty page = no selection),
    // so the menu always acts on what you clicked.
    c.on("contextmenu", ({ target }) => {
      const active = c.getActiveObject();
      if (target && target !== active && !c.getActiveObjects().includes(target)) {
        c.setActiveObject(target);
        c.requestRenderAll();
      } else if (!target && active) {
        c.discardActiveObject();
        c.requestRenderAll();
      }
    });

    c.on("object:modified", (e) => {
      // Replacing an object mid-gesture (a resized group is rebuilt) makes Fabric
      // finish the gesture again and re-fire this event — ignore that echo.
      if (this.rendering > 0) return;
      const changes = this.collectTransform(e.target);
      // Apply once Fabric has completely finished the gesture, so the store's
      // re-render can safely replace the object that was being transformed.
      if (changes.length > 0) {
        queueMicrotask(() => {
          if (!this.disposed) this.callbacks.onTransform(changes);
        });
      }
    });

    c.on("text:editing:entered", (e) => {
      const id = getObjectId(e.target);
      this.textHeights.set(e.target, e.target.height);
      if (id) this.callbacks.onTextEditing(id);
    });

    // While typing, Fabric re-measures around the centre; shift the box so its
    // top edge stays fixed and new lines grow downwards (rotation-aware).
    c.on("text:changed", (e) => {
      const obj = e.target;
      const previous = this.textHeights.get(obj) ?? obj.height;
      const dh = (obj.height - previous) * obj.scaleY;
      if (Math.abs(dh) > 0.01) {
        const angle = (obj.angle * Math.PI) / 180;
        obj.set({
          left: obj.left - (Math.sin(angle) * dh) / 2,
          top: obj.top + (Math.cos(angle) * dh) / 2,
        });
        obj.setCoords();
      }
      this.textHeights.set(obj, obj.height);
    });

    c.on("text:editing:exited", (e) => {
      const obj = e.target;
      const id = getObjectId(obj);
      const base = id ? this.applied.get(id) : undefined;
      this.callbacks.onTextEditing(null);
      if (!id || base?.type !== "text") return;
      if (obj.text.trim() === "") {
        this.callbacks.onTextCommit(id, null);
        return;
      }
      const next = readElement(obj, base) as TextElement;
      this.callbacks.onTextCommit(id, next);
    });

    c.on("mouse:wheel", (opt: TPointerEventInfo<WheelEvent>) => {
      const e = opt.e;
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        // Pinch on a trackpad arrives as ctrl+wheel.
        const zoom = clamp(this.zoom * 0.995 ** e.deltaY, MIN_ZOOM, MAX_ZOOM);
        const rect = this.canvas.upperCanvasEl.getBoundingClientRect();
        this.setZoom(zoom, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
        this.canvas.relativePan(new Point(-dx, -dy));
        this.autoFit = false;
        this.afterViewportChange();
      }
    });

    // Freehand strokes become drawing elements (the live preview path is removed).
    c.on("path:created", ({ path }) => {
      const mode = this.drawMode;
      this.muted(() => c.remove(path));
      if (!mode || mode.tool === "eraser") return;
      const element = strokeToDrawing((path as Path).path as (string | number)[][], mode);
      if (element) this.callbacks.onDrawn?.(element);
    });

    c.on("mouse:down", (opt) => {
      const e = opt.e as MouseEvent;
      if (this.drawMode?.tool === "eraser" && !this.spaceDown && e.button !== 1) {
        this.erasing = true;
        this.eraseAt(opt.target, opt.e);
        return;
      }
      if (this.spaceDown || e.button === 1) {
        this.panning = { x: e.clientX, y: e.clientY };
        this.canvas.setCursor("grabbing");
        e.preventDefault();
      }
    });

    c.on("mouse:move", (opt) => {
      if (this.erasing) return this.eraseAt(opt.target, opt.e);
      if (!this.panning) return;
      const e = opt.e as MouseEvent;
      this.canvas.relativePan(new Point(e.clientX - this.panning.x, e.clientY - this.panning.y));
      this.panning = { x: e.clientX, y: e.clientY };
      this.autoFit = false;
      this.afterViewportChange();
    });

    c.on("mouse:up", () => {
      if (this.erasing) {
        this.erasing = false;
        if (this.erased.size > 0) this.callbacks.onErase?.([...this.erased]);
        this.erased.clear();
        return;
      }
      if (!this.panning) return;
      this.panning = null;
      this.canvas.setCursor(this.spaceDown ? "grab" : "default");
    });
  }

  private bindDomEvents() {
    const setPanMode = (on: boolean) => {
      this.spaceDown = on;
      this.canvas.skipTargetFind = on;
      this.canvas.selection = !on;
      this.canvas.defaultCursor = on ? "grab" : "default";
      this.canvas.setCursor(this.canvas.defaultCursor);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTypingTarget(e.target)) return;
      const active = this.canvas.getActiveObject();
      if (active instanceof Textbox && active.isEditing) return;
      e.preventDefault();
      setPanMode(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && this.spaceDown) setPanMode(false);
    };
    const onBlur = () => this.spaceDown && setPanMode(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.container);

    this.cleanups.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      observer.disconnect();
    });
  }
}
