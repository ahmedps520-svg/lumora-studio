import { beforeEach, describe, expect, it } from "vitest";
import { applyAssistantActions, parseAssistantAction } from "@/lib/ai/assistant-tools";
import { summarizePage } from "@/lib/ai/scene-summary";
import {
  createDesign,
  createLine,
  createPage,
  createShape,
  createText,
} from "@/lib/document/factory";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import {
  ancestorOffset,
  groupElements,
  refitGroup,
  rotatedBounds,
  scaleChildren,
  tidyGroups,
  ungroupElements,
} from "@/lib/document/grouping";
import { findElement } from "@/lib/document/tree";
import {
  ElementSchema,
  type Element,
  type GroupElement,
  type Page,
  type ShapeElement,
  type TextElement,
} from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";

const format = formatFromPreset(getPreset("instagramPost")!);

const rect = (
  id: string,
  x: number,
  y: number,
  w = 100,
  h = 100,
  extra: Partial<ShapeElement> = {},
) => ({ ...createShape("rect", format, { x, y, width: w, height: h, ...extra }), id }) as Element;

function pageWith(...elements: Element[]): Page {
  const page = createPage();
  page.elements = elements;
  return page;
}

/** Where each element ends up on the page, found by ungrouping a copy. */
function pagePositions(page: Page) {
  const copy = structuredClone(page);
  ungroupElements(
    copy,
    copy.elements.filter((e) => e.type === "group").map((e) => e.id),
  );
  return Object.fromEntries(
    copy.elements.map((e) => [
      e.id,
      { cx: e.x + e.width / 2, cy: e.y + e.height / 2, rotation: e.rotation, flipX: e.flipX },
    ]),
  );
}

