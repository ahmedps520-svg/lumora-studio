/**
 * Factories for the richer elements in the Elements panel: icons, frames,
 * tables, charts and QR codes. Each comes centred on the page at a size that
 * suits the format.
 */
import { createId } from "@/lib/id";
import { ElementSchema, type Element, type ElementInput, type Format } from "@/lib/schema";

type Size = Pick<Format, "width" | "height">;
type Of<T extends Element["type"]> = Extract<Element, { type: T }>;

const short = (f: Size) => Math.min(f.width, f.height);

function centred(format: Size, width: number, height: number) {
  return {
    id: createId(),
    x: Math.round((format.width - width) / 2),
    y: Math.round((format.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}

const parse = <T extends Element["type"]>(input: Record<string, unknown>) =>
  ElementSchema.parse(input as ElementInput) as Of<T>;

export const DEFAULT_ICON_COLOR = "#1F1235";

export function createIcon(format: Size, svg: string, name: string, color = DEFAULT_ICON_COLOR) {
  const side = short(format) * 0.22;
  return parse<"svg">({
    ...centred(format, side, side),
    type: "svg",
    name,
    svg,
    source: "icon",
    colorMap: { currentColor: color },
  });
}

export const FRAME_SHAPES = [
  "square",
  "rounded",
  "circle",
  "arch",
  "heart",
  "blob",
  "star",
  "hexagon",
] as const;
export type FrameShape = (typeof FRAME_SHAPES)[number];

/** Outlines for path frames, drawn in a 100×100 box. */
export function framePath(
  shape: FrameShape,
  paths: { heart: string; blob: string; star: string; hexagon: string },
) {
  if (shape === "arch") return "M0 100 L0 50 A50 50 0 0 1 100 50 L100 100 Z";
  if (shape === "heart" || shape === "blob" || shape === "star" || shape === "hexagon")
    return paths[shape];
  return null;
}

export function createFrame(format: Size, shape: FrameShape, pathData: string | null) {
  const side = short(format) * 0.42;
  return parse<"frame">({
    ...centred(format, side, shape === "arch" ? side * 1.25 : side),
    type: "frame",
    name: "",
    shape: pathData ? "path" : shape === "circle" ? "ellipse" : "rect",
    cornerRadius: shape === "rounded" ? Math.round(side * 0.12) : 0,
    pathData,
    pathViewBox: pathData ? { width: 100, height: 100 } : null,
    placeholderColor: "#E2E8F0",
  });
}

export function createTable(format: Size, rows: number, cols: number, header: string[] = []) {
  const fontSize = Math.round(Math.max(12, Math.min(40, short(format) / 42)));
  const width = format.width * 0.7;
  const height = rows * fontSize * 2.6;
  return parse<"table">({
    ...centred(format, width, height),
    type: "table",
    name: "",
    fontSize,
    cellPadding: Math.round(fontSize * 0.6),
    rows: Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({ text: r === 0 ? (header[c] ?? "") : "" })),
    ),
  });
}

export const CHART_TYPES = ["bar", "horizontalBar", "line", "area", "pie", "donut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export interface ChartSample {
  title: string;
  labels: string[];
  series: { name: string; values: number[] }[];
}

export function createChart(format: Size, chartType: ChartType, sample: ChartSample) {
  const width = format.width * 0.62;
  const height = Math.min(format.height * 0.6, width * 0.7);
  return parse<"chart">({
    ...centred(format, width, height),
    type: "chart",
    name: "",
    chartType,
    title: sample.title,
    labels: sample.labels,
    series:
      chartType === "pie" || chartType === "donut" ? sample.series.slice(0, 1) : sample.series,
    showValues: chartType === "pie" || chartType === "donut",
  });
}

export function createCode(format: Size, value: string, codeType: "qr" | "ean13" = "qr") {
  const side = short(format) * 0.3;
  return parse<"qr">({
    ...centred(format, codeType === "ean13" ? side * 1.6 : side, side),
    type: "qr",
    name: "",
    codeType,
    value,
  });
}

// ─── Table editing helpers ───────────────────────────────────────────────────

type Table = Of<"table">;
type Cell = Table["rows"][number][number];
const blankCell = (): Cell => ({
  text: "",
  fill: null,
  color: null,
  bold: false,
  align: "left",
  rowSpan: 1,
  colSpan: 1,
});

export function setCellText(
  rows: Table["rows"],
  r: number,
  c: number,
  text: string,
): Table["rows"] {
  return rows.map((row, i) =>
    i === r ? row.map((cell, j) => (j === c ? { ...cell, text } : cell)) : row,
  );
}

export function addTableRow(rows: Table["rows"]): Table["rows"] {
  const cols = Math.max(...rows.map((r) => r.length));
  return [...rows, Array.from({ length: cols }, blankCell)];
}

export function removeTableRow(rows: Table["rows"]): Table["rows"] {
  return rows.length > 1 ? rows.slice(0, -1) : rows;
}

export function addTableColumn(rows: Table["rows"]): Table["rows"] {
  return rows.map((row) => [...row, blankCell()]);
}

export function removeTableColumn(rows: Table["rows"]): Table["rows"] {
  return rows.map((row) => (row.length > 1 ? row.slice(0, -1) : row));
}
