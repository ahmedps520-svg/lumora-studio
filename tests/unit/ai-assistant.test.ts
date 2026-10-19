import { describe, expect, it } from "vitest";
import {
  applyAssistantActions,
  assistantToolDefinitions,
  parseAssistantAction,
  type AssistantAction,
} from "@/lib/ai/assistant-tools";
import { summarizePage } from "@/lib/ai/scene-summary";
import { alignElements, distributeElements } from "@/lib/document/arrange";
import { createPage, createShape, createText } from "@/lib/document/factory";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import { applyPalette, buildColorMap, collectColors } from "@/lib/document/palette";
import { findElement } from "@/lib/document/tree";
import type { Page, TextElement } from "@/lib/schema";

const format = formatFromPreset(getPreset("instagramPost")!);

function samplePage(): Page {
  const page = createPage({ background: { type: "solid", color: "#FFFFFF" } });
  page.elements = [
    { ...createShape("rect", format, { fill: { type: "solid", color: "#3A2E8F" } }), id: "card" },
    {
      ...createText("heading", format, { runs: [{ text: "Hello world", style: {} }] }),
      id: "title",
    },
    { ...createShape("ellipse", format), id: "dot", locked: true },
  ];
  return page;
}

const act = (tool: string, input: unknown) => parseAssistantAction(tool, input)!;

describe("assistant tool definitions", () => {
  it("are plain JSON-schema objects the API accepts", () => {
    const defs = assistantToolDefinitions();
    expect(defs.map((d) => d.name)).toContain("update_element");
    for (const def of defs) {
      expect(def.input_schema.type).toBe("object");
      expect(def.input_schema).not.toHaveProperty("$schema");
      expect(def.description.length).toBeGreaterThan(10);
    }
  });

  it("rejects unknown tools and malformed input", () => {
    expect(parseAssistantAction("rm_rf", {})).toBeNull();
    expect(parseAssistantAction("delete_elements", { ids: "all" })).toBeNull();
    expect(parseAssistantAction("delete_elements", { ids: ["a"] })).toMatchObject({
      tool: "delete_elements",
    });
  });
});

describe("applyAssistantActions", () => {
  it("applies several edits in one go and reports what it touched", () => {
    const page = samplePage();
    const actions: AssistantAction[] = [
      act("update_element", { id: "title", fontSize: 140, color: "#F72585", text: "Big news" }),
      act("add_shape", {
        shape: "rect",
        x: 300,
        y: 900,
        width: 480,
        height: 100,
        color: "#FF7A3D",
        cornerRadius: 50,
      }),
      act("add_text", {
        text: "Shop now",
        x: 300,
        y: 920,
        width: 480,
        fontSize: 40,
        color: "#FFFFFF",
        align: "center",
      }),
      act("set_background", { gradient: { angle: 180, colors: ["#FFF7ED", "#FFE4E6"] } }),
    ];
    const result = applyAssistantActions(page, actions, format);
    expect(result.applied).toBe(4);
    const title = findElement(page, "title") as TextElement;
    expect(title.fontSize).toBe(140);
    expect(title.runs[0]!.text).toBe("Big news");
    expect(title.fill).toEqual({ type: "solid", color: "#F72585" });
    expect(page.elements).toHaveLength(5);
    expect(page.background.type).toBe("gradient");
    expect(result.touched).toContain("title");
  });

  it("skips locked elements and unknown ids", () => {
    const page = samplePage();
    const result = applyAssistantActions(
      page,
      [
        act("update_element", { id: "dot", x: 0 }),
        act("update_element", { id: "ghost", x: 0 }),
        act("delete_elements", { ids: ["dot"] }),
      ],
      format,
    );
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(3);
    expect(findElement(page, "dot")).toBeDefined();
  });

  it("clamps absurd numbers from the model", () => {
    const page = samplePage();
    applyAssistantActions(
      page,
      [act("update_element", { id: "card", x: 1e9, opacity: 7 })],
      format,
    );
    const card = findElement(page, "card")!;
    expect(card.x).toBeLessThanOrEqual(format.width * 2);
    expect(card.opacity).toBe(1);
  });

  it("replaces text across the page", () => {
    const page = samplePage();
    const result = applyAssistantActions(
      page,
      [act("replace_text", { find: "world", replace: "Lumora" })],
      format,
    );
    expect((findElement(page, "title") as TextElement).runs[0]!.text).toBe("Hello Lumora");
    expect(result.applied).toBe(1);
  });
});

describe("arrange helpers", () => {
  it("aligns to the page and to the selection", () => {
    const a = createShape("rect", format, { x: 10, y: 10, width: 100, height: 100 });
    const b = createShape("rect", format, { x: 500, y: 300, width: 50, height: 50 });
    alignElements([a], "center", format);
    expect(a.x).toBe(490);
    alignElements([a, b], "top", format, "selection");
    expect(a.y).toBe(10);
    expect(b.y).toBe(10);
  });

  it("distributes evenly", () => {
    const els = [0, 100, 900].map((x) =>
      createShape("rect", format, { x, y: 0, width: 50, height: 50 }),
    );
    distributeElements(els, "horizontal");
    expect(els.map((e) => e.x)).toEqual([0, 450, 900]);
  });
});

describe("palette remapping", () => {
  it("maps colours by lightness and keeps text readable", () => {
    const page = samplePage();
    const before = collectColors(page);
    expect(before).toContain("#3A2E8F");
    const map = buildColorMap(["#000000", "#808080", "#FFFFFF"], ["#FFF8F0", "#1F1235", "#D4145A"]);
    expect(map.get("#000000")).toBe("#1F1235");
    expect(map.get("#FFFFFF")).toBe("#FFF8F0");
    applyPalette(page, ["#1F1235", "#D4145A", "#FF7A3D", "#FFD166", "#FFF8F0"]);
    expect(page.background).toEqual({ type: "solid", color: "#FFF8F0" });
  });
});

describe("scene summary", () => {
  it("is compact JSON with ids, text and selection", () => {
    const page = samplePage();
    const summary = JSON.parse(summarizePage(page, format, ["title"]));
    expect(summary.page).toMatchObject({ width: 1080, height: 1080, background: "#FFFFFF" });
    const title = summary.elements.find((e: { id: string }) => e.id === "title");
    expect(title).toMatchObject({ type: "text", text: "Hello world", selected: true });
    expect(summary.elements.find((e: { id: string }) => e.id === "dot").locked).toBe(true);
  });
});
