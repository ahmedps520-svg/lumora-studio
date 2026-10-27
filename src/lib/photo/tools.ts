"use client";
/**
 * What each tool does with the pointer. The viewport turns screen events into
 * document coordinates and calls `down`, `move` and `up` of the active tool.
 * Tools draw their in-progress feedback through `useOverlay`.
 */
import { create } from "zustand";
import * as A from "./actions";
import { sampleGradient } from "./adjustments";
import { gaussianBlur } from "./blur";
import { unsharp } from "./filters";
import { contentAwareFill, healBlend, redEye } from "./inpaint";
import { clamp01, hexToRgb, hslToRgb, type Img, luma, rgbToHex, rgbToHsl } from "./pixels";
import {
  copyCanvas,
  createCanvas,
  ctx2d,
  ensureCovers,
  flatten,
  getPixels,
  gradientT,
  markDirty,
  readImg,
  writeImg,
} from "./runtime";
import {
  hitPath,
  movePathPart,
  type PathHit,
  simplify,
  smoothSubPath,
  distanceToPath,
} from "./paths";
import * as sel from "./selection";
import { type Box, snapBox, snapTargets } from "./snap";
import * as tree from "./tree";
import {
  activeLayer,
  commit,
  get,
  set,
  snapshot,
  type Snapshot,
  TOOL_GROUPS,
  type ToolId,
} from "./store";
import type { GradientKind, Layer, PhotoDoc, PhotoPath } from "./types";

export interface Pointer {
  x: number;
  y: number;
  pressure: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  /** Screen pixels per document pixel (for hit sizes). */
  zoom: number;
}

export interface Overlay {
  rect: { x: number; y: number; width: number; height: number; ellipse?: boolean } | null;
  points: [number, number][] | null;
  line: { x1: number; y1: number; x2: number; y2: number; label?: string } | null;
  crop: { x: number; y: number; width: number; height: number } | null;
  cloneSource: { x: number; y: number } | null;
  text: { x: number; y: number; layerId: string | null; value: string } | null;
  /** Quick-mask painting surface (alpha = selected). */
  quickMask: HTMLCanvasElement | null;
  /** Guides / canvas lines the moving item snapped to. */
  snapLines: { x: number[]; y: number[] } | null;
  /** The anchor picked with the path selection tool. */
  pathSel: { pathId: string; sub: number; index: number } | null;
}

export const useOverlay = create<Overlay>(() => ({
  rect: null,
  points: null,
  line: null,
  crop: null,
  cloneSource: null,
  text: null,
  quickMask: null,
  snapLines: null,
  pathSel: null,
}));
const overlay = useOverlay.setState;

const bump = () => set({ rev: get().rev + 1 });

// ─── Brush dabs ──────────────────────────────────────────────────────────────

const dabCache = new Map<string, HTMLCanvasElement>();
/** A round brush tip: `color` with soft edges by `hardness` (0–1). */
function dab(size: number, hardness: number, color: string): HTMLCanvasElement {
  const s = Math.max(1, Math.round(size));
  const key = `${s}|${hardness.toFixed(2)}|${color}`;
  let c = dabCache.get(key);
  if (c) return c;
  c = createCanvas(s, s);
  const g = ctx2d(c);
  const r = s / 2;
  if (s <= 2) {
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
  } else {
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    const [cr, cg, cb] = hexToRgb(color);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    grad.addColorStop(Math.min(0.99, Math.max(0, hardness)), `rgba(${cr},${cg},${cb},1)`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
  }
  if (dabCache.size > 64) dabCache.clear();
  dabCache.set(key, c);
  return c;
}

/** Points along a segment spaced by the brush spacing. */
function* spaced(
  from: [number, number],
  to: [number, number],
  step: number,
  carry: { left: number },
) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  let t = carry.left;
  while (t <= len) {
    yield [from[0] + (dx * t) / (len || 1), from[1] + (dy * t) / (len || 1)] as [number, number];
    t += step;
  }
  carry.left = t - len;
}

// ─── Painting target ─────────────────────────────────────────────────────────

interface Target {
  canvas: HTMLCanvasElement;
  /** Document position of the canvas's top-left. */
  ox: number;
  oy: number;
  kind: "content" | "mask" | "quickMask";
  layer: Layer | null;
}

function paintTarget(): Target | null {
  const qm = useOverlay.getState().quickMask;
  if (get().quickMask && qm) return { canvas: qm, ox: 0, oy: 0, kind: "quickMask", layer: null };
  const layer = activeLayer();
  if (!layer) return null;
  const p = getPixels(layer.id);
  // Adjustment and fill layers paint on their mask, like the mask itself was selected.
  const onMask = get().maskEdit || layer.kind === "adjustment" || layer.kind === "fill";
  if (onMask && p.mask) return { canvas: p.mask, ox: 0, oy: 0, kind: "mask", layer };
  if (layer.kind !== "pixel" || layer.locks.pixels || layer.locks.all) return null;
  const d = get().doc!;
  ensureCovers(layer, { x: 0, y: 0, width: d.width, height: d.height });
  return { canvas: p.canvas, ox: layer.x, oy: layer.y, kind: "content", layer };
}

/** The selection as a canvas in a target's coordinates (or null). */
function selectionFor(t: Target): HTMLCanvasElement | null {
  const s = get().selection;
  if (!s || t.kind === "quickMask") return null;
  const c = createCanvas(t.canvas.width, t.canvas.height);
  ctx2d(c).drawImage(A.selectionCanvas(s), -t.ox, -t.oy);
  return c;
}

// ─── Stroke-based tools (brush, pencil, eraser, clone, heal, history) ────────

interface Stroke {
  tool: ToolId;
  target: Target;
  before: Snapshot | null;
  base: HTMLCanvasElement;
  buffer: HTMLCanvasElement;
  clip: HTMLCanvasElement | null;
  last: [number, number];
  carry: { left: number };
  bounds: { x0: number; y0: number; x1: number; y1: number };
  source: HTMLCanvasElement | null;
  offset: [number, number];
  start: [number, number];
  /** Area (target coordinates) stamped since the last redraw. */
  pending: { x0: number; y0: number; x1: number; y1: number } | null;
}

let stroke: Stroke | null = null;
let cloneOffset: [number, number] | null = null;

function paintColor(t: Target) {
  const s = get();
  if (t.kind === "content") return s.fg;
  // Masks: lighter paint shows, darker hides.
  return luma(...hexToRgb(s.fg)) >= 128 ? "#FFFFFF" : "#000000";
}

function beginStroke(tool: ToolId, p: Pointer): boolean {
  const t = paintTarget();
  if (!t) return false;
  const s = get();
  let source: HTMLCanvasElement | null = null;
  let offset: [number, number] = [0, 0];
  if (tool === "clone" || tool === "heal") {
    const src = useOverlay.getState().cloneSource;
    if (!src) return false;
    if (!s.options.aligned || !cloneOffset) cloneOffset = [src.x - p.x, src.y - p.y];
    offset = cloneOffset;
    source = s.options.sampleAll ? flatten(s.doc!) : docSized(t);
  }
  if (tool === "historyBrush") {
    if (!s.original) return false;
    source = s.original;
  }
  stroke = {
    tool,
    target: t,
    before: t.kind === "quickMask" ? null : snapshot([t.layer!.id]),
    base: copyCanvas(t.canvas),
    buffer: createCanvas(t.canvas.width, t.canvas.height),
    clip: selectionFor(t),
    last: [p.x, p.y],
    carry: { left: 0 },
    bounds: { x0: p.x, y0: p.y, x1: p.x, y1: p.y },
    source,
    offset,
    start: [p.x, p.y],
    pending: null,
  };
  stampTo(p);
  return true;
}

