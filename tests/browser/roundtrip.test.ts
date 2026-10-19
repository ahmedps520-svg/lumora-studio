/**
 * Scene JSON → Fabric canvas → scene JSON must be lossless.
 * Runs in real Chromium (Vitest browser mode) so Fabric measures text for real.
 */
import { ActiveSelection, Group, Point, StaticCanvas, type Textbox } from "fabric";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDesign, createPage } from "@/lib/document/factory";
import { groupElements, ungroupElements } from "@/lib/document/grouping";
import { CanvasEngine, type EngineCallbacks } from "@/lib/engine/engine";
import { applyElement, createObject, getObjectId, readElement } from "@/lib/engine/mapping";
import {
  ElementSchema,
  type Element,
  type ElementInput,
  type GroupElement,
  type TextElement,
} from "@/lib/schema";

const el = (input: ElementInput): Element => ElementSchema.parse(input);

const SAMPLES: Element[] = [
  el({
    id: "rect",
    type: "shape",
    kind: "rect",
    x: 40,
    y: 60,
    width: 300,
    height: 180,
    cornerRadius: 24,
    rotation: 15,
    opacity: 0.8,
    flipX: true,
    blendMode: "multiply",
    shadow: { color: "#00000055", blur: 20, offsetX: 4, offsetY: 8 },
    fill: { type: "solid", color: "#FF7A3D" },
    stroke: { color: "#3A2E8F", width: 6, dash: [10, 5] },
    name: "Card",
    locked: true,
  }),
  el({
    id: "grad",
    type: "shape",
    kind: "ellipse",
    x: -50,
    y: 400,
    width: 260,
    height: 120,
    fill: {
      type: "gradient",
      gradient: {
        kind: "linear",
        angle: 135,
        stops: [
          { offset: 0, color: "#FF7A3D" },
          { offset: 0.5, color: "#FFFFFF" },
          { offset: 1, color: "#F72585" },
        ],
      },
    },
  }),
  el({
    id: "radial",
    type: "shape",
    kind: "triangle",
    x: 600,
    y: 20,
    width: 100,
    height: 90,
    fill: {
      type: "gradient",
      gradient: {
        kind: "radial",
        stops: [
          { offset: 0, color: "#FFFFFF" },
          { offset: 1, color: "#000000" },
        ],
      },
    },
  }),
  el({
    id: "star",
    type: "shape",
    kind: "star",
    x: 10,
    y: 10,
    width: 200,
    height: 190,
    sides: 6,
    innerRadius: 0.4,
  }),
  el({
    id: "poly",
    type: "shape",
    kind: "polygon",
    x: 300,
    y: 300,
    width: 150,
    height: 150,
    sides: 8,
    rotation: 330,
  }),
  el({
    id: "heart",
    type: "shape",
    kind: "heart",
    x: 500,
    y: 500,
    width: 120,
    height: 100,
    fill: { type: "none" },
    stroke: { color: "#F72585", width: 4 },
  }),
  el({
    id: "bubble",
    type: "shape",
    kind: "speechBubble",
    x: 700,
    y: 600,
    width: 220,
    height: 160,
    flipY: true,
  }),
  el({
    id: "line",
    type: "line",
    x: 100,
    y: 800,
    width: 400,
    height: 6,
    rotation: 45,
    stroke: { color: "#0F172A", width: 6, dash: [12, 6] },
    lineCap: "square",
  }),
  el({
    id: "text",
    type: "text",
    x: 120,
    y: 200,
    width: 600,
    height: 100,
    role: "heading",
    runs: [
      { text: "Hello " },
      { text: "bold", style: { fontWeight: 700, color: "#F72585" } },
      { text: " world\nsecond ", style: {} },
      { text: "line", style: { italic: true, underline: true, fontSize: 48 } },
    ],
    fontFamily: "Arial",
    fontSize: 40,
    align: "center",
    lineHeight: 1.4,
    letterSpacing: 50,
    rotation: 350,
    fill: { type: "solid", color: "#0F172A" },
    backgroundColor: "#FFF7AA",
  }),
  el({
    id: "arabic",
    type: "text",
    x: 100,
    y: 950,
    width: 500,
    height: 60,
    runs: [{ text: "مرحبا بالعالم" }, { text: " 2026", style: { strike: true } }],
    direction: "rtl",
    align: "right",
    fontFamily: "Arial",
    fontSize: 36,
  }),
  el({
    id: "drawing",
    type: "drawing",
    x: 300,
    y: 650,
    width: 420,
    height: 150,
    rotation: 12,
    sourceWidth: 210,
    sourceHeight: 100,
    strokes: [
      { d: "M 6 6 Q 60 90 200 50", color: "#F72585", width: 8 },
      { d: "M 10 90 L 200 10", color: "#FFD166", width: 20, opacity: 0.4, mode: "highlighter" },
    ],
  }),
];

