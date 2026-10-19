/**
 * Off-screen rendering of a page (Magic Design previews, thumbnails and every
 * download format). Browser only.
 */
import { StaticCanvas, type FabricObject } from "fabric";
import { fontFaces } from "@/lib/document/fonts";
import { loadFont } from "@/lib/fonts/loader";
import type { Background, Element } from "@/lib/schema";
import { PageBackground } from "./background";
import { createObject, whenImagesLoaded } from "./mapping";

export { backgroundFill } from "./background";

type Size = { width: number; height: number };
type PageContent = { background: Background; elements: Element[] };

/** The page background as a canvas object covering the whole page. */
export function createBackground(background: Background, format: Size): PageBackground {
  const { width, height } = format;
  const object = new PageBackground({
    left: width / 2,
    top: height / 2,
    width,
    height,
    strokeWidth: 0,
    objectCaching: false,
  });
  object.setBackground(background);
  return object;
}

/** Loads every font face the elements use (gives up after `timeoutMs`). */
export async function ensureFonts(elements: Element[], timeoutMs = 4_000): Promise<void> {
  const loading = fontFaces(elements).map((f) => loadFont(f.family, f.weight, f.italic));
  await Promise.race([
    Promise.allSettled(loading),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Every object of a page, bottom → top, with fonts and images ready. */
export async function buildPageObjects(
  content: PageContent,
  format: Size,
  options: { transparent?: boolean } = {},
): Promise<FabricObject[]> {
  await ensureFonts(content.elements);
  const objects = content.elements.filter((el) => el.visible).map(createObject);
  const background = options.transparent ? null : createBackground(content.background, format);
  await Promise.race([
    Promise.all([...objects.map(whenImagesLoaded), background?.ready]),
    new Promise((resolve) => setTimeout(resolve, 8_000)),
  ]);
  return background ? [background, ...objects] : objects;
}

/** Largest side we render at (browsers refuse much bigger canvases). */
export const MAX_RENDER_SIDE = 12_000;

/** Clamps an export scale so neither side goes past `MAX_RENDER_SIDE`. */
export function clampScale(format: Size, scale: number): number {
  return Math.max(0.01, Math.min(scale, MAX_RENDER_SIDE / Math.max(format.width, format.height)));
}

/** Renders a page into a plain canvas at `scale` × its design size. */
export async function renderPageToCanvas(
  content: PageContent,
  format: Size,
  options: { scale?: number; transparent?: boolean } = {},
): Promise<HTMLCanvasElement> {
  const scale = clampScale(format, options.scale ?? 1);
  const width = Math.max(1, Math.round(format.width * scale));
  const height = Math.max(1, Math.round(format.height * scale));
  const objects = await buildPageObjects(content, format, options);
  const canvas = new StaticCanvas(document.createElement("canvas"), {
    width,
    height,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    canvas.setZoom(scale);
    canvas.add(...objects);
    canvas.renderAll();
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    out.getContext("2d")!.drawImage(canvas.getElement(), 0, 0);
    return out;
  } finally {
    void canvas.dispose();
  }
}

export async function renderPageToDataUrl(
  content: PageContent,
  format: Size,
  options: { maxSize?: number; mimeType?: "jpeg" | "png"; quality?: number } = {},
): Promise<string> {
  const scale = Math.min(1, (options.maxSize ?? 480) / Math.max(format.width, format.height));
  const canvas = await renderPageToCanvas(content, format, { scale });
  return canvas.toDataURL(`image/${options.mimeType ?? "jpeg"}`, options.quality ?? 0.86);
}

/** The page as a standalone SVG document (text stays text). */
export async function renderPageToSvg(
  content: PageContent,
  format: Size,
  options: { transparent?: boolean } = {},
): Promise<string> {
  const objects = await buildPageObjects(content, format, options);
  const canvas = new StaticCanvas(document.createElement("canvas"), {
    width: format.width,
    height: format.height,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    canvas.add(...objects);
    return canvas.toSVG({ width: `${format.width}px`, height: `${format.height}px` });
  } finally {
    void canvas.dispose();
  }
}
