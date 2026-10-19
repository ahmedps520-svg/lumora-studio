/**
 * Lumora document model — the single source of truth.
 *
 * A Design holds Pages; a Page holds Elements. Everything (editor, storage,
 * export, every AI feature) reads and writes this exact shape, validated by Zod.
 *
 * Conventions
 * - Geometry is in design pixels (CSS px, 96 per inch). `x`/`y` are the top-left
 *   corner of the element's box BEFORE rotation; rotation (degrees, clockwise)
 *   happens around the box centre.
 * - Colours are hex strings: #RGB, #RGBA, #RRGGBB or #RRGGBBAA.
 * - Group children use coordinates relative to the group's top-left corner.
 * - Fields with defaults may be omitted in input (handy for AI output); parsing
 *   fills them in.
 *
 * Changing the shape of saved data? Bump SCHEMA_VERSION and add a migration in
 * src/lib/document/migrations.ts. Adding optional fields / new union members
 * that old documents never contain does not need a bump.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const LIMITS = {
  coord: 100_000,
  size: 50_000,
  pages: 200,
  elementsPerPage: 2_000,
  textLength: 20_000,
  nameLength: 200,
} as const;

// ─── Primitives ──────────────────────────────────────────────────────────────

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "IDs may only contain letters, digits, _ and -");

export const ColorSchema = z.string().regex(HEX_COLOR, "Expected a hex colour like #FF7A3D");

const coord = z.number().min(-LIMITS.coord).max(LIMITS.coord);
const size = z.number().min(0).max(LIMITS.size);
const unit = z.number().min(0).max(1);

/**
 * Where image pixels come from:
 * - `asset:<id>`  an uploaded file stored locally in IndexedDB
 * - `data:image/…;base64,…`  inline (small images, AI output)
 * - `https://…`  stock photo CDNs (allowed hosts are enforced by the CSP)
 */
export const ImageSrcSchema = z
  .string()
  .max(20_000_000)
  .refine(
    (s) =>
      /^asset:[A-Za-z0-9_-]+$/.test(s) ||
      /^data:image\/(png|jpeg|webp|gif|avif);base64,/.test(s) ||
      s.startsWith("https://"),
    "Images must be an uploaded asset, a data URL or an https URL",
  );

// ─── Paint ───────────────────────────────────────────────────────────────────

export const GradientStopSchema = z.object({
  offset: unit,
  color: ColorSchema,
});

export const GradientSchema = z.object({
  kind: z.enum(["linear", "radial"]).default("linear"),
  /** CSS convention: 0 = towards top, 90 = towards right, 180 = towards bottom. */
  angle: z.number().min(-360).max(360).default(180),
  stops: z.array(GradientStopSchema).min(2).max(16),
});

export const FillSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: ColorSchema }),
  z.object({ type: z.literal("gradient"), gradient: GradientSchema }),
  z.object({ type: z.literal("none") }),
]);

export const StrokeSchema = z.object({
  color: ColorSchema,
  width: z.number().min(0).max(1000),
  /** Dash pattern in px, e.g. [8, 4]. Empty = solid line. */
  dash: z.array(z.number().min(0).max(1000)).max(8).default([]),
});

export const ShadowSchema = z.object({
  color: ColorSchema,
  blur: z.number().min(0).max(500).default(12),
  offsetX: coord.default(0),
  offsetY: coord.default(4),
});

export const BlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);

// ─── Animation ───────────────────────────────────────────────────────────────

export const ANIMATION_KINDS = [
  "fade",
  "rise",
  "pan",
  "pop",
  "zoom",
  "breathe",
  "drift",
  "tumble",
  "stomp",
  "bounce",
  "wipe",
  "typewriter",
] as const;

/** How an element (or a whole page) enters when presenting / in videos. */
export const AnimationSchema = z.object({
  kind: z.enum(ANIMATION_KINDS),
  speed: z.enum(["slow", "medium", "fast"]).default("medium"),
  /** Where it comes from (for rise / pan / drift / wipe). */
  direction: z.enum(["up", "down", "left", "right"]).default("up"),
});

// ─── Common element props ───────────────────────────────────────────────────