/** Text height is computed by layout; "settle" it like the engine does before comparing. */
function settle(element: Element): Element {
  if (element.type !== "text") return element;
  const obj = createObject(element) as Textbox;
  return { ...element, height: Math.round(obj.height * 100) / 100 };
}

describe("element ⇄ Fabric mapping", () => {
  let canvas: StaticCanvas;
  beforeEach(() => {
    canvas = new StaticCanvas(document.createElement("canvas"), { width: 1200, height: 1200 });
  });
  afterEach(() => void canvas.dispose());

  for (const sample of SAMPLES) {
    it(`round-trips ${sample.id}`, () => {
      const settled = settle(sample);
      const obj = createObject(settled);
      canvas.add(obj);
      canvas.renderAll();
      expect(readElement(obj, settled)).toEqual(settled);
    });
  }

  it("bakes a user resize into width/height (rect)", () => {
    const rect = SAMPLES[0]!;
    const obj = createObject(rect);
    obj.set({ scaleX: 2, scaleY: 0.5 });
    const read = readElement(obj, rect);
    expect(read.width).toBeCloseTo(rect.width * 2, 1);
    expect(read.height).toBeCloseTo(rect.height * 0.5, 1);
    // Re-applying the read element leaves the object unscaled with the new size.
    applyElement(obj, read);
    expect(obj.scaleX).toBe(1);
    expect(obj.width).toBeCloseTo(rect.width * 2, 1);
  });

  it("keeps path shapes at their box size when resized", () => {
    const star = SAMPLES[3]!;
    const obj = createObject(star);
    obj.set({ scaleX: obj.scaleX * 1.5 });
    expect(readElement(obj, star).width).toBeCloseTo(star.width * 1.5, 1);
  });

  it("turns corner-scaling of text into a bigger font", () => {
    const text = settle(SAMPLES[8]!) as TextElement;
    const obj = createObject(text);
    obj.set({ scaleX: 2, scaleY: 2 });
    const read = readElement(obj, text) as TextElement;
    expect(read.fontSize).toBe(80);
    expect(read.runs.find((r) => r.text === "line")?.style.fontSize).toBe(96);
    expect(read.width).toBeCloseTo(text.width * 2, 1);
  });

  it("reads absolute positions of objects inside a multi-selection", () => {
    const a = el({ id: "a", type: "shape", kind: "rect", x: 0, y: 0, width: 100, height: 100 });
    const b = el({ id: "b", type: "shape", kind: "rect", x: 300, y: 200, width: 50, height: 50 });
    const oa = createObject(a);
    const ob = createObject(b);
    canvas.add(oa, ob);
    const selection = new ActiveSelection([oa, ob]);
    selection.setPositionByOrigin(
      selection.getCenterPoint().add(new Point(10, 20)),
      "center",
      "center",
    );
    selection.setCoords();
    expect(readElement(oa, a)).toMatchObject({ x: 10, y: 20, width: 100, height: 100 });
    expect(readElement(ob, b)).toMatchObject({ x: 310, y: 220, width: 50, height: 50 });
  });
});

/** A rotated group holding a rotated shape, a line and a (settled) text box. */
function sampleGroup(rotation: number, flipX = false): GroupElement {
  const page = createPage();
  page.elements = [
    el({
      id: "g-rect",
      type: "shape",
      kind: "rect",
      x: 100,
      y: 120,
      width: 200,
      height: 80,
      rotation: 20,
    }),
    el({ id: "g-line", type: "line", x: 80, y: 300, width: 300, height: 4 }),
    settle(
      el({
        id: "g-text",
        type: "text",
        x: 150,
        y: 360,
        width: 260,
        height: 10,
        fontFamily: "Arial",
        runs: [{ text: "Grouped words" }],
      }),
    ),
  ];
  const id = groupElements(page, ["g-rect", "g-line", "g-text"])!;
  const group = page.elements.find((e) => e.id === id) as GroupElement;
  group.rotation = rotation;
  group.flipX = flipX;
  return group;
}

