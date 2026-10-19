/**
 * The drawing kit templates are written with. Every call adds an ordinary,
 * fully editable element (text, shape, icon, frame, chart…) to the page; the
 * kit only takes care of sizes that fit, colours that read and fonts that
 * suit the language.
 */
import {
  createChart,
  createCode,
  createTable,
  type ChartSample,
  type ChartType,
} from "@/lib/document/elements";
import { contrastRatio } from "@/lib/engine/paint";
import { createId } from "@/lib/id";
import { coverWidth, photoAttribution, photoUrl, type StockPhoto } from "@/lib/photos";
import type { Background, ElementInput, Fill, ImageFilters, ShapeKind } from "@/lib/schema";
import { fontWidth, type FontPair } from "./fonts";
import { templateIcon } from "./icons";
import { alpha, onColor, type Palette } from "./palettes";
import type { Copy, TemplateLocale } from "./types";

export type Run = [
  text: string,
  style?: { color?: string; weight?: number; italic?: boolean; font?: string },
];

export interface TextOptions {
  x: number;
  y: number;
  w: number;
  size: number;
  /** "h" heading font, "b" body font, or a family name. */
  font?: "h" | "b" | string;
  weight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  lh?: number;
  /** Letter spacing in thousandths of an em (ignored for Arabic). */
  ls?: number;
  role?: "heading" | "subheading" | "body" | "caption" | "other";
  italic?: boolean;
  upper?: boolean;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur?: number; x?: number; y?: number };
  extrude?: { depth: number; color: string; angle?: number };
  gradient?: string[];
  bg?: string;
  opacity?: number;
  rotation?: number;
  name?: string;
}

export interface ShapeOptions {
  fill?: string | Fill | null;
  r?: number;
  stroke?: string;
  sw?: number;
  dash?: number[];
  opacity?: number;
  rotation?: number;
  shadow?: { color: string; blur?: number; x?: number; y?: number };
  sides?: number;
  inner?: number;
  name?: string;
}

/** Hands out a template's photos, so one design never shows the same photo twice. */
export interface PhotoPicker {
  next(kind: "theme" | "people"): StockPhoto | null;
}

const ARABIC = /[؀-ۿ]/;

