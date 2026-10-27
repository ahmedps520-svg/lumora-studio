"use client";
/**
 * Opening, closing and autosaving the photo document that's in the editor.
 */
import { create } from "zustand";
import { clearRegistry, flatten } from "./runtime";
import { type LayerBlobs, openedBlobs, prepareSave } from "./storage";
import { DEFAULT_OPTIONS, get, noteChanged, set, takeChanged } from "./store";
import type { PhotoDoc } from "./types";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export const useSaveState = create<{ state: SaveState }>(() => ({ state: "saved" }));

/** PNGs of the open document as last saved (reused for layers that didn't change). */
let saved: { id: string; blobs: LayerBlobs } | null = null;
let lastThumbnail = 0;

/** Puts a loaded document (pixels already in the registry) into the editor. */
export function openDocument(doc: PhotoDoc) {
  saved = { id: doc.id, blobs: openedBlobs(doc.id) };
  takeChanged();
  lastThumbnail = Date.now();
  set({
    doc,
    rev: get().rev + 1,
    activeId: doc.layers[doc.layers.length - 1]?.id ?? null,
    selectedIds: [],
    activePathId: null,
    selection: null,
    lastSelection: null,
    savedSelection: null,
    quickMask: false,
    maskEdit: false,
    history: [],
    historyIndex: 0,
    dirty: false,
    overrides: null,
    adjustmentOverride: null,
    dialog: null,
    transform: null,
    cursor: null,
    original: flatten(doc),
    busy: null,
    // Fit to the window once the viewport measures itself.
    zoom: 0,
  });
  useSaveState.setState({ state: "saved" });
}

export function closeDocument() {
  set({
    doc: null,
    history: [],
    historyIndex: 0,
    original: null,
    selection: null,
    overrides: null,
    transform: null,
  });
  clearRegistry();
}

export function resetToolOptions() {
  set({ options: DEFAULT_OPTIONS });
}

let chain: Promise<void> = Promise.resolve();

/**
 * Saves now. What's on screen is captured immediately; writes run one after
 * another so an older save never lands after a newer one. Only layers whose
 * pixels changed are encoded again; the gallery thumbnail is refreshed every
 * 15 seconds at most, or when `final` (leaving the editor).
 */
export function saveNow(opts: { final?: boolean } = {}): Promise<void> {
  const doc = get().doc;
  if (!doc) return chain;
  const changed = takeChanged();
  const reuse = saved?.id === doc.id ? saved.blobs : undefined;
  const thumbnail = opts.final || Date.now() - lastThumbnail > 15_000;
  if (thumbnail) lastThumbnail = Date.now();
  const write = prepareSave(doc, { reuse, changed: reuse ? changed : "all", thumbnail });
  // What identifies this version: every edit replaces the history list or the document.
  const { history, historyIndex } = get();
  useSaveState.setState({ state: "saving" });
  chain = chain
    .then(write)
    .then((blobs) => {
      saved = { id: doc.id, blobs };
      // Nothing changed since the capture → everything is on disk.
      const now = get();
      if (now.doc === doc && now.history === history && now.historyIndex === historyIndex)
        set({ dirty: false });
      useSaveState.setState({ state: get().dirty ? "unsaved" : "saved" });
    })
    .catch((error: unknown) => {
      // Try those layers again next time.
      noteChanged(changed);
      console.error("[photo] save failed", error);
      useSaveState.setState({ state: "error" });
    });
  return chain;
}