describe("groups on the canvas", () => {
  for (const [rotation, flipX] of [
    [0, false],
    [35, false],
    [200, true],
  ] as const) {
    it(`draws children where ungrouping puts them (rotation ${rotation}, flip ${flipX})`, () => {
      const group = sampleGroup(rotation, flipX);
      const obj = createObject(group) as Group;
      expect(obj).toBeInstanceOf(Group);
      expect(obj.width).toBeCloseTo(group.width, 5);
      expect(obj.getCenterPoint().x).toBeCloseTo(group.x + group.width / 2, 5);

      const page = createPage();
      page.elements = [structuredClone(group)];
      ungroupElements(page, [group.id]);
      for (const child of obj.getObjects()) {
        const expected = page.elements.find((e) => e.id === getObjectId(child))!;
        const center = child.getCenterPoint();
        expect(center.x).toBeCloseTo(expected.x + expected.width / 2, 1);
        expect(center.y).toBeCloseTo(expected.y + expected.height / 2, 1);
        if (!flipX) expect(child.getTotalAngle()).toBeCloseTo(expected.rotation, 1);
      }
    });
  }

  it("round-trips a group, and bakes a corner resize into its children", () => {
    const group = sampleGroup(15);
    const obj = createObject(group);
    expect(readElement(obj, group)).toEqual(group);

    obj.set({ scaleX: 2, scaleY: 2 });
    const read = readElement(obj, group) as GroupElement;
    expect(read.width).toBeCloseTo(group.width * 2, 1);
    const text = read.children.find((c) => c.id === "g-text") as TextElement;
    expect(text.fontSize).toBe(64);
    const line = read.children.find((c) => c.id === "g-line")!;
    expect(line.height).toBe(4);
  });
});

