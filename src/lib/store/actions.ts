/**
 * High-level editor commands. UI components, keyboard shortcuts and (later)
 * the AI assistant all call these, so behaviour stays identical everywhere.
 * Each command is a single undoable step.
 */
import {
  cloneWithNewIds,
  duplicateElements,
  findElement,
  flattenElements,
  getPage,
  insertElements,
  locate,
  moveElementToIndex,
  patchElement,
  removeElements,
  reorderElements,
  type OrderOp,
} from "@/lib/document/tree";
import {
  applyAssistantActions,
  type ApplyResult,
  type AssistantAction,
} from "@/lib/ai/assistant-tools";
import { alignElements, distributeElements, type Alignment } from "@/lib/document/arrange";
import { current } from "immer";
import { groupElements, scaleChildren, ungroupElements } from "@/lib/document/grouping";
import { serializeElements } from "@/lib/document/clipboard";
import { coverCrop, createImage, createText } from "@/lib/document/factory";
import { applyPalette } from "@/lib/document/palette";
import { backgroundToImage, imageToBackground } from "@/lib/document/photo";
import { loadImage } from "@/lib/engine/images";
import { applyStyle, extractStyle, type CopiedStyle } from "@/lib/document/style";
import { directionPatch, fontForText, withTextStyle } from "@/lib/document/text";
import {
  ImageFiltersSchema,
  type Background,
  type Design,
  type Element,
  type ImageElement,
  type Page,
} from "@/lib/schema";
import { useEditorStore, type ChangeOptions } from "./editor-store";

const state = () => useEditorStore.getState();

/** Where a photo can go: a frame (fills it) or an image (replaces it). */
export interface PhotoTarget {
  id: string;
  type: "frame" | "image";
}

/** A photo to put on the page: its source, pixel size and credit. */
export interface PhotoInput {
  src: string;
  width: number;
  height: number;
  alt?: string;
  attribution?: ImageElement["attribution"];
}

function onCurrentPage(
  label: string,
  fn: (page: Page, design: Design) => void,
  options?: ChangeOptions,
) {
  const { pageId, change } = state();
  if (!pageId) return;
  change(
    label,
    (draft) => {
      const page = getPage(draft, pageId);
      if (page) fn(page, draft);
    },
    options,
  );
}

function currentPage(): Page | undefined {
  const { design, pageId } = state();
  return design && pageId ? getPage(design, pageId) : undefined;
}

/** Selected elements that are not locked. */
function unlockedSelection(): string[] {
  const { selection } = state();
  const page = currentPage();
  if (!page) return [];
  return selection.filter((id) => {
    const el = findElement(page, id);
    return el && !el.locked;
  });
}

export interface ElementChange {
  id: string;
  patch: Partial<Element>;
}

/** In-memory clipboard for copy/paste between pages and designs in this tab. */
let clipboard: { elements: Element[]; pasteCount: number } | null = null;
let copiedStyle: CopiedStyle | null = null;

