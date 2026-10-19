/**
 * SVG graphics (icons, illustrations): find their colours, recolour them, and
 * turn them into an image URL the canvas can draw crisply at any size.
 * They're drawn as images, so scripts or links inside can never run.
 */

const COLOR_ATTR = /\b(fill|stroke|stop-color)\s*=\s*"([^"]+)"/gi;
const COLOR_STYLE = /\b(fill|stroke|stop-color)\s*:\s*([^;"']+)/gi;
const SKIP = new Set(["none", "transparent", "inherit"]);

const normalize = (value: string) => {
  const v = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(v))
    return `#${[...v.slice(1)].map((c) => c + c).join("")}`.toUpperCase();
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) return v.toUpperCase();
  return v.toLowerCase() === "currentcolor" ? "currentColor" : v;
};

/** The distinct colours an SVG paints with (in order of appearance). */
export function svgColors(svg: string): string[] {
  const found = new Set<string>();
  for (const re of [COLOR_ATTR, COLOR_STYLE]) {
    re.lastIndex = 0;
    for (const match of svg.matchAll(re)) {
      const value = normalize(match[2]!);
      if (!SKIP.has(value.toLowerCase()) && !value.startsWith("url(")) found.add(value);
    }
  }
  return [...found];
}

/** Swaps colours according to `colorMap` (original → replacement). */
export function recolorSvg(svg: string, colorMap: Record<string, string>): string {
  if (Object.keys(colorMap).length === 0) return svg;
  const swap = (whole: string, prop: string, value: string, sep: string) => {
    const replacement = colorMap[normalize(value)];
    return replacement ? `${prop}${sep}${replacement}` : whole;
  };
  return svg
    .replace(COLOR_ATTR, (whole, prop: string, value: string) => {
      const replacement = colorMap[normalize(value)];
      return replacement ? `${prop}="${replacement}"` : whole;
    })
    .replace(COLOR_STYLE, (whole, prop: string, value: string) => swap(whole, prop, value, ":"));
}

/** Natural size from width/height, else from the view box (default 100×100). */
export function svgSize(svg: string): { width: number; height: number } {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const num = (name: string) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([\\d.]+)(px)?"`, "i").exec(root);
    return m ? Number(m[1]) : null;
  };
  const viewBox = /\bviewBox\s*=\s*"([^"]+)"/i
    .exec(root)?.[1]
    ?.split(/[\s,]+/)
    .map(Number);
  const vbW = viewBox && viewBox.length === 4 ? viewBox[2]! : null;
  const vbH = viewBox && viewBox.length === 4 ? viewBox[3]! : null;
  return { width: num("width") ?? vbW ?? 100, height: num("height") ?? vbH ?? 100 };
}

/**
 * A data URL for drawing the SVG. The root gets an explicit size (so the
 * browser knows its shape) and `currentColor` defaults to black.
 */
export function svgDataUrl(svg: string, colorMap: Record<string, string> = {}): string {
  const { width, height } = svgSize(svg);
  let markup = recolorSvg(svg, { currentColor: "#000000", ...colorMap });
  markup = markup.replace(/<svg\b([^>]*)>/i, (_whole, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height)\s*=\s*"[^"]*"/gi, "");
    const ns = /\bxmlns\s*=/.test(cleaned) ? "" : ' xmlns="http://www.w3.org/2000/svg"';
    return `<svg${cleaned}${ns} width="${width}" height="${height}">`;
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

/** Mixes a hex colour towards black (k < 0) or white (k > 0). */
function shade(hex: string, k: number): string {
  const h = hex.replace("#", "").slice(0, 6);
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  const mix = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

/**
 * What an empty photo frame shows: a soft gradient in its colour with a small
 * landscape glyph in the middle ("a photo goes here").
 */
export function framePlaceholderUrl(color: string): string {
  const base = /^#[0-9a-f]{3,8}$/i.test(color) ? color.slice(0, 7) : "#E2E8F0";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${shade(base, 0.18)}"/><stop offset="1" stop-color="${shade(base, -0.1)}"/>` +
    `</linearGradient></defs><rect width="600" height="600" fill="url(#g)"/>` +
    `<g fill="#FFFFFF" fill-opacity="0.7"><circle cx="330" cy="268" r="17"/>` +
    `<path d="M240 345 L282 292 L310 326 L333 302 L364 345 Z"/></g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
