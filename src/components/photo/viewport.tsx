"use client";

import { useEffect, useRef } from "react";
import { addGuide, transformed } from "@/lib/photo/actions";
import { bezierPatch, pointInPolygon, quadBounds } from "@/lib/photo/geometry";
import { pathD } from "@/lib/photo/paths";
import { composite, createCanvas, ctx2d, redrawMargin, takeDirty } from "@/lib/photo/runtime";
import { snapBox, snapTargets, snapValue } from "@/lib/photo/snap";
import { freeQuad } from "@/lib/photo/transform";
import type { Pt } from "@/lib/photo/types";
import { outline, type Mask } from "@/lib/photo/selection";
import { get, set, usePhoto, type TransformState } from "@/lib/photo/store";
import * as tools from "@/lib/photo/tools";
import { useOverlay } from "@/lib/photo/tools";
import { TextEditor } from "./text-editor";

const RULER = 20;

/** Screen ↔ document helpers for the current zoom and pan. */
const toDoc = (sx: number, sy: number) => {
  const { zoom, pan } = get();
  return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
};

function checker(g: CanvasRenderingContext2D, dark: boolean) {
  const c = createCanvas(16, 16);
  const cg = ctx2d(c);
  cg.fillStyle = dark ? "#2a2b33" : "#ffffff";
  cg.fillRect(0, 0, 16, 16);
  cg.fillStyle = dark ? "#202128" : "#e4e4e8";
  cg.fillRect(0, 0, 8, 8);
  cg.fillRect(8, 8, 8, 8);
  return g.createPattern(c, "repeat")!;
}

/** Context for on-screen canvases (GPU-friendly: never read back). */
const screen2d = (c: HTMLCanvasElement) => c.getContext("2d")!;

/** A tidy ruler / grid step for the current zoom. */
function niceStep(pxPerUnit: number, minPx: number) {
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  return steps.find((s) => s * pxPerUnit >= minPx) ?? 10000;
}

/** Corners of the transform box (document coordinates). */
export function transformBox(t: TransformState) {
  const w = t.original.canvas.width * Math.abs(t.scaleX);
  const h = t.original.canvas.height * Math.abs(t.scaleY);
  const cx = t.x + w / 2;
  const cy = t.y + h / 2;
  const a = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const at = (u: number, v: number) => ({ x: cx + u * cos - v * sin, y: cy + u * sin + v * cos });
  return { cx, cy, w, h, a, at };
}

type Handle =
  | { kind: "move" }
  | { kind: "rotate" }
  | { kind: "scale"; hx: number; hy: number }
  | { kind: "corner"; i: number }
  | { kind: "edge"; i: number }
  | { kind: "mesh"; i: number };

/** Outline of the transformed shape (document coordinates). */
function transformOutline(t: TransformState): Pt[] {
  if (t.mode === "warp" && t.mesh) {
    const m = t.mesh;
    const out: Pt[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) out.push(bezierPatch(m, i / n, 0));
    for (let i = 0; i <= n; i++) out.push(bezierPatch(m, 1, i / n));
    for (let i = n; i >= 0; i--) out.push(bezierPatch(m, i / n, 1));
    for (let i = n; i >= 0; i--) out.push(bezierPatch(m, 0, i / n));
    return out;
  }
  return t.mode === "free" ? freeQuad(t) : (t.quad ?? freeQuad(t));
}

const midpoint = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function hitTransform(t: TransformState, x: number, y: number, zoom: number): Handle | null {
  const tol = 8 / zoom;
  if (t.mode === "warp" && t.mesh) {
    for (let i = 0; i < 16; i++) {
      const q = t.mesh[i]!;
      if (Math.hypot(q[0] - x, q[1] - y) <= tol) return { kind: "mesh", i };
    }
    return pointInPolygon([x, y], transformOutline(t)) ? { kind: "move" } : null;
  }
  if (t.mode !== "free" && t.quad) {
    const q = t.quad;
    for (let i = 0; i < 4; i++)
      if (Math.hypot(q[i]![0] - x, q[i]![1] - y) <= tol) return { kind: "corner", i };
    for (let i = 0; i < 4; i++) {
      const m = midpoint(q[i]!, q[(i + 1) % 4]!);
      if (Math.hypot(m[0] - x, m[1] - y) <= tol) return { kind: "edge", i };
    }
    return pointInPolygon([x, y], q) ? { kind: "move" } : null;
  }
  const b = transformBox(t);
  for (const hx of [-1, 0, 1])
    for (const hy of [-1, 0, 1]) {
      if (!hx && !hy) continue;
      const p = b.at((hx * b.w) / 2, (hy * b.h) / 2);
      if (Math.hypot(p.x - x, p.y - y) <= tol) return { kind: "scale", hx, hy };
    }
  // Local coordinates of the point.
  const dx = x - b.cx;
  const dy = y - b.cy;
  const u = dx * Math.cos(-b.a) - dy * Math.sin(-b.a);
  const v = dx * Math.sin(-b.a) + dy * Math.cos(-b.a);
  if (Math.abs(u) <= b.w / 2 && Math.abs(v) <= b.h / 2) return { kind: "move" };
  if (Math.abs(u) <= b.w / 2 + 28 / zoom && Math.abs(v) <= b.h / 2 + 28 / zoom)
    return { kind: "rotate" };
  return null;
}

type CropHandle = { kind: "move" } | { kind: "edge"; hx: number; hy: number };

function hitCrop(
  c: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
  zoom: number,
): CropHandle | null {
  const tol = 10 / zoom;
  const hx = Math.abs(x - c.x) <= tol ? -1 : Math.abs(x - (c.x + c.width)) <= tol ? 1 : 0;
  const hy = Math.abs(y - c.y) <= tol ? -1 : Math.abs(y - (c.y + c.height)) <= tol ? 1 : 0;
  const insideX = x >= c.x - tol && x <= c.x + c.width + tol;
  const insideY = y >= c.y - tol && y <= c.y + c.height + tol;
  if ((hx || hy) && insideX && insideY) return { kind: "edge", hx, hy };
  if (x > c.x && x < c.x + c.width && y > c.y && y < c.y + c.height) return { kind: "move" };
  return null;
}

