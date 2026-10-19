/**
 * Elements drawn from several Fabric pieces: tables, charts, QR codes and
 * barcodes. Each is laid out in its own box (0…width × 0…height) and returned
 * as one Group; the engine rebuilds it whenever its content or size changes.
 */
import {
  Circle,
  FabricText,
  Group,
  LayoutManager,
  Path,
  Rect,
  Textbox,
  type FabricObject,
} from "fabric";
import { ean13Pattern, normalizeEan13, qrMatrix } from "@/lib/document/codes";
import type { Element } from "@/lib/schema";
import { ElementBoxLayout } from "./layout";

type TableElement = Extract<Element, { type: "table" }>;
type ChartElement = Extract<Element, { type: "chart" }>;
type CodeElement = Extract<Element, { type: "qr" }>;

export const CHART_PALETTE = [
  "#7C6CF2",
  "#F72585",
  "#FF7A3D",
  "#06D6A0",
  "#4CC9F0",
  "#FFD166",
  "#3A86FF",
  "#8D6E63",
];

const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

function box(children: FabricObject[], width: number, height: number): Group {
  return new Group(children, {
    layoutManager: new LayoutManager(new ElementBoxLayout({ x: 0, y: 0, width, height })),
    subTargetCheck: false,
    interactive: false,
  });
}

function rect(x: number, y: number, w: number, h: number, options: Partial<Rect> = {}): Rect {
  return new Rect({
    left: x + w / 2,
    top: y + h / 2,
    width: Math.max(0, w),
    height: Math.max(0, h),
    strokeWidth: 0,
    ...options,
  });
}

function label(
  text: string,
  x: number,
  y: number,
  o: {
    size: number;
    color: string;
    family: string;
    weight?: number;
    align?: "left" | "center" | "right";
    baseline?: "top" | "center" | "bottom";
  },
): FabricText {
  return new FabricText(text, {
    left: x,
    top: y,
    originX: o.align ?? "center",
    originY: o.baseline ?? "center",
    fontSize: o.size,
    fill: o.color,
    fontFamily: o.family,
    fontWeight: o.weight ?? 400,
    direction: RTL.test(text) ? "rtl" : "ltr",
  });
}

// ─── QR codes and barcodes ───────────────────────────────────────────────────

export function buildCode(el: CodeElement): Group {
  const W = Math.max(1, el.width);
  const H = Math.max(1, el.height);
  const children: FabricObject[] = [];
  if (el.background) children.push(rect(0, 0, W, H, { fill: el.background }));

  const digits = el.codeType === "ean13" ? normalizeEan13(el.value) : null;
  if (digits) {
    const bits = ean13Pattern(digits);
    const quiet = 9;
    const unit = W / (bits.length + quiet * 2);
    const top = H * 0.06;
    const barH = H * 0.7;
    const guardH = H * 0.78;
    const guards = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
    let d = "";
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] !== "1") continue;
      const x = (quiet + i) * unit;
      const h = guards.has(i) ? guardH : barH;
      d += `M${x} ${top}h${unit}v${h}h${-unit}z`;
    }
    children.push(new Path(d, { fill: el.foreground, strokeWidth: 0 }));
    const size = Math.min(unit * 9, H * 0.18);
    const y = top + barH + size * 0.7;
    const text = (t: string, x: number) =>
      label(t, x, y, { size, color: el.foreground, family: "Inter", align: "center" });
    children.push(text(digits[0]!, (quiet - 4) * unit));
    children.push(text(digits.slice(1, 7), (quiet + 3 + 21) * unit));
    children.push(text(digits.slice(7), (quiet + 50 + 21) * unit));
    return box(children, W, H);
  }

  // QR (also used for barcode types that aren't supported yet).
  const matrix = qrMatrix(el.value, el.errorCorrection);
  const n = matrix.length;
  const quiet = 2;
  const cell = Math.min(W, H) / (n + quiet * 2);
  const ox = (W - cell * n) / 2;
  const oy = (H - cell * n) / 2;
  // A hair of overlap hides anti-aliasing seams between neighbouring modules.
  const bleed = cell * 0.03;
  let d = "";
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!matrix[r]![c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && matrix[r]![c]) c++;
      const x = ox + start * cell;
      const y = oy + r * cell;
      d += `M${x} ${y}h${(c - start) * cell + bleed}v${cell + bleed}h${-((c - start) * cell + bleed)}z`;
    }
  }
  if (d) children.push(new Path(d, { fill: el.foreground, strokeWidth: 0 }));
  return box(children, W, H);
}

// ─── Tables ──────────────────────────────────────────────────────────────────

