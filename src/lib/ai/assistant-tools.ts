/**
 * Design Assistant tools. Claude calls these (tool use); the server validates
 * each call with Zod and sends the valid ones to the browser, which applies
 * them all as ONE undoable change via `applyAssistantActions`.
 */
import { z } from "zod";
import { alignElements, distributeElements } from "@/lib/document/arrange";
import { createLine, createShape, createText } from "@/lib/document/factory";
import {
  ancestorOffset,
  groupElements,
  tidyGroups,
  ungroupElements,
} from "@/lib/document/grouping";
import { applyPalette } from "@/lib/document/palette";
import { directionPatch, fontForText, withTextStyle } from "@/lib/document/text";
import {
  duplicateElements,
  findElement,
  flattenElements,
  insertElements,
  removeElements,
  reorderElements,
} from "@/lib/document/tree";
import type { Element, Fill, Format, Page, ShapeKind, TextElement } from "@/lib/schema";
import { safeFont, safeHex } from "./design-format";

const Hex = z.string().describe("Hex colour like #FF7A3D");
const Ids = z.array(z.string()).describe("Element ids from the scene");

const GradientInput = z.object({
  angle: z.number().describe("CSS degrees: 90 = left→right, 180 = top→bottom"),
  colors: z.array(Hex).describe("2–3 colours"),
});

export const ASSISTANT_TOOL_SCHEMAS = {
  add_text: z.object({
    text: z.string(),
    role: z.enum(["heading", "subheading", "body", "caption", "other"]).optional(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    fontSize: z.number(),
    fontFamily: z.string().optional(),
    fontWeight: z.number().optional(),
    color: Hex.optional(),
    align: z.enum(["left", "center", "right"]).optional(),
  }),
  add_shape: z.object({
    shape: z.enum([
      "rect",
      "ellipse",
      "triangle",
      "polygon",
      "star",
      "arrow",
      "diamond",
      "heart",
      "speechBubble",
      "blob",
    ]),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: Hex,
    cornerRadius: z.number().optional(),
    opacity: z.number().optional().describe("0–1"),
    position: z
      .enum(["front", "back"])
      .optional()
      .describe("Stack on top (default) or behind everything"),
  }),
  add_line: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    color: Hex,
    thickness: z.number(),
    dashed: z.boolean().optional(),
    rotation: z.number().optional(),
  }),
  update_element: z.object({
    id: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    rotation: z.number().optional(),
    opacity: z.number().optional().describe("0–1"),
    color: Hex.optional().describe("Fill colour (text colour for text, stroke for lines)"),
    gradient: GradientInput.optional().describe("Gradient fill for shapes/text"),
    text: z.string().optional().describe("Replace a text element's words"),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    fontWeight: z.number().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    align: z.enum(["left", "center", "right", "justify"]).optional(),
    lineHeight: z.number().optional(),
    letterSpacing: z.number().optional(),
    cornerRadius: z.number().optional(),
    visible: z.boolean().optional(),
  }),
  delete_elements: z.object({ ids: Ids }),
  duplicate_elements: z.object({ ids: Ids }),
  set_background: z.object({
    color: Hex.optional(),
    gradient: GradientInput.optional(),
  }),
  apply_palette: z.object({
    colors: z.array(Hex).describe("3–6 colours; the design's colours are remapped by lightness"),
  }),
  align_elements: z.object({
    ids: Ids,
    alignment: z.enum(["left", "center", "right", "top", "middle", "bottom"]),
    relativeTo: z.enum(["page", "selection"]).optional(),
  }),
  distribute_elements: z.object({ ids: Ids, direction: z.enum(["horizontal", "vertical"]) }),
  reorder_layers: z.object({
    ids: Ids,
    operation: z.enum(["forward", "backward", "front", "back"]),
  }),
  replace_text: z.object({
    find: z.string(),
    replace: z.string(),
  }),
  group_elements: z.object({
    ids: Ids.describe("2 or more top-level element ids"),
    name: z.string().optional().describe("Short layer name, e.g. 'Button'"),
  }),
  ungroup_elements: z.object({ ids: Ids.describe("Group ids") }),
} as const;

