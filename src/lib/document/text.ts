import type { TextElement, TextStyle } from "@/lib/schema";

/** Box-level text props that per-run styles can also override. */
const RUN_KEYS: Partial<Record<keyof TextElement, keyof TextStyle>> = {
  fontFamily: "fontFamily",
  fontSize: "fontSize",
  fontWeight: "fontWeight",
  italic: "italic",
  underline: "underline",
  strike: "strike",
  fill: "color",
};

/**
 * Applies a style to the WHOLE text box: sets the box-level value and removes
 * matching per-run overrides, so e.g. "font size 48" really makes all text 48.
 */
export function withTextStyle(
  element: TextElement,
  patch: Partial<TextElement>,
): Partial<TextElement> {
  const overridden = new Set(
    Object.keys(patch)
      .map((key) => RUN_KEYS[key as keyof TextElement])
      .filter((k): k is keyof TextStyle => Boolean(k)),
  );
  if (overridden.size === 0) return patch;
  const runs = element.runs.map((run) => {
    const style = { ...run.style };
    for (const key of overridden) delete style[key];
    return { ...run, style };
  });
  return { ...patch, runs };
}

/** The text box's content without styling. */
export function plainText(element: TextElement): string {
  return element.runs.map((r) => r.text).join("");
}

// Arabic (incl. Persian/Urdu), Syriac, Thaana, N'Ko and Hebrew blocks + presentation forms.
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/g;
// Letters from left-to-right scripts (Latin, Greek, Cyrillic, CJK, …).
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ぀-ヿ一-鿿가-힯]/g;

/** Writing direction suggested by the text's letters (majority wins), or null if unclear. */
export function detectDirection(text: string): "rtl" | "ltr" | null {
  const rtl = text.match(RTL_CHAR)?.length ?? 0;
  const ltr = text.match(LTR_CHAR)?.length ?? 0;
  if (rtl === 0 && ltr === 0) return null;
  return rtl > ltr ? "rtl" : "ltr";
}

/** Fonts in the starter catalogue that include Arabic letters. */
export const ARABIC_FONTS = new Set([
  "Cairo",
  "Tajawal",
  "IBM Plex Sans Arabic",
  "Noto Kufi Arabic",
  "Amiri",
  "Reem Kufi",
]);

/**
 * The font to actually use for `text`: the wanted one, unless the text is
 * Arabic and the wanted font has no Arabic letters — then the current font
 * (if it has them) or a matching Arabic font.
 */
export function fontForText(text: string, wanted: string, current: string, weight: number): string {
  if (!/[؀-ۿ]/.test(text) || ARABIC_FONTS.has(wanted)) return wanted;
  if (ARABIC_FONTS.has(current)) return current;
  return weight >= 600 ? "Cairo" : "IBM Plex Sans Arabic";
}

/**
 * Settings a text box needs when its words change script: right-to-left
 * direction, mirrored left/right alignment and (for Arabic) a font that has
 * Arabic letters. Returns an empty patch when nothing needs to change.
 */
export function directionPatch(
  element: Pick<TextElement, "direction" | "align" | "fontFamily" | "fontWeight">,
  text: string,
): Partial<TextElement> {
  const direction = detectDirection(text);
  const patch: Partial<TextElement> = {};
  if (direction && direction !== element.direction) {
    patch.direction = direction;
    if (element.align === "left" || element.align === "right") {
      patch.align = direction === "rtl" ? "right" : "left";
    }
  }
  const arabic = direction === "rtl" && /[؀-ۿ]/.test(text);
  if (arabic && !ARABIC_FONTS.has(element.fontFamily)) {
    patch.fontFamily = element.fontWeight >= 600 ? "Cairo" : "IBM Plex Sans Arabic";
  }
  return patch;
}