/** The target's pixels on a document-size canvas (clone source = current layer). */
function docSized(t: Target) {
  const d = get().doc!;
  const c = createCanvas(d.width, d.height);
  ctx2d(c).drawImage(t.canvas, t.ox, t.oy);
  return c;
}

function stampAt(x: number, y: number, pressure: number) {
  const st = stroke!;
  const o = get().options;
  const size = Math.max(1, o.size * (0.35 + 0.65 * pressure));
  const hard = st.tool === "pencil" ? 1 : o.hardness;
  const tx = x - st.target.ox;
  const ty = y - st.target.oy;
  const g = ctx2d(st.buffer);
  g.globalAlpha = o.flow;
  if (st.source) {
    // Clone / heal / history: the source picture through the brush tip.
    const tip = dab(size, hard, "#000000");
    const piece = createCanvas(tip.width, tip.height);
    const pg = ctx2d(piece);
    pg.drawImage(st.source, -(x + st.offset[0] - size / 2), -(y + st.offset[1] - size / 2));
    pg.globalCompositeOperation = "destination-in";
    pg.drawImage(tip, 0, 0);
    g.drawImage(piece, tx - size / 2, ty - size / 2);
  } else {
    const color = st.tool === "eraser" ? "#000000" : paintColor(st.target);
    g.drawImage(dab(size, hard, color), tx - size / 2, ty - size / 2);
  }
  g.globalAlpha = 1;
  const r = st.pending;
  if (!r) st.pending = { x0: tx - size, y0: ty - size, x1: tx + size, y1: ty + size };
  else {
    r.x0 = Math.min(r.x0, tx - size);
    r.y0 = Math.min(r.y0, ty - size);
    r.x1 = Math.max(r.x1, tx + size);
    r.y1 = Math.max(r.y1, ty + size);
  }
  const b = st.bounds;
  b.x0 = Math.min(b.x0, x - size);
  b.y0 = Math.min(b.y0, y - size);
  b.x1 = Math.max(b.x1, x + size);
  b.y1 = Math.max(b.y1, y + size);
}

function stampTo(p: Pointer) {
  const st = stroke!;
  const o = get().options;
  const step = Math.max(1, o.size * o.spacing);
  if (p.x === st.last[0] && p.y === st.last[1] && st.carry.left === 0)
    stampAt(p.x, p.y, p.pressure);
  for (const [x, y] of spaced(st.last, [p.x, p.y], step, st.carry)) stampAt(x, y, p.pressure);
  st.last = [p.x, p.y];
}

/**
 * Shows what was painted since the last call. The viewport calls this once
 * per frame (after all of the frame's pointer events), so a fast pointer
 * never redraws the layer more than once a frame.
 */
export function flushPaint() {
  if (stroke?.pending) renderStroke(stroke);
}

/**
 * Draws base + stroke into the target (live), honouring opacity, mode and
 * selection — only inside the area stamped since the last redraw.
 */
function renderStroke(st: Stroke) {
  const pend = st.pending;
  st.pending = null;
  if (!pend) return;
  const W = st.target.canvas.width;
  const H = st.target.canvas.height;
  const x = Math.max(0, Math.floor(pend.x0));
  const y = Math.max(0, Math.floor(pend.y0));
  const w = Math.min(W, Math.ceil(pend.x1)) - x;
  const h = Math.min(H, Math.ceil(pend.y1)) - y;
  if (w <= 0 || h <= 0) return;
  const o = get().options;
  const out = ctx2d(st.target.canvas);
  out.save();
  out.beginPath();
  out.rect(x, y, w, h);
  out.clip();
  out.globalCompositeOperation = "copy";
  out.drawImage(st.base, x, y, w, h, x, y, w, h);
  // The stroke for this area (limited to the selection).
  const paint = createCanvas(w, h);
  const pg = ctx2d(paint);
  pg.drawImage(st.buffer, x, y, w, h, 0, 0, w, h);
  if (st.clip) {
    pg.globalCompositeOperation = "destination-in";
    pg.drawImage(st.clip, x, y, w, h, 0, 0, w, h);
  }
  const lockAlpha = st.target.kind === "content" && st.target.layer?.locks.transparency;
  const erase =
    st.tool === "eraser" ||
    (st.target.kind !== "content" &&
      paintColor(st.target) === "#000000" &&
      st.tool !== "historyBrush");
  out.globalAlpha = o.opacity;
  if (erase && st.target.kind !== "content") out.globalCompositeOperation = "destination-out";
  else if (st.tool === "eraser")
    out.globalCompositeOperation = lockAlpha ? "source-atop" : "destination-out";
  else if (lockAlpha) out.globalCompositeOperation = "source-atop";
  else {
    const mode =
      (
        {
          normal: "source-over",
          multiply: "multiply",
          screen: "screen",
          overlay: "overlay",
          darken: "darken",
          lighten: "lighten",
          colorDodge: "color-dodge",
          colorBurn: "color-burn",
          softLight: "soft-light",
          hardLight: "hard-light",
          difference: "difference",
          exclusion: "exclusion",
          hue: "hue",
          saturation: "saturation",
          color: "color",
          luminosity: "luminosity",
        } as Record<string, GlobalCompositeOperation>
      )[o.brushBlend] ?? "source-over";
    out.globalCompositeOperation = mode;
  }
  if (st.tool === "eraser" && lockAlpha) {
    // Erasing with locked transparency paints the background colour.
    pg.globalCompositeOperation = "source-in";
    pg.fillStyle = get().bg;
    pg.fillRect(0, 0, w, h);
  }
  out.drawImage(paint, x, y);
  out.restore();
  markDirty(x + st.target.ox, y + st.target.oy, w, h);
  bump();
}

function endStroke() {
  const st = stroke;
  stroke = null;
  if (!st) return;
  renderStroke(st);
  if (st.tool === "heal") healStroke(st);
  // Only the stroke's area needs redrawing.
  const pad = get().options.size + 2;
  markDirty(
    st.bounds.x0 - pad,
    st.bounds.y0 - pad,
    st.bounds.x1 - st.bounds.x0 + pad * 2,
    st.bounds.y1 - st.bounds.y0 + pad * 2,
  );
  if (st.target.kind === "quickMask") {
    bump();
    return;
  }
  commit(st.tool, st.before!);
}

/** Healing brush: the cloned texture takes the destination's colour and tone. */
function healStroke(st: Stroke) {
  const t = st.target;
  const pad = 12;
  const x = Math.max(0, Math.floor(st.bounds.x0 - t.ox - pad));
  const y = Math.max(0, Math.floor(st.bounds.y0 - t.oy - pad));
  const w = Math.min(t.canvas.width - x, Math.ceil(st.bounds.x1 - st.bounds.x0 + pad * 2));
  const h = Math.min(t.canvas.height - y, Math.ceil(st.bounds.y1 - st.bounds.y0 + pad * 2));
  if (w < 2 || h < 2) return;
  const dst = readImg(st.base, x, y, w, h);
  const src = readImg(t.canvas, x, y, w, h);
  const strokeAlpha = readImg(st.buffer, x, y, w, h);
  healBlend(dst, src, Math.max(3, get().options.size / 4));
  for (let i = 0; i < src.data.length; i += 4) {
    const a = (strokeAlpha.data[i + 3]! / 255) * get().options.opacity;
    for (let c = 0; c < 3; c++)
      dst.data[i + c] = dst.data[i + c]! + (src.data[i + c]! - dst.data[i + c]!) * a;
  }
  writeImg(t.canvas, dst, x, y);
}

