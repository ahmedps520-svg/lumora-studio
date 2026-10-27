"use client";
/**
 * Generative Fill: sends the area around the selection (with the selection
 * painted magenta) to the server, then lays the answer on a new layer masked
 * to the selection, so the original pixels stay untouched underneath.
 */
import { aiPhotoFill } from "@/lib/ai/api";
import { PHOTO_FILL_MAX_SIDE } from "@/lib/ai/photo-fill";
import { addPictureLayer, selectionCanvas } from "./actions";
import { createCanvas, ctx2d, flatten } from "./runtime";
import { feather, maskBounds } from "./selection";
import { get, set } from "./store";

/** The part of the document sent as context: the selection plus a margin. */
export function fillRegion(
  bounds: { x: number; y: number; width: number; height: number },
  docW: number,
  docH: number,
) {
  const pad = Math.round(Math.max(48, Math.max(bounds.width, bounds.height) * 0.5));
  const x = Math.max(0, bounds.x - pad);
  const y = Math.max(0, bounds.y - pad);
  const w = Math.min(docW, bounds.x + bounds.width + pad) - x;
  const h = Math.min(docH, bounds.y + bounds.height + pad) - y;
  return { x, y, width: Math.max(16, w), height: Math.max(16, h) };
}

function dataUrlToBlob(url: string): Blob {
  const [head = "", body = ""] = url.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/png";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function generativeFill(prompt: string, signal?: AbortSignal) {
  const s = get();
  const doc = s.doc;
  const selection = s.selection;
  if (!doc || !selection) return;
  const bounds = maskBounds(selection);
  if (!bounds) return;
  const region = fillRegion(bounds, doc.width, doc.height);
  const k = Math.min(1, PHOTO_FILL_MAX_SIDE / Math.max(region.width, region.height));
  const sw = Math.max(16, Math.round(region.width * k));
  const sh = Math.max(16, Math.round(region.height * k));

  // Context picture with the hole painted magenta.
  const flat = flatten(doc, "#FFFFFF");
  const ctxCanvas = createCanvas(sw, sh);
  const g = ctx2d(ctxCanvas);
  g.imageSmoothingQuality = "high";
  g.drawImage(flat, region.x, region.y, region.width, region.height, 0, 0, sw, sh);
  const hole = selectionCanvas(selection);
  const hg = ctx2d(hole);
  hg.globalCompositeOperation = "source-in";
  hg.fillStyle = "#FF00FF";
  hg.fillRect(0, 0, hole.width, hole.height);
  g.drawImage(hole, region.x, region.y, region.width, region.height, 0, 0, sw, sh);

  set({ busy: "generativeFill" });
  try {
    const result = await aiPhotoFill(
      { prompt, image: ctxCanvas.toDataURL("image/jpeg", 0.92), width: sw, height: sh },
      signal,
    );
    const bitmap = await createImageBitmap(dataUrlToBlob(result.image));
    const piece = createCanvas(region.width, region.height);
    const pg = ctx2d(piece);
    pg.imageSmoothingQuality = "high";
    pg.drawImage(bitmap, 0, 0, region.width, region.height);
    bitmap.close();
    // Soft-edged mask from the selection, in document coordinates.
    const mask = selectionCanvas(feather(selection, 2));
    addPictureLayer(piece, region.x, region.y, prompt || "Generative fill", mask);
  } finally {
    set({ busy: null });
  }
}
