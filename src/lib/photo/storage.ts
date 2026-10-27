"use client";
/**
 * Saving and opening photo documents in the browser (IndexedDB), and making
 * new ones from a blank canvas or an image file.
 */
import { createId } from "@/lib/id";
import { getDb, type PhotoRecord } from "@/lib/storage/db";
import {
  copyCanvas,
  createCanvas,
  ctx2d,
  flatten,
  getPixels,
  refreshLayer,
  setPixels,
  clearRegistry,
} from "./runtime";
import { DEFAULT_STYLES, MAX_SIDE, type Layer, type PhotoDoc, withDefaultStyles } from "./types";

/** A new layer with default settings; `extra` supplies the kind's own settings. */
export function newLayer<K extends Layer["kind"]>(
  kind: K,
  name: string,
  extra: Partial<Extract<Layer, { kind: K }>> = {},
): Extract<Layer, { kind: K }> {
  return {
    id: createId(),
    name,
    kind,
    visible: true,
    opacity: 1,
    fillOpacity: 1,
    blend: "normal",
    locks: { transparency: false, pixels: false, position: false, all: false },
    clip: false,
    mask: null,
    styles: structuredClone(DEFAULT_STYLES),
    x: 0,
    y: 0,
    ...extra,
  } as unknown as Extract<Layer, { kind: K }>;
}

export function blankDoc(
  name: string,
  width: number,
  height: number,
  background: string | null,
): PhotoDoc {
  const w = Math.min(MAX_SIDE, Math.max(1, Math.round(width)));
  const h = Math.min(MAX_SIDE, Math.max(1, Math.round(height)));
  const layer = newLayer("pixel", background ? "Background" : "Layer 1", {});
  const canvas = createCanvas(w, h);
  if (background) {
    const g = ctx2d(canvas);
    g.fillStyle = background;
    g.fillRect(0, 0, w, h);
  }
  setPixels(layer.id, { canvas, mask: null });
  return {
    id: createId(),
    name,
    width: w,
    height: h,
    layers: [layer],
    resolution: 72,
    guides: { horizontal: [], vertical: [] },
    grayscale: false,
    paths: [],
  };
}

/** Decodes an image file into a canvas, scaled down if it's bigger than we support. */
export async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const c = createCanvas(bitmap.width * k, bitmap.height * k);
  ctx2d(c).drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

export async function docFromFile(file: File): Promise<PhotoDoc> {
  const canvas = await fileToCanvas(file);
  const name = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Photo";
  const layer = newLayer("pixel", "Background", {});
  setPixels(layer.id, { canvas, mask: null });
  return {
    id: createId(),
    name,
    width: canvas.width,
    height: canvas.height,
    layers: [layer],
    resolution: 72,
    guides: { horizontal: [], vertical: [] },
    grayscale: false,
    paths: [],
  };
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), "image/png"));

function thumbnail(doc: PhotoDoc): string {
  const flat = flatten(doc, "#FFFFFF");
  const k = Math.min(1, 320 / Math.max(doc.width, doc.height));
  const t = createCanvas(doc.width * k, doc.height * k);
  const g = ctx2d(t);
  g.imageSmoothingQuality = "high";
  g.drawImage(flat, 0, 0, t.width, t.height);
  return t.toDataURL("image/jpeg", 0.8);
}

export function savePhoto(doc: PhotoDoc, createdAt?: string): Promise<void> {
  return prepareSave(doc, { createdAt })().then(() => undefined);
}

export type LayerBlobs = Map<string, { content: Blob | null; mask: Blob | null }>;

/**
 * Copies everything a save needs right now (the editor may close and clear
 * the registry before the PNGs are encoded) and returns the writer. Layers
 * that didn't change reuse their PNGs from `reuse`; the thumbnail is only
 * redrawn when asked (it renders the whole picture).
 */