// ─── Region tools (dodge/burn/sponge/blur/sharpen/smudge/liquify/spot heal) ──

let region: {
  before: Snapshot;
  target: Target;
  last: [number, number];
  base: HTMLCanvasElement;
  strokeMask?: HTMLCanvasElement;
} | null = null;

function beginRegion(p: Pointer) {
  const t = paintTarget();
  if (!t || t.kind !== "content") return false;
  region = {
    before: snapshot([t.layer!.id]),
    target: t,
    last: [p.x, p.y],
    base: copyCanvas(t.canvas),
  };
  if (get().tool === "spotHeal") region.strokeMask = createCanvas(t.canvas.width, t.canvas.height);
  if (get().tool !== "colorReplace") regionAt(p);
  return true;
}

function falloff(dist: number, radius: number, hardness: number) {
  const t = dist / radius;
  if (t >= 1) return 0;
  if (t <= hardness) return 1;
  return 1 - (t - hardness) / (1 - hardness);
}

function regionAt(p: Pointer) {
  const r = region!;
  const o = get().options;
  const tool = get().tool;
  const t = r.target;
  const size = Math.max(4, o.size);
  const rad = size / 2;
  if (tool === "spotHeal") {
    const g = ctx2d(r.strokeMask!);
    g.drawImage(dab(size, 1, "#FFFFFF"), p.x - t.ox - rad, p.y - t.oy - rad);
    // Show where it will heal: a light tint over the stroke.
    const og = ctx2d(t.canvas);
    og.globalAlpha = 0.3;
    og.drawImage(dab(size, 1, "#FFFFFF"), p.x - t.ox - rad, p.y - t.oy - rad);
    og.globalAlpha = 1;
    markDirty(p.x - rad - 1, p.y - rad - 1, size + 2, size + 2);
    bump();
    return;
  }
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(p.x - r.last[0], p.y - r.last[1]) / Math.max(2, size * 0.2)),
  );
  for (let s = 1; s <= steps; s++) {
    const x = r.last[0] + ((p.x - r.last[0]) * s) / steps;
    const y = r.last[1] + ((p.y - r.last[1]) * s) / steps;
    const prev: [number, number] = [
      r.last[0] + ((p.x - r.last[0]) * (s - 1)) / steps,
      r.last[1] + ((p.y - r.last[1]) * (s - 1)) / steps,
    ];
    regionDab(tool, x - t.ox, y - t.oy, prev[0] - t.ox, prev[1] - t.oy, rad);
  }
  r.last = [p.x, p.y];
  bump();
}

function regionDab(tool: ToolId, cx: number, cy: number, px: number, py: number, rad: number) {
  const r = region!;
  const c = r.target.canvas;
  const o = get().options;
  const x = Math.max(0, Math.floor(cx - rad - 2));
  const y = Math.max(0, Math.floor(cy - rad - 2));
  const w = Math.min(c.width - x, Math.ceil(rad * 2 + 4));
  const h = Math.min(c.height - y, Math.ceil(rad * 2 + 4));
  if (w < 1 || h < 1) return;
  const img = readImg(c, x, y, w, h);
  const before = { ...img, data: new Uint8ClampedArray(img.data) };
  let effect: Img | null = null;
  if (tool === "blur") {
    effect = { ...img, data: new Uint8ClampedArray(img.data) };
    gaussianBlur(effect, Math.max(1, rad / 6) * (0.5 + o.strength));
  } else if (tool === "sharpen") {
    effect = { ...img, data: new Uint8ClampedArray(img.data) };
    unsharp(effect, o.strength * 0.8, Math.max(1, rad / 10));
  } else if (tool === "smudge") {
    effect = readImg(
      c,
      Math.max(0, Math.round(x - (cx - px))),
      Math.max(0, Math.round(y - (cy - py))),
      w,
      h,
    );
    if (effect.width !== w || effect.height !== h) effect = null;
  } else if (tool === "liquify") {
    effect = liquifyDab(img, r.base, x, y, cx, cy, px, py, rad, o.liquifyMode, o.strength);
  }
  const d = img.data;
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const k = falloff(Math.hypot(x + xx - cx, y + yy - cy), rad, o.hardness * 0.5);
      if (!k) continue;
      const i = (yy * w + xx) * 4;
      if (effect) {
        const a =
          k *
          (tool === "smudge" ? o.strength : tool === "liquify" ? 1 : Math.min(1, o.strength + 0.2));
        for (let ch = 0; ch < 4; ch++)
          d[i + ch] = before.data[i + ch]! + (effect.data[i + ch]! - before.data[i + ch]!) * a;
        continue;
      }
      // Dodge, burn, sponge.
      const l = luma(d[i]!, d[i + 1]!, d[i + 2]!) / 255;
      const weight =
        o.range === "shadows" ? 1 - l : o.range === "highlights" ? l : 1 - Math.abs(l - 0.5) * 2;
      const amt = k * o.exposure * 0.12 * (0.3 + weight);
      if (tool === "dodge" || tool === "burn") {
        for (let ch = 0; ch < 3; ch++) {
          const v = d[i + ch]!;
          d[i + ch] = tool === "dodge" ? v + (255 - v) * amt : v * (1 - amt);
        }
      } else if (tool === "sponge") {
        const [hh, ss, ll] = rgbToHsl(d[i]!, d[i + 1]!, d[i + 2]!);
        const ns = clamp01(ss + (o.spongeMode === "saturate" ? amt : -amt));
        const [rr, gg, bb] = hslToRgb(hh, ns, ll);
        d[i] = rr;
        d[i + 1] = gg;
        d[i + 2] = bb;
      }
    }
  // Keep the selection limit.
  const m = A.selectionIn(x + r.target.ox, y + r.target.oy, w, h);
  if (m)
    for (let p = 0; p < m.length; p++) {
      const k = m[p]! / 255;
      if (k >= 1) continue;
      for (let ch = 0; ch < 4; ch++)
        d[p * 4 + ch] = before.data[p * 4 + ch]! + (d[p * 4 + ch]! - before.data[p * 4 + ch]!) * k;
    }
  writeImg(c, img, x, y);
  markDirty(x + r.target.ox, y + r.target.oy, w, h);
}

function liquifyDab(
  img: Img,
  base: HTMLCanvasElement,
  x: number,
  y: number,
  cx: number,
  cy: number,
  px: number,
  py: number,
  rad: number,
  mode: string,
  strength: number,
): Img {
  const { width: w, height: h } = img;
  const out: Img = { width: w, height: h, data: new Uint8ClampedArray(img.data) };
  const src = img.data;
  const orig = mode === "restore" ? readImg(base, x, y, w, h) : null;
  const dx = cx - px;
  const dy = cy - py;
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const ax = x + xx - cx;
      const ay = y + yy - cy;
      const k = falloff(Math.hypot(ax, ay), rad, 0);
      if (!k) continue;
      const i = (yy * w + xx) * 4;
      if (orig) {
        for (let ch = 0; ch < 4; ch++)
          out.data[i + ch] = src[i + ch]! + (orig.data[i + ch]! - src[i + ch]!) * k * strength;
        continue;
      }
      let sx = xx;
      let sy = yy;
      if (mode === "push") {
        sx = xx - dx * k * (0.6 + strength);
        sy = yy - dy * k * (0.6 + strength);
      } else {
        const f = 1 + (mode === "pinch" ? 1 : -1) * 0.15 * k * strength;
        sx = cx - x + ax * f;
        sy = cy - y + ay * f;
      }
      const ix = Math.min(w - 1, Math.max(0, Math.round(sx)));
      const iy = Math.min(h - 1, Math.max(0, Math.round(sy)));
      const j = (iy * w + ix) * 4;
      for (let ch = 0; ch < 4; ch++) out.data[i + ch] = src[j + ch]!;
    }
  return out;
}

