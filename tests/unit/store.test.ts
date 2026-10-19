import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDesign, createShape, createText } from "@/lib/document/factory";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import { findElement } from "@/lib/document/tree";
import { editorActions } from "@/lib/store/actions";
import {
  HISTORY_LIMIT,
  MERGE_WINDOW_MS,
  selectCurrentPage,
  useEditorStore,
} from "@/lib/store/editor-store";

const format = formatFromPreset(getPreset("instagramPost")!);
const s = () => useEditorStore.getState();
const page = () => selectCurrentPage(s())!;
const ids = () => page().elements.map((e) => e.id);

beforeEach(() => {
  s().load(createDesign({ format }));
});

describe("editor store", () => {
  it("adds an element, selects it and can undo/redo", () => {
    const rect = createShape("rect", format);
    editorActions.addElements([rect]);
    expect(ids()).toEqual([rect.id]);
    expect(s().selection).toEqual([rect.id]);
    expect(s().saveState).toBe("unsaved");

    s().undo();
    expect(ids()).toEqual([]);
    expect(s().selection).toEqual([]);

    s().redo();
    expect(ids()).toEqual([rect.id]);
    expect(s().selection).toEqual([rect.id]);
  });

  it("clears redo history after a new change", () => {
    editorActions.addElements([createShape("rect", format)]);
    s().undo();
    expect(s().future).toHaveLength(1);
    editorActions.addElements([createShape("ellipse", format)]);
    expect(s().future).toHaveLength(0);
  });

  it("keeps at least 100 undo steps", () => {
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(100);
    const rect = createShape("rect", format);
    editorActions.addElements([rect]);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) editorActions.updateElement(rect.id, { x: i });
    expect(s().past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < 100; i++) s().undo();
    expect(findElement(page(), rect.id)?.x).toBe(HISTORY_LIMIT + 20 - 101);
  });

  it("merges rapid changes with the same key into one undo step", () => {
    vi.useFakeTimers();
    try {
      const rect = createShape("rect", format, { x: 100 });
      editorActions.addElements([rect]);
      editorActions.nudgeSelection(1, 0);
      vi.advanceTimersByTime(100);
      editorActions.nudgeSelection(1, 0);
      vi.advanceTimersByTime(100);
      editorActions.nudgeSelection(0, 5);
      expect(s().past).toHaveLength(2);
      expect(findElement(page(), rect.id)).toMatchObject({ x: 102, y: rect.y + 5 });
      s().undo();
      expect(findElement(page(), rect.id)).toMatchObject({ x: 100, y: rect.y });

      // After the merge window a new step starts.
      s().redo();
      vi.advanceTimersByTime(MERGE_WINDOW_MS + 1);
      editorActions.nudgeSelection(1, 0);
      expect(s().past).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not record no-op changes", () => {
    const rect = createShape("rect", format);
    editorActions.addElements([rect]);
    const before = s().past.length;
    editorActions.updateElement(rect.id, { x: rect.x });
    expect(s().past.length).toBe(before);
  });

  it("deletes, duplicates and reorders the selection", () => {
    const a = createShape("rect", format);
    const b = createShape("ellipse", format);
    editorActions.addElements([a, b]);
    s().select([a.id]);
    editorActions.reorderSelection("front");
    expect(ids()).toEqual([b.id, a.id]);

    editorActions.duplicateSelection();
    expect(ids()).toHaveLength(3);
    expect(s().selection).toHaveLength(1);
    expect(s().selection[0]).not.toBe(a.id);

    editorActions.deleteSelection();
    expect(ids()).toEqual([b.id, a.id]);
  });

  it("never moves or deletes locked elements", () => {
    const a = createShape("rect", format, { x: 10 });
    editorActions.addElements([a]);
    editorActions.toggleLock(a.id);
    editorActions.nudgeSelection(5, 5);
    editorActions.deleteSelection();
    expect(findElement(page(), a.id)).toMatchObject({ x: 10, locked: true });
  });

  it("copies and pastes with new ids and an offset", () => {
    const t = createText("heading", format);
    editorActions.addElements([t]);
    editorActions.copySelection();
    editorActions.paste();
    editorActions.paste();
    expect(ids()).toHaveLength(3);
    const [, first, second] = page().elements;
    expect(first!.id).not.toBe(t.id);
    expect(first!.x).toBe(t.x + 20);
    expect(second!.x).toBe(t.x + 40);
  });

  it("drops selection ids that no longer exist", () => {
    s().select(["ghost"]);
    expect(s().selection).toEqual([]);
  });

  it("renames the design (ignoring blank names)", () => {
    editorActions.renameDesign("  Summer sale  ");
    expect(s().design!.name).toBe("Summer sale");
    editorActions.renameDesign("   ");
    expect(s().design!.name).toBe("Summer sale");
  });
});
