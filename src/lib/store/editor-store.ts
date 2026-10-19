/**
 * The editor's in-memory state: the open design, the current page and
 * selection, and an undo/redo history built from Immer patches.
 *
 * Every change to the design goes through `change()`, which records the exact
 * forward and inverse patches — so undo/redo is cheap and precise, and a batch
 * of edits (e.g. everything an AI request did) is one undo step.
 */
import { applyPatches, enablePatches, produce, produceWithPatches, type Patch } from "immer";
import { create } from "zustand";
import { findElement, getPage, patchElement } from "@/lib/document/tree";
import type { Design, Element } from "@/lib/schema";

enablePatches();

export const HISTORY_LIMIT = 200;
/** Changes with the same mergeKey within this window become one undo step (slider drags, nudges). */
export const MERGE_WINDOW_MS = 1_000;

interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
  mergeKey?: string;
  at: number;
  pageBefore: string | null;
  selectionBefore: string[];
  pageAfter: string | null;
  selectionAfter: string[];
}

export interface ChangeOptions {
  /** Coalesce with the previous change if it has the same key and happened moments ago. */
  mergeKey?: string;
  /** Selection to apply once the change is done (defaults to the current one). */
  select?: string[];
  /** Page to switch to once the change is done. */
  page?: string;
}

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export interface EditorState {
  design: Design | null;
  pageId: string | null;
  selection: string[];
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Bumped on every document change (including undo/redo); autosave watches it. */
  revision: number;
  savedRevision: number;
  saveState: SaveState;
  /** Display-only mirror of the canvas zoom (the engine owns the real viewport). */
  zoom: number;
  /** Element currently in inline text editing, if any. */
  editingTextId: string | null;

  load: (design: Design) => void;
  close: () => void;
  change: (label: string, recipe: (draft: Design) => void, options?: ChangeOptions) => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  setPage: (pageId: string) => void;
  /**
   * Stores values the canvas computed (e.g. laid-out text height) WITHOUT an undo
   * step — they are consequences of other edits, not edits themselves.
   */
  syncDerived: (pageId: string, changes: { id: string; patch: Partial<Element> }[]) => void;
  setZoom: (zoom: number) => void;
  setEditingText: (id: string | null) => void;
  setSaveState: (state: SaveState, savedRevision?: number) => void;
}

/** Drops selected IDs that no longer exist on the page. */
function validSelection(design: Design, pageId: string | null, ids: string[]): string[] {
  const page = pageId ? getPage(design, pageId) : undefined;
  if (!page) return [];
  return ids.filter((id) => findElement(page, id));
}

function validPage(design: Design, pageId: string | null): string | null {
  if (pageId && getPage(design, pageId)) return pageId;
  return design.pages[0]?.id ?? null;
}

const initial = {
  design: null,
  pageId: null,
  selection: [],
  past: [],
  future: [],
  revision: 0,
  savedRevision: 0,
  saveState: "saved" as SaveState,
  zoom: 1,
  editingTextId: null,
};

export const useEditorStore = create<EditorState>()((set, get) => ({
  ...initial,

  load: (design) => set({ ...initial, design, pageId: design.pages[0]?.id ?? null }),

  close: () => set({ ...initial }),

  change: (label, recipe, options = {}) => {
    const state = get();
    if (!state.design) return;
    const [next, patches, inverse] = produceWithPatches(state.design, recipe);
    if (patches.length === 0) {
      if (options.select)
        set({ selection: validSelection(state.design, state.pageId, options.select) });
      return;
    }

    const pageAfter = validPage(next, options.page ?? state.pageId);
    const selectionAfter = validSelection(next, pageAfter, options.select ?? state.selection);
    const now = Date.now();
    const last = state.past.at(-1);
    let past: HistoryEntry[];

    if (
      options.mergeKey &&
      last?.mergeKey === options.mergeKey &&
      now - last.at < MERGE_WINDOW_MS &&
      state.future.length === 0
    ) {
      past = [
        ...state.past.slice(0, -1),
        {
          ...last,
          patches: [...last.patches, ...patches],
          inverse: [...inverse, ...last.inverse],
          at: now,
          pageAfter,
          selectionAfter,
        },
      ];
    } else {
      past = [
        ...state.past,
        {
          label,
          patches,
          inverse,
          mergeKey: options.mergeKey,
          at: now,
          pageBefore: state.pageId,
          selectionBefore: state.selection,
          pageAfter,
          selectionAfter,
        },
      ].slice(-HISTORY_LIMIT);
    }

    set({
      design: next,
      past,
      future: [],
      pageId: pageAfter,
      selection: selectionAfter,
      revision: state.revision + 1,
      saveState: "unsaved",
    });
  },

  undo: () => {
    const state = get();
    const entry = state.past.at(-1);
    if (!state.design || !entry) return;
    const design = applyPatches(state.design, entry.inverse);
    const pageId = validPage(design, entry.pageBefore);
    set({
      design,
      past: state.past.slice(0, -1),
      future: [entry, ...state.future],
      pageId,
      selection: validSelection(design, pageId, entry.selectionBefore),
      revision: state.revision + 1,
      saveState: "unsaved",
      editingTextId: null,
    });
  },

  redo: () => {
    const state = get();
    const entry = state.future[0];
    if (!state.design || !entry) return;
    const design = applyPatches(state.design, entry.patches);
    const pageId = validPage(design, entry.pageAfter);
    set({
      design,
      past: [...state.past, entry],
      future: state.future.slice(1),
      pageId,
      selection: validSelection(design, pageId, entry.selectionAfter),
      revision: state.revision + 1,
      saveState: "unsaved",
      editingTextId: null,
    });
  },

  select: (ids) => {
    const { design, pageId, selection } = get();
    if (!design) return;
    const next = validSelection(design, pageId, ids);
    if (next.length === selection.length && next.every((id, i) => id === selection[i])) return;
    set({ selection: next });
  },

  setPage: (pageId) => {
    const { design } = get();
    if (!design || !getPage(design, pageId)) return;
    set({ pageId, selection: [], editingTextId: null });
  },

  syncDerived: (pageId, changes) => {
    const { design, revision } = get();
    if (!design || changes.length === 0) return;
    const next = produce(design, (draft) => {
      const page = getPage(draft, pageId);
      if (page) changes.forEach((c) => patchElement(page, c.id, c.patch));
    });
    if (next !== design) set({ design: next, revision: revision + 1, saveState: "unsaved" });
  },

  setZoom: (zoom) => set({ zoom }),

  setEditingText: (editingTextId) => set({ editingTextId }),

  setSaveState: (saveState, savedRevision) =>
    set(savedRevision === undefined ? { saveState } : { saveState, savedRevision }),
}));

/** The page currently shown in the editor. */
export function selectCurrentPage(state: EditorState) {
  return state.design && state.pageId ? getPage(state.design, state.pageId) : undefined;
}

export const selectCanUndo = (state: EditorState) => state.past.length > 0;
export const selectCanRedo = (state: EditorState) => state.future.length > 0;