function endRegion() {
  const r = region;
  region = null;
  if (!r) return;
  if (get().tool === "spotHeal" && r.strokeMask) {
    const t = r.target;
    const g = ctx2d(t.canvas);
    g.globalCompositeOperation = "copy";
    g.drawImage(r.base, 0, 0);
    g.globalCompositeOperation = "source-over";
    const maskImg = readImg(r.strokeMask);
    let x0 = t.canvas.width;
    let y0 = t.canvas.height;
    let x1 = 0;
    let y1 = 0;
    for (let y = 0; y < maskImg.height; y++)
      for (let x = 0; x < maskImg.width; x++)
        if (maskImg.data[(y * maskImg.width + x) * 4 + 3]! > 0) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    if (x1 >= x0) {
      const pad = Math.max(24, get().options.size * 2);
      const rx = Math.max(0, x0 - pad);
      const ry = Math.max(0, y0 - pad);
      const rw = Math.min(t.canvas.width - rx, x1 - x0 + pad * 2);
      const rh = Math.min(t.canvas.height - ry, y1 - y0 + pad * 2);
      const img = readImg(t.canvas, rx, ry, rw, rh);
      const holeImg = readImg(r.strokeMask, rx, ry, rw, rh);
      const hole = new Uint8Array(rw * rh);
      for (let i = 0; i < hole.length; i++) hole[i] = holeImg.data[i * 4 + 3]! > 30 ? 1 : 0;
      contentAwareFill(img, hole);
      writeImg(t.canvas, img, rx, ry);
    }
  }
  // The touched area was already redrawn piece by piece; redraw it once more as a whole.
  markDirty(r.target.ox, r.target.oy, r.target.canvas.width, r.target.canvas.height);
  commit(get().tool, r.before);
}

// ─── Tool handlers ───────────────────────────────────────────────────────────

interface Drag {
  start: [number, number];
  last: [number, number];
  mode: sel.CombineMode;
  points: [number, number][];
  moved: boolean;
  moveLayer?: {
    id: string;
    /** Start positions of every layer that moves (a group moves its contents). */
    starts: Map<string, { x: number; y: number }>;
    /** What snaps: the moving pixels' box at the start. */
    box: Box | null;
    floating?: { piece: HTMLCanvasElement; base: HTMLCanvasElement; bx: number; by: number };
  };
  crop?: { x: number; y: number; width: number; height: number };
}

let drag: Drag | null = null;

function selectionModeFor(p: Pointer): sel.CombineMode {
  if (p.shift && p.alt) return "intersect";
  if (p.shift) return "add";
  if (p.alt) return "subtract";
  return get().options.selectionMode;
}

function constrainedRect(
  p: Pointer,
  start: [number, number],
  square: boolean,
  fromCenter: boolean,
  ratio?: number,
) {
  let w = p.x - start[0];
  let h = p.y - start[1];
  if (square || ratio) {
    const r = ratio ?? 1;
    const size = Math.max(Math.abs(w), Math.abs(h) * r);
    w = Math.sign(w || 1) * size;
    h = (Math.sign(h || 1) * size) / r;
  }
  if (fromCenter) return { x: start[0] - w, y: start[1] - h, width: w * 2, height: h * 2 };
  return { x: start[0], y: start[1], width: w, height: h };
}

const norm = (r: { x: number; y: number; width: number; height: number }) => ({
  x: Math.min(r.x, r.x + r.width),
  y: Math.min(r.y, r.y + r.height),
  width: Math.abs(r.width),
  height: Math.abs(r.height),
});

function pickColor(p: Pointer, toBackground: boolean) {
  const s = get();
  const img = A.sampleImage(s.options.sampleAll || !activeLayer());
  const n = s.options.sampleSize;
  const half = (n - 1) / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let dy = -half; dy <= half; dy++)
    for (let dx = -half; dx <= half; dx++) {
      const x = Math.floor(p.x + dx);
      const y = Math.floor(p.y + dy);
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (y * img.width + x) * 4;
      if (!img.data[i + 3]) continue;
      r += img.data[i]!;
      g += img.data[i + 1]!;
      b += img.data[i + 2]!;
      count++;
    }
  if (!count) return;
  const hex = rgbToHex(r / count, g / count, b / count);
  set(toBackground ? { bg: hex } : { fg: hex });
}

export function down(p: Pointer) {
  const s = get();
  const tool = s.tool;
  drag = {
    start: [p.x, p.y],
    last: [p.x, p.y],
    mode: selectionModeFor(p),
    points: [[p.x, p.y]],
    moved: false,
  };
  switch (tool) {
    case "brush":
    case "pencil":
    case "eraser":
    case "historyBrush":
      beginStroke(tool, p);
      return;
    case "clone":
    case "heal":
      if (p.alt) {
        overlay({ cloneSource: { x: p.x, y: p.y } });
        cloneOffset = null;
        drag = null;
        return;
      }
      beginStroke(tool, p);
      return;
    case "colorReplace":
      if (beginRegion(p)) colorReplaceAt(p);
      return;
    case "blur":
    case "sharpen":
    case "smudge":
    case "dodge":
    case "burn":
    case "sponge":
    case "liquify":
    case "spotHeal":
      beginRegion(p);
      return;
    case "eyedropper":
      pickColor(p, p.alt);
      return;
    case "magicWand": {
      const m = sel.magicWand(
        A.sampleImage(s.options.sampleAll),
        p.x,
        p.y,
        s.options.tolerance,
        s.options.contiguous,
      );
      A.setSelection(
        s.options.feather ? sel.feather(m, s.options.feather) : m,
        drag.mode,
        "magicWand",
      );
      drag = null;
      return;
    }
    case "bucket":
      bucket(p);
      drag = null;
      return;
    case "magicEraser":
      magicErase(p);
      drag = null;
      return;
    case "move": {
      const layer = activeLayer();
      if (!layer || layer.locks.position || layer.locks.all) {
        drag = null;
        return;
      }
      const moving = tree
        .blockOf(s.doc!.layers, layer.id)
        .filter((l) => l.kind !== "group" && l.kind !== "adjustment" && l.kind !== "fill");
      drag.moveLayer = {
        id: layer.id,
        starts: new Map(moving.map((l) => [l.id, { x: l.x, y: l.y }])),
        box: s.view.snap ? A.contentBounds(layer) : null,
      };
      if (s.selection && layer.kind === "pixel") {
        startFloating(layer);
        drag.moveLayer.box = sel.maskBounds(s.selection);
      }
      return;
    }
    case "pen":
      penDown(p);
      return;
    case "freeformPen":
      penBefore = snapshot([]);
      overlay({ points: [[p.x, p.y]] });
      return;
    case "pathSelect":
      pathSelectDown(p);
      return;
    case "crop":
      if (!useOverlay.getState().crop)
        overlay({ crop: { x: 0, y: 0, width: s.doc!.width, height: s.doc!.height } });
      drag.crop = { ...useOverlay.getState().crop! };
      return;
    case "polyLasso": {
      const pts = useOverlay.getState().points ?? [];
      const first = pts[0];
      if (first && pts.length > 2 && Math.hypot(first[0] - p.x, first[1] - p.y) * p.zoom < 10) {
        finishPolygon(pts, drag.mode);
        drag = null;
        return;
      }
      overlay({ points: [...pts, [p.x, p.y]] });
      drag = null;
      return;
    }
    case "type": {
      const hit = textLayerAt(p);
      if (hit && hit.kind === "text") {
        set({ activeId: hit.id });
        overlay({ text: { x: hit.x, y: hit.y, layerId: hit.id, value: hit.text.text } });
      } else
        overlay({ text: { x: p.x, y: p.y - s.options.fontSize * 0.8, layerId: null, value: "" } });
      drag = null;
      return;
    }
    case "zoom":
      zoomAt(p, p.alt ? 0.5 : 2);
      drag = null;
      return;
    default:
      return;
  }
}

