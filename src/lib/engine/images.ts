/**
 * Loads the pixels behind an image `src` (`asset:<id>`, data URL or https URL)
 * into an <img> Fabric can draw. Each distinct src is loaded once.
 */
import { assetIdFromSrc, assetUrl } from "@/lib/storage/assets";

const cache = new Map<string, Promise<HTMLImageElement>>();
const ready = new Map<string, HTMLImageElement>();

/** The image for `src` if it has already finished loading (lets objects skip the placeholder). */
export const loadedImage = (src: string): HTMLImageElement | undefined => ready.get(src);

async function resolveUrl(src: string): Promise<string> {
  const assetId = assetIdFromSrc(src);
  if (!assetId) return src;
  const url = await assetUrl(assetId);
  if (!url) throw new Error(`Missing image asset ${assetId}`);
  return url;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  let promise = cache.get(src);
  if (!promise) {
    promise = resolveUrl(src).then(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          // Remote images must allow CORS so exports don't "taint" the canvas.
          if (url.startsWith("https:")) img.crossOrigin = "anonymous";
          img.decoding = "async";
          img.onload = () => {
            ready.set(src, img);
            resolve(img);
          };
          img.onerror = () => reject(new Error("Image failed to load"));
          img.src = url;
        }),
    );
    // Don't cache failures — the asset may appear later (e.g. still importing).
    promise.catch(() => cache.delete(src));
    cache.set(src, promise);
  }
  return promise;
}

/** A tiny light-grey canvas shown while (or if) the real image can't load. */
export function placeholderSource(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#E2E8F0";
    ctx.fillRect(0, 0, 1, 1);
  }
  return canvas;
}