const baseElement = {
  id: IdSchema,
  name: z.string().max(LIMITS.nameLength).default(""),
  x: coord,
  y: coord,
  width: size,
  height: size,
  rotation: z.number().min(-360).max(360).default(0),
  opacity: unit.default(1),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  blendMode: BlendModeSchema.default("normal"),
  shadow: ShadowSchema.nullable().default(null),
  /** Gaussian blur radius in px. */
  blur: z.number().min(0).max(100).default(0),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  /** Entrance animation (null = none, or the page's animation if it has one). */
  animation: AnimationSchema.nullable().default(null),
};

// ─── Text ────────────────────────────────────────────────────────────────────

const fontFamily = z.string().min(1).max(100);
const fontSize = z.number().min(1).max(2000);
const fontWeight = z.number().int().min(100).max(900);

/** Per-run overrides on top of the text element's base style. */
export const TextStyleSchema = z.object({
  fontFamily: fontFamily.optional(),
  fontSize: fontSize.optional(),
  fontWeight: fontWeight.optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  color: ColorSchema.optional(),
  backgroundColor: ColorSchema.optional(),
});

export const TextRunSchema = z.object({
  /** May contain "\n" for line breaks. */
  text: z.string().max(LIMITS.textLength),
  style: TextStyleSchema.default({}),
});

export const TextElementSchema = z.object({
  ...baseElement,
  type: z.literal("text"),
  runs: z.array(TextRunSchema).min(1).max(5_000),
  /** Semantic role — helps AI keep hierarchy when restyling or resizing. */
  role: z.enum(["heading", "subheading", "body", "caption", "other"]).default("other"),
  fontFamily: fontFamily.default("Inter"),
  fontSize: fontSize.default(32),
  fontWeight: fontWeight.default(400),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  strike: z.boolean().default(false),
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  /** Multiple of the font size. */
  lineHeight: z.number().min(0.5).max(5).default(1.2),
  /** In thousandths of an em (100 = 0.1em). */
  letterSpacing: z.number().min(-500).max(2000).default(0),
  fill: FillSchema.default({ type: "solid", color: "#0F172A" }),
  stroke: StrokeSchema.nullable().default(null),
  /** Highlight colour behind the whole text box. */
  backgroundColor: ColorSchema.nullable().default(null),
  /** Solid 3D sides (game-title look). `angle`: 90 = straight down, 135 = down-left. */
  extrude: z
    .object({
      depth: z.number().min(0).max(500),
      color: ColorSchema,
      angle: z.number().min(-360).max(360).default(90),
    })
    .nullable()
    .default(null),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).default("none"),
  listStyle: z.enum(["none", "bullet", "number"]).default("none"),
  direction: z.enum(["ltr", "rtl"]).default("ltr"),
  /** Bend amount, -100 (arch down) … 100 (arch up). 0 = straight. */
  curve: z.number().min(-100).max(100).default(0),
  vertical: z.boolean().default(false),
  /** autoHeight: box grows with text · shrink: font shrinks to fit box · fixed: may overflow. */
  autoFit: z.enum(["autoHeight", "shrink", "fixed"]).default("autoHeight"),
});

// ─── Images ──────────────────────────────────────────────────────────────────

export const ImageFiltersSchema = z.object({
  brightness: z.number().min(-1).max(1).default(0),
  contrast: z.number().min(-1).max(1).default(0),
  saturation: z.number().min(-1).max(1).default(0),
  hue: z.number().min(-180).max(180).default(0),
  /** Colour temperature: −1 cool (blue) … 1 warm (orange). */
  warmth: z.number().min(-1).max(1).default(0),
  blur: unit.default(0),
  vignette: unit.default(0),
  grayscale: z.boolean().default(false),
  sepia: z.boolean().default(false),
  /** Two-colour effect: [shadows colour, highlights colour]. */
  duotone: z.tuple([ColorSchema, ColorSchema]).nullable().default(null),
  preset: z.string().max(40).nullable().default(null),
  /** How strongly the preset applies (manual adjustments stack on top). */
  presetStrength: unit.default(1),
});

/** Crop rectangle in source-image pixels. */
export const CropSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().gt(0),
  height: z.number().gt(0),
});

export const ViewBoxSchema = z.object({
  width: z.number().gt(0).max(LIMITS.size),
  height: z.number().gt(0).max(LIMITS.size),
});