export function move(p: Pointer) {
  const s = get();
  if (!drag) return;
  drag.moved = true;
  drag.last = [p.x, p.y];
  const tool = s.tool;
  if (stroke) {
    stampTo(p);
    return;
  }
  if (region) {
    if (tool === "colorReplace") colorReplaceAt(p);
    else regionAt(p);
    return;
  }
  switch (tool) {
    case "marqueeRect":
    case "marqueeEllipse":
      overlay({
        rect: {
          ...constrainedRect(
            p,
            drag.start,
            p.shift && drag.mode === "new",
            p.alt && drag.mode === "new",
          ),
          ellipse: tool === "marqueeEllipse",
        },
      });
      return;
    case "lasso":
      drag.points.push([p.x, p.y]);
      overlay({ points: [...drag.points] });
      return;
    case "rectangle":
    case "ellipse":
    case "triangle":
    case "polygon":
      overlay({
        rect: { ...constrainedRect(p, drag.start, p.shift, p.alt), ellipse: tool === "ellipse" },
      });
      return;
    case "line":
    case "gradient":
    case "ruler": {
      let [x2, y2] = [p.x, p.y];
      if (p.shift) {
        const a =
          Math.round(Math.atan2(y2 - drag.start[1], x2 - drag.start[0]) / (Math.PI / 4)) *
          (Math.PI / 4);
        const len = Math.hypot(x2 - drag.start[0], y2 - drag.start[1]);
        x2 = drag.start[0] + Math.cos(a) * len;
        y2 = drag.start[1] + Math.sin(a) * len;
      }
      const dist = Math.hypot(x2 - drag.start[0], y2 - drag.start[1]);
      const angle = (-Math.atan2(y2 - drag.start[1], x2 - drag.start[0]) * 180) / Math.PI;
      overlay({
        line: {
          x1: drag.start[0],
          y1: drag.start[1],
          x2,
          y2,
          label: tool === "ruler" ? `${dist.toFixed(1)} px · ${angle.toFixed(1)}°` : undefined,
        },
      });
      return;
    }
    case "move":
      if (drag.moveLayer) moveLayerTo(p);
      return;
    case "pen":
      penDrag(p);
      return;
    case "freeformPen":
      drag.points.push([p.x, p.y]);
      overlay({ points: [...drag.points] });
      return;
    case "pathSelect":
      pathSelectDrag(p);
      return;
    case "crop": {
      const ratio = cropRatio();
      const r = norm(constrainedRect(p, drag.start, false, p.alt, ratio ?? undefined));
      overlay({ crop: r });
      return;
    }
    case "redEye":
      overlay({ rect: constrainedRect(p, drag.start, false, false) });
      return;
    case "hand":
      set({
        pan: {
          x: s.pan.x + (p.x - drag.start[0]) * s.zoom,
          y: s.pan.y + (p.y - drag.start[1]) * s.zoom,
        },
      });
      return;
  }
}

export function up(p: Pointer) {
  const s = get();
  const tool = s.tool;
  const d = drag;
  drag = null;
  if (stroke) {
    endStroke();
    return;
  }
  if (region) {
    endRegion();
    return;
  }
  if (!d) return;
  switch (tool) {
    case "marqueeRect":
    case "marqueeEllipse": {
      const r = useOverlay.getState().rect;
      overlay({ rect: null });
      if (!d.moved || !r || Math.abs(r.width) < 1 || Math.abs(r.height) < 1) {
        if (d.mode === "new") A.deselect();
        return;
      }
      const nr = norm(r);
      const doc = s.doc!;
      let m =
        tool === "marqueeEllipse"
          ? sel.ellipseMask(doc.width, doc.height, nr.x, nr.y, nr.width, nr.height)
          : sel.rectMask(doc.width, doc.height, nr.x, nr.y, nr.width, nr.height);
      if (s.options.feather) m = sel.feather(m, s.options.feather);
      A.setSelection(m, d.mode, tool);
      return;
    }
    case "lasso": {
      overlay({ points: null });
      if (d.points.length < 3) {
        if (d.mode === "new") A.deselect();
        return;
      }
      finishPolygon(d.points, d.mode);
      return;
    }
    case "rectangle":
    case "ellipse":
    case "triangle":
    case "polygon": {
      const r = useOverlay.getState().rect;
      overlay({ rect: null });
      if (!r || Math.abs(r.width) < 2 || Math.abs(r.height) < 2) return;
      A.addShapeLayer(tool, norm(r));
      return;
    }
    case "line": {
      const l = useOverlay.getState().line;
      overlay({ line: null });
      if (!l) return;
      const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
      if (len < 2) return;
      // A horizontal line shape, rotated into place.
      const w = Math.round(len);
      const sw = Math.max(1, s.options.strokeWidth);
      A.addShapeLayer("line", {
        x: (l.x1 + l.x2) / 2 - w / 2,
        y: (l.y1 + l.y2) / 2 - sw / 2,
        width: w,
        height: sw,
      });
      const angle = (Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180) / Math.PI;
      if (Math.abs(angle) > 0.5) {
        A.startTransform();
        const t = get().transform;
        if (t) {
          set({ transform: { ...t, rotation: angle } });
          A.commitTransform();
        }
      }
      return;
    }
    case "gradient": {
      const l = useOverlay.getState().line;
      overlay({ line: null });
      if (l && Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 1) drawGradient(l);
      return;
    }
    case "ruler":
      return;
    case "move":
      overlay({ snapLines: null });
      if (d.moveLayer) endMove(d);
      return;
    case "pen":
      penUp();
      return;
    case "freeformPen":
      freeformUp(d, p);
      return;
    case "pathSelect":
      pathSelectUp();
      return;
    case "redEye": {
      const r = useOverlay.getState().rect;
      overlay({ rect: null });
      const box =
        r && Math.abs(r.width) > 2 ? norm(r) : { x: p.x - 20, y: p.y - 20, width: 40, height: 40 };
      A.editPixels("redEye", (img, o) => {
        const mask = new Uint8Array(img.width * img.height);
        for (let y = 0; y < img.height; y++)
          for (let x = 0; x < img.width; x++) {
            const dx = x + o.x;
            const dy = y + o.y;
            if (dx >= box.x && dx < box.x + box.width && dy >= box.y && dy < box.y + box.height)
              mask[y * img.width + x] = 1;
          }
        redEye(img, mask);
      });
      return;
    }
  }
}