/** Deterministic random numbers (same template → same layout). */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Kit {
  readonly els: ElementInput[] = [];
  background: Background;
  /** One percent of the shorter side — the unit most sizes are written in. */
  readonly u: number;
  readonly landscape: boolean;
  /** Taller than 1.5 : 1 (stories). */
  readonly tall: boolean;
  readonly rtl: boolean;
  readonly rand: () => number;

  constructor(
    readonly W: number,
    readonly H: number,
    readonly p: Palette,
    readonly f: FontPair,
    readonly c: Copy,
    readonly icons: string[],
    readonly locale: TemplateLocale,
    seed: string,
    /** The theme id (lets blueprints add theme-specific touches). */
    readonly theme = "",
    /** Fills photo frames (empty frames when missing). */
    readonly photos: PhotoPicker | null = null,
  ) {
    this.u = Math.min(W, H) / 100;
    this.landscape = W > H * 1.15;
    this.tall = H > W * 1.5;
    this.rtl = locale === "ar";
    this.rand = seeded(seed);
    this.background = { type: "solid", color: p.bg };
  }

  // ─── Colour helpers ────────────────────────────────────────────────────────

  /** Readable text colour on `color`. */
  /** The first colour that stands out on `bg` (falls back to black or white). */
  pick(bg: string, candidates: string[], min = 2.6) {
    const base = bg.slice(0, 7);
    return candidates.find((c) => contrastRatio(base, c.slice(0, 7)) >= min) ?? this.on(bg);
  }

  on(color: string) {
    return onColor(color, this.p.dark ? this.p.bg : this.p.ink, "#FFFFFF");
  }
  alpha = alpha;
  grad(colors: string[], angle = 135): Fill {
    return {
      type: "gradient",
      gradient: {
        kind: "linear",
        angle,
        stops: colors.map((color, i) => ({ offset: i / Math.max(1, colors.length - 1), color })),
      },
    };
  }
  radial(colors: string[]): Fill {
    return {
      type: "gradient",
      gradient: {
        kind: "radial",
        angle: 0,
        stops: colors.map((color, i) => ({ offset: i / Math.max(1, colors.length - 1), color })),
      },
    };
  }
  bgSolid(color: string) {
    this.background = { type: "solid", color };
  }
  bgGradient(colors: string[], angle = 160) {
    const fill = this.grad(colors, angle);
    if (fill.type === "gradient") this.background = { type: "gradient", gradient: fill.gradient };
  }

  // ─── Fonts and measuring ───────────────────────────────────────────────────

  family(font: TextOptions["font"], text: string): string {
    const arabic = this.rtl || ARABIC.test(text);
    if (font === "h" || font === undefined) return arabic ? this.f.ar.heading : this.f.heading;
    if (font === "b") return arabic ? this.f.ar.body : this.f.body;
    // Latin-only display fonts can't draw Arabic.
    return arabic ? this.f.ar.body : font;
  }

  /** Approximate width of one line of text. */
  measure(text: string, size: number, family: string, ls = 0, upper = false): number {
    const base = fontWidth(family, this.f);
    let units = 0;
    for (const ch of text) {
      if (ch === " ") units += 0.3;
      else if (ch === "%") units += base * 1.7;
      else if (/[A-Z0-9]/.test(ch) || upper) units += base * 1.12;
      else if (/[ilj.,'!:;|]/.test(ch)) units += base * 0.5;
      else if (/[mwMW]/.test(ch)) units += base * 1.45;
      else units += base;
      units += ls / 1000;
    }
    // A little headroom: real glyphs of heavy display fonts run wide.
    return units * size * 1.04;
  }

  /** How many lines `text` wraps to in `w`, and the longest word's width. */
  wrap(text: string, size: number, family: string, w: number, ls = 0, upper = false) {
    let lines = 0;
    let longest = 0;
    for (const para of text.split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = 0;
      lines++;
      for (const word of words) {
        const ww = this.measure(word, size, family, ls, upper);
        longest = Math.max(longest, ww);
        const space = this.measure(" ", size, family, ls);
        if (line > 0 && line + space + ww > w) {
          lines++;
          line = ww;
        } else line += (line > 0 ? space : 0) + ww;
      }
    }
    return { lines, longest };
  }

  /**
   * The biggest size (≤ max) at which `text` fits a box: `w` wide, at most
   * `lines` lines and (optionally) `maxH` tall.
   */
  fitBox(
    text: string,
    o: {
      w: number;
      maxH: number;
      max: number;
      min?: number;
      lines?: number;
      font?: TextOptions["font"];
      lh?: number;
    },
  ) {
    const font = o.font ?? "h";
    let size = this.fit(text, { w: o.w, max: o.max, min: o.min, lines: o.lines, font });
    const min = o.min ?? Math.min(o.max, this.u * 3);
    while (size > min && this.heightOf(text, size, o.w, font, o.lh) > o.maxH)
      size = Math.round(size * 0.94);
    return Math.max(min, size);
  }

  /** The biggest size (≤ max) at which `text` fits `w` in at most `maxLines`. */
  fit(
    text: string,
    o: {
      w: number;
      max: number;
      min?: number;
      lines?: number;
      font?: TextOptions["font"];
      ls?: number;
      upper?: boolean;
    },
  ) {
    const family = this.family(o.font ?? "h", text);
    const shown = this.shown(text, o.upper ?? (o.font ?? "h") === "h");
    const ls = this.rtl ? 0 : (o.ls ?? 0);
    const min = o.min ?? Math.min(o.max, this.u * 3);
    let size = o.max;
    while (size > min) {
      const { lines, longest } = this.wrap(shown, size, family, o.w, ls);
      if (longest <= o.w * 0.98 && lines <= (o.lines ?? 3)) break;
      size *= 0.94;
    }
    return Math.max(min, Math.round(size));
  }

  private shown(text: string, upper: boolean) {
    return upper && this.f.caps && !this.rtl ? text.toUpperCase() : text;
  }

  /** Estimated height of a text block (without adding it). */
  heightOf(text: string, size: number, w: number, font: TextOptions["font"] = "b", lh?: number) {
    if (!text.trim()) return 0;
    const heading = font === "h";
    const family = this.family(font, text);
    const shown = this.shown(text, heading);
    const ls = this.rtl ? 0 : heading ? this.f.tracking : 0;
    const lineH = lh ?? (heading ? (this.rtl ? 1.35 : 1.05) : this.rtl ? 1.6 : 1.4);
    return Math.round(this.wrap(shown, size, family, w, ls).lines * size * lineH);
  }

  /** Adds a text box; returns its (estimated) height. */
  text(content: string | Run[], o: TextOptions): number {
    const runs: Run[] = typeof content === "string" ? [[content]] : content;
    const plain = runs.map((r) => r[0]).join("");
    if (!plain.trim()) return 0;
    const heading = (o.font ?? "b") === "h";
    const family = this.family(o.font ?? "b", plain);
    const upper = o.upper ?? (heading && this.f.caps);
    const weight =
      o.weight ??
      (heading ? (this.rtl ? this.f.ar.headingWeight : this.f.headingWeight) : this.f.bodyWeight);
    const ls = this.rtl || ARABIC.test(plain) ? 0 : (o.ls ?? (heading ? this.f.tracking : 0));
    const lh = o.lh ?? (heading ? (this.rtl ? 1.35 : 1.05) : this.rtl ? 1.6 : 1.4);
    const shownRuns = runs.map(([t, s]) => [upper && !this.rtl ? t.toUpperCase() : t, s] as Run);
    const fullText = shownRuns.map((r) => r[0]).join("");
    const { lines } = this.wrap(fullText, o.size, family, o.w, ls);
    const height = Math.round(lines * o.size * lh);
    const color = o.color ?? this.p.ink;
    const fill: Fill = o.gradient ? this.grad(o.gradient, 180) : { type: "solid", color };
    this.els.push({
      id: createId(),
      type: "text",
      name: o.name ?? "",
      role: o.role ?? (heading ? "heading" : "body"),
      x: Math.round(o.x),
      y: Math.round(o.y),
      width: Math.round(o.w),
      height,
      rotation: o.rotation ?? 0,
      opacity: o.opacity ?? 1,
      runs: shownRuns.map(([text, s]) => ({
        text,
        style: {
          ...(s?.color ? { color: s.color } : {}),
          ...(s?.weight ? { fontWeight: s.weight } : {}),
          ...(s?.italic ? { italic: true } : {}),
          ...(s?.font ? { fontFamily: this.family(s.font, text) } : {}),
        },
      })),
      fontFamily: family,
      fontSize: Math.round(o.size),
      fontWeight: weight,
      italic: o.italic ?? false,
      // Blueprints are written left-to-right; Arabic pages are mirrored afterwards.
      align: o.align ?? "left",
      lineHeight: lh,
      letterSpacing: ls,
      fill,
      stroke: o.stroke ? { color: o.stroke.color, width: o.stroke.width, dash: [] } : null,
      shadow: o.shadow
        ? {
            color: o.shadow.color,
            blur: o.shadow.blur ?? 0,
            offsetX: o.shadow.x ?? 0,
            offsetY: o.shadow.y ?? 0,
          }
        : null,
      extrude: o.extrude
        ? { depth: o.extrude.depth, color: o.extrude.color, angle: o.extrude.angle ?? 90 }
        : null,
      backgroundColor: o.bg ?? null,
      direction: this.rtl || ARABIC.test(plain) ? "rtl" : "ltr",
    } as ElementInput);
    return height;
  }

  /** A headline sized to fit `w` (and at most `lines` lines). Returns size and height. */
  title(
    text: string,
    o: Omit<TextOptions, "size"> & { max: number; min?: number; lines?: number },
  ) {
    const size = this.fit(text, {
      w: o.w,
      max: o.max,
      min: o.min,
      lines: o.lines,
      font: o.font ?? "h",
      ls: o.ls,
      upper: o.upper,
    });
    const h = this.text(text, { ...o, size, font: o.font ?? "h", role: o.role ?? "heading" });
    return { size, h };
  }

  // ─── Shapes ────────────────────────────────────────────────────────────────

  private fillOf(fill: ShapeOptions["fill"], fallback: string): Fill {
    if (fill === null) return { type: "none" };
    if (fill === undefined) return { type: "solid", color: fallback };
    return typeof fill === "string" ? { type: "solid", color: fill } : fill;
  }

  shape(kind: ShapeKind, x: number, y: number, w: number, h: number, o: ShapeOptions = {}) {
    this.els.push({
      id: createId(),
      type: "shape",
      name: o.name ?? "",
      kind,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.max(1, Math.round(w)),
      height: Math.max(1, Math.round(h)),
      rotation: o.rotation ?? 0,
      opacity: o.opacity ?? 1,
      fill: this.fillOf(o.fill, this.p.primary),
      stroke: o.stroke ? { color: o.stroke, width: o.sw ?? 2, dash: o.dash ?? [] } : null,
      cornerRadius: Math.round(o.r ?? 0),
      sides: o.sides ?? 5,
      innerRadius: o.inner ?? 0.5,
      shadow: o.shadow
        ? {
            color: o.shadow.color,
            blur: o.shadow.blur ?? 20,
            offsetX: o.shadow.x ?? 0,
            offsetY: o.shadow.y ?? 8,
          }
        : null,
    } as ElementInput);
  }

  rect(x: number, y: number, w: number, h: number, o: ShapeOptions = {}) {
    this.shape("rect", x, y, w, h, o);
  }
  ellipse(x: number, y: number, w: number, h: number, o: ShapeOptions = {}) {
    this.shape("ellipse", x, y, w, h, o);
  }
  circle(cx: number, cy: number, r: number, o: ShapeOptions = {}) {
    this.shape("ellipse", cx - r, cy - r, r * 2, r * 2, o);
  }

  /** Any SVG outline drawn in a 100 × 100 box, stretched to (w × h). */
  path(d: string, x: number, y: number, w: number, h: number, o: ShapeOptions = {}) {
    this.els.push({
      id: createId(),
      type: "shape",
      name: o.name ?? "",
      kind: "path",
      x: Math.round(x),
      y: Math.round(y),
      width: Math.max(1, Math.round(w)),
      height: Math.max(1, Math.round(h)),
      rotation: o.rotation ?? 0,
      opacity: o.opacity ?? 1,
      fill: this.fillOf(o.fill, this.p.primary),
      stroke: o.stroke ? { color: o.stroke, width: o.sw ?? 2, dash: o.dash ?? [] } : null,
      pathData: d,
      pathViewBox: { width: 100, height: 100 },
    } as ElementInput);
  }

  /** A soft light: a circle fading from `color` to transparent. */
  glow(cx: number, cy: number, r: number, color: string, strength = 0.55) {
    this.circle(cx, cy, r, {
      fill: this.radial([alpha(color, strength), alpha(color, strength * 0.35), alpha(color, 0)]),
      name: "glow",
    });
  }

  /** A thin straight bar (dividers, underlines). */
  bar(x: number, y: number, w: number, h: number, color: string, r = h / 2) {
    this.rect(x, y, w, h, { fill: color, r });
  }

  /** A rounded label or button with centred text. Returns its width. */
  pill(
    label: string,
    x: number,
    y: number,
    o: {
      size: number;
      fill?: string;
      color?: string;
      padX?: number;
      h?: number;
      anchor?: "start" | "center" | "end";
      font?: TextOptions["font"];
      weight?: number;
      stroke?: string;
      upper?: boolean;
      ls?: number;
    },
  ) {
    if (!label) return 0;
    const family = this.family(o.font ?? "b", label);
    const shown = o.upper && !this.rtl ? label.toUpperCase() : label;
    const ls = this.rtl ? 0 : (o.ls ?? 0);
    const tw = this.measure(shown, o.size, family, ls, o.upper);
    const padX = o.padX ?? o.size * 1.2;
    const w = Math.round(tw + padX * 2);
    const h = Math.round(o.h ?? o.size * 2.4);
    const left = o.anchor === "center" ? x - w / 2 : o.anchor === "end" ? x - w : x;
    const fill = o.fill ?? this.p.primary;
    this.rect(left, y, w, h, {
      fill: fill === "none" ? null : fill,
      r: h / 2,
      stroke: o.stroke,
      sw: o.stroke ? Math.max(2, o.size * 0.12) : undefined,
      name: "button",
    });
    this.text(shown, {
      x: left,
      y: y + (h - o.size * 1.25) / 2,
      w,
      size: o.size,
      font: o.font ?? "b",
      weight: o.weight ?? 700,
      color: o.color ?? (fill === "none" ? this.p.ink : this.on(fill)),
      align: "center",
      lh: 1.25,
      ls,
      upper: false,
      role: "other",
    });
    return w;
  }

  // ─── Icons, frames, data ───────────────────────────────────────────────────

  icon(
    name: string,
    x: number,
    y: number,
    size: number,
    color: string,
    o: { stroke?: number } = {},
  ) {
    const svg = templateIcon(name, o.stroke ?? 2);
    if (!svg) return;
    this.els.push({
      id: createId(),
      type: "svg",
      name,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(size),
      height: Math.round(size),
      svg,
      source: "icon",
      colorMap: { currentColor: color },
    } as ElementInput);
  }

  /**
   * A photo frame, filled with a photo that suits the theme (or a portrait for
   * "people"). Users swap the photo by dropping another on it.
   */
  frame(
    x: number,
    y: number,
    w: number,
    h: number,
    o: {
      shape?: "rect" | "ellipse" | "path";
      r?: number;
      path?: string;
      color?: string;
      stroke?: string;
      sw?: number;
      /** Which photo goes in: the theme's (default), a portrait, or none. */
      photo?: "theme" | "people" | false;
      filters?: Partial<ImageFilters>;
      rotation?: number;
      shadow?: { color: string; blur?: number; x?: number; y?: number };
    } = {},
  ) {
    const photo = o.photo === false ? null : (this.photos?.next(o.photo ?? "theme") ?? null);
    this.els.push({
      id: createId(),
      type: "frame",
      name: "photo",
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      shape: o.shape ?? (o.path ? "path" : "rect"),
      cornerRadius: Math.round(o.r ?? 0),
      pathData: o.path ?? null,
      pathViewBox: o.path ? { width: 100, height: 100 } : null,
      rotation: o.rotation ?? 0,
      shadow: o.shadow
        ? {
            color: o.shadow.color,
            blur: o.shadow.blur ?? 20,
            offsetX: o.shadow.x ?? 0,
            offsetY: o.shadow.y ?? 8,
          }
        : null,
      placeholderColor: o.color ?? this.p.bg2,
      stroke: o.stroke ? { color: o.stroke, width: o.sw ?? 6, dash: [] } : null,
      image: photo
        ? {
            src: photoUrl(photo.id, coverWidth(w, h)),
            attribution: photoAttribution(photo),
            ...(o.filters ? { filters: o.filters } : {}),
          }
        : null,
    } as ElementInput);
  }

  chart(
    type: ChartType,
    x: number,
    y: number,
    w: number,
    h: number,
    sample: ChartSample,
    o: { colors?: string[]; text?: string } = {},
  ) {
    const chart = createChart({ width: w, height: h }, type, sample);
    this.els.push({
      ...chart,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      colors: o.colors ?? [this.p.primary, this.p.secondary, this.p.accent, this.p.soft],
      series: chart.series.map((s, i) => ({
        ...s,
        color: (o.colors ?? [this.p.primary, this.p.secondary, this.p.accent])[i] ?? null,
      })),
      textColor: o.text ?? this.p.soft,
      fontFamily: this.family("b", sample.labels.join("")),
    } as ElementInput);
  }

  table(x: number, y: number, w: number, rows: string[][], o: { size: number; header?: string }) {
    const t = createTable({ width: w, height: 100 }, rows.length, rows[0]?.length ?? 1);
    this.els.push({
      ...t,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(rows.length * o.size * 2.6),
      fontSize: Math.round(o.size),
      cellPadding: Math.round(o.size * 0.6),
      fontFamily: this.family("b", rows.flat().join("")),
      textColor: this.p.ink,
      headerFill: o.header ?? this.p.bg2,
      borderColor: alpha(this.p.soft, 0.35),
      rows: rows.map((row) =>
        row.map((text) => ({
          text,
          fill: null,
          color: null,
          bold: false,
          align: this.rtl ? "right" : "left",
          rowSpan: 1,
          colSpan: 1,
        })),
      ),
    } as ElementInput);
  }

  qr(
    value: string,
    x: number,
    y: number,
    size: number,
    o: { fg?: string; bg?: string | null } = {},
  ) {
    const code = createCode({ width: size, height: size }, value);
    this.els.push({
      ...code,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(size),
      height: Math.round(size),
      foreground: o.fg ?? this.p.ink,
      background: o.bg === undefined ? "#FFFFFF" : o.bg,
    } as ElementInput);
  }

  // ─── Decoration ────────────────────────────────────────────────────────────

  /** A grid of small dots. */
  dots(x: number, y: number, cols: number, rows: number, gap: number, r: number, color: string) {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++)
        this.circle(x + i * gap, y + j * gap, r, { fill: color, name: "dot" });
    }
  }

  /** Little scattered shapes (confetti), kept away from a central box. */
  confetti(
    count: number,
    colors: string[],
    avoid?: { x: number; y: number; w: number; h: number },
  ) {
    const kinds: ShapeKind[] = ["rect", "ellipse", "triangle", "star"];
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 8; tries++) {
      const s = this.u * (1.2 + this.rand() * 2.2);
      const x = this.rand() * (this.W - s);
      const y = this.rand() * (this.H - s);
      if (
        avoid &&
        x + s > avoid.x &&
        x < avoid.x + avoid.w &&
        y + s > avoid.y &&
        y < avoid.y + avoid.h
      )
        continue;
      const kind = kinds[Math.floor(this.rand() * kinds.length)]!;
      this.shape(kind, x, y, kind === "rect" ? s * 0.5 : s, s, {
        fill: colors[placed % colors.length],
        rotation: Math.round(this.rand() * 90 - 45),
        r: kind === "rect" ? s * 0.12 : 0,
        name: "confetti",
      });
      placed++;
    }
  }

  /** The main icon of the theme (or the n-th). */
  ic(n = 0) {
    return this.icons[n % this.icons.length] ?? "sparkles";
  }
}