describe("CanvasEngine", () => {
  let container: HTMLDivElement;
  let engine: CanvasEngine;
  const calls: Record<string, unknown[]> = {};
  const callbacks: EngineCallbacks = {
    onSelectionChange: (ids) => (calls.selection ??= []).push(ids),
    onTransform: (c) => (calls.transform ??= []).push(c),
    onTextCommit: (id, e) => (calls.text ??= []).push([id, e]),
    onTextEditing: (id) => (calls.editing ??= []).push(id),
    onDerived: (c) => (calls.derived ??= []).push(c),
    onViewport: (v) => (calls.viewport ??= []).push(v),
  };

  beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
    container = document.createElement("div");
    container.style.cssText = "width:800px;height:600px;position:relative";
    document.body.appendChild(container);
    const canvasEl = document.createElement("canvas");
    container.appendChild(canvasEl);
    engine = new CanvasEngine(canvasEl, container, callbacks, { loadFonts: false });
  });

  afterEach(() => {
    engine.dispose();
    container.remove();
  });

  it("renders a page and exports the same scene (round trip)", () => {
    const design = createDesign({
      format: { width: 1080, height: 1080, unit: "px", dpi: 96, presetId: null },
    });
    const page = { ...design.pages[0]!, elements: SAMPLES.map(settle) };
    engine.renderPage(page, design.format);
    expect(engine.exportElements()).toEqual(page.elements);
  });

  it("fits the page in the viewport and reports zoom", () => {
    const design = createDesign({
      format: { width: 1080, height: 1920, unit: "px", dpi: 96, presetId: null },
    });
    engine.renderPage(design.pages[0]!, design.format);
    const last = calls.viewport?.at(-1) as { zoom: number; pageRect: { height: number } };
    expect(last.zoom).toBeCloseTo((600 - 96) / 1920, 3);
    expect(last.pageRect.height).toBeCloseTo(600 - 96, 0);
  });

  it("updates only changed objects and keeps stacking order", () => {
    const design = createDesign({
      format: { width: 1000, height: 1000, unit: "px", dpi: 96, presetId: null },
    });
    const [rect, ellipse] = [SAMPLES[1]!, SAMPLES[3]!];
    const page = { ...design.pages[0]!, elements: [rect, ellipse] };
    engine.renderPage(page, design.format);
    const before = engine.canvas.getObjects();

    const moved = { ...ellipse, x: ellipse.x + 50 };
    engine.renderPage({ ...page, elements: [moved, rect] }, design.format);
    const after = engine.canvas.getObjects();
    // Same Fabric objects reused, order swapped (index 0 is the page background).
    expect(after[1]).toBe(before[2]);
    expect(after[2]).toBe(before[1]);
    expect(engine.exportElements().map((e) => e.x)).toEqual([moved.x, rect.x]);
  });

  it("produces a thumbnail", () => {
    const design = createDesign({
      format: { width: 1080, height: 1080, unit: "px", dpi: 96, presetId: null },
    });
    engine.renderPage({ ...design.pages[0]!, elements: [SAMPLES[0]!] }, design.format);
    expect(engine.snapshot(200)).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("moves a group in place and rebuilds it when its content changes", () => {
    const design = createDesign({
      format: { width: 1000, height: 1000, unit: "px", dpi: 96, presetId: null },
    });
    const group = sampleGroup(10);
    const page = { ...design.pages[0]!, elements: [group] };
    engine.renderPage(page, design.format);
    const first = engine.canvas.getObjects()[1];
    expect(engine.exportElements()).toEqual([group]);

    const moved = { ...group, x: group.x + 40 };
    engine.renderPage({ ...page, elements: [moved] }, design.format);
    expect(engine.canvas.getObjects()[1]).toBe(first);
    expect(engine.exportElements()).toEqual([moved]);

    const recoloured = {
      ...moved,
      children: moved.children.map((c) =>
        c.type === "shape" ? { ...c, fill: { type: "solid" as const, color: "#FF0000" } } : c,
      ),
    };
    engine.renderPage({ ...page, elements: [recoloured] }, design.format);
    expect(engine.canvas.getObjects()[1]).not.toBe(first);
    expect(engine.exportElements()).toEqual([recoloured]);
  });

  it("rebuilds a group resized by the mouse without leaving copies behind", async () => {
    const design = createDesign({
      format: { width: 1000, height: 1000, unit: "px", dpi: 96, presetId: null },
    });
    let page = { ...design.pages[0]!, elements: [sampleGroup(0)] as Element[] };
    const transforms: unknown[] = [];
    // Like the editor: every transform goes to the "store", which re-renders.
    const original = callbacks.onTransform;
    callbacks.onTransform = (changes) => {
      transforms.push(changes);
      page = {
        ...page,
        elements: page.elements.map((e) => {
          const change = changes.find((c) => c.id === e.id);
          return change ? ({ ...e, ...change.patch } as Element) : e;
        }),
      };
      engine.renderPage(page, design.format);
    };
    try {
      engine.renderPage(page, design.format);
      engine.setSelection([page.elements[0]!.id]);
      const canvas = engine.canvas as unknown as {
        _currentTransform: unknown;
        _finalizeCurrentTransform: (e: Event) => void;
      };
      const obj = engine.canvas.getActiveObject()!;
      obj.set({ scaleX: 1.5, scaleY: 1.5 });
      // What Fabric does on mouse-up after a corner drag.
      canvas._currentTransform = {
        target: obj,
        action: "scale",
        corner: "br",
        actionPerformed: true,
      };
      canvas._finalizeCurrentTransform(new MouseEvent("mouseup"));
      canvas._currentTransform = null;
      await Promise.resolve();

      expect(transforms).toHaveLength(1);
      const groups = engine.canvas.getObjects().filter((o) => o instanceof Group);
      expect(groups).toHaveLength(1);
      expect(groups[0]).not.toBe(obj);
      expect(engine.canvas.getActiveObject()).toBe(groups[0]);
      expect((engine.exportElements()[0] as GroupElement).width).toBeCloseTo(
        (page.elements[0] as GroupElement).width,
        1,
      );
    } finally {
      callbacks.onTransform = original;
    }
  });

  it("selects and reports selection without echoing store-driven changes", () => {
    const design = createDesign({
      format: { width: 1000, height: 1000, unit: "px", dpi: 96, presetId: null },
    });
    engine.renderPage({ ...design.pages[0]!, elements: [SAMPLES[1]!, SAMPLES[3]!] }, design.format);
    engine.setSelection(["grad", "star"]);
    expect(engine.canvas.getActiveObjects()).toHaveLength(2);
    expect(calls.selection).toBeUndefined();
  });
});