/** Commits the crop box (Enter) or cancels it (Escape). */
export function finishCrop(apply: boolean) {
  const c = useOverlay.getState().crop;
  overlay({ crop: null });
  if (apply && c && c.width >= 1 && c.height >= 1) A.crop(c, get().options.deleteCropped);
}

function cropRatio(): number | null {
  const r = get().options.cropRatio;
  if (r === "free") return null;
  if (r === "original") return get().doc!.width / get().doc!.height;
  const [a, b] = r.split(":").map(Number);
  return a! / b!;
}

export function finishPolygon(points: [number, number][], mode: sel.CombineMode) {
  const doc = get().doc!;
  let m = sel.polygonMask(doc.width, doc.height, points);
  if (get().options.feather) m = sel.feather(m, get().options.feather);
  overlay({ points: null });
  A.setSelection(m, mode, "lasso");
}

export function cancelTool() {
  if (stroke) {
    const st = stroke;
    stroke = null;
    const g = ctx2d(st.target.canvas);
    g.globalCompositeOperation = "copy";
    g.drawImage(st.base, 0, 0);
    g.globalCompositeOperation = "source-over";
  }
  drag = null;
  penOpen = null;
  overlay({ rect: null, points: null, line: null, crop: null, snapLines: null });
  bump();
}

function textLayerAt(p: Pointer): Layer | null {
  const layers = [...(get().doc?.layers ?? [])].reverse();
  for (const l of layers) {
    if (l.kind !== "text" || !l.visible) continue;
    const c = getPixels(l.id).canvas;
    if (p.x >= l.x && p.x <= l.x + c.width && p.y >= l.y && p.y <= l.y + c.height) return l;
  }
  return null;
}

/** Commits the on-canvas text editor into a text layer. */
export function commitText() {
  const t = useOverlay.getState().text;
  overlay({ text: null });
  if (!t) return;
  const value = t.value;
  if (t.layerId) {
    const layer = get().doc?.layers.find((l) => l.id === t.layerId);
    if (layer?.kind === "text" && value.trim() && value !== layer.text.text)
      A.updateLayer(
        layer.id,
        { text: { ...layer.text, text: value }, name: value.slice(0, 40) } as Partial<Layer>,
        "editText",
      );
    return;
  }
  if (value.trim()) A.addTextLayer({ x: t.x, y: t.y }, value);
}

export function zoomAt(p: { x: number; y: number }, factor: number) {
  const s = get();
  const zoom = Math.min(32, Math.max(0.02, s.zoom * factor));
  // Keep the document point under the cursor in place.
  const k = zoom / s.zoom;
  set({ zoom, pan: { x: s.pan.x - p.x * s.zoom * (k - 1), y: s.pan.y - p.y * s.zoom * (k - 1) } });
}

// ─── Move ────────────────────────────────────────────────────────────────────

function startFloating(layer: Layer) {
  const s = get();
  const p = getPixels(layer.id);
  const m = A.selectionCanvas(s.selection!);
  const piece = copyCanvas(p.canvas);
  const pg = ctx2d(piece);
  pg.globalCompositeOperation = "destination-in";
  pg.drawImage(m, -layer.x, -layer.y);
  const base = copyCanvas(p.canvas);
  const bg = ctx2d(base);
  bg.globalCompositeOperation = "destination-out";
  bg.drawImage(m, -layer.x, -layer.y);
  drag!.moveLayer!.floating = { piece, base, bx: layer.x, by: layer.y };
  floatingBefore = snapshot([layer.id]);
}

let floatingBefore: Snapshot | null = null;

