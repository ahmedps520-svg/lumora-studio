import { beforeEach, describe, expect, it } from "vitest";
import { createDesign, createShape } from "@/lib/document/factory";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";
import { pageActions } from "@/lib/store/page-actions";

const format = formatFromPreset(getPreset("presentation16x9")!);
const s = () => useEditorStore.getState();
const pageIds = () => s().design!.pages.map((p) => p.id);
const currentIndex = () => pageIds().indexOf(s().pageId!);

beforeEach(() => s().load(createDesign({ format })));

describe("page commands", () => {
  it("adds a page after the current one and opens it; undo goes back", () => {
    const first = s().pageId!;
    const added = pageActions.addPage()!;
    expect(pageIds()).toEqual([first, added]);
    expect(s().pageId).toBe(added);
    s().undo();
    expect(pageIds()).toEqual([first]);
    expect(s().pageId).toBe(first);
    s().redo();
    expect(s().pageId).toBe(added);
  });

  it("duplicates a page with fresh element ids", () => {
    editorActions.addElements([createShape("rect", format)]);
    const original = s().design!.pages[0]!;
    const copyId = pageActions.duplicatePage(original.id)!;
    const copy = s().design!.pages[1]!;
    expect(copy.id).toBe(copyId);
    expect(copy.elements).toHaveLength(1);
    expect(copy.elements[0]!.id).not.toBe(original.elements[0]!.id);
    expect(copy.elements[0]!.x).toBe(original.elements[0]!.x);
  });

  it("deletes a page and opens its neighbour; the last page is cleared instead", () => {
    const a = s().pageId!;
    const b = pageActions.addPage()!;
    pageActions.deletePage(b);
    expect(pageIds()).toEqual([a]);
    expect(s().pageId).toBe(a);

    editorActions.addElements([createShape("rect", format)]);
    pageActions.deletePage(a);
    expect(pageIds()).toEqual([a]);
    expect(s().design!.pages[0]!.elements).toHaveLength(0);
  });

  it("reorders pages and steps between them", () => {
    const a = s().pageId!;
    const b = pageActions.addPage()!;
    const c = pageActions.addPage()!;
    pageActions.movePage(c, 0);
    expect(pageIds()).toEqual([c, a, b]);
    pageActions.goTo(0);
    pageActions.step(1);
    expect(s().pageId).toBe(a);
    pageActions.step(5); // out of range: stays
    expect(currentIndex()).toBe(1);
  });

  it("keeps speaker notes, merging fast typing into one undo step", () => {
    const id = s().pageId!;
    pageActions.setNotes(id, "H");
    pageActions.setNotes(id, "Hello");
    expect(s().design!.pages[0]!.notes).toBe("Hello");
    s().undo();
    expect(s().design!.pages[0]!.notes).toBe("");
  });
});

describe("applying templates", () => {
  it("fills an empty page, adds the rest after it, and undoes in one step", async () => {
    const { buildTemplate, catalog } = await import("@/lib/templates");
    const deck = catalog().find((d) => d.kind === "presentation16x9")!;
    const built = buildTemplate(deck, "en", format);
    const first = s().pageId!;
    pageActions.applyTemplate(built.pages);
    expect(pageIds()).toHaveLength(8);
    expect(pageIds()[0]).toBe(first);
    expect(s().design!.pages[0]!.elements.length).toBeGreaterThan(3);
    expect(s().pageId).toBe(first);
    s().undo();
    expect(pageIds()).toEqual([first]);
    expect(s().design!.pages[0]!.elements).toHaveLength(0);
  });

  it("adds a template after a page that already has content", async () => {
    const { buildTemplate, catalog } = await import("@/lib/templates");
    editorActions.addElements([createShape("rect", format)]);
    const first = s().pageId!;
    const post = catalog().find((d) => d.kind === "facebookPost")!;
    pageActions.applyTemplate(buildTemplate(post, "ar", format).pages);
    expect(pageIds()).toHaveLength(2);
    expect(s().design!.pages[0]!.elements).toHaveLength(1);
    expect(s().pageId).toBe(pageIds()[1]);
    expect(pageIds()[0]).toBe(first);
  });
});
