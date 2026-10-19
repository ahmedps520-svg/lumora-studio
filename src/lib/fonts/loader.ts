/**
 * Loads Google Fonts on demand so the canvas can draw any family by its real name.
 * Each family is fetched once; callers await `loadFont` before measuring text.
 */

const SYSTEM_FONTS = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "system-ui",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
]);

const loaded = new Map<string, Promise<boolean>>();
const listeners = new Set<(family: string) => void>();

const FAMILY_PATTERN = /^[A-Za-z0-9 ]{1,60}$/;

const ALL_STYLES = [100, 200, 300, 400, 500, 600, 700, 800, 900]
  .flatMap((w) => [`${w}`, `${w}italic`])
  .join(",");

/**
 * Stylesheet URL asking for every weight, upright and italic. We use the
 * classic `css` endpoint on purpose: it returns whichever of those styles the
 * family actually has, whereas `css2` rejects the whole request (HTTP 400) if
 * any requested axis value is missing (e.g. Cairo has no italic, Sora stops at 800).
 * Browsers only download the faces that are actually used.
 */
export function googleFontsCssUrl(family: string): string {
  const name = family.trim().replace(/ /g, "+");
  return `https://fonts.googleapis.com/css?family=${name}:${ALL_STYLES}&display=swap`;
}

function injectStylesheet(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Could not load ${href}`));
    document.head.appendChild(link);
  });
}

/** Whether a family comes from Google Fonts (not a built-in system font). */
export function isWebFont(family: string): boolean {
  return !SYSTEM_FONTS.has(family) && FAMILY_PATTERN.test(family);
}

/** Loads a font family (all weights) and resolves true when the given face is ready. */
export function loadFont(family: string, weight = 400, italic = false): Promise<boolean> {
  if (typeof document === "undefined" || SYSTEM_FONTS.has(family) || !FAMILY_PATTERN.test(family)) {
    return Promise.resolve(true);
  }
  const key = `${family}|${weight}|${italic}`;
  const existing = loaded.get(key);
  if (existing) return existing;

  const sheetKey = `${family}|sheet`;
  let sheet = loaded.get(sheetKey);
  if (!sheet) {
    sheet = injectStylesheet(googleFontsCssUrl(family)).then(
      () => true,
      () => false,
    );
    loaded.set(sheetKey, sheet);
  }

  const promise = sheet.then(async (ok) => {
    if (!ok) return false;
    try {
      // Google Fonts split each family by script; ask for Latin *and* Arabic
      // letters so both parts load (otherwise Arabic is measured with a
      // fallback font and wraps wrongly until its glyphs arrive).
      const faces = await document.fonts.load(
        `${italic ? "italic " : ""}${weight} 32px "${family}"`,
        "Aa0 أبجد",
      );
      const ready = faces.length > 0;
      if (ready) listeners.forEach((fn) => fn(family));
      return ready;
    } catch {
      return false;
    }
  });
  loaded.set(key, promise);
  return promise;
}

/** Notified whenever a new font face finishes loading (used to re-measure text). */
export function onFontLoaded(listener: (family: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