function moveLayerTo(p: Pointer) {
  const d = drag!;
  const ml = d.moveLayer!;
  const s = get();
  let dx = Math.round(p.x - d.start[0]);
  let dy = Math.round(p.y - d.start[1]);
  // Shift keeps the move horizontal or vertical.
  if (p.shift) {
    if (Math.abs(dx) > Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  if (ml.box && s.view.snap) {
    const doc = s.doc!;
    const snap = snapBox(
      { ...ml.box, x: ml.box.x + dx, y: ml.box.y + dy },
      snapTargets(doc.width, doc.height, doc.guides),
      8 / s.zoom,
    );
    dx = Math.round(dx + snap.dx);
    dy = Math.round(dy + snap.dy);
    overlay({ snapLines: snap.lines.x.length || snap.lines.y.length ? snap.lines : null });
  }
  d.last = [d.start[0] + dx, d.start[1] + dy];
  if (ml.floating) {
    const f = ml.floating;
    const c = createCanvas(f.base.width, f.base.height);
    const g = ctx2d(c);
    g.drawImage(f.base, 0, 0);
    g.drawImage(f.piece, dx, dy);
    set({ overrides: new Map([[ml.id, c]]), rev: s.rev + 1 });
    return;
  }
  const doc = s.doc!;
  const layers = doc.layers.map((l) => {
    const st = ml.starts.get(l.id);
    return st ? { ...l, x: st.x + dx, y: st.y + dy } : l;
  });
  set({ doc: { ...doc, layers }, rev: s.rev + 1 });
}

function endMove(d: Drag) {
  const ml = d.moveLayer!;
  if (!d.moved) {
    floatingBefore = null;
    return;
  }
  const dx = Math.round(d.last[0] - d.start[0]);
  const dy = Math.round(d.last[1] - d.start[1]);
  if (ml.floating) {
    const result = get().overrides?.get(ml.id);
    const before = floatingBefore!;
    floatingBefore = null;
    set({ overrides: null });
    if (!result) return;
    getPixels(ml.id).canvas = result;
    const sel0 = get().selection;
    // The selection travels with the moved pixels.
    if (sel0) set({ selection: sel.translate(sel0, dx, dy) });
    commit("move", before);
    return;
  }
  // Put the old positions back for the "before" snapshot, then the new ones.
  const doc = get().doc!;
  const moved = doc.layers;
  set({
    doc: {
      ...doc,
      layers: doc.layers.map((l) => {
        const st = ml.starts.get(l.id);
        return st ? { ...l, x: st.x, y: st.y } : l;
      }),
    },
  });
  const before = snapshot([...ml.starts.keys()]);
  set({ doc: { ...get().doc!, layers: moved } });
  commit("move", before);
}

/** Arrow keys with the move tool: nudge by 1 (10 with Shift). */
export function nudge(dx: number, dy: number) {
  const layer = activeLayer();
  if (!layer || layer.locks.position || layer.locks.all) return;
  A.offsetLayer(layer.id, dx, dy);
}

// ─── Pen tools ───────────────────────────────────────────────────────────────

/** The sub-path the pen is adding to (null = the next click starts a new one). */
let penOpen: { pathId: string; sub: number } | null = null;
/** The anchor being placed (its handles follow a drag). */
let penPoint: { pathId: string; sub: number; index: number } | null = null;
let penBefore: Snapshot | null = null;

/** A copy of the document with an active path to draw into (made if missing). */
function draftWithPath(): { d: PhotoDoc; path: PhotoPath } {
  const s = get();
  const d = structuredClone(s.doc!);
  d.paths ??= [];
  let path = d.paths.find((x) => x.id === s.activePathId);
  if (!path) {
    path = { id: `path-${Date.now().toString(36)}`, name: "Work Path", subpaths: [] };
    d.paths.push(path);
    set({ activePathId: path.id });
  }
  return { d, path };
}

function penDown(p: Pointer) {
  penBefore = snapshot([]);
  const { d, path } = draftWithPath();
  const open = penOpen?.pathId === path.id ? path.subpaths[penOpen.sub] : undefined;
  if (open && !open.closed) {
    const first = open.points[0]!;
    if (open.points.length > 2 && Math.hypot(first.x - p.x, first.y - p.y) * p.zoom < 9) {
      // Click on the first anchor: close the shape.
      open.closed = true;
      penPoint = { pathId: path.id, sub: penOpen!.sub, index: 0 };
      penOpen = null;
    } else {
      open.points.push({ x: p.x, y: p.y, in: null, out: null });
      penPoint = { pathId: path.id, sub: penOpen!.sub, index: open.points.length - 1 };
    }
  } else {
    path.subpaths.push({ closed: false, points: [{ x: p.x, y: p.y, in: null, out: null }] });
    penOpen = { pathId: path.id, sub: path.subpaths.length - 1 };
    penPoint = { pathId: path.id, sub: penOpen.sub, index: 0 };
  }
  set({ doc: d, rev: get().rev + 1 });
}

function penDrag(p: Pointer) {
  if (!penPoint) return;
  const d = structuredClone(get().doc!);
  const sp = d.paths?.find((x) => x.id === penPoint!.pathId)?.subpaths[penPoint.sub];
  const pt = sp?.points[penPoint.index];
  if (!pt) return;
  // Dragging pulls out smooth handles (mirrored).
  pt.out = [p.x, p.y];
  pt.in = [2 * pt.x - p.x, 2 * pt.y - p.y];
  set({ doc: d, rev: get().rev + 1 });
}

function penUp() {
  penPoint = null;
  if (penBefore) commit("anchor", penBefore);
  penBefore = null;
}

/** Enter / Escape: stop adding to the current sub-path. */
export function endPenPath() {
  penOpen = null;
  bump();
}

function freeformUp(d: Drag, p: Pointer) {
  overlay({ points: null });
  const before = penBefore;
  penBefore = null;
  if (!before || d.points.length < 2) return;
  const pts = simplify(d.points, Math.max(1, 2.5 / p.zoom));
  if (pts.length < 2) return;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const closed = pts.length > 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) * p.zoom < 12;
  if (closed) pts.pop();
  const { d: draft, path } = draftWithPath();
  path.subpaths.push(smoothSubPath(pts, closed));
  set({ doc: draft });
  commit("anchor", before);
}

let pathDrag: {
  before: Snapshot;
  pathId: string;
  hit: PathHit | null;
  start: [number, number];
  original: PhotoPath;
  mirror: boolean;
} | null = null;

function pathSelectDown(p: Pointer) {
  const s = get();
  const paths = s.doc?.paths ?? [];
  const tol = 8 / p.zoom;
  // The active path first, then any path under the pointer.
  const ordered = [...paths].sort(
    (a, b) => Number(b.id === s.activePathId) - Number(a.id === s.activePathId),
  );
  for (const path of ordered) {
    const hit = hitPath(path, p.x, p.y, tol);
    if (!hit && distanceToPath(path, p.x, p.y) > tol) continue;
    set({ activePathId: path.id });
    if (hit && p.alt && hit.part === "anchor") {
      // Alt-click: a smooth point becomes a corner, a corner starts new handles.
      const pt = path.subpaths[hit.sub]!.points[hit.index]!;
      if (pt.in || pt.out) {
        const before = snapshot([]);
        const d = structuredClone(s.doc!);
        const dp = d.paths!.find((x) => x.id === path.id)!.subpaths[hit.sub]!.points[hit.index]!;
        dp.in = null;
        dp.out = null;
        set({ doc: d });
        commit("pathEdit", before);
        return;
      }
      pathDrag = {
        before: snapshot([]),
        pathId: path.id,
        hit: { ...hit, part: "out" },
        start: [p.x, p.y],
        original: structuredClone(path),
        mirror: true,
      };
    } else
      pathDrag = {
        before: snapshot([]),
        pathId: path.id,
        hit,
        start: [p.x, p.y],
        original: structuredClone(path),
        mirror: !p.alt,
      };
    overlay({ pathSel: hit ? { pathId: path.id, sub: hit.sub, index: hit.index } : null });
    return;
  }
  set({ activePathId: null });
  overlay({ pathSel: null });
}

function pathSelectDrag(p: Pointer) {
  if (!pathDrag) return;
  const d = structuredClone(get().doc!);
  const path = d.paths?.find((x) => x.id === pathDrag!.pathId);
  if (!path) return;
  const orig = pathDrag.original;
  const hit = pathDrag.hit;
  if (hit) {
    const sp = orig.subpaths[hit.sub]!;
    if (hit.part === "out" && !sp.points[hit.index]!.out) {
      // Pulling handles out of a corner.
      const pt = { ...sp.points[hit.index]! };
      const next = {
        ...sp,
        points: sp.points.map((q, i) =>
          i === hit.index
            ? {
                ...pt,
                out: [p.x, p.y] as [number, number],
                in: [2 * pt.x - p.x, 2 * pt.y - p.y] as [number, number],
              }
            : q,
        ),
      };
      path.subpaths[hit.sub] = next;
    } else
      path.subpaths[hit.sub] = movePathPart(sp, hit.index, hit.part, p.x, p.y, pathDrag.mirror);
  } else {
    // Dragging the outline moves the whole path.
    const dx = p.x - pathDrag.start[0];
    const dy = p.y - pathDrag.start[1];
    const shift = (q: [number, number] | null): [number, number] | null =>
      q ? [q[0] + dx, q[1] + dy] : null;
    path.subpaths = orig.subpaths.map((sp) => ({
      ...sp,
      points: sp.points.map((q) => ({
        x: q.x + dx,
        y: q.y + dy,
        in: shift(q.in),
        out: shift(q.out),
      })),
    }));
  }
  set({ doc: d, rev: get().rev + 1 });
}

function pathSelectUp() {
  const pd = pathDrag;
  pathDrag = null;
  if (!pd) return;
  const now = get().doc?.paths?.find((x) => x.id === pd.pathId);
  // A plain click (nothing moved) is not an undo step.
  if (JSON.stringify(now) !== JSON.stringify(pd.original)) commit("pathEdit", pd.before);
}

/** Delete with the path selection tool: removes the picked anchor. */
export function deletePickedAnchor(): boolean {
  const pick = useOverlay.getState().pathSel;
  if (!pick) return false;
  const before = snapshot([]);
  const d = structuredClone(get().doc!);
  const path = d.paths?.find((x) => x.id === pick.pathId);
  const sp = path?.subpaths[pick.sub];
  if (!path || !sp) return false;
  sp.points.splice(pick.index, 1);
  if (sp.points.length < 2) path.subpaths.splice(pick.sub, 1);
  else if (sp.points.length < 3) sp.closed = false;
  set({ doc: d });
  overlay({ pathSel: null });
  commit("pathEdit", before);
  return true;
}

// ─── One-click tools ─────────────────────────────────────────────────────────

function bucket(p: Pointer) {
  const s = get();
  const m = sel.magicWand(
    A.sampleImage(s.options.sampleAll),
    p.x,
    p.y,
    s.options.tolerance,
    s.options.contiguous,
  );
  const [r, g, b] = hexToRgb(s.fg);
  const op = s.options.opacity;
  A.editPixels("bucket", (img, o) => {
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const dx = x + o.x;
        const dy = y + o.y;
        if (dx < 0 || dy < 0 || dx >= m.width || dy >= m.height) continue;
        const k = (m.data[dy * m.width + dx]! / 255) * op;
        if (!k) continue;
        const i = (y * img.width + x) * 4;
        img.data[i] = img.data[i]! + (r - img.data[i]!) * k;
        img.data[i + 1] = img.data[i + 1]! + (g - img.data[i + 1]!) * k;
        img.data[i + 2] = img.data[i + 2]! + (b - img.data[i + 2]!) * k;
        img.data[i + 3] = img.data[i + 3]! + (255 - img.data[i + 3]!) * k;
      }
  });
}