export const editorActions = {
  addElements(
    elements: Element[],
    options: { select?: boolean; index?: number; cascade?: boolean } = {},
  ) {
    if (elements.length === 0) return;
    onCurrentPage(
      "addElement",
      (page) => {
        // A single new element dropped exactly on top of another steps down-right
        // so it never hides behind (or hides) something already there.
        if (elements.length === 1 && options.cascade !== false) {
          const el = elements[0]!;
          const taken = (x: number, y: number) =>
            page.elements.some((e) => Math.abs(e.x - x) < 1 && Math.abs(e.y - y) < 1);
          for (let i = 0; i < 20 && taken(el.x, el.y); i++) {
            el.x += 24;
            el.y += 24;
          }
        }
        insertElements(page, elements, options.index);
      },
      { select: options.select === false ? undefined : elements.map((e) => e.id) },
    );
  },

  updateElement(id: string, patch: Partial<Element>, mergeKey?: string) {
    onCurrentPage("editElement", (page) => void patchElement(page, id, patch), { mergeKey });
  },

  updateElements(changes: ElementChange[], options: { label?: string; mergeKey?: string } = {}) {
    if (changes.length === 0) return;
    onCurrentPage(
      options.label ?? "editElement",
      (page) => changes.forEach((c) => patchElement(page, c.id, c.patch)),
      { mergeKey: options.mergeKey },
    );
  },

  /** Applies the same patch to every selected element. */
  updateSelection(patch: Partial<Element>, mergeKey?: string) {
    const ids = state().selection;
    editorActions.updateElements(
      ids.map((id) => ({ id, patch })),
      { mergeKey },
    );
  },

  deleteSelection() {
    const ids = unlockedSelection();
    if (ids.length === 0) return;
    onCurrentPage("delete", (page) => void removeElements(page, ids), { select: [] });
  },

  deleteElements(ids: string[]) {
    if (ids.length === 0) return;
    const remaining = state().selection.filter((id) => !ids.includes(id));
    onCurrentPage("delete", (page) => void removeElements(page, ids), { select: remaining });
  },

  /** Moves a top-level element to a stack index (0 = bottom). */
  moveElement(id: string, toIndex: number) {
    onCurrentPage("reorder", (page) => moveElementToIndex(page, id, toIndex));
  },

  flipSelection(axis: "x" | "y") {
    const ids = unlockedSelection();
    if (ids.length === 0) return;
    onCurrentPage("flip", (page) => {
      for (const id of ids) {
        const el = findElement(page, id);
        if (!el) continue;
        if (axis === "x") el.flipX = !el.flipX;
        else el.flipY = !el.flipY;
      }
    });
  },

  duplicateSelection() {
    const ids = unlockedSelection();
    if (ids.length === 0) return;
    let newIds: string[] = [];
    const { pageId, change } = state();
    if (!pageId) return;
    change("duplicate", (draft) => {
      const page = getPage(draft, pageId);
      if (page) newIds = duplicateElements(page, ids);
    });
    state().select(newIds);
  },

  reorderSelection(op: OrderOp) {
    const ids = state().selection;
    if (ids.length === 0) return;
    onCurrentPage("reorder", (page) => reorderElements(page, ids, op));
  },

  nudgeSelection(dx: number, dy: number) {
    const ids = unlockedSelection();
    if (ids.length === 0) return;
    onCurrentPage(
      "move",
      (page) => {
        for (const id of ids) {
          const el = findElement(page, id);
          if (el) {
            el.x += dx;
            el.y += dy;
          }
        }
      },
      { mergeKey: "nudge" },
    );
  },

  selectAll() {
    const { design, pageId } = state();
    const page = design && pageId ? getPage(design, pageId) : undefined;
    if (page) state().select(page.elements.filter((e) => e.visible).map((e) => e.id));
  },

  toggleVisibility(id: string) {
    onCurrentPage("toggleVisibility", (page) => {
      const el = findElement(page, id);
      if (el) el.visible = !el.visible;
    });
  },

  toggleLock(id: string) {
    onCurrentPage("toggleLock", (page) => {
      const el = findElement(page, id);
      if (el) el.locked = !el.locked;
    });
  },

  renameElement(id: string, name: string) {
    onCurrentPage("rename", (page) => {
      const el = findElement(page, id);
      if (el) el.name = name.slice(0, 200);
    });
  },

  renameDesign(name: string) {
    const trimmed = name.trim().slice(0, 200);
    if (!trimmed) return;
    state().change("renameDesign", (draft) => {
      draft.name = trimmed;
    });
  },

  setBackground(background: Background, mergeKey?: string) {
    onCurrentPage(
      "background",
      (page) => {
        page.background = background;
      },
      { mergeKey },
    );
  },

  /** The top-most unlocked frame or photo under a page point (for dropping photos on). */
  photoAt(point: { x: number; y: number }): PhotoTarget | null {
    const page = currentPage();
    if (!page) return null;
    for (let i = page.elements.length - 1; i >= 0; i--) {
      const el = page.elements[i]!;
      if ((el.type !== "frame" && el.type !== "image") || el.locked || !el.visible) continue;
      if (
        point.x >= el.x &&
        point.x <= el.x + el.width &&
        point.y >= el.y &&
        point.y <= el.y + el.height
      ) {
        return { id: el.id, type: el.type };
      }
    }
    return null;
  },

  /** The top-most unlocked frame under a page point (for dropping photos into frames). */
  frameAt(point: { x: number; y: number }): string | null {
    const target = editorActions.photoAt(point);
    return target?.type === "frame" ? target.id : null;
  },

  /** The selected frame, when exactly one frame is selected. */
  selectedFrame(): string | null {
    const target = editorActions.selectedPhoto();
    return target?.type === "frame" ? target.id : null;
  },

  /** The selected frame or photo, when exactly one (unlocked) is selected. */
  selectedPhoto(): PhotoTarget | null {
    const page = currentPage();
    const ids = state().selection;
    const el = page && ids.length === 1 ? findElement(page, ids[0]!) : undefined;
    if ((el?.type !== "frame" && el?.type !== "image") || el.locked) return null;
    return { id: el.id, type: el.type };
  },

  /** Puts a photo into a frame (replacing any photo it had), centred and covering it. */
  fillFrame(id: string, src: string, attribution: ImageElement["attribution"] = null) {
    const page = currentPage();
    const frame = page ? findElement(page, id) : undefined;
    if (frame?.type !== "frame" || frame.locked) return;
    editorActions.updateElement(id, {
      image: {
        src,
        alt: "",
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        filters: frame.image?.filters ?? ImageFiltersSchema.parse({}),
        attribution,
      },
    } as Partial<Element>);
  },

  /**
   * Swaps the picture of a photo for another, keeping its place, size, shape
   * and look; the new picture is cropped to cover the same box.
   */
  replaceImage(id: string, photo: PhotoInput) {
    const page = currentPage();
    const el = page ? findElement(page, id) : undefined;
    if (el?.type !== "image" || el.locked) return;
    editorActions.updateElement(id, {
      src: photo.src,
      alt: photo.alt ?? "",
      crop: coverCrop(photo, el),
      attribution: photo.attribution ?? null,
    } as Partial<Element>);
  },

  /**
   * Puts a photo where the user wants it: into `target` (a frame or photo),
   * else into the selected frame / over the selected photo, else onto the
   * page as a new photo (centred on `at` when given). Returns what it did.
   */
  placePhoto(
    photo: PhotoInput,
    options: { target?: PhotoTarget | null; at?: { x: number; y: number } } = {},
  ): "filled" | "replaced" | "added" | null {
    const target = options.target === undefined ? editorActions.selectedPhoto() : options.target;
    if (target?.type === "frame") {
      editorActions.fillFrame(target.id, photo.src, photo.attribution ?? null);
      return "filled";
    }
    if (target?.type === "image") {
      editorActions.replaceImage(target.id, photo);
      return "replaced";
    }
    const format = state().design?.format;
    if (!format) return null;
    editorActions.addElements([createImage(format, photo, { at: options.at })]);
    return "added";
  },

  /** Makes a photo the page background (filling the page) and takes it off the page. */
  setImageAsBackground(id: string) {
    const page = currentPage();
    const element = page ? findElement(page, id) : undefined;
    if (element?.type !== "image" || element.locked) return;
    onCurrentPage(
      "imageToBackground",
      (draft) => {
        draft.background = imageToBackground(element);
        removeElements(draft, [id]);
      },
      { select: [] },
    );
  },

  /** Turns the background photo back into a normal photo covering the page. */
  async detachBackgroundImage() {
    const { design } = state();
    const page = currentPage();
    const background = page?.background;
    if (!design || !page || background?.type !== "image") return;
    const img = await loadImage(background.src).catch(() => null);
    if (!img) return;
    const element = backgroundToImage(
      background,
      { width: img.naturalWidth, height: img.naturalHeight },
      design.format,
    );
    onCurrentPage(
      "detachBackground",
      (draft) => {
        draft.background = { type: "solid", color: "#FFFFFF" };
        insertElements(draft, [element], 0);
      },
      { select: [element.id] },
    );
  },

  copySelection(): boolean {
    const { design, pageId, selection } = state();
    const page = design && pageId ? getPage(design, pageId) : undefined;
    if (!page || selection.length === 0) return false;
    // Keep stacking order (bottom → top) regardless of click order.
    const elements = page.elements.filter((e) => selection.includes(e.id));
    const nested = selection
      .map((id) => locate(page.elements, id))
      .filter((loc) => loc && loc.parent)
      .map((loc) => loc!.element);
    clipboard = { elements: structuredClone([...elements, ...nested]), pasteCount: 0 };
    return true;
  },

  cutSelection() {
    if (editorActions.copySelection()) editorActions.deleteSelection();
  },

  /** The copied elements as clipboard text (for other tabs/designs), if any. */
  clipboardText(): string | null {
    return clipboard?.elements.length ? serializeElements(clipboard.elements) : null;
  },

  /** Pastes elements that arrived through the system clipboard (e.g. from another tab). */
  pasteFromSystem(elements: Element[], text: string) {
    // The same thing we copied here keeps stepping down-right on each paste.
    if (!clipboard || serializeElements(clipboard.elements) !== text) {
      clipboard = { elements: structuredClone(elements), pasteCount: 0 };
    }
    editorActions.paste();
  },

  /** Plain text from outside becomes a new text box in the middle of the page. */
  pasteText(raw: string) {
    const format = state().design?.format;
    const text = raw.replace(/\r\n?/g, "\n").trim().slice(0, 20_000);
    if (!format || !text) return;
    const element = createText("body", format, { runs: [{ text, style: {} }], align: "left" });
    const longest = Math.max(...text.split("\n").map((line) => line.length));
    const width = Math.round(
      Math.min(
        format.width * 0.8,
        Math.max(element.fontSize * 4, longest * element.fontSize * 0.56),
      ),
    );
    element.width = width;
    element.x = Math.round((format.width - width) / 2);
    Object.assign(element, directionPatch(element, text));
    editorActions.addElements([element]);
  },

  paste() {
    if (!clipboard || clipboard.elements.length === 0) return;
    clipboard.pasteCount += 1;
    const offset = 20 * clipboard.pasteCount;
    const copies = clipboard.elements.map((e) => {
      const copy = cloneWithNewIds(e);
      copy.x += offset;
      copy.y += offset;
      copy.locked = false;
      return copy;
    });
    editorActions.addElements(copies);
  },

  hasClipboard: () => Boolean(clipboard?.elements.length),

  /** Ctrl+Alt+C — remembers the look of the (first) selected element. */
  copyStyle(): boolean {
    const page = currentPage();
    const id = state().selection[0];
    const el = page && id ? findElement(page, id) : undefined;
    if (!el) return false;
    copiedStyle = extractStyle(el);
    return true;
  },

  /** Ctrl+Alt+V — applies the copied look to every selected element. */
  pasteStyle() {
    const style = copiedStyle;
    const ids = unlockedSelection();
    if (!style || ids.length === 0) return;
    onCurrentPage("pasteStyle", (page) => {
      for (const id of ids) {
        const el = findElement(page, id);
        if (el) applyStyle(el, style);
      }
    });
  },

  hasCopiedStyle: () => copiedStyle !== null,

  /** Locks every selected element, or unlocks them all if they're all locked. */
  toggleLockSelection() {
    const page = currentPage();
    const ids = state().selection;
    if (!page || ids.length === 0) return;
    const els = ids.map((id) => findElement(page, id)).filter((e): e is Element => Boolean(e));
    const lock = !els.every((e) => e.locked);
    onCurrentPage(lock ? "lock" : "unlock", (draft) => {
      for (const id of ids) {
        const el = findElement(draft, id);
        if (el) el.locked = lock;
      }
    });
  },

  alignSelection(alignment: Alignment) {
    const { design, selection } = state();
    if (!design || selection.length === 0) return;
    onCurrentPage("align", (page) => {
      const els = selection
        .map((id) => findElement(page, id))
        .filter((e): e is Element => Boolean(e));
      alignElements(els, alignment, design.format, els.length > 1 ? "selection" : "page");
    });
  },

  distributeSelection(direction: "horizontal" | "vertical") {
    const ids = unlockedSelection();
    if (ids.length < 3) return;
    onCurrentPage("distribute", (page) => {
      const els = ids.map((id) => findElement(page, id)).filter((e): e is Element => Boolean(e));
      distributeElements(els, direction);
    });
  },

  /** Top-level, unlocked selected elements that can be grouped (needs 2+). */
  groupableSelection(): string[] {
    const page = currentPage();
    if (!page) return [];
    const ids = new Set(state().selection);
    return page.elements.filter((e) => ids.has(e.id) && !e.locked).map((e) => e.id);
  },

  /** Selected groups that can be ungrouped. */
  ungroupableSelection(): string[] {
    const page = currentPage();
    if (!page) return [];
    const ids = new Set(state().selection);
    return page.elements
      .filter((e) => ids.has(e.id) && e.type === "group" && !e.locked)
      .map((e) => e.id);
  },

  /** Ctrl+G — the selected elements become one group that moves and resizes as a unit. */
  groupSelection() {
    const ids = editorActions.groupableSelection();
    if (ids.length < 2) return;
    let groupId = null as string | null;
    onCurrentPage("group", (page) => {
      groupId = groupElements(page, ids);
    });
    if (groupId) state().select([groupId]);
  },

  /** Ctrl+Shift+G — splits the selected groups back into their elements (all selected). */
  ungroupSelection() {
    const ids = editorActions.ungroupableSelection();
    if (ids.length === 0) return;
    let released: string[] = [];
    onCurrentPage("ungroup", (page) => {
      released = ungroupElements(page, ids);
    });
    if (released.length > 0) state().select(released);
  },

  /** Sets a group's width or height; the other side and everything inside scale with it. */
  resizeGroup(id: string, width?: number, height?: number, mergeKey?: string) {
    onCurrentPage(
      "resize",
      (page) => {
        const el = findElement(page, id);
        if (el?.type !== "group" || el.locked || el.width <= 0 || el.height <= 0) return;
        const k =
          width !== undefined
            ? Math.max(1, width) / el.width
            : Math.max(1, height ?? el.height) / el.height;
        if (!Number.isFinite(k) || Math.abs(k - 1) < 1e-4) return;
        el.children = scaleChildren(current(el).children, k, k);
        el.width = Math.round(el.width * k * 100) / 100;
        el.height = Math.round(el.height * k * 100) / 100;
      },
      { mergeKey },
    );
  },

  // ─── AI results (each is ONE undo step) ──────────────────────────────────

  /** Replaces the current page's background and elements (Magic Design). */
  replacePageContent(content: { background: Background; elements: Element[] }) {
    onCurrentPage(
      "magicDesign",
      (page) => {
        page.background = structuredClone(content.background);
        page.elements = structuredClone(content.elements);
      },
      { select: [] },
    );
  },

  /** Applies validated assistant tool calls as a single change. */
  applyAssistant(actions: AssistantAction[]): ApplyResult {
    let result: ApplyResult = { touched: [], applied: 0, skipped: actions.length };
    const { design, pageId, change } = state();
    if (!design || !pageId || actions.length === 0) return result;
    change("assistant", (draft) => {
      const page = getPage(draft, pageId);
      if (page) result = applyAssistantActions(page, actions, draft.format);
    });
    state().select(result.touched);
    return result;
  },

  applyPaletteToPage(colors: string[]) {
    onCurrentPage("palette", (page) => void applyPalette(page, colors));
  },

  /**
   * Headings/subheadings get the heading font; everything else the body font.
   * Arabic text keeps a font that has Arabic letters.
   */
  applyFontPairing(headingFont: string, bodyFont: string) {
    onCurrentPage("fonts", (page) => {
      for (const el of flattenElements(page.elements)) {
        if (el.type !== "text") continue;
        const wanted = el.role === "heading" || el.role === "subheading" ? headingFont : bodyFont;
        const text = el.runs.map((r) => r.text).join("");
        const fontFamily = fontForText(text, wanted, el.fontFamily, el.fontWeight);
        Object.assign(el, withTextStyle(el, { fontFamily }));
      }
    });
  },

  /**
   * Replaces a text element's words, keeping the style of its first run.
   * Switching script (e.g. English → Arabic) also flips direction/alignment
   * and picks a font that has the needed letters.
   */
  setTextContent(id: string, text: string) {
    onCurrentPage("aiWrite", (page) => {
      const el = findElement(page, id);
      if (el?.type !== "text") return;
      const { fontFamily: _drop, ...style } = el.runs[0]?.style ?? {};
      const patch = directionPatch(el, text);
      el.runs = [
        {
          text: text.slice(0, 20_000),
          style: patch.fontFamily ? style : { ...(el.runs[0]?.style ?? {}) },
        },
      ];
      Object.assign(el, patch);
    });
  },
};