export const MaskSchema = z.object({
  kind: z.enum(["rect", "ellipse", "path"]),
  pathData: z.string().max(50_000).nullable().default(null),
  viewBox: ViewBoxSchema.nullable().default(null),
});

export const AttributionSchema = z.object({
  provider: z.enum(["unsplash", "pexels", "pixabay", "ai", "other"]),
  author: z.string().max(200),
  url: z.string().max(2000),
});

export const ImageElementSchema = z.object({
  ...baseElement,
  type: z.literal("image"),
  src: ImageSrcSchema,
  alt: z.string().max(1_000).default(""),
  crop: CropSchema.nullable().default(null),
  filters: ImageFiltersSchema.prefault({}),
  mask: MaskSchema.nullable().default(null),
  cornerRadius: size.default(0),
  stroke: StrokeSchema.nullable().default(null),
  attribution: AttributionSchema.nullable().default(null),
});

// ─── Shapes, lines, vectors ──────────────────────────────────────────────────

export const ShapeKindSchema = z.enum([
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
  "path",
]);

export const ShapeElementSchema = z.object({
  ...baseElement,
  type: z.literal("shape"),
  kind: ShapeKindSchema,
  fill: FillSchema.default({ type: "solid", color: "#3A2E8F" }),
  stroke: StrokeSchema.nullable().default(null),
  cornerRadius: size.default(0),
  /** Polygon sides / star points. */
  sides: z.number().int().min(3).max(64).default(5),
  /** Star inner radius as a fraction of the outer radius. */
  innerRadius: z.number().min(0.05).max(1).default(0.5),
  /** SVG path for kind "path" (and library shapes), drawn inside pathViewBox. */
  pathData: z.string().max(100_000).nullable().default(null),
  pathViewBox: ViewBoxSchema.nullable().default(null),
});

export const LineCapSchema = z.enum(["none", "arrow", "triangle", "circle", "square", "bar"]);

/** A straight line across the element's width, through its vertical centre. Rotate to angle it. */
export const LineElementSchema = z.object({
  ...baseElement,
  type: z.literal("line"),
  stroke: StrokeSchema.prefault({ color: "#0F172A", width: 4 }),
  startCap: LineCapSchema.default("none"),
  endCap: LineCapSchema.default("none"),
  lineCap: z.enum(["butt", "round", "square"]).default("round"),
});

/** Sanitised SVG markup (icons, AI illustrations, uploads). */
export const SvgElementSchema = z.object({
  ...baseElement,
  type: z.literal("svg"),
  svg: z.string().max(500_000),
  /** Recolouring: original colour → replacement. */
  colorMap: z.record(z.string(), ColorSchema).default({}),
  source: z.enum(["icon", "illustration", "upload"]).default("upload"),
});

export const DrawingStrokeSchema = z.object({
  /** SVG path in the element's local space (0…sourceWidth, 0…sourceHeight). */
  d: z.string().max(200_000),
  color: ColorSchema,
  width: z.number().min(0.1).max(500),
  opacity: unit.default(1),
  mode: z.enum(["brush", "highlighter"]).default("brush"),
});

export const DrawingElementSchema = z.object({
  ...baseElement,
  type: z.literal("drawing"),
  strokes: z.array(DrawingStrokeSchema).max(1_000),
  /** The box the strokes were drawn in; rendering scales to width/height. */
  sourceWidth: z.number().gt(0).max(LIMITS.size),
  sourceHeight: z.number().gt(0).max(LIMITS.size),
});

// ─── Frames (image placeholders) ─────────────────────────────────────────────

export const FrameImageSchema = z.object({
  src: ImageSrcSchema,
  alt: z.string().max(1_000).default(""),
  /** Pan of the image inside the frame, in px from centred. */
  offsetX: z.number().min(-LIMITS.size).max(LIMITS.size).default(0),
  offsetY: z.number().min(-LIMITS.size).max(LIMITS.size).default(0),
  /** 1 = image just covers the frame. */
  scale: z.number().min(0.01).max(100).default(1),
  filters: ImageFiltersSchema.prefault({}),
  attribution: AttributionSchema.nullable().default(null),
});

