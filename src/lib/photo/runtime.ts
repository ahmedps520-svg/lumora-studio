"use client";
/**
 * The pixels behind a document: one canvas per layer (plus an optional mask
 * canvas), kept outside React state. Also draws text, shape and fill layers
 * from their settings, and composites everything into one picture.
 */
import { applyAdjustment } from "./adjustments";
import { blendInto, NATIVE_BLEND } from "./blend";
import { bevelShading } from "./effects";
import { hexToRgb, type Img } from "./pixels";
import { sampleGradient } from "./adjustments";
import type { FillProps, GradientKind, Layer, PhotoDoc, ShapeProps, TextProps } from "./types";

export interface LayerPixels {
  /** Content (pixel layers: the pixels; text/shape/fill: drawn from settings). */
  canvas: HTMLCanvasElement;
  /** Layer mask in document coordinates; alpha = how much shows. */
  mask: HTMLCanvasElement | null;
}

const registry = new Map<string, LayerPixels>();

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;

export function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  ctx2d(c).drawImage(src, 0, 0);
  return c;
}

export function getPixels(id: string): LayerPixels {
  let p = registry.get(id);
  if (!p) {
    p = { canvas: createCanvas(1, 1), mask: null };
    registry.set(id, p);
  }
  return p;
}

export const setPixels = (id: string, pixels: LayerPixels) => registry.set(id, pixels);
export const dropPixels = (id: string) => registry.delete(id);
export const clearRegistry = () => registry.clear();

export function readImg(c: HTMLCanvasElement, x = 0, y = 0, w = c.width, h = c.height): Img {
  const data = ctx2d(c).getImageData(x, y, w, h);
  return { width: data.width, height: data.height, data: data.data };
}

export function writeImg(c: HTMLCanvasElement, img: Img, x = 0, y = 0) {
  ctx2d(c).putImageData(
    new ImageData(new Uint8ClampedArray(img.data), img.width, img.height),
    x,
    y,
  );
}

/** A new mask canvas for a document: everything shown (white) or hidden (empty). */
export function newMask(doc: PhotoDoc, reveal: boolean): HTMLCanvasElement {
  const m = createCanvas(doc.width, doc.height);
  if (reveal) {
    const c = ctx2d(m);
    c.fillStyle = "#FFFFFF";
    c.fillRect(0, 0, m.width, m.height);
  }
  return m;
}

