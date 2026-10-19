import { beforeEach, describe, expect, it } from "vitest";
import { CLIPBOARD_PREFIX, parseClipboardText, serializeElements } from "@/lib/document/clipboard";
import { createDesign, createShape } from "@/lib/document/factory";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import type { TextElement } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";

const format = formatFromPreset(getPreset("instagramPost")!);
const s = () => useEditorStore.getState();
const page = () => selectCurrentPage(s())!;

beforeEach(() => s().load(createDesign({ format })));

describe("clipboard text format", () => {
  it("round-trips elements and rejects anything else", () => {
    const shape = createShape("star", format);
    const text = serializeElements([shape]);
    expect(text.startsWith(CLIPBOARD_PREFIX)).toBe(true);
    expect(parseClipboardText(text)).toEqual([shape]);
    expect(parseClipboardText("hello")).toBeNull();
    expect(parseClipboardText(`${CLIPBOARD_PREFIX}{not json`)).toBeNull();
    expect(
      parseClipboardText(`${CLIPBOARD_PREFIX}${JSON.stringify({ elements: [{ type: "evil" }] })}`),
    ).toBeNull();
  });
});

describe("pasting", () => {
  it("pastes elements from another tab with fresh ids, stepping each time", () => {
    const shape = createShape("rect", format);
    const text = serializeElements([shape]);
    editorActions.pasteFromSystem(parseClipboardText(text)!, text);
    editorActions.pasteFromSystem(parseClipboardText(text)!, text);
    const [first, second] = page().elements;
    expect(first!.id).not.toBe(shape.id);
    expect(second!.id).not.toBe(first!.id);
    expect(first!.x).toBe(shape.x + 20);
    expect(second!.x).toBe(shape.x + 40);
  });

  it("turns outside text into a text box (right-to-left for Arabic)", () => {
    editorActions.pasteText("Hello\r\nworld");
    const english = page().elements[0] as TextElement;
    expect(english.type).toBe("text");
    expect(english.runs[0]!.text).toBe("Hello\nworld");
    expect(english.x + english.width / 2).toBeCloseTo(format.width / 2, 0);

    editorActions.pasteText("مرحبا بالعالم");
    const arabic = page().elements[1] as TextElement;
    expect(arabic.direction).toBe("rtl");
  });

  it("puts copied elements on the system clipboard", () => {
    const shape = createShape("rect", format);
    editorActions.addElements([shape]);
    s().select([shape.id]);
    editorActions.copySelection();
    const text = editorActions.clipboardText()!;
    expect(parseClipboardText(text)?.[0]?.id).toBe(shape.id);
  });
});