describe("rotatedBounds", () => {
  it("is the box itself without rotation, and grows when rotated", () => {
    expect(rotatedBounds({ x: 10, y: 20, width: 100, height: 50, rotation: 0 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
    const b = rotatedBounds({ x: 0, y: 0, width: 100, height: 50, rotation: 90 });
    expect(b.width).toBeCloseTo(50);
    expect(b.height).toBeCloseTo(100);
    expect(b.x).toBeCloseTo(25);
    expect(b.y).toBeCloseTo(-25);
  });
});

describe("groupElements", () => {
  it("wraps top-level elements in a snug group placed at the topmost one's layer", () => {
    const page = pageWith(rect("a", 100, 100), rect("mid", 0, 0), rect("b", 300, 250, 50, 50));
    const id = groupElements(page, ["a", "b"])!;
    expect(page.elements.map((e) => e.id)).toEqual(["mid", id]);
    const group = page.elements[1] as GroupElement;
    expect(group).toMatchObject({ type: "group", x: 100, y: 100, width: 250, height: 200 });
    expect(group.children.map((c) => [c.id, c.x, c.y])).toEqual([
      ["a", 0, 0],
      ["b", 200, 150],
    ]);
    expect(ElementSchema.safeParse(group).success).toBe(true);
  });

  it("needs two unlocked top-level elements", () => {
    const page = pageWith(rect("a", 0, 0), rect("b", 10, 10, 10, 10, { locked: true }));
    expect(groupElements(page, ["a", "b"])).toBeNull();
    expect(groupElements(page, ["a", "missing"])).toBeNull();
    expect(page.elements).toHaveLength(2);
  });

  it("can group groups", () => {
    const page = pageWith(rect("a", 0, 0), rect("b", 200, 0), rect("c", 0, 300));
    const inner = groupElements(page, ["a", "b"])!;
    const outer = groupElements(page, [inner, "c"])!;
    expect(page.elements.map((e) => e.id)).toEqual([outer]);
    expect(ancestorOffset(page.elements, "b")).toEqual({ x: 0, y: 0 });
    expect(findElement(page, "b")).toMatchObject({ x: 200, y: 0 });
  });
});

describe("ungroupElements", () => {
  it("is the exact inverse of grouping", () => {
    const original = [rect("a", 100, 100), rect("b", 300, 250, 50, 50, { rotation: 30 })];
    const page = pageWith(...structuredClone(original));
    const id = groupElements(page, ["a", "b"])!;
    expect(ungroupElements(page, [id])).toEqual(["a", "b"]);
    expect(page.elements).toEqual(original);
  });

  it("applies the group's rotation to each child's position and angle", () => {
    const page = pageWith(rect("a", 0, 0), rect("b", 100, 0));
    const id = groupElements(page, ["a", "b"])!; // 200 × 100 at (0, 0)
    (page.elements[0] as GroupElement).rotation = 90;
    ungroupElements(page, [id]);
    // Child "a" (centre 50,50) rotates 90° around the group centre (100,50) → centre (100,0).
    expect(findElement(page, "a")).toMatchObject({ x: 50, y: -50, rotation: 90 });
    expect(findElement(page, "b")).toMatchObject({ x: 50, y: 50, rotation: 90 });
  });

  it("mirrors children of a flipped group and multiplies opacity", () => {
    const page = pageWith(
      rect("a", 0, 0, 100, 100, { rotation: 20, opacity: 0.5 }),
      rect("b", 100, 0),
    );
    const id = groupElements(page, ["a", "b"])!;
    const group = page.elements[0] as GroupElement;
    group.flipX = true;
    group.opacity = 0.5;
    ungroupElements(page, [id]);
    const a = findElement(page, "a")!;
    expect(a.flipX).toBe(true);
    expect(a.rotation).toBe(340);
    expect(a.opacity).toBe(0.25);
    // Mirrored across the group's vertical centre line: left child moves right.
    expect(a.x).toBeGreaterThan(findElement(page, "b")!.x);
  });

  it("ignores things that are not groups", () => {
    const page = pageWith(rect("a", 0, 0));
    expect(ungroupElements(page, ["a"])).toEqual([]);
  });
});

describe("scaleChildren", () => {
  it("scales positions, sizes and font sizes but keeps line thickness", () => {
    const text = {
      ...createText("body", format, { x: 10, y: 20, width: 200, height: 40 }),
      id: "t",
    };
    text.fontSize = 20;
    text.runs = [{ text: "Hi", style: { fontSize: 30 } }];
    const line = { ...createLine(format, { x: 0, y: 100, width: 100, height: 4 }), id: "l" };
    const [t, l] = scaleChildren([text, line], 2, 2) as [TextElement, Element];
    expect(t).toMatchObject({ x: 20, y: 40, width: 400, height: 80, fontSize: 40 });
    expect(t.runs[0]!.style.fontSize).toBe(60);
    expect(l.width).toBe(200);
    expect(l.height).toBe(4);
    // Centre line moves from y=102 to y=204.
    expect(l.y + l.height / 2).toBe(204);
  });
});

describe("refitGroup / tidyGroups", () => {
  it("refits the box after a child moved without moving anything on the page", () => {
    const page = pageWith(rect("a", 0, 0), rect("b", 200, 100));
    groupElements(page, ["a", "b"]);
    const group = page.elements[0] as GroupElement;
    group.rotation = 30;
    group.flipY = true;
    group.children[1]!.x += 150; // the child now sticks out of the box
    const before = pagePositions(page);
    expect(refitGroup(group)).toBe(true);
    expect(group.width).toBe(450);
    const after = pagePositions(page);
    for (const id of ["a", "b"]) {
      expect(after[id]!.cx).toBeCloseTo(before[id]!.cx, 1);
      expect(after[id]!.cy).toBeCloseTo(before[id]!.cy, 1);
    }
  });

  it("removes empty groups and dissolves one-element groups", () => {
    const page = pageWith(
      rect("a", 0, 0),
      rect("b", 200, 0),
      rect("c", 0, 300),
      rect("d", 300, 300),
    );
    const g1 = groupElements(page, ["a", "b"])!;
    const g2 = groupElements(page, ["c", "d"])!;
    (findElement(page, g1) as GroupElement).children = [];
    (findElement(page, g2) as GroupElement).children.pop();
    tidyGroups(page);
    expect(page.elements.map((e) => e.id)).toEqual(["c"]);
  });
});

describe("store: group / ungroup", () => {
  const s = () => useEditorStore.getState();
  const page = () => selectCurrentPage(s())!;

  beforeEach(() => s().load(createDesign({ format })));

  it("groups the selection as one undo step and selects the group", () => {
    editorActions.addElements([rect("a", 0, 0), rect("b", 200, 0)]);
    s().select(["a", "b"]);
    editorActions.groupSelection();
    expect(page().elements).toHaveLength(1);
    const groupId = page().elements[0]!.id;
    expect(s().selection).toEqual([groupId]);

    editorActions.ungroupSelection();
    expect(page().elements.map((e) => e.id)).toEqual(["a", "b"]);
    expect(s().selection).toEqual(["a", "b"]);

    s().undo();
    expect(page().elements.map((e) => e.id)).toEqual([groupId]);
    s().undo();
    expect(page().elements.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("resizes a group proportionally, scaling what is inside", () => {
    editorActions.addElements([rect("a", 0, 0), rect("b", 100, 100)]);
    s().select(["a", "b"]);
    editorActions.groupSelection();
    const groupId = s().selection[0]!;
    editorActions.resizeGroup(groupId, 400);
    const group = findElement(page(), groupId) as GroupElement;
    expect(group).toMatchObject({ width: 400, height: 400 });
    expect(group.children[1]).toMatchObject({ x: 200, y: 200, width: 200, height: 200 });
  });
});

describe("assistant + groups", () => {
  const act = (tool: string, input: unknown) => parseAssistantAction(tool, input)!;

  it("lists group children with page coordinates in the scene", () => {
    const page = pageWith(rect("a", 100, 100), rect("b", 300, 200));
    groupElements(page, ["a", "b"]);
    const scene = JSON.parse(summarizePage(page, format, [])) as {
      elements: { type: string; children?: { id: string; x: number; y: number }[] }[];
    };
    expect(scene.elements[0]!.type).toBe("group");
    expect(scene.elements[0]!.children).toEqual([
      expect.objectContaining({ id: "a", x: 100, y: 100 }),
      expect.objectContaining({ id: "b", x: 300, y: 200 }),
    ]);
  });

  it("groups and ungroups, and moves children using page coordinates", () => {
    const page = pageWith(rect("a", 100, 100), rect("b", 300, 200), rect("c", 0, 0));
    let result = applyAssistantActions(
      page,
      [act("group_elements", { ids: ["a", "b"], name: "Card" })],
      format,
    );
    const group = page.elements.find((e) => e.type === "group")!;
    expect(group.name).toBe("Card");
    expect(result.touched).toEqual([group.id]);

    // Move "b" (page coords) — stored relative to the group, box refitted.
    result = applyAssistantActions(
      page,
      [act("update_element", { id: "b", x: 500, y: 200 })],
      format,
    );
    expect(result.touched).toEqual([group.id]);
    expect(pagePositions(page).b).toMatchObject({ cx: 550, cy: 250 });
    expect((findElement(page, group.id) as GroupElement).width).toBe(500);

    applyAssistantActions(page, [act("ungroup_elements", { ids: [group.id] })], format);
    expect(page.elements.map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
    expect(findElement(page, "b")).toMatchObject({ x: 500, y: 200 });
  });
});