/** Grows a pixel layer's canvas so it covers a document rectangle. */
export function ensureCovers(
  layer: Layer,
  rect: { x: number; y: number; width: number; height: number },
) {
  const p = getPixels(layer.id);
  const x0 = Math.min(layer.x, Math.floor(rect.x));
  const y0 = Math.min(layer.y, Math.floor(rect.y));
  const x1 = Math.max(layer.x + p.canvas.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.max(layer.y + p.canvas.height, Math.ceil(rect.y + rect.height));
  if (x0 === layer.x && y0 === layer.y && x1 - x0 === p.canvas.width && y1 - y0 === p.canvas.height)
    return;
  const grown = createCanvas(x1 - x0, y1 - y0);
  ctx2d(grown).drawImage(p.canvas, layer.x - x0, layer.y - y0);
  p.canvas = grown;
  layer.x = x0;
  layer.y = y0;
}

// ─── Text, shape and fill layers ─────────────────────────────────────────────

const ARABIC = /[؀-ۿ]/;

/** Lines of a text layer after wrapping. */
function textLines(c: CanvasRenderingContext2D, t: TextProps): string[] {
  const out: string[] = [];
  for (const para of t.text.split("\n")) {
    if (!t.width) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (line && c.measureText(test).width > t.width) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function textFont(t: TextProps) {
  return `${t.italic ? "italic " : ""}${t.weight} ${t.size}px "${t.font}", "IBM Plex Sans Arabic", sans-serif`;
}

export function renderText(t: TextProps): HTMLCanvasElement {
  const probe = ctx2d(createCanvas(1, 1));
  probe.font = textFont(t);
  (probe as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    `${(t.tracking / 1000) * t.size}px`;
  const lines = textLines(probe, t);
  const lineH = t.size * t.lineHeight;
  const width =
    Math.ceil(t.width || Math.max(1, ...lines.map((l) => probe.measureText(l).width))) +
    Math.ceil(t.size * 0.2);
  const height = Math.ceil(lines.length * lineH + t.size * 0.3);
  const c = createCanvas(width, height);
  const g = ctx2d(c);
  g.font = textFont(t);
  (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    `${(t.tracking / 1000) * t.size}px`;
  g.fillStyle = t.color;
  g.textBaseline = "alphabetic";
  const rtl = ARABIC.test(t.text);
  g.direction = rtl ? "rtl" : "ltr";
  const align = t.align;
  g.textAlign = align;
  const ax = align === "left" ? 0 : align === "center" ? width / 2 : width;
  lines.forEach((line, i) =>
    g.fillText(line, ax, (i + 1) * lineH - (lineH - t.size) / 2 - t.size * 0.12),
  );
  return c;
}

export function renderShape(s: ShapeProps): HTMLCanvasElement {
  const pad = Math.ceil(s.stroke ? s.strokeWidth : 0);
  const c = createCanvas(s.width + pad * 2, s.height + pad * 2);
  const g = ctx2d(c);
  g.translate(pad, pad);
  g.beginPath();
  const { width: w, height: h } = s;
  if (s.shape === "rectangle") g.roundRect(0, 0, w, h, Math.min(s.radius, w / 2, h / 2));
  else if (s.shape === "ellipse") g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (s.shape === "triangle") {
    g.moveTo(w / 2, 0);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
  } else if (s.shape === "polygon") {
    const n = Math.max(3, s.sides);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const px = w / 2 + (Math.cos(a) * w) / 2;
      const py = h / 2 + (Math.sin(a) * h) / 2;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
  } else {
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
  }
  if (s.fill && s.shape !== "line") {
    g.fillStyle = s.fill;
    g.fill();
  }
  if (s.stroke || s.shape === "line") {
    g.strokeStyle = s.stroke ?? s.fill ?? "#000000";
    g.lineWidth = Math.max(1, s.strokeWidth);
    g.lineCap = "round";
    g.stroke();
  }
  return c;
}

export function renderFill(f: FillProps, w: number, h: number): HTMLCanvasElement {
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  if (f.type === "solid") {
    g.fillStyle = f.color;
    g.fillRect(0, 0, w, h);
    return c;
  }
  const img = g.createImageData(w, h);
  const a = (f.angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
  const table = Array.from({ length: 256 }, (_, i) => sampleGradient(f.stops, i / 255));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = x - w / 2;
      const py = y - h / 2;
      const t = gradientT(f.kind, px, py, dx, dy, half, Math.hypot(w, h) / 2);
      const col = table[Math.round(Math.max(0, Math.min(1, t)) * 255)]!;
      const i = (y * w + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

/** Gradient position (0–1) for a point relative to the centre / start. */
export function gradientT(
  kind: GradientKind,
  px: number,
  py: number,
  dx: number,
  dy: number,
  half: number,
  radius: number,
): number {
  switch (kind) {
    case "radial":
      return Math.hypot(px, py) / radius;
    case "angle":
      return ((Math.atan2(py, px) - Math.atan2(dy, dx)) / (Math.PI * 2) + 2) % 1;
    case "reflected":
      return Math.abs(px * dx + py * dy) / half;
    case "diamond":
      return (Math.abs(px * dx + py * dy) + Math.abs(-px * dy + py * dx)) / (half * 1.4);
    default:
      return (px * dx + py * dy + half) / (2 * half);
  }
}

/** Redraws a text, shape or fill layer from its settings (pixel layers are untouched). */
export function refreshLayer(layer: Layer, doc: PhotoDoc) {
  if (layer.kind === "group") return;
  const p = getPixels(layer.id);
  if (layer.kind === "text") p.canvas = renderText(layer.text);
  else if (layer.kind === "shape") p.canvas = renderShape(layer.shape);
  else if (layer.kind === "fill") p.canvas = renderFill(layer.fill, doc.width, doc.height);
}

// ─── Compositing ─────────────────────────────────────────────────────────────

const pool: HTMLCanvasElement[] = [];
function scratch(w: number, h: number, slot: number) {
  let c = pool[slot];
  if (!c || c.width !== w || c.height !== h) {
    c = createCanvas(w, h);
    pool[slot] = c;
  }
  const g = ctx2d(c);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  g.clearRect(0, 0, w, h);
  return c;
}

/** Where a composite canvas sits on the document, and its size. */
interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The layer's content on a frame-size canvas (the whole document, or the part
 * being redrawn), with mask, overlays and clipping applied.
 */
function layerImage(
  layer: Layer,
  doc: PhotoDoc,
  source: HTMLCanvasElement,
  base: HTMLCanvasElement | null,
  slot: number,
  at: { x: number; y: number },
  f: Frame,
) {
  const p = getPixels(layer.id);
  const t = scratch(f.w, f.h, slot);
  const g = ctx2d(t);
  g.drawImage(source, Math.round(at.x) - f.x, Math.round(at.y) - f.y);
  const ov = layer.styles.colorOverlay;
  if (ov?.enabled) {
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = ov.opacity;
    g.fillStyle = ov.color;
    g.fillRect(0, 0, t.width, t.height);
    g.globalAlpha = 1;
  }
  const go = layer.styles.gradientOverlay;
  if (go?.enabled) {
    // Spans the layer's own box (the whole document for groups).
    const box =
      layer.kind === "group"
        ? { x: -f.x, y: -f.y, w: doc.width, h: doc.height }
        : { x: at.x - f.x, y: at.y - f.y, w: source.width, h: source.height };
    const a = (go.angle * Math.PI) / 180;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const half = (Math.abs(Math.cos(a)) * box.w + Math.abs(Math.sin(a)) * box.h) / 2;
    const grad = g.createLinearGradient(
      cx - Math.cos(a) * half,
      cy + Math.sin(a) * half,
      cx + Math.cos(a) * half,
      cy - Math.sin(a) * half,
    );
    grad.addColorStop(0, go.from);
    grad.addColorStop(1, go.to);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = go.opacity;
    g.fillStyle = grad;
    g.fillRect(0, 0, t.width, t.height);
    g.globalAlpha = 1;
  }
  if (layer.mask?.enabled && p.mask) {
    g.globalCompositeOperation = "destination-in";
    g.drawImage(p.mask, -f.x, -f.y);
  }
  if (layer.clip && base) {
    g.globalCompositeOperation = "destination-in";
    g.drawImage(base, 0, 0);
  }
  g.globalCompositeOperation = "source-over";
  return t;
}

/** Shadow / glow / stroke drawn under the layer's content. */
function drawStyles(out: CanvasRenderingContext2D, layer: Layer, content: HTMLCanvasElement) {
  const s = layer.styles;
  const W = content.width;
  const away = W * 3;
  const shadowOnly = (color: string, blur: number, dx: number, dy: number, alpha: number) => {
    out.save();
    out.globalAlpha = alpha * layer.opacity;
    out.shadowColor = color;
    out.shadowBlur = blur;
    out.shadowOffsetX = dx + away;
    out.shadowOffsetY = dy;
    // The picture itself is drawn far off-canvas; only its shadow lands.
    out.drawImage(content, -away, 0);
    out.restore();
  };
  if (s.dropShadow.enabled) {
    const a = (s.dropShadow.angle * Math.PI) / 180;
    shadowOnly(
      s.dropShadow.color,
      s.dropShadow.size,
      -Math.cos(a) * s.dropShadow.distance,
      Math.sin(a) * s.dropShadow.distance,
      s.dropShadow.opacity,
    );
  }
  if (s.outerGlow.enabled)
    shadowOnly(s.outerGlow.color, s.outerGlow.size, 0, 0, s.outerGlow.opacity);
  if (s.stroke.enabled && s.stroke.size > 0) {
    const size =
      s.stroke.size *
      (s.stroke.position === "center" ? 0.5 : s.stroke.position === "inside" ? 0 : 1);
    if (size > 0) {
      const tinted = createCanvas(content.width, content.height);
      const tg = ctx2d(tinted);
      tg.drawImage(content, 0, 0);
      tg.globalCompositeOperation = "source-in";
      tg.fillStyle = s.stroke.color;
      tg.fillRect(0, 0, tinted.width, tinted.height);
      out.save();
      out.globalAlpha = s.stroke.opacity * layer.opacity;
      const steps = Math.max(12, Math.round(size * 3));
      for (let r = 1; r <= Math.ceil(size); r += Math.max(1, size / 6))
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          out.drawImage(tinted, Math.cos(a) * Math.min(r, size), Math.sin(a) * Math.min(r, size));
        }
      out.restore();
    }
  }
}

/**
 * Inner shadow / inner glow: the shadow of everything *outside* the shape,
 * kept only inside it.
 */
function innerShade(
  out: CanvasRenderingContext2D,
  layer: Layer,
  content: HTMLCanvasElement,
  color: string,
  blur: number,
  dx: number,
  dy: number,
  alpha: number,
) {
  const W = content.width;
  const H = content.height;
  const pad = Math.ceil(blur * 2 + Math.abs(dx) + Math.abs(dy) + 4);
  const inv = createCanvas(W + pad * 2, H + pad * 2);
  const ig = ctx2d(inv);
  ig.fillStyle = "#000";
  ig.fillRect(0, 0, inv.width, inv.height);
  ig.globalCompositeOperation = "destination-out";
  ig.drawImage(content, pad, pad);
  const shade = createCanvas(W, H);
  const sg = ctx2d(shade);
  const away = inv.width * 2;
  sg.shadowColor = color;
  sg.shadowBlur = blur;
  sg.shadowOffsetX = dx + away;
  sg.shadowOffsetY = dy;
  sg.drawImage(inv, -away - pad, -pad);
  sg.shadowColor = "transparent";
  sg.globalCompositeOperation = "destination-in";
  sg.drawImage(content, 0, 0);
  out.save();
  out.globalAlpha = alpha * layer.opacity;
  out.drawImage(shade, 0, 0);
  out.restore();
}

/** Bevel & emboss: light and shade along the shape's edges (computed on its box only). */
function drawBevel(
  out: CanvasRenderingContext2D,
  layer: Layer,
  content: HTMLCanvasElement,
  f: Frame,
) {
  const b = layer.styles.bevel;
  // The layer's box (plus room for the bevel), inside the frame.
  let x0 = 0;
  let y0 = 0;
  let x1 = f.w;
  let y1 = f.h;
  if (layer.kind !== "group") {
    const c = getPixels(layer.id).canvas;
    const pad = Math.ceil(b.size * 2);
    x0 = Math.max(0, Math.floor(layer.x - f.x) - pad);
    y0 = Math.max(0, Math.floor(layer.y - f.y) - pad);
    x1 = Math.min(f.w, Math.ceil(layer.x - f.x + c.width) + pad);
    y1 = Math.min(f.h, Math.ceil(layer.y - f.y + c.height) + pad);
  }
  const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  if (box.w < 2 || box.h < 2) return;
  const img = readImg(content, box.x, box.y, box.w, box.h);
  const n = box.w * box.h;
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = img.data[i * 4 + 3]!;
  const shade = bevelShading(alpha, box.w, box.h, b);
  const light = new ImageData(box.w, box.h);
  const dark = new ImageData(box.w, box.h);
  const [hr, hg, hb] = hexToRgb(b.highlight);
  const [sr, sg, sb] = hexToRgb(b.shadow);
  for (let i = 0; i < n; i++) {
    const a = alpha[i]! / 255;
    if (!a) continue;
    const v = shade[i]!;
    const o = i * 4;
    if (v > 0) {
      light.data[o] = hr;
      light.data[o + 1] = hg;
      light.data[o + 2] = hb;
      light.data[o + 3] = Math.min(1, v * 2.2) * a * b.highlightOpacity * 255;
    } else if (v < 0) {
      dark.data[o] = sr;
      dark.data[o + 1] = sg;
      dark.data[o + 2] = sb;
      dark.data[o + 3] = Math.min(1, -v * 2.2) * a * b.shadowOpacity * 255;
    }
  }
  const lc = createCanvas(box.w, box.h);
  ctx2d(lc).putImageData(light, 0, 0);
  const dc = createCanvas(box.w, box.h);
  ctx2d(dc).putImageData(dark, 0, 0);
  out.save();
  out.globalAlpha = layer.opacity;
  out.globalCompositeOperation = "screen";
  out.drawImage(lc, box.x, box.y);
  out.globalCompositeOperation = "multiply";
  out.drawImage(dc, box.x, box.y);
  out.restore();
}

/** Effects drawn over the content: inner stroke, inner shadow/glow, bevel. */
function drawInnerEffects(
  out: CanvasRenderingContext2D,
  layer: Layer,
  content: HTMLCanvasElement,
  f: Frame,
) {
  const s = layer.styles;
  if (s.stroke.enabled && s.stroke.position !== "outside") drawInsideStroke(out, layer, content);
  if (s.innerGlow?.enabled)
    innerShade(out, layer, content, s.innerGlow.color, s.innerGlow.size, 0, 0, s.innerGlow.opacity);
  if (s.innerShadow?.enabled) {
    const a = (s.innerShadow.angle * Math.PI) / 180;
    innerShade(
      out,
      layer,
      content,
      s.innerShadow.color,
      s.innerShadow.size,
      -Math.cos(a) * s.innerShadow.distance,
      Math.sin(a) * s.innerShadow.distance,
      s.innerShadow.opacity,
    );
  }
  if (s.bevel?.enabled) drawBevel(out, layer, content, f);
}

function drawInsideStroke(out: CanvasRenderingContext2D, layer: Layer, content: HTMLCanvasElement) {
  const s = layer.styles.stroke;
  const size = s.position === "center" ? s.size / 2 : s.size;
  // Inner band = content minus content shrunk by `size` (approximated by offsets).
  const band = createCanvas(content.width, content.height);
  const bg = ctx2d(band);
  bg.drawImage(content, 0, 0);
  bg.globalCompositeOperation = "source-in";
  bg.fillStyle = s.color;
  bg.fillRect(0, 0, band.width, band.height);
  bg.globalCompositeOperation = "destination-out";
  const steps = 16;
  const inner = createCanvas(content.width, content.height);
  const ig = ctx2d(inner);
  ig.drawImage(content, 0, 0);
  ig.globalCompositeOperation = "destination-in";
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ig.drawImage(content, Math.cos(a) * size, Math.sin(a) * size);
  }
  bg.drawImage(inner, 0, 0);
  out.save();
  out.globalAlpha = s.opacity * layer.opacity;
  out.drawImage(band, 0, 0);
  out.restore();
}

export interface CompositeOptions {
  /** Shows another canvas in place of a layer's content (filter previews, live strokes). */
  overrides?: Map<string, HTMLCanvasElement>;
  /** Draws an overridden layer at another position (free-transform preview). */
  placements?: Map<string, { x: number; y: number }>;
  /** Replaces an adjustment layer's settings (live dialog preview). */
  adjustmentOverride?: {
    layerId: string;
    adjustment: Extract<Layer, { kind: "adjustment" }>["adjustment"];
  };
  /**
   * Document position of `out`'s top-left. With a canvas smaller than the
   * document, only that part is composited (fast redraws while painting).
   */
  origin?: { x: number; y: number };
}

const hasEffects = (l: Layer) =>
  Object.values(l.styles).some((e) => (e as { enabled?: boolean } | undefined)?.enabled);

/**
 * Draws the document into `out` — the whole of it for a document-size canvas,
 * or the part at `opts.origin` the size of `out`. Transparent where empty.
 */
export function composite(doc: PhotoDoc, out: HTMLCanvasElement, opts: CompositeOptions = {}) {
  const o = ctx2d(out);
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalAlpha = 1;
  o.globalCompositeOperation = "source-over";
  o.clearRect(0, 0, out.width, out.height);
  // Children of each group (and of the top level), bottom → top.
  const kids = new Map<string | null, Layer[]>();
  for (const l of doc.layers) {
    const key = l.parentId ?? null;
    const list = kids.get(key);
    if (list) list.push(l);
    else kids.set(key, [l]);
  }
  const f: Frame = { x: opts.origin?.x ?? 0, y: opts.origin?.y ?? 0, w: out.width, h: out.height };
  compositeList(doc, out, kids.get(null) ?? [], kids, opts, 0, f);
}

function compositeList(
  doc: PhotoDoc,
  out: HTMLCanvasElement,
  nodes: Layer[],
  kids: Map<string | null, Layer[]>,
  opts: CompositeOptions,
  depth: number,
  f: Frame,
) {
  const o = ctx2d(out);
  let base: HTMLCanvasElement | null = null;
  // Each nesting level gets its own scratch canvases.
  const slot = depth * 3;
  for (const layer of nodes) {
    if (!layer.visible) {
      if (!layer.clip) base = null;
      continue;
    }
    if (layer.kind === "adjustment") {
      const adj =
        opts.adjustmentOverride?.layerId === layer.id
          ? opts.adjustmentOverride.adjustment
          : layer.adjustment;
      applyAdjustmentLayer(out, layer, adj, layer.clip ? base : null, f);
      continue;
    }
    let content: HTMLCanvasElement;
    if (layer.kind === "group") {
      const children = kids.get(layer.id) ?? [];
      const simple =
        layer.passThrough &&
        layer.opacity >= 1 &&
        layer.fillOpacity >= 1 &&
        !layer.mask?.enabled &&
        !layer.clip &&
        !hasEffects(layer);
      if (simple) {
        // Pass through: the contents blend straight into what's below.
        compositeList(doc, out, children, kids, opts, depth + 1, f);
        base = null;
        continue;
      }
      const buffer = scratch(f.w, f.h, slot + 2);
      compositeList(doc, buffer, children, kids, opts, depth + 1, f);
      content = layerImage(layer, doc, buffer, layer.clip ? base : null, slot, f, f);
    } else {
      const placed = opts.placements?.get(layer.id);
      content = layerImage(
        layer,
        doc,
        opts.overrides?.get(layer.id) ?? getPixels(layer.id).canvas,
        layer.clip ? base : null,
        slot,
        placed ?? { x: layer.x, y: layer.y },
        f,
      );
    }
    drawStyles(o, layer, content);
    const alpha = layer.opacity * layer.fillOpacity;
    const native = NATIVE_BLEND[layer.blend];
    if (native) {
      o.globalCompositeOperation = native;
      o.globalAlpha = alpha;
      o.drawImage(content, 0, 0);
      o.globalCompositeOperation = "source-over";
      o.globalAlpha = 1;
    } else {
      const dst = readImg(out);
      const src = readImg(content);
      blendInto(dst, src, layer.blend, alpha);
      writeImg(out, dst);
    }
    drawInnerEffects(o, layer, content, f);
    if (!layer.clip) {
      // Remember this layer's shape for clipping masks above it.
      const keep = scratch(f.w, f.h, slot + 1);
      ctx2d(keep).drawImage(content, 0, 0);
      base = keep;
    }
  }
}

function applyAdjustmentLayer(
  out: HTMLCanvasElement,
  layer: Layer,
  adj: Extract<Layer, { kind: "adjustment" }>["adjustment"],
  base: HTMLCanvasElement | null,
  f: Frame,
) {
  const before = readImg(out);
  const after: Img = { ...before, data: new Uint8ClampedArray(before.data) };
  applyAdjustment(after, adj);
  const p = getPixels(layer.id);
  const maskImg = layer.mask?.enabled && p.mask ? readImg(p.mask, f.x, f.y, f.w, f.h) : null;
  const baseImg = base ? readImg(base) : null;
  const d = after.data;
  const b = before.data;
  for (let i = 0; i < d.length; i += 4) {
    let k = layer.opacity;
    if (maskImg) k *= maskImg.data[i + 3]! / 255;
    if (baseImg) k *= baseImg.data[i + 3]! / 255;
    if (k >= 1) {
      d[i + 3] = b[i + 3]!;
      continue;
    }
    for (let c = 0; c < 3; c++) d[i + c] = b[i + c]! + (d[i + c]! - b[i + c]!) * k;
    d[i + 3] = b[i + 3]!;
  }
  writeImg(out, after);
}

/** The document flattened onto a background colour (or transparent). */
export function flatten(doc: PhotoDoc, background: string | null = null): HTMLCanvasElement {
  const c = createCanvas(doc.width, doc.height);
  composite(doc, c);
  if (!background) return c;
  const out = createCanvas(doc.width, doc.height);
  const g = ctx2d(out);
  g.fillStyle = background;
  g.fillRect(0, 0, out.width, out.height);
  g.drawImage(c, 0, 0);
  return out;
}

export const rgbOf = hexToRgb;

// ─── Partial redraws ─────────────────────────────────────────────────────────

let dirty: { x0: number; y0: number; x1: number; y1: number } | null = null;

/** Records a document area whose pixels just changed (painting), for a partial redraw. */
export function markDirty(x: number, y: number, w: number, h: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + w);
  const y1 = Math.ceil(y + h);
  if (!dirty) dirty = { x0, y0, x1, y1 };
  else {
    dirty.x0 = Math.min(dirty.x0, x0);
    dirty.y0 = Math.min(dirty.y0, y0);
    dirty.x1 = Math.max(dirty.x1, x1);
    dirty.y1 = Math.max(dirty.y1, y1);
  }
}

/** The area changed since the last call (or null), and forgets it. */
export function takeDirty() {
  const d = dirty;
  dirty = null;
  return d ? { x: d.x0, y: d.y0, width: d.x1 - d.x0, height: d.y1 - d.y0 } : null;
}

/** Adjustments that look at the whole picture (can't be redrawn piece by piece). */
const GLOBAL_ADJUSTMENTS = new Set(["shadowsHighlights", "equalize", "develop"]);

/**
 * How far layer effects reach beyond a layer's pixels — a partial redraw
 * must include that margin — or Infinity when only a full redraw is right.
 */
export function redrawMargin(doc: PhotoDoc): number {
  let pad = 2;
  for (const l of doc.layers) {
    if (!l.visible) continue;
    if (l.kind === "adjustment" && GLOBAL_ADJUSTMENTS.has(l.adjustment.type)) return Infinity;
    const s = l.styles;
    if (s.dropShadow?.enabled) pad = Math.max(pad, s.dropShadow.distance + s.dropShadow.size * 2);
    if (s.outerGlow?.enabled) pad = Math.max(pad, s.outerGlow.size * 2);
    if (s.stroke?.enabled) pad = Math.max(pad, s.stroke.size + 2);
    if (s.innerShadow?.enabled)
      pad = Math.max(pad, s.innerShadow.distance + s.innerShadow.size * 2);
    if (s.innerGlow?.enabled) pad = Math.max(pad, s.innerGlow.size * 2);
    if (s.bevel?.enabled) pad = Math.max(pad, s.bevel.size * 3);
  }
  return Math.ceil(pad);
}