const cursorFor = (tool: string) =>
  tool === "hand"
    ? "grab"
    : tool === "zoom"
      ? "zoom-in"
      : tool === "move"
        ? "move"
        : tool === "type"
          ? "text"
          : tools.BRUSH_TOOLS.has(tool as never)
            ? "none"
            : "crosshair";

export function Viewport() {
  const boxRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const rulerXRef = useRef<HTMLCanvasElement>(null);
  const rulerYRef = useRef<HTMLCanvasElement>(null);
  const tool = usePhoto((s) => s.tool);
  const rulers = usePhoto((s) => s.view.rulers);
  const hasDoc = usePhoto((s) => Boolean(s.doc));

  useEffect(() => {
    const box = boxRef.current!;
    const base = baseRef.current!;
    const over = overRef.current!;
    const docCanvas = createCanvas(1, 1);
    let needComposite = true;
    /** Pixels changed by painting (doc unchanged): try a partial redraw. */
    let pendingPartial = false;
    let frame = 0;
    let overlayOnly = false;
    let size = { w: 1, h: 1, dpr: 1 };
    let antsOffset = 0;
    let pattern: CanvasPattern | null = null;
    let patternDark = false;
    let outlineCache: { mask: Mask; path: Path2D } | null = null;
    let screenCursor: { x: number; y: number } | null = null;
    let guideDrag: { axis: "horizontal" | "vertical"; at: number } | null = null;

    const isDark = () => document.documentElement.dataset.theme === "dark";

    const fit = () => {
      const d = get().doc;
      if (!d) return;
      const zoom = Math.min(1, (size.w - 80) / d.width, (size.h - 80) / d.height);
      const z = Math.max(0.02, zoom);
      set({ zoom: z, pan: { x: (size.w - d.width * z) / 2, y: (size.h - d.height * z) / 2 } });
    };

    const selectionPath = (m: Mask) => {
      if (outlineCache?.mask === m) return outlineCache.path;
      const segs = outline(m);
      const path = new Path2D();
      for (let i = 0; i < segs.length; i += 4) {
        path.moveTo(segs[i]!, segs[i + 1]!);
        path.lineTo(segs[i + 2]!, segs[i + 3]!);
      }
      outlineCache = { mask: m, path };
      return path;
    };

    /** Composite inputs for the current state (live previews, transform, text editing). */
    const compositeOptions = () => {
      const s = get();
      let overrides = s.overrides ?? undefined;
      let placements: Map<string, { x: number; y: number }> | undefined;
      if (s.transform) {
        const r = transformed(s.transform);
        overrides = new Map(overrides);
        overrides.set(s.transform.layerId, r.canvas);
        placements = new Map([[s.transform.layerId, { x: r.x, y: r.y }]]);
      }
      const editing = useOverlay.getState().text?.layerId;
      if (editing) {
        overrides = new Map(overrides);
        overrides.set(editing, createCanvas(1, 1));
      }
      return { overrides, placements, adjustmentOverride: s.adjustmentOverride as never };
    };

    /**
     * While painting, only the area that changed is composited again; returns
     * that area, or null when everything must be redrawn.
     */
    const partialComposite = () => {
      const s = get();
      const d = s.doc!;
      const dirty = takeDirty();
      if (!dirty || docCanvas.width !== d.width || docCanvas.height !== d.height) return null;
      const margin = redrawMargin(d);
      if (!Number.isFinite(margin)) return null;
      const x0 = Math.max(0, dirty.x - margin);
      const y0 = Math.max(0, dirty.y - margin);
      const x1 = Math.min(d.width, dirty.x + dirty.width + margin);
      const y1 = Math.min(d.height, dirty.y + dirty.height + margin);
      if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, width: 0, height: 0 };
      // Large areas are cheaper as one full redraw.
      if ((x1 - x0) * (y1 - y0) > d.width * d.height * 0.6) return null;
      const part = createCanvas(x1 - x0, y1 - y0);
      composite(d, part, { ...compositeOptions(), origin: { x: x0, y: y0 } });
      const dg = ctx2d(docCanvas);
      dg.clearRect(x0, y0, x1 - x0, y1 - y0);
      dg.drawImage(part, x0, y0);
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    };

    let lastView = "";
    let qmTint: HTMLCanvasElement | null = null;

    const drawBase = () => {
      const s = get();
      const d = s.doc;
      const g = screen2d(base);
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (!d) {
        g.clearRect(0, 0, base.width, base.height);
        return;
      }
      // Partial redraw of the document (and of the screen) while painting.
      let area: { x: number; y: number; width: number; height: number } | null = null;
      if (!needComposite && pendingPartial) area = partialComposite();
      if (pendingPartial && !area) needComposite = true;
      pendingPartial = false;
      const view = `${s.zoom}|${s.pan.x}|${s.pan.y}|${size.w}|${size.h}|${isDark()}|${s.quickMask}`;
      const sameView = view === lastView;
      lastView = view;
      if (needComposite) {
        if (docCanvas.width !== d.width || docCanvas.height !== d.height) {
          docCanvas.width = d.width;
          docCanvas.height = d.height;
        }
        composite(d, docCanvas, compositeOptions());
        takeDirty();
        needComposite = false;
        area = null;
      }
      const { dpr } = size;
      const dark = isDark();
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (area && sameView) {
        if (!area.width) return;
        // Only the changed part of the screen.
        const x = Math.floor((s.pan.x + area.x * s.zoom) * dpr) - 2;
        const y = Math.floor((s.pan.y + area.y * s.zoom) * dpr) - 2;
        const w = Math.ceil(area.width * s.zoom * dpr) + 4;
        const h = Math.ceil(area.height * s.zoom * dpr) + 4;
        g.save();
        g.beginPath();
        g.rect(x, y, w, h);
        g.clip();
        g.clearRect(x, y, w, h);
      } else {
        g.save();
        g.clearRect(0, 0, base.width, base.height);
      }
      if (!pattern || patternDark !== dark) {
        pattern = checker(g, dark);
        patternDark = dark;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = pattern;
      g.fillRect(s.pan.x, s.pan.y, d.width * s.zoom, d.height * s.zoom);
      g.setTransform(dpr * s.zoom, 0, 0, dpr * s.zoom, dpr * s.pan.x, dpr * s.pan.y);
      g.imageSmoothingEnabled = s.zoom < 2;
      g.imageSmoothingQuality = "high";
      g.drawImage(docCanvas, 0, 0);
      const qm = useOverlay.getState().quickMask;
      if (s.quickMask && qm) {
        if (!qmTint || qmTint.width !== d.width || qmTint.height !== d.height)
          qmTint = createCanvas(d.width, d.height);
        const tg = ctx2d(qmTint);
        tg.globalCompositeOperation = "copy";
        tg.fillStyle = "rgba(255, 40, 40, 0.5)";
        tg.fillRect(0, 0, d.width, d.height);
        tg.globalCompositeOperation = "destination-out";
        tg.drawImage(qm, 0, 0);
        g.drawImage(qmTint, 0, 0);
      }
      g.restore();
    };

    const drawOverlay = () => {
      const s = get();
      const d = s.doc;
      const o = useOverlay.getState();
      const g = screen2d(over);
      const { dpr } = size;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, over.width, over.height);
      if (!d) return;
      const z = s.zoom;
      const sx = (x: number) => s.pan.x + x * z;
      const sy = (y: number) => s.pan.y + y * z;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.lineWidth = 1;

      // Pixel grid when zoomed far in.
      if (z >= 10) {
        g.strokeStyle = "rgba(128,128,128,0.25)";
        g.beginPath();
        const x0 = Math.max(0, Math.floor(-s.pan.x / z));
        const x1 = Math.min(d.width, Math.ceil((size.w - s.pan.x) / z));
        const y0 = Math.max(0, Math.floor(-s.pan.y / z));
        const y1 = Math.min(d.height, Math.ceil((size.h - s.pan.y) / z));
        for (let x = x0; x <= x1; x++) {
          g.moveTo(Math.round(sx(x)) + 0.5, sy(y0));
          g.lineTo(Math.round(sx(x)) + 0.5, sy(y1));
        }
        for (let y = y0; y <= y1; y++) {
          g.moveTo(sx(x0), Math.round(sy(y)) + 0.5);
          g.lineTo(sx(x1), Math.round(sy(y)) + 0.5);
        }
        g.stroke();
      }

      if (s.view.grid) {
        const step = niceStep(z, 48);
        g.strokeStyle = "rgba(124,108,242,0.35)";
        g.beginPath();
        for (let x = 0; x <= d.width; x += step) {
          g.moveTo(Math.round(sx(x)) + 0.5, sy(0));
          g.lineTo(Math.round(sx(x)) + 0.5, sy(d.height));
        }
        for (let y = 0; y <= d.height; y += step) {
          g.moveTo(sx(0), Math.round(sy(y)) + 0.5);
          g.lineTo(sx(d.width), Math.round(sy(y)) + 0.5);
        }
        g.stroke();
      }

      if (s.view.guides) {
        g.strokeStyle = "#00C2FF";
        g.beginPath();
        for (const y of d.guides.horizontal) {
          g.moveTo(0, Math.round(sy(y)) + 0.5);
          g.lineTo(size.w, Math.round(sy(y)) + 0.5);
        }
        for (const x of d.guides.vertical) {
          g.moveTo(Math.round(sx(x)) + 0.5, 0);
          g.lineTo(Math.round(sx(x)) + 0.5, size.h);
        }
        g.stroke();
      }
      if (guideDrag) {
        g.strokeStyle = "#00C2FF";
        g.setLineDash([4, 3]);
        g.beginPath();
        if (guideDrag.axis === "horizontal") {
          g.moveTo(0, sy(guideDrag.at));
          g.lineTo(size.w, sy(guideDrag.at));
        } else {
          g.moveTo(sx(guideDrag.at), 0);
          g.lineTo(sx(guideDrag.at), size.h);
        }
        g.stroke();
        g.setLineDash([]);
      }

      // Marching ants.
      if (s.selection && s.view.edges && !s.quickMask) {
        const path = selectionPath(s.selection);
        g.save();
        g.setTransform(dpr * z, 0, 0, dpr * z, dpr * s.pan.x, dpr * s.pan.y);
        g.lineWidth = 1 / z;
        g.strokeStyle = "#FFFFFF";
        g.stroke(path);
        g.strokeStyle = "#000000";
        g.setLineDash([4 / z, 4 / z]);
        g.lineDashOffset = -antsOffset / z;
        g.stroke(path);
        g.restore();
      }

      const dashed = (draw: () => void) => {
        g.strokeStyle = "#FFFFFF";
        g.setLineDash([]);
        draw();
        g.stroke();
        g.strokeStyle = "#000000";
        g.setLineDash([4, 4]);
        g.lineDashOffset = -antsOffset;
        draw();
        g.stroke();
        g.setLineDash([]);
      };

      if (o.rect) {
        const r = o.rect;
        const x = Math.min(r.x, r.x + r.width);
        const y = Math.min(r.y, r.y + r.height);
        const w = Math.abs(r.width);
        const h = Math.abs(r.height);
        dashed(() => {
          g.beginPath();
          if (r.ellipse)
            g.ellipse(sx(x + w / 2), sy(y + h / 2), (w * z) / 2, (h * z) / 2, 0, 0, Math.PI * 2);
          else g.rect(sx(x) + 0.5, sy(y) + 0.5, w * z, h * z);
        });
        g.font = "11px system-ui, sans-serif";
        g.fillStyle = "rgba(0,0,0,0.7)";
        const label = `${Math.round(w)} × ${Math.round(h)}`;
        const tw = g.measureText(label).width + 10;
        g.fillRect(sx(x + w) + 8, sy(y + h) + 8, tw, 18);
        g.fillStyle = "#fff";
        g.fillText(label, sx(x + w) + 13, sy(y + h) + 21);
      }

      if (o.points && o.points.length) {
        dashed(() => {
          g.beginPath();
          o.points!.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
          if (s.tool === "polyLasso" && screenCursor) g.lineTo(screenCursor.x, screenCursor.y);
        });
      }

      if (o.line) {
        const l = o.line;
        g.strokeStyle = "#FFFFFF";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(sx(l.x1), sy(l.y1));
        g.lineTo(sx(l.x2), sy(l.y2));
        g.stroke();
        g.strokeStyle = "#111";
        g.lineWidth = 1;
        g.stroke();
        for (const [x, y] of [
          [l.x1, l.y1],
          [l.x2, l.y2],
        ] as const) {
          g.fillStyle = "#fff";
          g.beginPath();
          g.arc(sx(x), sy(y), 4, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        if (l.label) {
          g.font = "11px system-ui, sans-serif";
          const tw = g.measureText(l.label).width + 10;
          g.fillStyle = "rgba(0,0,0,0.75)";
          g.fillRect(sx(l.x2) + 10, sy(l.y2) - 9, tw, 18);
          g.fillStyle = "#fff";
          g.fillText(l.label, sx(l.x2) + 15, sy(l.y2) + 4);
        }
      }

      if (o.crop) {
        const c = o.crop;
        const x = sx(c.x);
        const y = sy(c.y);
        const w = c.width * z;
        const h = c.height * z;
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.beginPath();
        g.rect(0, 0, size.w, size.h);
        g.rect(x, y, w, h);
        g.fill("evenodd");
        g.strokeStyle = "rgba(255,255,255,0.5)";
        g.beginPath();
        for (const k of [1 / 3, 2 / 3]) {
          g.moveTo(x + w * k, y);
          g.lineTo(x + w * k, y + h);
          g.moveTo(x, y + h * k);
          g.lineTo(x + w, y + h * k);
        }
        g.stroke();
        g.strokeStyle = "#fff";
        g.lineWidth = 1.5;
        g.strokeRect(x, y, w, h);
        g.lineWidth = 4;
        for (const [hx, hy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] as const) {
          const px = x + w * hx;
          const py = y + h * hy;
          const dx = hx ? -1 : 1;
          const dy = hy ? -1 : 1;
          g.beginPath();
          g.moveTo(px + dx * 16, py);
          g.lineTo(px, py);
          g.lineTo(px, py + dy * 16);
          g.stroke();
        }
        g.lineWidth = 1;
        g.font = "11px system-ui, sans-serif";
        const label = `${Math.round(c.width)} × ${Math.round(c.height)}`;
        g.fillStyle = "rgba(0,0,0,0.75)";
        g.fillRect(x, y + h + 6, g.measureText(label).width + 10, 18);
        g.fillStyle = "#fff";
        g.fillText(label, x + 5, y + h + 19);
      }

      if (o.cloneSource && (s.tool === "clone" || s.tool === "heal")) {
        const cx = sx(o.cloneSource.x);
        const cy = sy(o.cloneSource.y);
        g.strokeStyle = "#fff";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cx - 8, cy);
        g.lineTo(cx + 8, cy);
        g.moveTo(cx, cy - 8);
        g.lineTo(cx, cy + 8);
        g.stroke();
        g.strokeStyle = "#000";
        g.lineWidth = 1;
        g.stroke();
      }

      const activePath = d.paths?.find((x) => x.id === s.activePathId);
      if (activePath && activePath.subpaths.length) {
        g.save();
        g.setTransform(dpr * z, 0, 0, dpr * z, dpr * s.pan.x, dpr * s.pan.y);
        g.lineWidth = 1.5 / z;
        g.strokeStyle = "#1E90FF";
        g.stroke(new Path2D(pathD(activePath)));
        g.restore();
        if (s.tool === "pen" || s.tool === "freeformPen" || s.tool === "pathSelect") {
          const pick = o.pathSel?.pathId === activePath.id ? o.pathSel : null;
          activePath.subpaths.forEach((sp, si) =>
            sp.points.forEach((pt, pi) => {
              const picked = pick?.sub === si && pick.index === pi;
              g.strokeStyle = "#1E90FF";
              g.lineWidth = 1;
              for (const h of [pt.in, pt.out]) {
                if (!h) continue;
                g.beginPath();
                g.moveTo(sx(pt.x), sy(pt.y));
                g.lineTo(sx(h[0]), sy(h[1]));
                g.stroke();
                g.fillStyle = "#1E90FF";
                g.beginPath();
                g.arc(sx(h[0]), sy(h[1]), 3, 0, Math.PI * 2);
                g.fill();
              }
              g.fillStyle = picked ? "#1E90FF" : "#FFFFFF";
              g.fillRect(sx(pt.x) - 3.5, sy(pt.y) - 3.5, 7, 7);
              g.strokeRect(sx(pt.x) - 3.5, sy(pt.y) - 3.5, 7, 7);
            }),
          );
        }
      }

      if (o.snapLines) {
        g.strokeStyle = "#F72585";
        g.lineWidth = 1;
        g.beginPath();
        for (const x of o.snapLines.x) {
          g.moveTo(Math.round(sx(x)) + 0.5, 0);
          g.lineTo(Math.round(sx(x)) + 0.5, size.h);
        }
        for (const y of o.snapLines.y) {
          g.moveTo(0, Math.round(sy(y)) + 0.5);
          g.lineTo(size.w, Math.round(sy(y)) + 0.5);
        }
        g.stroke();
      }

      if (s.transform && s.transform.mode !== "free") {
        const t = s.transform;
        g.strokeStyle = "#7C6CF2";
        g.lineWidth = 1.5;
        g.fillStyle = "#fff";
        if (t.mode === "warp" && t.mesh) {
          const m = t.mesh;
          g.beginPath();
          for (let k = 0; k <= 3; k++) {
            for (let i = 0; i <= 24; i++) {
              const a = bezierPatch(m, k / 3, i / 24);
              if (i) g.lineTo(sx(a[0]), sy(a[1]));
              else g.moveTo(sx(a[0]), sy(a[1]));
            }
            for (let i = 0; i <= 24; i++) {
              const a = bezierPatch(m, i / 24, k / 3);
              if (i) g.lineTo(sx(a[0]), sy(a[1]));
              else g.moveTo(sx(a[0]), sy(a[1]));
            }
          }
          g.stroke();
          // Handle lines from each corner to its neighbours.
          g.lineWidth = 1;
          g.beginPath();
          for (const [c, a, b] of [
            [0, 1, 4],
            [3, 2, 7],
            [12, 13, 8],
            [15, 14, 11],
          ] as const) {
            for (const n of [a, b]) {
              g.moveTo(sx(m[c]![0]), sy(m[c]![1]));
              g.lineTo(sx(m[n]![0]), sy(m[n]![1]));
            }
          }
          g.stroke();
          m.forEach((q, i) => {
            const corner = i === 0 || i === 3 || i === 12 || i === 15;
            g.beginPath();
            if (corner) g.rect(sx(q[0]) - 4, sy(q[1]) - 4, 8, 8);
            else g.arc(sx(q[0]), sy(q[1]), 3.5, 0, Math.PI * 2);
            g.fill();
            g.stroke();
          });
        } else if (t.quad) {
          const q = t.quad;
          g.beginPath();
          q.forEach((pt, i) =>
            i ? g.lineTo(sx(pt[0]), sy(pt[1])) : g.moveTo(sx(pt[0]), sy(pt[1])),
          );
          g.closePath();
          g.stroke();
          g.lineWidth = 1;
          q.forEach((pt, i) => {
            g.fillRect(sx(pt[0]) - 4, sy(pt[1]) - 4, 8, 8);
            g.strokeRect(sx(pt[0]) - 4, sy(pt[1]) - 4, 8, 8);
            const m = midpoint(pt, q[(i + 1) % 4]!);
            g.fillRect(sx(m[0]) - 3, sy(m[1]) - 3, 6, 6);
            g.strokeRect(sx(m[0]) - 3, sy(m[1]) - 3, 6, 6);
          });
        }
        g.lineWidth = 1;
      }

      if (s.transform && s.transform.mode === "free") {
        const b = transformBox(s.transform);
        const pts = [
          b.at(-b.w / 2, -b.h / 2),
          b.at(b.w / 2, -b.h / 2),
          b.at(b.w / 2, b.h / 2),
          b.at(-b.w / 2, b.h / 2),
        ];
        g.strokeStyle = "#7C6CF2";
        g.lineWidth = 1.5;
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(sx(p.x), sy(p.y)) : g.moveTo(sx(p.x), sy(p.y))));
        g.closePath();
        g.stroke();
        g.fillStyle = "#fff";
        for (const hx of [-1, 0, 1])
          for (const hy of [-1, 0, 1]) {
            if (!hx && !hy) continue;
            const p = b.at((hx * b.w) / 2, (hy * b.h) / 2);
            g.fillRect(sx(p.x) - 4, sy(p.y) - 4, 8, 8);
            g.strokeRect(sx(p.x) - 4, sy(p.y) - 4, 8, 8);
          }
        g.beginPath();
        g.arc(sx(b.cx), sy(b.cy), 4, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 1;
      }

      if (screenCursor && tools.BRUSH_TOOLS.has(s.tool) && !s.transform) {
        const r = Math.max(1, (s.options.size * z) / 2);
        g.lineWidth = 1;
        g.strokeStyle = "rgba(255,255,255,0.9)";
        g.beginPath();
        g.arc(screenCursor.x, screenCursor.y, r, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = "rgba(0,0,0,0.9)";
        g.beginPath();
        g.arc(screenCursor.x, screenCursor.y, r + 1, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(screenCursor.x - 3, screenCursor.y);
        g.lineTo(screenCursor.x + 3, screenCursor.y);
        g.moveTo(screenCursor.x, screenCursor.y - 3);
        g.lineTo(screenCursor.x, screenCursor.y + 3);
        g.stroke();
      }
      drawRulers();
    };

    const drawRulers = () => {
      const s = get();
      const d = s.doc;
      const rx = rulerXRef.current;
      const ry = rulerYRef.current;
      if (!d || !rx || !ry) return;
      const { dpr } = size;
      const dark = isDark();
      const step = niceStep(s.zoom, 60);
      const minor = step / 5;
      for (const [c, horizontal] of [
        [rx, true],
        [ry, false],
      ] as const) {
        const len = horizontal ? size.w : size.h;
        const want = Math.round(len * dpr);
        if (horizontal ? c.width !== want : c.height !== want) {
          if (horizontal) {
            c.width = want;
            c.height = RULER * dpr;
          } else {
            c.height = want;
            c.width = RULER * dpr;
          }
        }
        const g = screen2d(c);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = dark ? "#15161e" : "#f4f3ef";
        g.fillRect(0, 0, horizontal ? len : RULER, horizontal ? RULER : len);
        g.strokeStyle = dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
        g.fillStyle = dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)";
        g.font = "9px system-ui, sans-serif";
        g.beginPath();
        const origin = horizontal ? s.pan.x : s.pan.y;
        const first = Math.floor(-origin / s.zoom / minor) * minor;
        for (let v = first; origin + v * s.zoom < len; v += minor) {
          const p = Math.round(origin + v * s.zoom) + 0.5;
          const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
          const tick = major ? RULER : RULER * 0.3;
          if (horizontal) {
            g.moveTo(p, RULER);
            g.lineTo(p, RULER - tick);
            if (major) g.fillText(String(Math.round(v)), p + 2, 9);
          } else {
            g.moveTo(RULER, p);
            g.lineTo(RULER - tick, p);
            if (major) {
              g.save();
              g.translate(9, p + 2);
              g.rotate(-Math.PI / 2);
              g.fillText(String(Math.round(v)), -g.measureText(String(Math.round(v))).width, 0);
              g.restore();
            }
          }
        }
        g.stroke();
      }
    };

    const schedule = (full: boolean) => {
      if (full) overlayOnly = false;
      else if (!frame) overlayOnly = true;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!overlayOnly) drawBase();
        drawOverlay();
        overlayOnly = false;
      });
    };

    const resize = () => {
      const r = box.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size = { w: r.width, h: r.height, dpr };
      for (const c of [base, over]) {
        c.width = Math.max(1, Math.round(r.width * dpr));
        c.height = Math.max(1, Math.round(r.height * dpr));
        c.style.width = `${r.width}px`;
        c.style.height = `${r.height}px`;
      }
      if (!get().zoom) fit();
      schedule(true);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();

    const unsub = usePhoto.subscribe((s, prev) => {
      if (s.doc && !s.zoom && size.w > 1) {
        fit();
        return;
      }
      const structural =
        s.doc !== prev.doc ||
        s.overrides !== prev.overrides ||
        s.adjustmentOverride !== prev.adjustmentOverride ||
        s.transform !== prev.transform ||
        s.quickMask !== prev.quickMask;
      const content = structural || s.rev !== prev.rev;
      // Painting only bumps rev (and records the changed area): redraw just that.
      if (structural) needComposite = true;
      else if (content) pendingPartial = true;
      if (content || s.zoom !== prev.zoom || s.pan !== prev.pan) schedule(true);
      else if (
        s.selection !== prev.selection ||
        s.view !== prev.view ||
        s.tool !== prev.tool ||
        s.options !== prev.options
      )
        schedule(false);
    });
    const unsubOverlay = useOverlay.subscribe((o, prev) => {
      if (o.text !== prev.text) {
        needComposite = true;
        schedule(true);
      } else schedule(false);
    });
    const themeObserver = new MutationObserver(() => schedule(true));
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // Marching ants.
    const ants = window.setInterval(() => {
      const s = get();
      const o = useOverlay.getState();
      if ((s.selection && s.view.edges) || o.rect || o.points) {
        antsOffset = (antsOffset + 1) % 8;
        schedule(false);
      }
    }, 110);

    // ─── Pointer input ───────────────────────────────────────────────────────

    let spaceDown = false;
    let pan: { x: number; y: number; px: number; py: number } | null = null;
    let tDrag: { handle: Handle; start: { x: number; y: number }; t0: TransformState } | null =
      null;
    let cDrag: {
      handle: CropHandle;
      start: { x: number; y: number };
      c0: { x: number; y: number; width: number; height: number };
    } | null = null;
    let toolActive = false;
    let cursorFrame = 0;

    /** The viewport's box, kept during a drag (reading it per event forces layout). */
    let dragRect: DOMRect | null = null;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = dragRect ?? box.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pointer = (e: PointerEvent): tools.Pointer => {
      const l = local(e);
      const p = toDoc(l.x, l.y);
      return {
        x: p.x,
        y: p.y,
        pressure: e.pointerType === "pen" ? e.pressure || 0.5 : 1,
        shift: e.shiftKey,
        alt: e.altKey,
        ctrl: e.ctrlKey || e.metaKey,
        zoom: get().zoom,
      };
    };

    const updateCursor = (e: PointerEvent) => {
      const l = local(e);
      screenCursor = l;
      if (cursorFrame) return;
      cursorFrame = requestAnimationFrame(() => {
        cursorFrame = 0;
        const s = get();
        const d = s.doc;
        if (!d || !screenCursor) return;
        const p = toDoc(screenCursor.x, screenCursor.y);
        const x = Math.floor(p.x);
        const y = Math.floor(p.y);
        let rgba: [number, number, number, number] | null = null;
        if (x >= 0 && y >= 0 && x < d.width && y < d.height) {
          const px = ctx2d(docCanvas).getImageData(x, y, 1, 1).data;
          rgba = [px[0]!, px[1]!, px[2]!, px[3]!];
        }
        set({ cursor: { x, y, rgba } });
      });
      schedule(false);
    };

    const onDown = (e: PointerEvent) => {
      const s = get();
      if (!s.doc || e.button === 2 || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      box.focus({ preventScroll: true });
      box.setPointerCapture(e.pointerId);
      const l = local(e);
      if (e.button === 1 || spaceDown || s.tool === "hand") {
        pan = { x: s.pan.x, y: s.pan.y, px: l.x, py: l.y };
        box.style.cursor = "grabbing";
        return;
      }
      const p = pointer(e);
      if (s.transform) {
        const handle = hitTransform(s.transform, p.x, p.y, s.zoom);
        if (handle) tDrag = { handle, start: { x: p.x, y: p.y }, t0: s.transform };
        return;
      }
      const crop = useOverlay.getState().crop;
      if (s.tool === "crop" && crop) {
        const handle = hitCrop(crop, p.x, p.y, s.zoom);
        if (handle) {
          cDrag = { handle, start: { x: p.x, y: p.y }, c0: crop };
          return;
        }
      }
      if (s.tool === "type" && useOverlay.getState().text) {
        tools.commitText();
        return;
      }
      toolActive = true;
      dragRect = box.getBoundingClientRect();
      tools.down(p);
      tools.flushPaint();
    };

    const onMove = (e: PointerEvent) => {
      updateCursor(e);
      const s = get();
      const l = local(e);
      if (pan) {
        set({ pan: { x: pan.x + l.x - pan.px, y: pan.y + l.y - pan.py } });
        return;
      }
      const p = pointer(e);
      if (tDrag) {
        transformDrag(tDrag, p);
        return;
      }
      if (cDrag) {
        cropDrag(cDrag, p);
        return;
      }
      if (toolActive) {
        // Coalesced events give smoother strokes.
        const events = e.getCoalescedEvents?.() ?? [e];
        for (const ev of events.length ? events : [e]) tools.move(pointer(ev));
        // One redraw per frame, however many events arrived.
        tools.flushPaint();
        return;
      }
      // Hover feedback.
      if (s.transform) {
        const h = hitTransform(s.transform, p.x, p.y, s.zoom);
        box.style.cursor = !h
          ? "default"
          : h.kind === "move"
            ? "move"
            : h.kind === "rotate"
              ? "alias"
              : h.kind === "scale"
                ? "nwse-resize"
                : "crosshair";
      } else if (s.tool === "crop" && useOverlay.getState().crop) {
        const h = hitCrop(useOverlay.getState().crop!, p.x, p.y, s.zoom);
        box.style.cursor = !h
          ? "crosshair"
          : h.kind === "move"
            ? "move"
            : h.hx && h.hy
              ? h.hx === h.hy
                ? "nwse-resize"
                : "nesw-resize"
              : h.hx
                ? "ew-resize"
                : "ns-resize";
      } else box.style.cursor = spaceDown ? "grab" : cursorFor(s.tool);
    };

    const onUp = (e: PointerEvent) => {
      if (box.hasPointerCapture(e.pointerId)) box.releasePointerCapture(e.pointerId);
      if (pan) {
        pan = null;
        box.style.cursor = spaceDown ? "grab" : cursorFor(get().tool);
        return;
      }
      if (tDrag) {
        tDrag = null;
        useOverlay.setState({ snapLines: null });
        return;
      }
      if (cDrag) {
        cDrag = null;
        useOverlay.setState({ snapLines: null });
        return;
      }
      if (toolActive) {
        toolActive = false;
        tools.up(pointer(e));
      }
      dragRect = null;
    };

    const onLeave = () => {
      screenCursor = null;
      set({ cursor: null });
      schedule(false);
    };

    const transformDrag = (drag: NonNullable<typeof tDrag>, p: tools.Pointer) => {
      const t0 = drag.t0;
      const s0 = get();
      let mx = p.x - drag.start.x;
      let my = p.y - drag.start.y;
      if (drag.handle.kind === "move") {
        if (p.shift) {
          if (Math.abs(mx) > Math.abs(my)) my = 0;
          else mx = 0;
        }
        // Snap the shape's box to guides and the canvas.
        if (s0.view.snap && s0.doc) {
          const b0 = quadBounds(transformOutline(t0));
          const snap = snapBox(
            { ...b0, x: b0.x + mx, y: b0.y + my },
            snapTargets(s0.doc.width, s0.doc.height, s0.doc.guides),
            8 / s0.zoom,
          );
          mx += snap.dx;
          my += snap.dy;
          useOverlay.setState({
            snapLines: snap.lines.x.length || snap.lines.y.length ? snap.lines : null,
          });
        }
        const shift = (q: Pt): Pt => [q[0] + mx, q[1] + my];
        set({
          transform: {
            ...t0,
            x: Math.round(t0.x + mx),
            y: Math.round(t0.y + my),
            quad: t0.quad?.map(shift) ?? null,
            mesh: t0.mesh?.map(shift) ?? null,
          },
        });
        return;
      }
      if (drag.handle.kind === "mesh" && t0.mesh) {
        const i = drag.handle.i;
        // Corners carry their two handles along.
        const carry: Record<number, number[]> = { 0: [1, 4], 3: [2, 7], 12: [13, 8], 15: [14, 11] };
        const move = new Set([i, ...(carry[i] ?? [])]);
        set({
          transform: {
            ...t0,
            mesh: t0.mesh.map((q, k) => (move.has(k) ? ([q[0] + mx, q[1] + my] as Pt) : q)),
          },
        });
        return;
      }
      if ((drag.handle.kind === "corner" || drag.handle.kind === "edge") && t0.quad) {
        const q = t0.quad.map((pt) => [...pt] as Pt);
        const i = drag.handle.i;
        const add = (k: number, x: number, y: number) => {
          q[k] = [q[k]![0] + x, q[k]![1] + y];
        };
        const horizontal = Math.abs(mx) >= Math.abs(my);
        if (drag.handle.kind === "edge") {
          const j = (i + 1) % 4;
          // Top/bottom edges are 0 and 2; left/right are 3 and 1.
          const sideways = i === 0 || i === 2;
          if (t0.mode === "distort") {
            add(i, mx, my);
            add(j, mx, my);
          } else if (sideways) {
            add(i, mx, 0);
            add(j, mx, 0);
          } else {
            add(i, 0, my);
            add(j, 0, my);
          }
        } else if (t0.mode === "distort") add(i, mx, my);
        else if (t0.mode === "skew") {
          // Slide the corner and its neighbour along one side.
          const partner = horizontal ? [1, 0, 3, 2][i]! : [3, 2, 1, 0][i]!;
          if (horizontal) {
            add(i, mx, 0);
            add(partner, mx, 0);
          } else {
            add(i, 0, my);
            add(partner, 0, my);
          }
        } else {
          // Perspective: the opposite corner on the same side moves the other way.
          const partner = horizontal ? [1, 0, 3, 2][i]! : [3, 2, 1, 0][i]!;
          if (horizontal) {
            add(i, mx, 0);
            add(partner, -mx, 0);
          } else {
            add(i, 0, my);
            add(partner, 0, -my);
          }
        }
        set({ transform: { ...t0, quad: q } });
        return;
      }
      const b = transformBox(t0);
      const srcW = t0.original.canvas.width;
      const srcH = t0.original.canvas.height;
      if (drag.handle.kind === "rotate") {
        const a0 = Math.atan2(drag.start.y - b.cy, drag.start.x - b.cx);
        const a1 = Math.atan2(p.y - b.cy, p.x - b.cx);
        let rotation = t0.rotation + ((a1 - a0) * 180) / Math.PI;
        if (p.shift) rotation = Math.round(rotation / 15) * 15;
        set({ transform: { ...t0, rotation } });
        return;
      }
      if (drag.handle.kind !== "scale") return;
      const { hx, hy } = drag.handle;
      const anchor = b.at((-hx * b.w) / 2, (-hy * b.h) / 2);
      const dx = p.x - anchor.x;
      const dy = p.y - anchor.y;
      // Pointer in the box's own (rotated) frame, relative to the anchor.
      const u = dx * Math.cos(-b.a) - dy * Math.sin(-b.a);
      const v = dx * Math.sin(-b.a) + dy * Math.cos(-b.a);
      let w = hx ? u * hx : b.w;
      let h = hy ? v * hy : b.h;
      // Corners keep proportions unless Shift is held; Alt scales from the centre.
      if (hx && hy && !p.shift) {
        const k = Math.max(w / b.w, h / b.h);
        w = b.w * k;
        h = b.h * k;
      }
      const flipX = w < 0 ? -1 : 1;
      const flipY = h < 0 ? -1 : 1;
      w = Math.max(1, Math.abs(w));
      h = Math.max(1, Math.abs(h));
      const centerLocal = { u: hx ? (hx * flipX * w) / 2 : 0, v: hy ? (hy * flipY * h) / 2 : 0 };
      const cx = anchor.x + centerLocal.u * Math.cos(b.a) - centerLocal.v * Math.sin(b.a);
      const cy = anchor.y + centerLocal.u * Math.sin(b.a) + centerLocal.v * Math.cos(b.a);
      const sxSign = Math.sign(t0.scaleX) * flipX;
      const sySign = Math.sign(t0.scaleY) * flipY;
      set({
        transform: {
          ...t0,
          scaleX: (sxSign * w) / srcW,
          scaleY: (sySign * h) / srcH,
          x: cx - w / 2,
          y: cy - h / 2,
        },
      });
    };

    const cropDrag = (drag: NonNullable<typeof cDrag>, p: tools.Pointer) => {
      const c = { ...drag.c0 };
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      if (drag.handle.kind === "move") {
        c.x += dx;
        c.y += dy;
      } else {
        const { hx, hy } = drag.handle;
        if (hx < 0) {
          c.x += dx;
          c.width -= dx;
        }
        if (hx > 0) c.width += dx;
        if (hy < 0) {
          c.y += dy;
          c.height -= dy;
        }
        if (hy > 0) c.height += dy;
        const r = get().options.cropRatio;
        const d = get().doc!;
        const ratio =
          r === "free"
            ? p.shift
              ? drag.c0.width / drag.c0.height
              : null
            : r === "original"
              ? d.width / d.height
              : (() => {
                  const [a, b] = r.split(":").map(Number);
                  return a! / b!;
                })();
        if (ratio) {
          if (hx) {
            const nh = c.width / ratio;
            if (hy < 0) c.y += c.height - nh;
            c.height = nh;
          } else {
            const nw = c.height * ratio;
            c.width = nw;
          }
        }
      }
      const s0 = get();
      if (s0.view.snap && s0.doc) {
        const targets = snapTargets(s0.doc.width, s0.doc.height, s0.doc.guides);
        const tol = 8 / s0.zoom;
        if (drag.handle.kind === "move") {
          const snap = snapBox(c, targets, tol);
          c.x += snap.dx;
          c.y += snap.dy;
        } else {
          const { hx, hy } = drag.handle;
          if (hx < 0) {
            const x = snapValue(c.x, targets.x, tol);
            c.width += c.x - x;
            c.x = x;
          }
          if (hx > 0) c.width = snapValue(c.x + c.width, targets.x, tol) - c.x;
          if (hy < 0) {
            const y = snapValue(c.y, targets.y, tol);
            c.height += c.y - y;
            c.y = y;
          }
          if (hy > 0) c.height = snapValue(c.y + c.height, targets.y, tol) - c.y;
        }
      }
      if (c.width < 0) {
        c.x += c.width;
        c.width = -c.width;
      }
      if (c.height < 0) {
        c.y += c.height;
        c.height = -c.height;
      }
      useOverlay.setState({
        crop: {
          x: Math.round(c.x),
          y: Math.round(c.y),
          width: Math.max(1, Math.round(c.width)),
          height: Math.max(1, Math.round(c.height)),
        },
      });
    };

    const onWheel = (e: WheelEvent) => {
      const s = get();
      if (!s.doc) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const l = local(e);
        const p = toDoc(l.x, l.y);
        tools.zoomAt(p, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)));
        return;
      }
      const k = e.deltaMode === 1 ? 16 : 1;
      const dx = (e.shiftKey ? e.deltaY : e.deltaX) * k;
      const dy = e.shiftKey ? 0 : e.deltaY * k;
      set({ pan: { x: s.pan.x - dx, y: s.pan.y - dy } });
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        return;
      if (e.code === "Space") {
        const was = spaceDown;
        spaceDown = e.type === "keydown";
        if (spaceDown !== was && !pan)
          box.style.cursor = spaceDown ? "grab" : cursorFor(get().tool);
        if (spaceDown) e.preventDefault();
      }
    };

    // Ruler drags create guides.
    const rulerDown = (axis: "horizontal" | "vertical") => (e: PointerEvent) => {
      if (!get().doc) return;
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const l = local(ev);
        const p = toDoc(l.x, l.y);
        guideDrag = { axis, at: Math.round(axis === "horizontal" ? p.y : p.x) };
        schedule(false);
      };
      const up = (ev: PointerEvent) => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        const l = local(ev);
        const d = get().doc;
        if (guideDrag && d && l.x > RULER && l.y > RULER) {
          const max = axis === "horizontal" ? d.height : d.width;
          if (guideDrag.at >= 0 && guideDrag.at <= max) addGuide(axis, guideDrag.at);
        }
        guideDrag = null;
        schedule(false);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    };
    const rx = rulerXRef.current;
    const ry = rulerYRef.current;
    const downX = rulerDown("horizontal");
    const downY = rulerDown("vertical");
    rx?.addEventListener("pointerdown", downX);
    ry?.addEventListener("pointerdown", downY);

    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    box.addEventListener("pointerleave", onLeave);
    box.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    const fitHandler = () => fit();
    window.addEventListener("photo:fit", fitHandler);

    return () => {
      ro.disconnect();
      unsub();
      unsubOverlay();
      themeObserver.disconnect();
      window.clearInterval(ants);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(cursorFrame);
      rx?.removeEventListener("pointerdown", downX);
      ry?.removeEventListener("pointerdown", downY);
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp);
      box.removeEventListener("pointercancel", onUp);
      box.removeEventListener("pointerleave", onLeave);
      box.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("photo:fit", fitHandler);
    };
  }, [rulers]);

  return (
    <div dir="ltr" className="absolute inset-0 overflow-hidden bg-[var(--canvas-backdrop)]">
      <div
        ref={boxRef}
        tabIndex={-1}
        data-testid="photo-viewport"
        className="absolute inset-0 touch-none outline-none"
        style={{ cursor: cursorFor(tool) }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={baseRef} className="pointer-events-none absolute inset-0" />
        <canvas ref={overRef} className="pointer-events-none absolute inset-0" />
        {hasDoc && <TextEditor />}
      </div>
      {rulers && (
        <>
          <canvas
            ref={rulerXRef}
            aria-hidden
            className="absolute start-0 top-0 h-5 w-full cursor-s-resize border-b"
          />
          <canvas
            ref={rulerYRef}
            aria-hidden
            className="absolute start-0 top-0 h-full w-5 cursor-e-resize border-e"
          />
          <span className="absolute start-0 top-0 size-5 border-e border-b bg-card" />
        </>
      )}
    </div>
  );
}

/** Asks the viewport to fit the image in the window. */
export const fitOnScreen = () => window.dispatchEvent(new Event("photo:fit"));