export const FrameElementSchema = z.object({
  ...baseElement,
  type: z.literal("frame"),
  shape: z.enum(["rect", "ellipse", "path"]).default("rect"),
  cornerRadius: size.default(0),
  pathData: z.string().max(100_000).nullable().default(null),
  pathViewBox: ViewBoxSchema.nullable().default(null),
  placeholderColor: ColorSchema.default("#E2E8F0"),
  image: FrameImageSchema.nullable().default(null),
  stroke: StrokeSchema.nullable().default(null),
});

// ─── Tables, charts, codes ───────────────────────────────────────────────────

export const TableCellSchema = z.object({
  text: z.string().max(5_000).default(""),
  fill: ColorSchema.nullable().default(null),
  color: ColorSchema.nullable().default(null),
  bold: z.boolean().default(false),
  align: z.enum(["left", "center", "right"]).default("left"),
  rowSpan: z.number().int().min(1).max(100).default(1),
  colSpan: z.number().int().min(1).max(50).default(1),
});

export const TableElementSchema = z.object({
  ...baseElement,
  type: z.literal("table"),
  /** rows[r][c]. Cells covered by a merge are kept but not drawn. */
  rows: z.array(z.array(TableCellSchema).min(1).max(50)).min(1).max(100),
  /** Relative column widths (any positive numbers; normalised to the table width). */
  colWidths: z.array(z.number().gt(0)).max(50).default([]),
  fontFamily: fontFamily.default("Inter"),
  fontSize: fontSize.default(16),
  textColor: ColorSchema.default("#0F172A"),
  borderColor: ColorSchema.default("#CBD5E1"),
  borderWidth: z.number().min(0).max(20).default(1),
  headerRow: z.boolean().default(true),
  headerFill: ColorSchema.nullable().default("#F1F5F9"),
  stripeFill: ColorSchema.nullable().default(null),
  cellPadding: z.number().min(0).max(200).default(8),
});

export const ChartSeriesSchema = z.object({
  name: z.string().max(100),
  values: z.array(z.number().finite()).max(1_000),
  color: ColorSchema.nullable().default(null),
});

export const ChartElementSchema = z.object({
  ...baseElement,
  type: z.literal("chart"),
  chartType: z.enum(["bar", "horizontalBar", "line", "area", "pie", "donut"]),
  labels: z.array(z.string().max(100)).max(1_000),
  series: z.array(ChartSeriesSchema).min(1).max(20),
  colors: z.array(ColorSchema).max(20).default([]),
  title: z.string().max(200).default(""),
  /** Short insight caption (e.g. written by AI). */
  caption: z.string().max(500).default(""),
  showLegend: z.boolean().default(true),
  showGrid: z.boolean().default(true),
  showValues: z.boolean().default(false),
  fontFamily: fontFamily.default("Inter"),
  textColor: ColorSchema.default("#334155"),
});

export const CodeElementSchema = z.object({
  ...baseElement,
  type: z.literal("qr"),
  codeType: z.enum(["qr", "code128", "ean13"]).default("qr"),
  value: z.string().min(1).max(2_000),
  foreground: ColorSchema.default("#000000"),
  background: ColorSchema.nullable().default("#FFFFFF"),
  errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M"),
});

// ─── Groups and the element union ────────────────────────────────────────────

const LeafElementSchema = z.discriminatedUnion("type", [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  SvgElementSchema,
  LineElementSchema,
  FrameElementSchema,
  TableElementSchema,
  ChartElementSchema,
  CodeElementSchema,
  DrawingElementSchema,
]);

const groupBase = z.object({ ...baseElement, type: z.literal("group") });

// Groups contain elements (including groups), so the types are spelled out by hand.
export type Element =
  z.output<typeof LeafElementSchema> | (z.output<typeof groupBase> & { children: Element[] });
export type ElementInput =
  z.input<typeof LeafElementSchema> | (z.input<typeof groupBase> & { children: ElementInput[] });

export const GroupElementSchema = z.object({
  ...groupBase.shape,
  get children(): z.ZodArray<z.ZodType<Element, ElementInput>> {
    return z.array(ElementSchema).max(LIMITS.elementsPerPage);
  },
});

export const ElementSchema: z.ZodType<Element, ElementInput> = z.discriminatedUnion("type", [
  ...LeafElementSchema.options,
  GroupElementSchema,
]);

// ─── Pages and designs ───────────────────────────────────────────────────────