function magicErase(p: Pointer) {
  const s = get();
  const m = sel.magicWand(
    A.sampleImage(false),
    p.x,
    p.y,
    s.options.tolerance,
    s.options.contiguous,
  );
  A.editPixels("magicEraser", (img, o) => {
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const dx = x + o.x;
        const dy = y + o.y;
        if (dx < 0 || dy < 0 || dx >= m.width || dy >= m.height) continue;
        const k = m.data[dy * m.width + dx]! / 255;
        if (k)
          img.data[(y * img.width + x) * 4 + 3] =
            img.data[(y * img.width + x) * 4 + 3]! * (1 - k * s.options.opacity);
      }
  });
}

/** Position along a dragged gradient (0 at the start point, 1 at the end). */
export function gradientAt(
  kind: GradientKind,
  px: number,
  py: number,
  ux: number,
  uy: number,
  len: number,
) {
  const along = px * ux + py * uy;
  const across = -px * uy + py * ux;
  switch (kind) {
    case "radial":
      return Math.hypot(px, py) / len;
    case "angle":
      return gradientT("angle", px, py, ux, uy, len, len);
    case "reflected":
      return Math.abs(along) / len;
    case "diamond":
      return (Math.abs(along) + Math.abs(across)) / len;
    default:
      return along / len;
  }
}

function drawGradient(l: { x1: number; y1: number; x2: number; y2: number }) {
  const s = get();
  const o = s.options;
  const fg = hexToRgb(s.fg);
  const stops = [
    { offset: 0, color: s.fg },
    { offset: 1, color: s.bg },
  ];
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const transparentEnd = o.gradientFade === "fgTransparent";
  A.editPixels("gradient", (img, origin) => {
    const d = img.data;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const t = clamp01(
          gradientAt(o.gradientKind, x + origin.x - l.x1, y + origin.y - l.y1, ux, uy, len),
        );
        const c = transparentEnd ? fg : sampleGradient(stops, t);
        const k = (transparentEnd ? 1 - t : 1) * o.opacity;
        const i = (y * img.width + x) * 4;
        // Paint over what's there (source-over with coverage k).
        const a0 = d[i + 3]! / 255;
        const a = k + a0 * (1 - k);
        if (a <= 0) continue;
        for (let ch = 0; ch < 3; ch++) d[i + ch] = (c[ch]! * k + d[i + ch]! * a0 * (1 - k)) / a;
        d[i + 3] = a * 255;
      }
  });
}

function colorReplaceAt(p: Pointer) {
  const r = region!;
  const t = r.target;
  const o = get().options;
  const rad = Math.max(2, o.size / 2);
  const x = Math.max(0, Math.floor(p.x - t.ox - rad));
  const y = Math.max(0, Math.floor(p.y - t.oy - rad));
  const w = Math.min(t.canvas.width - x, Math.ceil(rad * 2));
  const h = Math.min(t.canvas.height - y, Math.ceil(rad * 2));
  if (w < 1 || h < 1) return;
  const img = readImg(t.canvas, x, y, w, h);
  const [fh, fs] = rgbToHsl(...hexToRgb(get().fg));
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const k = falloff(Math.hypot(x + xx + t.ox - p.x, y + yy + t.oy - p.y), rad, o.hardness);
      if (!k) continue;
      const i = (yy * w + xx) * 4;
      const [, , l] = rgbToHsl(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!);
      const [nr, ng, nb] = hslToRgb(fh, fs, l);
      img.data[i] = img.data[i]! + (nr - img.data[i]!) * k * o.opacity;
      img.data[i + 1] = img.data[i + 1]! + (ng - img.data[i + 1]!) * k * o.opacity;
      img.data[i + 2] = img.data[i + 2]! + (nb - img.data[i + 2]!) * k * o.opacity;
    }
  writeImg(t.canvas, img, x, y);
  markDirty(x + t.ox, y + t.oy, w, h);
  bump();
}

export const isPainting = () => Boolean(stroke || region);

// ─── Quick mask ──────────────────────────────────────────────────────────────

/** Quick Mask (Q): paint the selection; black hides, white selects. */
export function toggleQuickMask() {
  const s = get();
  if (!s.doc) return;
  if (!s.quickMask) {
    const c = s.selection
      ? A.selectionCanvas(s.selection)
      : createCanvas(s.doc.width, s.doc.height);
    if (!s.selection) {
      const g = ctx2d(c);
      g.fillStyle = "#FFFFFF";
      g.fillRect(0, 0, c.width, c.height);
    }
    overlay({ quickMask: c });
    set({ quickMask: true, rev: s.rev + 1 });
    return;
  }
  const c = useOverlay.getState().quickMask;
  overlay({ quickMask: null });
  set({ quickMask: false, rev: s.rev + 1 });
  if (!c) return;
  const img = readImg(c);
  const m = sel.emptyMask(c.width, c.height);
  let full = true;
  for (let i = 0; i < m.data.length; i++) {
    m.data[i] = img.data[i * 4 + 3]!;
    if (m.data[i]! < 255) full = false;
  }
  A.setSelection(full ? null : m, "new", "quickMask");
}

/** Starts the crop box over the whole image (choosing the crop tool). */
export function startCrop() {
  const d = get().doc;
  if (d) overlay({ crop: { x: 0, y: 0, width: d.width, height: d.height } });
}

export const BRUSH_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  "brush",
  "pencil",
  "eraser",
  "clone",
  "heal",
  "spotHeal",
  "historyBrush",
  "colorReplace",
  "blur",
  "sharpen",
  "smudge",
  "dodge",
  "burn",
  "sponge",
  "liquify",
]);

/** Picks a tool (and remembers it as its toolbar group's shown tool). */
export function selectTool(tool: ToolId) {
  const s = get();
  if (s.tool === tool) return;
  if (s.tool === "type") commitText();
  if (s.tool === "crop") overlay({ crop: null });
  if (s.tool === "polyLasso") overlay({ points: null });
  if (s.tool === "pen") penOpen = null;
  if (s.tool === "pathSelect") overlay({ pathSel: null });
  const group = TOOL_GROUPS.find((g) => g.tools.includes(tool));
  set({ tool, groupTool: group ? { ...s.groupTool, [group.id]: tool } : s.groupTool });
  if (tool === "crop") startCrop();
}

/** A toolbar shortcut: picks the group's tool, or the next one with Shift. */
export function toolShortcut(key: string, cycle: boolean) {
  const group = TOOL_GROUPS.find((g) => g.key === key.toUpperCase());
  if (!group) return false;
  const s = get();
  const shown = s.groupTool[group.id] ?? group.tools[0]!;
  const next =
    cycle && s.tool === shown
      ? group.tools[(group.tools.indexOf(shown) + 1) % group.tools.length]!
      : shown;
  selectTool(next);
  return true;
}