/** A few outlines used by many blueprints (100 × 100 boxes). */
export const PATHS = {
  waveTop: "M0 30 C 20 0, 40 0, 55 22 S 85 50, 100 18 L100 100 L0 100 Z",
  waveBottom: "M0 0 L100 0 L100 70 C 80 100, 60 100, 45 78 S 15 50, 0 82 Z",
  arch: "M0 100 L0 50 A50 50 0 0 1 100 50 L100 100 Z",
  slantTop: "M0 22 L100 0 L100 100 L0 100 Z",
  slantBottom: "M0 0 L100 0 L100 78 L0 100 Z",
  blob1:
    "M50 2 C 74 2, 98 18, 98 46 C 98 76, 78 98, 50 98 C 22 98, 2 80, 3 52 C 4 24, 26 2, 50 2 Z",
  blob2:
    "M58 4 C 84 8, 98 32, 94 58 C 90 86, 64 99, 40 95 C 14 91, 1 68, 5 42 C 9 16, 32 0, 58 4 Z",
  burst:
    "M50 0 L58 18 L77 8 L76 29 L97 27 L86 45 L100 58 L80 64 L86 85 L66 80 L58 100 L46 84 L28 96 L26 75 L5 76 L15 58 L0 45 L19 38 L12 18 L33 21 Z",
  quote:
    "M8 60 C 8 34, 20 18, 40 12 L44 22 C 32 28, 27 37, 27 46 L42 46 L42 82 L8 82 Z M56 60 C 56 34, 68 18, 88 12 L92 22 C 80 28, 75 37, 75 46 L90 46 L90 82 L56 82 Z",
  ticket: "M0 0 L100 0 L100 40 A10 10 0 0 0 100 60 L100 100 L0 100 L0 60 A10 10 0 0 0 0 40 Z",
  corner: "M0 0 L100 0 C 60 10, 10 60, 0 100 Z",
  leaf: "M50 100 C 10 70, 5 30, 50 0 C 95 30, 90 70, 50 100 Z",
  sparkle:
    "M50 0 C 54 36, 64 46, 100 50 C 64 54, 54 64, 50 100 C 46 64, 36 54, 0 50 C 36 46, 46 36, 50 0 Z",
  crescent: "M62 4 A48 48 0 1 0 96 70 A38 38 0 1 1 62 4 Z",
  lantern:
    "M44 0 L56 0 L56 8 L62 8 L74 22 L74 70 L62 86 L56 86 L56 100 L44 100 L44 86 L38 86 L26 70 L26 22 L38 8 L44 8 Z",
};