export const BackgroundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: ColorSchema }),
  z.object({ type: z.literal("gradient"), gradient: GradientSchema }),
  z.object({
    type: z.literal("image"),
    src: ImageSrcSchema,
    fit: z.enum(["cover", "contain", "tile"]).default("cover"),
    opacity: unit.default(1),
    /** Optional colour wash over the image (use an alpha hex like #00000066). */
    tint: ColorSchema.nullable().default(null),
  }),
]);

export const PAGE_TRANSITIONS = ["none", "fade", "slide", "rise", "zoom", "dissolve"] as const;
export const PageTransitionSchema = z.enum(PAGE_TRANSITIONS);
export type PageTransition = z.output<typeof PageTransitionSchema>;

export const PageSchema = z.object({
  id: IdSchema,
  name: z.string().max(LIMITS.nameLength).default(""),
  background: BackgroundSchema.default({ type: "solid", color: "#FFFFFF" }),
  elements: z.array(ElementSchema).max(LIMITS.elementsPerPage).default([]),
  /** Speaker notes (presentations). */
  notes: z.string().max(LIMITS.textLength).default(""),
  /** Slide duration for presentations / animated exports. */
  durationMs: z.number().int().min(500).max(600_000).nullable().default(null),
  /** How this page appears when presenting. */
  transition: PageTransitionSchema.default("fade"),
  /** Animates every element on the page that has no animation of its own. */
  animation: AnimationSchema.nullable().default(null),
});

export const FormatSchema = z.object({
  /** Canvas size in design px (96 per inch). */
  width: z.number().min(16).max(20_000),
  height: z.number().min(16).max(20_000),
  /** Unit shown in the UI for this design's size. */
  unit: z.enum(["px", "mm", "cm", "in"]).default("px"),
  /** Output resolution for print exports (96 = screen). */
  dpi: z.number().int().min(72).max(1_200).default(96),
  presetId: z.string().max(60).nullable().default(null),
});

export const DesignSchema = z.object({
  id: IdSchema,
  name: z.string().max(LIMITS.nameLength).default("Untitled design"),
  schemaVersion: z.literal(SCHEMA_VERSION),
  format: FormatSchema,
  pages: z.array(PageSchema).min(1).max(LIMITS.pages),
  brandKitId: IdSchema.nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type Color = z.output<typeof ColorSchema>;
export type Gradient = z.output<typeof GradientSchema>;
export type Fill = z.output<typeof FillSchema>;
export type Stroke = z.output<typeof StrokeSchema>;
export type Shadow = z.output<typeof ShadowSchema>;
export type BlendMode = z.output<typeof BlendModeSchema>;
export type TextStyle = z.output<typeof TextStyleSchema>;
export type TextRun = z.output<typeof TextRunSchema>;
export type ImageFilters = z.output<typeof ImageFiltersSchema>;
export type Animation = z.output<typeof AnimationSchema>;
export type AnimationKind = Animation["kind"];

export type TextElement = z.output<typeof TextElementSchema>;
export type ImageElement = z.output<typeof ImageElementSchema>;
export type ShapeElement = z.output<typeof ShapeElementSchema>;
export type ShapeKind = z.output<typeof ShapeKindSchema>;
export type SvgElement = z.output<typeof SvgElementSchema>;
export type LineElement = z.output<typeof LineElementSchema>;
export type GroupElement = Extract<Element, { type: "group" }>;
export type FrameElement = z.output<typeof FrameElementSchema>;
export type TableElement = z.output<typeof TableElementSchema>;
export type ChartElement = z.output<typeof ChartElementSchema>;
export type CodeElement = z.output<typeof CodeElementSchema>;
export type DrawingElement = z.output<typeof DrawingElementSchema>;

export type ElementType = Element["type"];
export type ElementOfType<T extends ElementType> = Extract<Element, { type: T }>;

export type Background = z.output<typeof BackgroundSchema>;
export type Page = z.output<typeof PageSchema>;
export type Format = z.output<typeof FormatSchema>;
export type Design = z.output<typeof DesignSchema>;
export type DesignInput = z.input<typeof DesignSchema>;

/** Props every element has, regardless of type. */
export type CommonProps = Pick<Element, keyof typeof baseElement>;
export const COMMON_PROP_KEYS = Object.keys(baseElement) as (keyof CommonProps)[];
