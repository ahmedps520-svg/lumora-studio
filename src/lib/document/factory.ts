import { createId } from "@/lib/id";
import {
  DesignSchema,
  ImageElementSchema,
  LineElementSchema,
  PageSchema,
  SCHEMA_VERSION,
  ShapeElementSchema,
  TextElementSchema,
  type Design,
  type Format,
  type ImageElement,
  type LineElement,
  type Page,
  type ShapeElement,
  type ShapeKind,
  type TextElement,
} from "@/lib/schema";

/** Default type pairing for new text until a brand kit says otherwise. */
export const DEFAULT_HEADING_FONT = "Sora";
export const DEFAULT_BODY_FONT = "Inter";
export const DEFAULT_SHAPE_COLOR = "#7C6CF2";
export const DEFAULT_TEXT_COLOR = "#0F172A";

export function createPage(overrides: Partial<Page> = {}): Page {
  return PageSchema.parse({ id: createId(), ...overrides });
}

export function createDesign(options: { name?: string; format: Format; pages?: Page[] }): Design {
  const now = new Date().toISOString();
  return DesignSchema.parse({
    id: createId(),
    name: options.name ?? "Untitled design",
    schemaVersion: SCHEMA_VERSION,
    format: options.format,
    pages: options.pages ?? [createPage()],
    createdAt: now,
    updatedAt: now,
  });
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export type TextPreset = "heading" | "subheading" | "body";

/** Font sizes scale with the page so a heading looks right on a story or a poster. */
export function textPresetSize(preset: TextPreset, format: Format): number {
  const base = Math.min(format.width, format.height);
  const ratio = preset === "heading" ? 0.08 : preset === "subheading" ? 0.045 : 0.03;
  return Math.round(clamp(base * ratio, 10, 400));
}

const PRESET_TEXT: Record<TextPreset, string> = {
  heading: "Add a heading",
  subheading: "Add a subheading",
  body: "Add a little bit of body text",
};

export function createText(
  preset: TextPreset,
  format: Format,
  overrides: Partial<TextElement> = {},
): TextElement {
  const fontSize = textPresetSize(preset, format);
  const width = Math.round(Math.min(format.width * 0.8, fontSize * (preset === "body" ? 18 : 12)));
  const height = Math.round(fontSize * 1.2);
  return TextElementSchema.parse({
    id: createId(),
    type: "text",
    name: "",
    x: Math.round((format.width - width) / 2),
    y: Math.round((format.height - height) / 2),
    width,
    height,
    runs: [{ text: PRESET_TEXT[preset] }],
    role: preset,
    fontFamily: preset === "body" ? DEFAULT_BODY_FONT : DEFAULT_HEADING_FONT,
    fontSize,
    fontWeight: preset === "heading" ? 700 : preset === "subheading" ? 600 : 400,
    align: "center",
    fill: { type: "solid", color: DEFAULT_TEXT_COLOR },
    ...overrides,
  });
}

export function createShape(
  kind: ShapeKind,
  format: Format,
  overrides: Partial<ShapeElement> = {},
): ShapeElement {
  const side = Math.round(Math.min(format.width, format.height) * 0.3);
  return ShapeElementSchema.parse({
    id: createId(),
    type: "shape",
    kind,
    x: Math.round((format.width - side) / 2),
    y: Math.round((format.height - side) / 2),
    width: side,
    height: side,
    fill: { type: "solid", color: DEFAULT_SHAPE_COLOR },
    ...overrides,
  });
}

/**
 * An image element for an uploaded asset, sized to fit comfortably on the page
 * (never upscaled) and centred on `at` (default: the page centre).
 */
/** The centred part of a `photo` with the same shape as `box` (in photo pixels). */
export function coverCrop(
  photo: { width: number; height: number },
  box: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const aspect = box.width / box.height;
  const width = Math.min(photo.width, photo.height * aspect);
  const height = width / aspect;
  return {
    x: Math.round((photo.width - width) / 2),
    y: Math.round((photo.height - height) / 2),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

/**
 * A photo element at its own shape, at most `maxFraction` of the page.
 * `asset` is an uploaded image (by id) or any image `src` (stock photos).
 */
export function createImage(
  format: Pick<Format, "width" | "height">,
  asset:
    | { id: string; width: number; height: number; name?: string }
    | {
        src: string;
        width: number;
        height: number;
        alt?: string;
        attribution?: ImageElement["attribution"];
      },
  options: { at?: { x: number; y: number }; maxFraction?: number } = {},
): ImageElement {
  const fraction = options.maxFraction ?? 0.6;
  const k = Math.min(
    1,
    (format.width * fraction) / asset.width,
    (format.height * fraction) / asset.height,
  );
  const width = Math.max(1, Math.round(asset.width * k));
  const height = Math.max(1, Math.round(asset.height * k));
  const center = options.at ?? { x: format.width / 2, y: format.height / 2 };
  return ImageElementSchema.parse({
    id: createId(),
    type: "image",
    name: "name" in asset ? (asset.name ?? "") : "",
    src: "src" in asset ? asset.src : `asset:${asset.id}`,
    alt: "src" in asset ? (asset.alt ?? "") : (asset.name ?? ""),
    attribution: "src" in asset ? (asset.attribution ?? null) : null,
    x: Math.round(center.x - width / 2),
    y: Math.round(center.y - height / 2),
    width,
    height,
  });
}

export function createLine(format: Format, overrides: Partial<LineElement> = {}): LineElement {
  const length = Math.round(Math.min(format.width, format.height) * 0.4);
  const strokeWidth = Math.max(2, Math.round(Math.min(format.width, format.height) / 270));
  return LineElementSchema.parse({
    id: createId(),
    type: "line",
    x: Math.round((format.width - length) / 2),
    y: Math.round(format.height / 2 - strokeWidth / 2),
    width: length,
    height: strokeWidth,
    stroke: { color: DEFAULT_TEXT_COLOR, width: strokeWidth },
    ...overrides,
  });
}
