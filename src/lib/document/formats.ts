import type { Format } from "@/lib/schema";

/** Design px per inch. All geometry is stored at this density. */
export const CSS_DPI = 96;
export const PRINT_DPI = 300;

export type SizeUnit = Format["unit"];

const UNIT_PER_INCH: Record<SizeUnit, number> = { px: CSS_DPI, in: 1, cm: 2.54, mm: 25.4 };

/** Converts design px to a display unit. */
export function pxToUnit(px: number, unit: SizeUnit): number {
  return (px / CSS_DPI) * UNIT_PER_INCH[unit];
}

/** Converts a display-unit value back to design px. */
export function unitToPx(value: number, unit: SizeUnit): number {
  return (value / UNIT_PER_INCH[unit]) * CSS_DPI;
}

/** Pixel size of an export at the format's DPI (e.g. A4 at 300 dpi → 2480 × 3508). */
export function outputPixels(format: Pick<Format, "width" | "height" | "dpi">) {
  const scale = format.dpi / CSS_DPI;
  return { width: Math.round(format.width * scale), height: Math.round(format.height * scale) };
}

export type FormatCategory = "social" | "video" | "presentation" | "print" | "document" | "other";

export interface FormatPreset {
  /** Also the i18n key under `formats.*`. */
  id: string;
  category: FormatCategory;
  width: number;
  height: number;
  unit: SizeUnit;
  dpi: number;
}

function screen(id: string, category: FormatCategory, width: number, height: number): FormatPreset {
  return { id, category, width, height, unit: "px", dpi: CSS_DPI };
}

function print(
  id: string,
  category: FormatCategory,
  w: number,
  h: number,
  unit: Exclude<SizeUnit, "px">,
): FormatPreset {
  return {
    id,
    category,
    width: Math.round(unitToPx(w, unit)),
    height: Math.round(unitToPx(h, unit)),
    unit,
    dpi: PRINT_DPI,
  };
}

export const FORMAT_PRESETS: readonly FormatPreset[] = [
  screen("instagramPost", "social", 1080, 1080),
  screen("instagramPortrait", "social", 1080, 1350),
  screen("instagramStory", "social", 1080, 1920),
  screen("instagramReelCover", "social", 1080, 1920),
  screen("facebookPost", "social", 1200, 630),
  screen("facebookCover", "social", 1640, 624),
  screen("xPost", "social", 1600, 900),
  screen("xHeader", "social", 1500, 500),
  screen("linkedinPost", "social", 1200, 627),
  screen("linkedinBanner", "social", 1584, 396),
  screen("pinterestPin", "social", 1000, 1500),
  screen("whatsappStatus", "social", 1080, 1920),
  screen("youtubeThumbnail", "video", 1280, 720),
  screen("youtubeBanner", "video", 2560, 1440),
  screen("tiktokVideo", "video", 1080, 1920),
  screen("presentation16x9", "presentation", 1920, 1080),
  screen("presentation4x3", "presentation", 1024, 768),
  screen("logo", "other", 500, 500),
  print("a4", "document", 210, 297, "mm"),
  print("letter", "document", 8.5, 11, "in"),
  print("resume", "document", 210, 297, "mm"),
  print("poster", "print", 18, 24, "in"),
  print("flyer", "print", 8.5, 11, "in"),
  print("businessCard", "print", 3.5, 2, "in"),
  print("invitation", "print", 5, 7, "in"),
  print("certificate", "print", 11, 8.5, "in"),
  print("menu", "print", 8.5, 11, "in"),
];

export function getPreset(id: string | null | undefined): FormatPreset | undefined {
  return FORMAT_PRESETS.find((p) => p.id === id);
}

export function formatFromPreset(preset: FormatPreset): Format {
  return {
    width: preset.width,
    height: preset.height,
    unit: preset.unit,
    dpi: preset.dpi,
    presetId: preset.id,
  };
}

/** A custom size typed by the user, e.g. 15 × 10 cm. */
export function customFormat(width: number, height: number, unit: SizeUnit): Format {
  const isPrint = unit !== "px";
  return {
    width: Math.round(unit === "px" ? width : unitToPx(width, unit)),
    height: Math.round(unit === "px" ? height : unitToPx(height, unit)),
    unit,
    dpi: isPrint ? PRINT_DPI : CSS_DPI,
    presetId: null,
  };
}