export type AssistantToolName = keyof typeof ASSISTANT_TOOL_SCHEMAS;

export const TOOL_DESCRIPTIONS: Record<AssistantToolName, string> = {
  add_text: "Add a new text box. Coordinates are page pixels from the top-left corner.",
  add_shape:
    "Add a shape (rectangle, circle, star…). Use for buttons, badges, backgrounds, decorations.",
  add_line: "Add a straight line or divider.",
  update_element:
    "Change properties of an existing element by id. Only include the properties to change.",
  delete_elements: "Delete elements by id.",
  duplicate_elements: "Duplicate elements by id (copies appear slightly offset).",
  set_background: "Change the page background to a colour or a gradient.",
  apply_palette:
    "Recolour the whole design with a new palette, keeping light/dark structure and readable text.",
  align_elements: "Align elements to the page or to each other.",
  distribute_elements: "Space 3 or more elements evenly.",
  reorder_layers: "Move elements forward/backward in the stacking order.",
  replace_text: "Find and replace words in every text element.",
  group_elements:
    "Group elements so they move and resize together (e.g. a button's shape and its label).",
  ungroup_elements: "Split groups back into their separate elements.",
};

/** One validated tool call ready to apply in the browser. */
export type AssistantAction = {
  [K in AssistantToolName]: { tool: K; input: z.output<(typeof ASSISTANT_TOOL_SCHEMAS)[K]> };
}[AssistantToolName];

export function parseAssistantAction(name: string, input: unknown): AssistantAction | null {
  if (!(name in ASSISTANT_TOOL_SCHEMAS)) return null;
  const tool = name as AssistantToolName;
  const parsed = ASSISTANT_TOOL_SCHEMAS[tool].safeParse(input);
  return parsed.success ? ({ tool, input: parsed.data } as AssistantAction) : null;
}

/** JSON Schema tool definitions for the Messages API. */
export function assistantToolDefinitions() {
  return (Object.keys(ASSISTANT_TOOL_SCHEMAS) as AssistantToolName[]).map((name) => {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(ASSISTANT_TOOL_SCHEMAS[name]) as Record<
      string,
      unknown
    >;
    return {
      name,
      description: TOOL_DESCRIPTIONS[name],
      input_schema: schema as { type: "object"; [key: string]: unknown },
    };
  });
}

// ─── Applying actions (inside an Immer recipe) ───────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function gradientFill(g: { angle: number; colors: string[] }): Fill | null {
  const colors = g.colors.map((c) => safeHex(c, "")).filter(Boolean);
  if (colors.length < 2) return null;
  return {
    type: "gradient",
    gradient: {
      kind: "linear",
      angle: clamp(g.angle, -360, 360),
      stops: colors.map((color, i) => ({ offset: i / (colors.length - 1), color })),
    },
  };
}

export interface ApplyResult {
  /** Ids of elements created or touched (selected afterwards). */
  touched: string[];
  applied: number;
  skipped: number;
}

