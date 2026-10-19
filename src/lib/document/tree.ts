/**
 * Pure helpers for reading and changing a design's element tree.
 * The mutating functions are written for Immer drafts (they mutate in place);
 * the editor store wraps them so every change is undoable.
 */
import { current, isDraft, type Draft } from "immer";
import { createId } from "@/lib/id";
import type { Design, Element, ElementOfType, ElementType, Page } from "@/lib/schema";

export function getPage(design: Design, pageId: string): Page | undefined {
  return design.pages.find((p) => p.id === pageId);
}

export interface ElementLocation {
  element: Element;
  /** The array that holds the element (page.elements or a group's children). */
  siblings: Element[];
  index: number;
  /** Enclosing group, if any. */
  parent: ElementOfType<"group"> | null;
}

/** Finds an element anywhere in the tree (including inside groups). */
export function locate(
  elements: Element[],
  id: string,
  parent: ElementOfType<"group"> | null = null,
): ElementLocation | undefined {
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index]!;
    if (element.id === id) return { element, siblings: elements, index, parent };
    if (element.type === "group") {
      const found = locate(element.children, id, element);
      if (found) return found;
    }
  }
  return undefined;
}

export function findElement(page: Page, id: string): Element | undefined {
  return locate(page.elements, id)?.element;
}

/** Depth-first list of every element (groups before their children). */
export function flattenElements(elements: Element[]): Element[] {
  return elements.flatMap((e) => (e.type === "group" ? [e, ...flattenElements(e.children)] : [e]));
}

export function isElementOfType<T extends ElementType>(
  element: Element | undefined,
  type: T,
): element is ElementOfType<T> {
  return element?.type === type;
}

// ─── Mutations (use inside Immer recipes) ────────────────────────────────────

export function insertElements(page: Page, elements: Element[], index = page.elements.length) {
  page.elements.splice(Math.max(0, Math.min(index, page.elements.length)), 0, ...elements);
}

/** Shallow-merges `patch` into the element. `id` and `type` can never change. */
export function patchElement(page: Page, id: string, patch: Partial<Element>): boolean {
  const found = locate(page.elements, id);
  if (!found) return false;
  const { id: _id, type: _type, ...rest } = patch as Partial<Element> & { id?: string };
  Object.assign(found.element, rest);
  return true;
}

export function removeElements(page: Page, ids: readonly string[]): number {
  let removed = 0;
  for (const id of ids) {
    const found = locate(page.elements, id);
    if (found) {
      found.siblings.splice(found.index, 1);
      removed++;
    }
  }
  return removed;
}

/** Deep-copies an element with fresh IDs (children included). */
export function cloneWithNewIds<T extends Element>(element: T): T {
  // Immer drafts are proxies that structuredClone can't copy — snapshot them first.
  const source: unknown = isDraft(element) ? current(element as Draft<T>) : element;
  const copy = structuredClone(source) as T;
  const reassign = (e: Element) => {
    e.id = createId();
    if (e.type === "group") e.children.forEach(reassign);
  };
  reassign(copy);
  return copy;
}

/**
 * Duplicates top-level elements, placing each copy just above its original and
 * offset so it is visible. Returns the new IDs in the same order.
 */
export function duplicateElements(page: Page, ids: readonly string[], offset = 20): string[] {
  const newIds: string[] = [];
  for (const id of ids) {
    const found = locate(page.elements, id);
    if (!found) continue;
    const copy = cloneWithNewIds(found.element);
    copy.x += offset;
    copy.y += offset;
    found.siblings.splice(found.index + 1, 0, copy);
    newIds.push(copy.id);
  }
  return newIds;
}

export type OrderOp = "forward" | "backward" | "front" | "back";

/**
 * Changes stacking order among siblings. Index 0 is the bottom of the stack.
 * Multiple elements keep their relative order.
 */
export function reorderElements(page: Page, ids: readonly string[], op: OrderOp) {
  const wanted = new Set(ids);
  // Group the selected ids by the array that holds them.
  const bySiblings = new Map<Element[], Set<string>>();
  for (const id of ids) {
    const found = locate(page.elements, id);
    if (!found) continue;
    const set = bySiblings.get(found.siblings) ?? new Set<string>();
    set.add(id);
    bySiblings.set(found.siblings, set);
  }

  for (const [siblings, set] of bySiblings) {
    const isSel = (e: Element) => set.has(e.id) && wanted.has(e.id);
    if (op === "front" || op === "back") {
      const selected = siblings.filter(isSel);
      const rest = siblings.filter((e) => !isSel(e));
      siblings.splice(
        0,
        siblings.length,
        ...(op === "front" ? [...rest, ...selected] : [...selected, ...rest]),
      );
      continue;
    }
    if (op === "forward") {
      for (let i = siblings.length - 2; i >= 0; i--) {
        if (isSel(siblings[i]!) && !isSel(siblings[i + 1]!)) {
          [siblings[i], siblings[i + 1]] = [siblings[i + 1]!, siblings[i]!];
        }
      }
    } else {
      for (let i = 1; i < siblings.length; i++) {
        if (isSel(siblings[i]!) && !isSel(siblings[i - 1]!)) {
          [siblings[i], siblings[i - 1]] = [siblings[i - 1]!, siblings[i]!];
        }
      }
    }
  }
}

/** Moves one top-level element to an exact stack index (used by drag-reorder in the layers panel). */
export function moveElementToIndex(page: Page, id: string, toIndex: number) {
  const found = locate(page.elements, id);
  if (!found) return;
  const [element] = found.siblings.splice(found.index, 1);
  const clamped = Math.max(0, Math.min(toIndex, found.siblings.length));
  found.siblings.splice(clamped, 0, element!);
}

/** A readable default name for the layers panel. */
export function describeElement(element: Element): string {
  if (element.name) return element.name;
  if (element.type === "text") {
    const text = element.runs
      .map((r) => r.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 40 ? `${text.slice(0, 40)}…` : text || "Text";
  }
  if (element.type === "shape") return element.kind.charAt(0).toUpperCase() + element.kind.slice(1);
  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
}
