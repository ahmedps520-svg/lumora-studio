import { beforeEach, describe, expect, it } from "vitest";
import { createDesign, createLine, createShape, createText } from "@/lib/document/factory";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import { applyStyle, extractStyle } from "@/lib/document/style";
import { findElement } from "@/lib/document/tree";
import type { ShapeElement, TextElement } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";

const format = formatFromPreset(getPreset("instagramPost")!);

describe("copy / paste style", () => {
  it("copies the whole look between elements of the same kind", () => {
    const source = createText("heading", format, {
      fontFamily: "Luckiest Guy",
      fontSize: 120,
      fill: { type: "solid", color: "#FF0000" },
      stroke: { color: "#000000", width: 12, dash: [] },
      extrude: { depth: 20, color: "#880000", angle: 100 },
      opacity: 0.8,
    });
    const target = createText("body", format, {
      runs: [{ text: "Hi", style: { color: "#00FF00" } }],
    });
    applyStyle(target, extractStyle(source));
    expect(target).toMatchObject({
      fontFamily: "Luckiest Guy",
      fontSize: 120,
      fill: { type: "solid", color: "#FF0000" },
      stroke: { width: 12 },
      extrude: { depth: 20 },
      opacity: 0.8,
    });
    // Run-level colour overrides give way to the pasted colour.
    expect(target.runs[0]!.style.color).toBeUndefined();
    expect(target.runs[0]!.text).toBe("Hi");
  });

  it("carries the sensible parts across kinds", () => {
    const shape = createShape("rect", format, {
      fill: { type: "solid", color: "#123456" },
      stroke: { color: "#FFFFFF", width: 6, dash: [] },
      cornerRadius: 40,
      shadow: { color: "#00000080", blur: 10, offsetX: 0, offsetY: 4 },
    });
    const text = createText("body", format);
    applyStyle(text, extractStyle(shape));
    expect(text.fill).toEqual({ type: "solid", color: "#123456" });
    expect(text.stroke?.width).toBe(6);
    expect(text.shadow?.blur).toBe(10);
    expect("cornerRadius" in text).toBe(false);

    const line = createLine(format);
    applyStyle(line, extractStyle(shape));
    expect(line.stroke.color).toBe("#FFFFFF");
  });

  it("never restyles locked elements", () => {
    const shape = createShape("rect", format, { locked: true });
    applyStyle(shape, extractStyle(createShape("ellipse", format, { opacity: 0.2 })));
    expect(shape.opacity).toBe(1);
  });

  describe("store", () => {
    const s = () => useEditorStore.getState();
    beforeEach(() => s().load(createDesign({ format })));

    it("pastes onto every selected element as one undo step", () => {
      const a = createShape("rect", format, { fill: { type: "solid", color: "#FF7A3D" } });
      const b = createShape("ellipse", format);
      const c = createShape("star", format);
      editorActions.addElements([a, b, c]);
      s().select([a.id]);
      expect(editorActions.copyStyle()).toBe(true);
      s().select([b.id, c.id]);
      editorActions.pasteStyle();
      const page = selectCurrentPage(s())!;
      for (const id of [b.id, c.id]) {
        expect((findElement(page, id) as ShapeElement).fill).toEqual({
          type: "solid",
          color: "#FF7A3D",
        });
      }
      s().undo();
      expect((findElement(selectCurrentPage(s())!, b.id) as ShapeElement).fill).not.toEqual(a.fill);
    });

    it("locks and unlocks the whole selection", () => {
      const a = createText("body", format);
      const b = createShape("rect", format);
      editorActions.addElements([a, b]);
      s().select([a.id, b.id]);
      editorActions.toggleLockSelection();
      const page = () => selectCurrentPage(s())!;
      expect((findElement(page(), a.id) as TextElement).locked).toBe(true);
      expect(findElement(page(), b.id)!.locked).toBe(true);
      editorActions.toggleLockSelection();
      expect(findElement(page(), b.id)!.locked).toBe(false);
    });
  });
});