/** Applies every action to the page. Unknown ids or locked elements are skipped. */
export function applyAssistantActions(
  page: Page,
  actions: AssistantAction[],
  format: Format,
): ApplyResult {
  const touched = new Set<string>();
  let applied = 0;
  let skipped = 0;
  const W = format.width;
  const H = format.height;
  const pick = (ids: string[]) =>
    ids.map((id) => findElement(page, id)).filter((e): e is Element => Boolean(e));

  for (const action of actions) {
    let ok = true;
    switch (action.tool) {
      case "add_text": {
        const a = action.input;
        const text = createText(
          a.role === "heading" ? "heading" : a.role === "body" ? "body" : "subheading",
          format,
          {
            runs: [{ text: a.text.slice(0, 2_000), style: {} }],
            role: a.role ?? "other",
            x: clamp(a.x, -W, W * 2),
            y: clamp(a.y, -H, H * 2),
            width: clamp(a.width, 20, W),
            fontSize: clamp(a.fontSize, 6, 1_000),
            align: a.align ?? "left",
          },
        );
        if (a.fontFamily) text.fontFamily = safeFont(a.fontFamily, text.fontFamily);
        if (a.fontWeight) text.fontWeight = clamp(Math.round(a.fontWeight / 100) * 100, 100, 900);
        if (a.color) text.fill = { type: "solid", color: safeHex(a.color, "#0F172A") };
        Object.assign(text, directionPatch(text, a.text));
        text.height = Math.round(text.fontSize * text.lineHeight);
        insertElements(page, [text]);
        touched.add(text.id);
        break;
      }
      case "add_shape": {
        const a = action.input;
        const shape = createShape(a.shape as ShapeKind, format, {
          x: clamp(a.x, -W, W * 2),
          y: clamp(a.y, -H, H * 2),
          width: clamp(a.width, 2, W * 3),
          height: clamp(a.height, 2, H * 3),
          fill: { type: "solid", color: safeHex(a.color, "#7C6CF2") },
          cornerRadius:
            a.shape === "rect" ? clamp(a.cornerRadius ?? 0, 0, Math.min(a.width, a.height) / 2) : 0,
          opacity: clamp(a.opacity ?? 1, 0.05, 1),
          sides: a.shape === "polygon" ? 6 : 5,
        });
        insertElements(page, [shape], a.position === "back" ? 0 : undefined);
        touched.add(shape.id);
        break;
      }
      case "add_line": {
        const a = action.input;
        const thickness = clamp(a.thickness, 1, 60);
        const line = createLine(format, {
          x: clamp(a.x, -W, W * 2),
          y: clamp(a.y, -H, H * 2),
          width: clamp(a.width, 4, W * 3),
          height: thickness,
          rotation: clamp(a.rotation ?? 0, -360, 360),
          stroke: {
            color: safeHex(a.color, "#0F172A"),
            width: thickness,
            dash: a.dashed ? [thickness * 3, thickness * 2] : [],
          },
        });
        insertElements(page, [line]);
        touched.add(line.id);
        break;
      }
      case "update_element": {
        const a = action.input;
        const el = findElement(page, a.id);
        if (!el || el.locked) {
          ok = false;
          break;
        }
        // The scene shows page coordinates; elements inside groups store them relative.
        const offset = ancestorOffset(page.elements, el.id) ?? { x: 0, y: 0 };
        if (a.x !== undefined) el.x = clamp(a.x, -W, W * 2) - offset.x;
        if (a.y !== undefined) el.y = clamp(a.y, -H, H * 2) - offset.y;
        // Groups are resized as a whole only from the editor (it scales their content).
        if (a.width !== undefined && el.type !== "group") el.width = clamp(a.width, 2, W * 3);
        if (a.height !== undefined && el.type !== "text" && el.type !== "group")
          el.height = clamp(a.height, 1, H * 3);
        if (a.rotation !== undefined) el.rotation = clamp(a.rotation, -360, 360);
        if (a.opacity !== undefined) el.opacity = clamp(a.opacity, 0, 1);
        if (a.visible !== undefined) el.visible = a.visible;
        const fill =
          a.gradient && (el.type === "shape" || el.type === "text")
            ? gradientFill(a.gradient)
            : a.color
              ? ({ type: "solid", color: safeHex(a.color, "#0F172A") } as Fill)
              : null;
        if (el.type === "text") {
          const patch: Partial<TextElement> = {};
          if (fill) patch.fill = fill;
          if (a.fontSize !== undefined) patch.fontSize = clamp(a.fontSize, 4, 2_000);
          if (a.fontFamily) {
            const text = a.text ?? el.runs.map((r) => r.text).join("");
            patch.fontFamily = fontForText(
              text,
              safeFont(a.fontFamily, el.fontFamily),
              el.fontFamily,
              el.fontWeight,
            );
          }
          if (a.fontWeight !== undefined)
            patch.fontWeight = clamp(Math.round(a.fontWeight / 100) * 100, 100, 900);
          if (a.italic !== undefined) patch.italic = a.italic;
          if (a.underline !== undefined) patch.underline = a.underline;
          if (a.align) patch.align = a.align;
          if (a.lineHeight !== undefined) patch.lineHeight = clamp(a.lineHeight, 0.5, 5);
          if (a.letterSpacing !== undefined)
            patch.letterSpacing = clamp(a.letterSpacing, -500, 2_000);
          Object.assign(el, withTextStyle(el, patch));
          if (a.text !== undefined) {
            el.runs = [{ text: a.text.slice(0, 5_000), style: {} }];
            Object.assign(el, directionPatch(el, a.text));
          }
        } else if (el.type === "shape") {
          if (fill) el.fill = fill;
          if (a.cornerRadius !== undefined) el.cornerRadius = clamp(a.cornerRadius, 0, 5_000);
        } else if (el.type === "line" && a.color) {
          el.stroke.color = safeHex(a.color, el.stroke.color);
        }
        touched.add(el.id);
        break;
      }
      case "delete_elements": {
        const ids = pick(action.input.ids)
          .filter((e) => !e.locked)
          .map((e) => e.id);
        ok = removeElements(page, ids) > 0;
        break;
      }
      case "duplicate_elements": {
        const ids = pick(action.input.ids).map((e) => e.id);
        const created = duplicateElements(page, ids);
        created.forEach((id) => touched.add(id));
        ok = created.length > 0;
        break;
      }
      case "set_background": {
        const a = action.input;
        const g = a.gradient ? gradientFill(a.gradient) : null;
        if (g && g.type === "gradient")
          page.background = { type: "gradient", gradient: g.gradient };
        else if (a.color) page.background = { type: "solid", color: safeHex(a.color, "#FFFFFF") };
        else ok = false;
        break;
      }
      case "apply_palette":
        ok = applyPalette(page, action.input.colors).size > 0;
        break;
      case "align_elements": {
        const els = pick(action.input.ids);
        alignElements(els, action.input.alignment, format, action.input.relativeTo ?? "page");
        els.forEach((e) => touched.add(e.id));
        ok = els.length > 0;
        break;
      }
      case "distribute_elements": {
        const els = pick(action.input.ids);
        distributeElements(els, action.input.direction);
        els.forEach((e) => touched.add(e.id));
        ok = els.length >= 3;
        break;
      }
      case "reorder_layers": {
        const ids = pick(action.input.ids).map((e) => e.id);
        reorderElements(page, ids, action.input.operation);
        ok = ids.length > 0;
        break;
      }
      case "replace_text": {
        const { find, replace } = action.input;
        if (!find) {
          ok = false;
          break;
        }
        let count = 0;
        for (const el of flattenElements(page.elements)) {
          if (el.type !== "text") continue;
          for (const run of el.runs) {
            if (run.text.includes(find)) {
              run.text = run.text.split(find).join(replace);
              count++;
              touched.add(el.id);
            }
          }
        }
        ok = count > 0;
        break;
      }
      case "group_elements": {
        const groupId = groupElements(page, action.input.ids);
        if (groupId) {
          const group = findElement(page, groupId)!;
          if (action.input.name) group.name = action.input.name.slice(0, 80);
          touched.add(groupId);
        }
        ok = groupId !== null;
        break;
      }
      case "ungroup_elements": {
        const released = ungroupElements(page, action.input.ids);
        released.forEach((id) => touched.add(id));
        ok = released.length > 0;
        break;
      }
    }
    if (ok) applied++;
    else skipped++;
  }
  // Edits inside groups can leave a group's box out of date (or empty).
  tidyGroups(page);
  // Select what changed; an element inside a group selects its (top-level) group.
  const topLevel = (id: string) =>
    page.elements.find(
      (e) =>
        e.id === id || (e.type === "group" && flattenElements(e.children).some((c) => c.id === id)),
    )?.id;
  const selected = [...touched].map(topLevel).filter((id): id is string => Boolean(id));
  return { touched: [...new Set(selected)], applied, skipped };
}