export function buildTable(el: TableElement): Group {
  const W = Math.max(1, el.width);
  const H = Math.max(1, el.height);
  const rows = el.rows.length;
  const cols = Math.max(...el.rows.map((r) => r.length));
  const weights = Array.from({ length: cols }, (_, c) => el.colWidths[c] ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const colX = [0];
  for (const w of weights) colX.push(colX[colX.length - 1]! + (w / total) * W);
  const pad = Math.min(el.cellPadding, W / cols / 4);

  // Cells hidden under a merged neighbour.
  const covered = new Set<string>();
  el.rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      for (let dr = 0; dr < cell.rowSpan; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) {
          if (dr || dc) covered.add(`${r + dr}:${c + dc}`);
        }
      }
    }),
  );

  const isHeader = (r: number) => el.headerRow && r === 0;
  const texts = el.rows.map((row, r) =>
    row.map((cell, c) => {
      if (covered.has(`${r}:${c}`)) return null;
      const span = Math.min(cols, c + cell.colSpan);
      const rtl = RTL.test(cell.text);
      const align =
        rtl && cell.align !== "center" ? (cell.align === "left" ? "right" : "left") : cell.align;
      return new Textbox(cell.text, {
        width: Math.max(4, colX[span]! - colX[c]! - pad * 2),
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        fontWeight: cell.bold || isHeader(r) ? 700 : 400,
        fill: cell.color ?? el.textColor,
        textAlign: align,
        direction: rtl ? "rtl" : "ltr",
        lineHeight: 1.2,
        splitByGrapheme: false,
      });
    }),
  );

  // Rows share the height; a row grows when its text needs more room.
  const base = H / rows;
  const rowH = el.rows.map((row, r) =>
    Math.max(
      base,
      ...row.map((cell, c) => {
        const tb = texts[r]![c];
        return tb && cell.rowSpan === 1 ? tb.height + pad * 2 : 0;
      }),
    ),
  );
  const rowY = [0];
  for (const h of rowH) rowY.push(rowY[rowY.length - 1]! + h);

  const fills: FabricObject[] = [];
  const lines: FabricObject[] = [];
  const words: FabricObject[] = [];
  el.rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      const tb = texts[r]![c];
      if (!tb) return;
      const x = colX[c]!;
      const y = rowY[r]!;
      const w = colX[Math.min(cols, c + cell.colSpan)]! - x;
      const h = rowY[Math.min(rows, r + cell.rowSpan)]! - y;
      const stripe = el.stripeFill && !isHeader(r) && (r - (el.headerRow ? 1 : 0)) % 2 === 1;
      const fill = cell.fill ?? (isHeader(r) ? el.headerFill : stripe ? el.stripeFill : null);
      if (fill) fills.push(rect(x, y, w, h, { fill }));
      if (el.borderWidth > 0) {
        lines.push(
          rect(x, y, w, h, { fill: "", stroke: el.borderColor, strokeWidth: el.borderWidth }),
        );
      }
      tb.set({ left: x + w / 2, top: y + h / 2 });
      words.push(tb);
    }),
  );
  return box([...fills, ...lines, ...words], W, H);
}

// ─── Charts ──────────────────────────────────────────────────────────────────

/** Round axis limits and a step (1, 2 or 5 × 10ⁿ). */
export function niceScale(min: number, max: number, ticks = 5) {
  if (min === max) max = min + 1;
  const raw = (max - min) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}

/** 1234 → "1.2k", 0.5 → "0.5". */
export function formatValue(v: number): string {
  const abs = Math.abs(v);
  const trim = (s: string) => s.replace(/\.0$/, "");
  if (abs >= 1e9) return `${trim((v / 1e9).toFixed(1))}B`;
  if (abs >= 1e6) return `${trim((v / 1e6).toFixed(1))}M`;
  if (abs >= 1e4) return `${trim((v / 1e3).toFixed(1))}k`;
  return trim(String(Math.round(v * 100) / 100));
}

function arcPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  a0: number,
  a1: number,
): string {
  // A full circle can't be one arc; split it in two.
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    const mid = a0 + Math.PI;
    return arcPath(cx, cy, inner, outer, a0, mid) + arcPath(cx, cy, inner, outer, mid, a1);
  }
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (inner <= 0) {
    return `M${cx} ${cy}L${p(outer, a0)}A${outer} ${outer} 0 ${large} 1 ${p(outer, a1)}Z`;
  }
  return (
    `M${p(outer, a0)}A${outer} ${outer} 0 ${large} 1 ${p(outer, a1)}` +
    `L${p(inner, a1)}A${inner} ${inner} 0 ${large} 0 ${p(inner, a0)}Z`
  );
}