export function prepareSave(
  doc: PhotoDoc,
  opts: {
    createdAt?: string;
    reuse?: LayerBlobs;
    changed?: Set<string> | "all";
    thumbnail?: boolean;
  } = {},
): () => Promise<LayerBlobs> {
  const snapshotDoc = structuredClone(doc);
  const layers = doc.layers.map((layer) => {
    const kept = opts.reuse?.get(layer.id);
    if (kept && opts.changed && opts.changed !== "all" && !opts.changed.has(layer.id))
      return { id: layer.id, kept, content: null, mask: null };
    const p = getPixels(layer.id);
    return {
      id: layer.id,
      kept: null,
      content: layer.kind === "pixel" ? copyCanvas(p.canvas) : null,
      mask: p.mask ? copyCanvas(p.mask) : null,
    };
  });
  const thumb = opts.thumbnail === false ? null : thumbnail(doc);
  return () => writeSave(snapshotDoc, layers, thumb, opts.createdAt);
}

async function writeSave(
  doc: PhotoDoc,
  layers: {
    id: string;
    kept: { content: Blob | null; mask: Blob | null } | null;
    content: HTMLCanvasElement | null;
    mask: HTMLCanvasElement | null;
  }[],
  thumb: string | null,
  createdAt?: string,
): Promise<LayerBlobs> {
  const pixels: Record<string, { content: Blob | null; mask: Blob | null }> = {};
  for (const l of layers) {
    pixels[l.id] = l.kept ?? {
      content: l.content ? await toBlob(l.content) : null,
      mask: l.mask ? await toBlob(l.mask) : null,
    };
  }
  const now = new Date().toISOString();
  const db = getDb();
  const existing = await db.photos.get(doc.id);
  const record: PhotoRecord = {
    id: doc.id,
    name: doc.name,
    createdAt: existing?.createdAt ?? createdAt ?? now,
    updatedAt: now,
    width: doc.width,
    height: doc.height,
    layerCount: doc.layers.length,
    thumbnail: thumb ?? existing?.thumbnail ?? null,
    deletedAt: null,
  };
  await db.transaction("rw", db.photos, db.photoData, async () => {
    await db.photos.put(record);
    await db.photoData.put({ id: doc.id, doc, pixels });
  });
  return new Map(Object.entries(pixels));
}

/** The PNGs a document was opened with (so the first save can reuse them). */
let opened: { id: string; blobs: LayerBlobs } | null = null;
export const openedBlobs = (id: string): LayerBlobs =>
  opened?.id === id ? new Map(opened.blobs) : new Map();

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const c = createCanvas(bitmap.width, bitmap.height);
  ctx2d(c).drawImage(bitmap, 0, 0);
  bitmap.close();
  return c;
}

export async function loadPhoto(id: string): Promise<PhotoDoc | null> {
  const record = await getDb().photoData.get(id);
  if (!record) return null;
  const doc = record.doc as PhotoDoc;
  // Documents saved by older versions lack newer settings.
  doc.paths ??= [];
  for (const l of doc.layers) l.styles = withDefaultStyles(l.styles);
  opened = { id, blobs: new Map(Object.entries(record.pixels)) };
  clearRegistry();
  for (const layer of doc.layers) {
    const stored = record.pixels[layer.id];
    const canvas = stored?.content ? await blobToCanvas(stored.content) : createCanvas(1, 1);
    const mask = stored?.mask ? await blobToCanvas(stored.mask) : null;
    setPixels(layer.id, { canvas, mask });
    refreshLayer(layer, doc);
  }
  return doc;
}

export const listPhotos = () =>
  getDb()
    .photos.orderBy("updatedAt")
    .reverse()
    .filter((p) => !p.deletedAt)
    .toArray();

export async function deletePhoto(id: string) {
  const db = getDb();
  await db.transaction("rw", db.photos, db.photoData, async () => {
    await db.photos.delete(id);
    await db.photoData.delete(id);
  });
}

export { copyCanvas };

/** Moves a photo to the trash (hidden from the list; can be restored). */
export const trashPhoto = (id: string) =>
  getDb().photos.update(id, { deletedAt: new Date().toISOString() });
export const restorePhoto = (id: string) => getDb().photos.update(id, { deletedAt: null });
