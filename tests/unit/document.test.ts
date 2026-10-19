import { describe, expect, it } from "vitest";
import {
  createDesign,
  createLine,
  createPage,
  createShape,
  createText,
} from "@/lib/document/factory";
import {
  customFormat,
  FORMAT_PRESETS,
  formatFromPreset,
  getPreset,
  outputPixels,
  pxToUnit,
  unitToPx,
} from "@/lib/document/formats";
import { DocumentError, migrateDesign, repairDesign, upgradeJson } from "@/lib/document/migrations";
import {
  duplicateElements,
  findElement,
  flattenElements,
  moveElementToIndex,
  patchElement,
  removeElements,
  reorderElements,
} from "@/lib/document/tree";
import { DesignSchema, ElementSchema, SCHEMA_VERSION, type Element, type Page } from "@/lib/schema";

const square = formatFromPreset(getPreset("instagramPost")!);

describe("schema", () => {
  it("fills defaults for minimal AI-style input", () => {
    const el = ElementSchema.parse({
      id: "t1",
      type: "text",
      x: 10,
      y: 20,
      width: 300,
      height: 50,
      runs: [{ text: "Hello" }],
    });
    expect(el.type).toBe("text");
    if (el.type !== "text") return;
    expect(el.fontFamily).toBe("Inter");
    expect(el.opacity).toBe(1);
    expect(el.runs[0]!.style).toEqual({});
    expect(el.fill).toEqual({ type: "solid", color: "#0F172A" });
  });

  it("fills nested defaults with prefault (image filters)", () => {
    const el = ElementSchema.parse({
      id: "i1",
      type: "image",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      src: "asset:abc",
    });
    if (el.type !== "image") throw new Error("expected image");
    expect(el.filters.brightness).toBe(0);
    expect(el.filters.duotone).toBeNull();
  });

  it("rejects bad colours, unsafe image sources and unknown types", () => {
    const base = { id: "s1", x: 0, y: 0, width: 10, height: 10 };
    expect(
      ElementSchema.safeParse({
        ...base,
        type: "shape",
        kind: "rect",
        fill: { type: "solid", color: "red" },
      }).success,
    ).toBe(false);
    expect(
      ElementSchema.safeParse({ ...base, type: "image", src: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      ElementSchema.safeParse({ ...base, type: "image", src: "http://insecure.example/x.png" })
        .success,
    ).toBe(false);
    expect(ElementSchema.safeParse({ ...base, type: "video" }).success).toBe(false);
  });

  it("supports nested groups", () => {
    const el = ElementSchema.parse({
      id: "g1",
      type: "group",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      children: [
        { id: "g2", type: "group", x: 0, y: 0, width: 50, height: 50, children: [] },
        { id: "s1", type: "shape", kind: "ellipse", x: 0, y: 0, width: 10, height: 10 },
      ],
    });
    expect(el.type === "group" && el.children.length).toBe(2);
  });
});

describe("formats", () => {
  it("has unique preset ids", () => {
    const ids = FORMAT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stores A4 at 96 dpi and exports it at 300 dpi", () => {
    const a4 = formatFromPreset(getPreset("a4")!);
    expect([a4.width, a4.height]).toEqual([794, 1123]);
    expect(a4.dpi).toBe(300);
    expect(outputPixels(a4)).toEqual({ width: 2481, height: 3509 });
  });

  it("converts units both ways", () => {
    expect(pxToUnit(96, "in")).toBe(1);
    expect(unitToPx(25.4, "mm")).toBeCloseTo(96);
    expect(pxToUnit(unitToPx(15, "cm"), "cm")).toBeCloseTo(15);
  });

  it("builds custom formats", () => {
    expect(customFormat(800, 600, "px")).toMatchObject({ width: 800, height: 600, dpi: 96 });
    expect(customFormat(10, 10, "cm")).toMatchObject({ width: 378, height: 378, dpi: 300 });
  });
});

describe("factory", () => {
  it("creates a valid design with one blank page", () => {
    const design = createDesign({ format: square });
    expect(DesignSchema.safeParse(design).success).toBe(true);
    expect(design.pages).toHaveLength(1);
    expect(design.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("centres new elements on the page", () => {
    for (const el of [
      createText("heading", square),
      createShape("rect", square),
      createLine(square),
    ]) {
      // Within a pixel (positions are rounded to whole pixels).
      expect(Math.abs(el.x + el.width / 2 - square.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(el.y + el.height / 2 - square.height / 2)).toBeLessThanOrEqual(1);
    }
  });

  it("scales heading size with the page", () => {
    const poster = formatFromPreset(getPreset("youtubeBanner")!);
    expect(createText("heading", poster).fontSize).toBeGreaterThan(
      createText("heading", square).fontSize,
    );
    expect(createText("heading", square).fontSize).toBeGreaterThan(
      createText("body", square).fontSize,
    );
  });
});

describe("migrations", () => {
  it("passes current documents through", () => {
    const design = createDesign({ format: square });
    expect(migrateDesign(JSON.parse(JSON.stringify(design)))).toEqual(design);
  });

  it("treats unversioned documents as version 1", () => {
    const { schemaVersion: _v, ...legacy } = createDesign({ format: square });
    expect(upgradeJson(legacy).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("refuses documents from a newer app version", () => {
    const future = { ...createDesign({ format: square }), schemaVersion: SCHEMA_VERSION + 1 };
    expect(() => migrateDesign(future)).toThrow(DocumentError);
  });

  it("rejects non-objects", () => {
    expect(() => migrateDesign("nope")).toThrow(/not a Lumora design/);
  });

  it("repairs a document by dropping only broken elements", () => {
    const design = createDesign({ format: square });
    const good = createShape("rect", square);
    const raw = JSON.parse(JSON.stringify(design));
    raw.pages[0].elements = [good, { id: "bad", type: "shape", kind: "rect", x: "oops" }];
    expect(() => migrateDesign(raw)).toThrow(DocumentError);
    const { design: repaired, dropped } = repairDesign(raw);
    expect(dropped).toBe(1);
    expect(repaired.pages[0]!.elements.map((e) => e.id)).toEqual([good.id]);
  });
});

describe("tree operations", () => {
  const makePage = (): Page => {
    const page = createPage();
    page.elements = ["a", "b", "c", "d"].map((id) => ({ ...createShape("rect", square), id }));
    return page;
  };
  const order = (page: Page) => page.elements.map((e) => e.id).join("");

  it("finds, patches and removes elements", () => {
    const page = makePage();
    expect(findElement(page, "b")?.id).toBe("b");
    expect(patchElement(page, "b", { x: 5, id: "hijack" } as Partial<Element>)).toBe(true);
    expect(findElement(page, "b")?.x).toBe(5);
    expect(findElement(page, "hijack")).toBeUndefined();
    expect(removeElements(page, ["a", "zzz"])).toBe(1);
    expect(order(page)).toBe("bcd");
  });

  it("reorders the stack", () => {
    let page = makePage();
    reorderElements(page, ["a"], "forward");
    expect(order(page)).toBe("bacd");
    page = makePage();
    reorderElements(page, ["c"], "backward");
    expect(order(page)).toBe("acbd");
    page = makePage();
    reorderElements(page, ["a", "c"], "front");
    expect(order(page)).toBe("bdac");
    page = makePage();
    reorderElements(page, ["b", "d"], "back");
    expect(order(page)).toBe("bdac");
    page = makePage();
    reorderElements(page, ["d"], "forward"); // already on top: no change
    expect(order(page)).toBe("abcd");
  });

  it("moves an element to an exact index", () => {
    const page = makePage();
    moveElementToIndex(page, "a", 3);
    expect(order(page)).toBe("bcda");
  });

  it("duplicates with fresh ids and an offset", () => {
    const page = makePage();
    const [copyId] = duplicateElements(page, ["b"]);
    expect(copyId).toBeDefined();
    expect(page.elements.map((e) => e.id).indexOf(copyId!)).toBe(2);
    expect(findElement(page, copyId!)!.x).toBe(findElement(page, "b")!.x + 20);
  });

  it("flattens nested groups", () => {
    const page = makePage();
    const child = { ...createShape("ellipse", square), id: "child" };
    page.elements.push({
      ...createShape("rect", square),
      type: "group",
      id: "grp",
      children: [child],
    } as unknown as Element);
    expect(flattenElements(page.elements).map((e) => e.id)).toContain("child");
    expect(findElement(page, "child")?.id).toBe("child");
  });
});