export function buildChart(el: ChartElement): Group {
  const W = Math.max(1, el.width);
  const H = Math.max(1, el.height);
  const family = el.fontFamily;
  const color = el.textColor;
  const fs = Math.max(10, Math.min(36, Math.min(W, H) * 0.045));
  const pad = Math.min(W, H) * 0.05;
  const children: FabricObject[] = [];
  const round = el.chartType === "pie" || el.chartType === "donut";
  const n = Math.max(el.labels.length, ...el.series.map((s) => s.values.length), 0);
  const seriesColor = (i: number) =>
    el.series[i]?.color ?? el.colors[i] ?? CHART_PALETTE[i % CHART_PALETTE.length]!;
  const sliceColor = (i: number) => el.colors[i] ?? CHART_PALETTE[i % CHART_PALETTE.length]!;

  let top = pad;
  let bottom = H - pad;
  if (el.title) {
    children.push(
      label(el.title, W / 2, top, { size: fs * 1.5, color, family, weight: 700, baseline: "top" }),
    );
    top += fs * 2.3;
  }
  if (el.caption) {
    children.push(
      label(el.caption, W / 2, bottom, { size: fs * 0.85, color, family, baseline: "bottom" }),
    );
    bottom -= fs * 1.6;
  }

  // Legend: one row of swatches + names, centred.
  const legendItems = round
    ? el.labels.map((name, i) => ({ name, color: sliceColor(i) }))
    : el.series.map((s, i) => ({ name: s.name, color: seriesColor(i) }));
  if (el.showLegend && (round || el.series.length > 1) && legendItems.length > 0) {
    const swatch = fs * 0.8;
    const gap = fs * 0.4;
    const parts = legendItems.map((item) => ({
      ...item,
      text: label(item.name, 0, 0, { size: fs * 0.9, color, family, align: "left" }),
    }));
    const widths = parts.map((p) => swatch + gap + p.text.width);
    const totalW = widths.reduce((a, b) => a + b, 0) + fs * (parts.length - 1);
    let x = Math.max(pad, (W - totalW) / 2);
    const y = bottom - fs * 0.5;
    parts.forEach((p, i) => {
      children.push(
        rect(x, y - swatch / 2, swatch, swatch, { fill: p.color, rx: swatch / 4, ry: swatch / 4 }),
      );
      p.text.set({ left: x + swatch + gap, top: y });
      children.push(p.text);
      x += widths[i]! + fs;
    });
    bottom -= fs * 1.8;
  }

  if (n === 0 || bottom - top < fs * 2) return box(children, W, H);

  if (round) {
    const values = (el.series[0]?.values ?? []).map((v) => Math.max(0, v));
    const sum = values.reduce((a, b) => a + b, 0);
    const cx = W / 2;
    const cy = (top + bottom) / 2;
    const outer = (Math.min(W - pad * 2, bottom - top) / 2) * 0.95;
    const inner = el.chartType === "donut" ? outer * 0.58 : 0;
    let a = -Math.PI / 2;
    values.forEach((v, i) => {
      if (sum <= 0 || v <= 0) return;
      const sweep = (v / sum) * Math.PI * 2;
      children.push(
        new Path(arcPath(cx, cy, inner, outer, a, a + sweep), {
          fill: sliceColor(i),
          stroke: "#FFFFFF",
          strokeWidth: Math.max(1, outer * 0.012),
          strokeLineJoin: "round",
        }),
      );
      if (el.showValues && sweep > 0.25) {
        const mid = a + sweep / 2;
        const r = inner > 0 ? (inner + outer) / 2 : outer * 0.62;
        children.push(
          label(`${Math.round((v / sum) * 100)}%`, cx + r * Math.cos(mid), cy + r * Math.sin(mid), {
            size: fs * 0.9,
            color: "#FFFFFF",
            family,
            weight: 700,
          }),
        );
      }
      a += sweep;
    });
    return box(children, W, H);
  }

  // Cartesian charts.
  const all = el.series.flatMap((s) => s.values);
  const { lo, hi, step } = niceScale(Math.min(0, ...all), Math.max(0, ...all));
  const tickValues: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) tickValues.push(Math.round(v / step) * step);
  const horizontal = el.chartType === "horizontalBar";
  const tickLabels = tickValues.map((v) =>
    label(formatValue(v), 0, 0, {
      size: fs * 0.85,
      color,
      family,
      align: horizontal ? "center" : "right",
    }),
  );
  const categoryLabels = Array.from({ length: n }, (_, i) =>
    label(el.labels[i] ?? "", 0, 0, {
      size: fs * 0.85,
      color,
      family,
      align: horizontal ? "right" : "center",
    }),
  );
  const gridColor = `${color.slice(0, 7)}26`;
  const axisColor = `${color.slice(0, 7)}66`;
  const line = Math.max(1, fs * 0.06);

  if (horizontal) {
    const labelW = Math.max(...categoryLabels.map((t) => t.width)) + fs * 0.6;
    const x0 = pad + labelW;
    const x1 = W - pad;
    const y0 = top;
    const y1 = bottom - fs * 1.6;
    const vx = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
    tickValues.forEach((v, i) => {
      if (el.showGrid)
        children.push(rect(vx(v) - line / 2, y0, line, y1 - y0, { fill: gridColor }));
      tickLabels[i]!.set({ left: vx(v), top: y1 + fs * 0.8 });
      children.push(tickLabels[i]!);
    });
    const rowH = (y1 - y0) / n;
    const barH = (rowH * 0.7) / el.series.length;
    for (let i = 0; i < n; i++) {
      categoryLabels[i]!.set({ left: x0 - fs * 0.4, top: y0 + rowH * (i + 0.5) });
      children.push(categoryLabels[i]!);
      el.series.forEach((s, k) => {
        const v = s.values[i] ?? 0;
        const y = y0 + rowH * i + rowH * 0.15 + barH * k;
        const a = vx(Math.min(0, v));
        const b = vx(Math.max(0, v));
        children.push(
          rect(a, y, b - a, barH * 0.92, {
            fill: seriesColor(k),
            rx: Math.min(barH * 0.2, 6),
            ry: Math.min(barH * 0.2, 6),
          }),
        );
        if (el.showValues) {
          children.push(
            label(formatValue(v), b + fs * 0.3, y + barH * 0.46, {
              size: fs * 0.8,
              color,
              family,
              align: "left",
            }),
          );
        }
      });
    }
    children.push(rect(vx(0) - line / 2, y0, line, y1 - y0, { fill: axisColor }));
    return box(children, W, H);
  }

  const labelW = Math.max(...tickLabels.map((t) => t.width)) + fs * 0.6;
  const x0 = pad + labelW;
  const x1 = W - pad;
  const y0 = top + fs * 0.5;
  const y1 = bottom - fs * 1.8;
  const vy = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  tickValues.forEach((v, i) => {
    if (el.showGrid) children.push(rect(x0, vy(v) - line / 2, x1 - x0, line, { fill: gridColor }));
    tickLabels[i]!.set({ left: x0 - fs * 0.4, top: vy(v) });
    children.push(tickLabels[i]!);
  });
  const groupW = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    categoryLabels[i]!.set({ left: x0 + groupW * (i + 0.5), top: y1 + fs * 0.9 });
    children.push(categoryLabels[i]!);
  }

  if (el.chartType === "bar") {
    const barW = (groupW * 0.72) / el.series.length;
    el.series.forEach((s, k) => {
      for (let i = 0; i < n; i++) {
        const v = s.values[i] ?? 0;
        const x = x0 + groupW * i + groupW * 0.14 + barW * k;
        const a = vy(Math.max(0, v));
        const b = vy(Math.min(0, v));
        const r = Math.min(barW * 0.2, 6);
        children.push(rect(x, a, barW * 0.92, b - a, { fill: seriesColor(k), rx: r, ry: r }));
        if (el.showValues) {
          children.push(
            label(formatValue(v), x + barW * 0.46, a - fs * 0.2, {
              size: fs * 0.8,
              color,
              family,
              baseline: "bottom",
            }),
          );
        }
      }
    });
  } else {
    el.series.forEach((s, k) => {
      const pts = Array.from({ length: n }, (_, i) => ({
        x: x0 + groupW * (i + 0.5),
        y: vy(s.values[i] ?? 0),
      }));
      const stroke = seriesColor(k);
      const width = Math.max(2, fs * 0.16);
      if (el.chartType === "area" && pts.length > 1) {
        const base = vy(Math.max(lo, 0));
        const d = `M${pts[0]!.x} ${base}${pts.map((p) => `L${p.x} ${p.y}`).join("")}L${pts[pts.length - 1]!.x} ${base}Z`;
        children.push(new Path(d, { fill: `${stroke.slice(0, 7)}40`, strokeWidth: 0 }));
      }
      if (pts.length > 1) {
        const d = `M${pts.map((p) => `${p.x} ${p.y}`).join("L")}`;
        children.push(
          new Path(d, {
            fill: "",
            stroke,
            strokeWidth: width,
            strokeLineJoin: "round",
            strokeLineCap: "round",
          }),
        );
      }
      for (const p of pts) {
        children.push(
          new Circle({
            left: p.x,
            top: p.y,
            radius: width * 1.3,
            fill: "#FFFFFF",
            stroke,
            strokeWidth: width,
          }),
        );
        if (el.showValues) {
          const v = s.values[pts.indexOf(p)] ?? 0;
          children.push(
            label(formatValue(v), p.x, p.y - width * 2.5, {
              size: fs * 0.8,
              color,
              family,
              baseline: "bottom",
            }),
          );
        }
      }
    });
  }
  children.push(rect(x0, vy(Math.max(lo, 0)) - line / 2, x1 - x0, line, { fill: axisColor }));
  return box(children, W, H);
}
