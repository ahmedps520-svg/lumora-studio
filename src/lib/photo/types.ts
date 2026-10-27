/**
 * Lumora Photo's document model. Pixels live in canvases outside this model
 * (see `layers.ts`); everything here is plain data that can be saved, undone
 * and sent to React.
 */

export const BLEND_MODES = [
  "normal",
  "dissolve",
  "darken",
  "multiply",
  "colorBurn",
  "linearBurn",
  "darkerColor",
  "lighten",
  "screen",
  "colorDodge",
  "linearDodge",
  "lighterColor",
  "overlay",
  "softLight",
  "hardLight",
  "vividLight",
  "linearLight",
  "pinLight",
  "hardMix",
  "difference",
  "exclusion",
  "subtract",
  "divide",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/** Blend-mode groups, as shown in the blend menu. */
export const BLEND_GROUPS: BlendMode[][] = [
  ["normal", "dissolve"],
  ["darken", "multiply", "colorBurn", "linearBurn", "darkerColor"],
  ["lighten", "screen", "colorDodge", "linearDodge", "lighterColor"],
  ["overlay", "softLight", "hardLight", "vividLight", "linearLight", "pinLight", "hardMix"],
  ["difference", "exclusion", "subtract", "divide"],
  ["hue", "saturation", "color", "luminosity"],
];

export interface Locks {
  transparency: boolean;
  pixels: boolean;
  position: boolean;
  all: boolean;
}

export interface LayerStyles {
  dropShadow: {
    enabled: boolean;
    color: string;
    opacity: number;
    angle: number;
    distance: number;
    size: number;
  };
  outerGlow: { enabled: boolean; color: string; opacity: number; size: number };
  stroke: {
    enabled: boolean;
    color: string;
    size: number;
    position: "outside" | "center" | "inside";
    opacity: number;
  };
  colorOverlay: { enabled: boolean; color: string; opacity: number };
  innerShadow: {
    enabled: boolean;
    color: string;
    opacity: number;
    angle: number;
    distance: number;
    size: number;
  };
  innerGlow: { enabled: boolean; color: string; opacity: number; size: number };
  bevel: {
    enabled: boolean;
    /** Strength of the relief (1 = normal). */
    depth: number;
    size: number;
    angle: number;
    altitude: number;
    highlight: string;
    highlightOpacity: number;
    shadow: string;
    shadowOpacity: number;
  };
  gradientOverlay: { enabled: boolean; opacity: number; angle: number; from: string; to: string };
}

export const DEFAULT_STYLES: LayerStyles = {
  dropShadow: {
    enabled: false,
    color: "#000000",
    opacity: 0.6,
    angle: 135,
    distance: 12,
    size: 18,
  },
  outerGlow: { enabled: false, color: "#FFE58A", opacity: 0.75, size: 24 },
  stroke: { enabled: false, color: "#000000", size: 4, position: "outside", opacity: 1 },
  colorOverlay: { enabled: false, color: "#FF3D7F", opacity: 1 },
  innerShadow: {
    enabled: false,
    color: "#000000",
    opacity: 0.6,
    angle: 135,
    distance: 6,
    size: 10,
  },
  innerGlow: { enabled: false, color: "#FFF3B0", opacity: 0.75, size: 14 },
  bevel: {
    enabled: false,
    depth: 1,
    size: 8,
    angle: 135,
    altitude: 30,
    highlight: "#FFFFFF",
    highlightOpacity: 0.75,
    shadow: "#000000",
    shadowOpacity: 0.6,
  },
  gradientOverlay: { enabled: false, opacity: 1, angle: 90, from: "#FF7A3D", to: "#7C6CF2" },
};

/** Fills in effects added after a document was saved. */
export function withDefaultStyles(styles: Partial<LayerStyles> | undefined): LayerStyles {
  const out = structuredClone(DEFAULT_STYLES);
  for (const key of Object.keys(out) as (keyof LayerStyles)[])
    if (styles?.[key]) Object.assign(out[key], styles[key]);
  return out;
}

export interface TextProps {
  text: string;
  font: string;
  size: number;
  weight: number;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  /** Thousandths of an em. */
  tracking: number;
  /** Wrap width in pixels (0 = one line per paragraph). */
  width: number;
}

export type ShapeKind = "rectangle" | "ellipse" | "triangle" | "polygon" | "line";

export interface ShapeProps {
  shape: ShapeKind;
  width: number;
  height: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  radius: number;
  sides: number;
}

export interface GradientStop {
  offset: number;
  color: string;
}

export type GradientKind = "linear" | "radial" | "angle" | "reflected" | "diamond";

export type FillProps =
  | { type: "solid"; color: string }
  | { type: "gradient"; kind: GradientKind; angle: number; stops: GradientStop[] };

// ─── Adjustments ─────────────────────────────────────────────────────────────

export type Channel = "rgb" | "r" | "g" | "b";
export type CurvePoint = [input: number, output: number];

export type Adjustment =
  | { type: "brightnessContrast"; brightness: number; contrast: number }
  | {
      type: "levels";
      channel: Channel;
      levels: Record<
        Channel,
        { inBlack: number; inWhite: number; gamma: number; outBlack: number; outWhite: number }
      >;
    }
  | { type: "curves"; curves: Record<Channel, CurvePoint[]> }
  | { type: "exposure"; exposure: number; offset: number; gamma: number }
  | { type: "vibrance"; vibrance: number; saturation: number }
  | { type: "hueSaturation"; hue: number; saturation: number; lightness: number; colorize: boolean }
  | {
      type: "colorBalance";
      shadows: [number, number, number];
      midtones: [number, number, number];
      highlights: [number, number, number];
      preserveLuminosity: boolean;
    }
  | {
      type: "blackWhite";
      reds: number;
      yellows: number;
      greens: number;
      cyans: number;
      blues: number;
      magentas: number;
      tint: string | null;
    }
  | { type: "photoFilter"; color: string; density: number; preserveLuminosity: boolean }
  | {
      type: "channelMixer";
      red: [number, number, number];
      green: [number, number, number];
      blue: [number, number, number];
      monochrome: boolean;
    }
  | { type: "invert" }
  | { type: "posterize"; levels: number }
  | { type: "threshold"; level: number }
  | { type: "gradientMap"; stops: GradientStop[]; reverse: boolean }
  | {
      type: "selectiveColor";
      range: SelectiveRange;
      values: Record<SelectiveRange, [number, number, number, number]>;
      absolute: boolean;
    }
  | { type: "shadowsHighlights"; shadows: number; highlights: number }
  | { type: "desaturate" }
  | { type: "equalize" }
  | {
      type: "replaceColor";
      color: string;
      fuzziness: number;
      hue: number;
      saturation: number;
      lightness: number;
    }
  | {
      type: "develop";
      temperature: number;
      tint: number;
      exposure: number;
      contrast: number;
      highlights: number;
      shadows: number;
      whites: number;
      blacks: number;
      texture: number;
      clarity: number;
      dehaze: number;
      vibrance: number;
      saturation: number;
      vignette: number;
      grain: number;
    };

export type AdjustmentType = Adjustment["type"];

export type SelectiveRange =
  "reds" | "yellows" | "greens" | "cyans" | "blues" | "magentas" | "whites" | "neutrals" | "blacks";

// ─── Layers ──────────────────────────────────────────────────────────────────

interface LayerBase {
  id: string;
  name: string;
  /** The group this layer is in (null/absent = top level). */
  parentId?: string | null;
  visible: boolean;
  opacity: number;
  /** Opacity of the content, not its styles. */
  fillOpacity: number;
  blend: BlendMode;
  locks: Locks;
  /** Clipped to the layer below (clipping mask). */
  clip: boolean;
  /** Layer mask: null = none. Pixels live with the layer's canvases. */
  mask: { enabled: boolean } | null;
  styles: LayerStyles;
  /** Where the layer's canvas sits on the document. */
  x: number;
  y: number;
}

export type Layer =
  | (LayerBase & {
      kind: "group";
      collapsed: boolean;
      /** Children blend straight into what's below (no separate group picture). */
      passThrough: boolean;
    })
  | (LayerBase & { kind: "pixel" })
  | (LayerBase & { kind: "text"; text: TextProps })
  | (LayerBase & { kind: "shape"; shape: ShapeProps })
  | (LayerBase & { kind: "fill"; fill: FillProps })
  | (LayerBase & { kind: "adjustment"; adjustment: Adjustment });

export type LayerKind = Layer["kind"];

export interface PhotoDoc {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Bottom → top. */
  layers: Layer[];
  /** Pixels per inch (shown in Image Size). */
  resolution: number;
  guides: { horizontal: number[]; vertical: number[] };
  grayscale: boolean;
  /** Pen-tool paths (absent in documents saved before paths existed). */
  paths?: PhotoPath[];
}

// ─── Paths ───────────────────────────────────────────────────────────────────

export type Pt = [x: number, y: number];

/** An anchor with optional Bézier handles (absolute document coordinates). */
export interface PathPoint {
  x: number;
  y: number;
  in: Pt | null;
  out: Pt | null;
}

export interface SubPath {
  points: PathPoint[];
  closed: boolean;
}

export interface PhotoPath {
  id: string;
  name: string;
  subpaths: SubPath[];
}

export const MAX_SIDE = 8_192;
