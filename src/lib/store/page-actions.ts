/**
 * Page commands (add, duplicate, delete, reorder, notes). Each is one undo
 * step, and undo/redo also brings you back to the page it happened on.
 */
import { createPage } from "@/lib/document/factory";
import { cloneWithNewIds, getPage } from "@/lib/document/tree";
import { createId } from "@/lib/id";
import { LIMITS, type Animation, type Page, type PageTransition } from "@/lib/schema";
import { useEditorStore } from "./editor-store";

const state = () => useEditorStore.getState();

function indexOf(pageId: string | null): number {
  const pages = state().design?.pages ?? [];
  return Math.max(
    0,
    pages.findIndex((p) => p.id === pageId),
  );
}

export const pageActions = {
  /** Adds a blank page after `afterId` (default: the current page) and opens it. */
  addPage(afterId?: string | null, page?: Page) {
    const { design, pageId, change } = state();
    if (!design || design.pages.length >= LIMITS.pages) return null;
    const at = indexOf(afterId ?? pageId) + 1;
    const next = page ?? createPage();
    change("addPage", (draft) => void draft.pages.splice(at, 0, next), {
      page: next.id,
      select: [],
    });
    return next.id;
  },

  /**
   * Uses a template: on an empty page its first page replaces the page;
   * otherwise its pages are added after the current one. One undo step.
   */
  applyTemplate(pages: Page[]) {
    const { design, pageId, change } = state();
    if (!design || pages.length === 0) return;
    const at = indexOf(pageId);
    const current = design.pages[at];
    const reuse = Boolean(current && current.elements.length === 0);
    const room = LIMITS.pages - design.pages.length + (reuse ? 1 : 0);
    const incoming = pages.slice(0, Math.max(0, room));
    if (incoming.length === 0) return;
    const firstId = reuse ? current!.id : incoming[0]!.id;
    change(
      "template",
      (draft) => {
        if (reuse) {
          const page = draft.pages[at]!;
          page.background = structuredClone(incoming[0]!.background);
          page.elements = structuredClone(incoming[0]!.elements);
          page.animation = incoming[0]!.animation;
          draft.pages.splice(at + 1, 0, ...structuredClone(incoming.slice(1)));
        } else {
          draft.pages.splice(at + 1, 0, ...structuredClone(incoming));
        }
      },
      { page: firstId, select: [] },
    );
  },

  /** Copies a page (and everything on it) right after itself. */
  duplicatePage(id: string) {
    const { design } = state();
    const source = design ? getPage(design, id) : undefined;
    if (!source) return null;
    const copy: Page = {
      ...structuredClone(source),
      id: createId(),
      elements: source.elements.map((e) => cloneWithNewIds(e)),
    };
    return pageActions.addPage(id, copy);
  },

  /** Deletes a page; the last remaining page is cleared instead. */
  deletePage(id: string) {
    const { design, change } = state();
    if (!design) return;
    const index = design.pages.findIndex((p) => p.id === id);
    if (index === -1) return;
    if (design.pages.length === 1) {
      change("clearPage", (draft) => {
        const page = draft.pages[0]!;
        page.elements = [];
        page.notes = "";
      });
      return;
    }
    const neighbour = design.pages[index + 1] ?? design.pages[index - 1]!;
    change("deletePage", (draft) => void draft.pages.splice(index, 1), {
      page: neighbour.id,
      select: [],
    });
  },

  movePage(id: string, toIndex: number) {
    const { design, change } = state();
    if (!design) return;
    const from = design.pages.findIndex((p) => p.id === id);
    const to = Math.max(0, Math.min(design.pages.length - 1, toIndex));
    if (from === -1 || from === to) return;
    change("movePage", (draft) => {
      const [page] = draft.pages.splice(from, 1);
      draft.pages.splice(to, 0, page!);
    });
  },

  renamePage(id: string, name: string) {
    state().change("renamePage", (draft) => {
      const page = getPage(draft, id);
      if (page) page.name = name.trim().slice(0, LIMITS.nameLength);
    });
  },

  setNotes(id: string, notes: string) {
    state().change(
      "notes",
      (draft) => {
        const page = getPage(draft, id);
        if (page) page.notes = notes.slice(0, LIMITS.textLength);
      },
      { mergeKey: `notes:${id}` },
    );
  },

  setTransition(id: string, transition: PageTransition) {
    state().change("transition", (draft) => {
      const page = getPage(draft, id);
      if (page) page.transition = transition;
    });
  },

  /** The entrance animation for every element that has none of its own. */
  setAnimation(id: string, animation: Animation | null) {
    state().change("animate", (draft) => {
      const page = getPage(draft, id);
      if (page) page.animation = animation;
    });
  },

  /** How long the page shows in autoplay (and animated exports). */
  setDuration(id: string, ms: number) {
    state().change(
      "duration",
      (draft) => {
        const page = getPage(draft, id);
        if (page) page.durationMs = Math.max(500, Math.min(600_000, Math.round(ms)));
      },
      { mergeKey: `duration:${id}` },
    );
  },

  /** Opens the page `delta` steps away (−1 = previous, 1 = next). */
  step(delta: number) {
    const { design, pageId, setPage } = state();
    if (!design) return;
    const target = design.pages[indexOf(pageId) + delta];
    if (target) setPage(target.id);
  },

  goTo(index: number) {
    const { design, setPage } = state();
    const target = design?.pages[index];
    if (target) setPage(target.id);
  },
};
