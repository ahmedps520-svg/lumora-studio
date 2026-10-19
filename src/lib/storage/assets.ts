/**
 * Uploaded images. Files are stored as Blobs in IndexedDB (never uploaded to a
 * server) and referenced from designs as `asset:<id>`.
 */
import { createId } from "@/lib/id";
import { getDb, type AssetRecord } from "./db";

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Bigger images are scaled down on import (keeps storage and the canvas fast). */
export const MAX_IMAGE_SIDE = 4096;

export type AssetErrorCode = "type" | "size" | "decode" | "storage";

export class AssetError extends Error {
  constructor(readonly code: AssetErrorCode) {
    super(`Image import failed: ${code}`);
    this.name = "AssetError";
  }
}

export interface DecodedImage {
  width: number;
  height: number;
  /** Re-encodes the image at a smaller size (only called when it is too big). */
  resize: (width: number, height: number, type: string) => Promise<Blob>;
  close: () => void;
}

/** Decodes an image in the browser. Swappable in tests (jsdom can't decode images). */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(blob);
  return {
    width: bitmap.width,
    height: bitmap.height,
    resize: async (width, height, type) => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2D context");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);
      return canvas.convertToBlob({ type, quality: 0.92 });
    },
    close: () => bitmap.close(),
  };
}

const baseName = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 120);

/** Validates, (if needed) shrinks and stores an image. */
export async function importImage(
  file: Blob,
  options: { name?: string; decode?: (blob: Blob) => Promise<DecodedImage> } = {},
): Promise<AssetRecord> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new AssetError("type");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new AssetError("size");

  let decoded: DecodedImage;
  try {
    decoded = await (options.decode ?? decodeImage)(file);
  } catch {
    throw new AssetError("decode");
  }
  let blob = file;
  let { width, height } = decoded;
  try {
    if (width < 1 || height < 1) throw new AssetError("decode");
    const longest = Math.max(width, height);
    if (longest > MAX_IMAGE_SIDE) {
      const k = MAX_IMAGE_SIDE / longest;
      width = Math.max(1, Math.round(width * k));
      height = Math.max(1, Math.round(height * k));
      // PNG keeps transparency; photos become WebP.
      const type = file.type === "image/jpeg" ? "image/webp" : "image/png";
      blob = await decoded.resize(width, height, type);
    }
  } catch (error) {
    throw error instanceof AssetError ? error : new AssetError("decode");
  } finally {
    decoded.close();
  }

  const record: AssetRecord = {
    id: createId(),
    blob,
    mime: blob.type || file.type,
    name: baseName(options.name ?? (file instanceof File ? file.name : "")) || "Image",
    width,
    height,
    size: blob.size,
    createdAt: new Date().toISOString(),
  };
  try {
    await getDb().assets.add(record);
  } catch {
    throw new AssetError("storage");
  }
  return record;
}

export async function getAsset(id: string): Promise<AssetRecord | undefined> {
  return getDb().assets.get(id);
}

export async function listAssets(limit = 300): Promise<AssetRecord[]> {
  return getDb().assets.orderBy("createdAt").reverse().limit(limit).toArray();
}

export async function deleteAsset(id: string): Promise<void> {
  await getDb().assets.delete(id);
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
}

// ─── Object URLs (one per asset, reused everywhere) ─────────────────────────

const objectUrls = new Map<string, string>();

export function assetObjectUrl(record: Pick<AssetRecord, "id" | "blob">): string {
  let url = objectUrls.get(record.id);
  if (!url) {
    url = URL.createObjectURL(record.blob);
    objectUrls.set(record.id, url);
  }
  return url;
}

/** URL for `asset:<id>`; null when the asset no longer exists. */
export async function assetUrl(id: string): Promise<string | null> {
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const record = await getAsset(id);
  return record ? assetObjectUrl(record) : null;
}

export const assetIdFromSrc = (src: string): string | null =>
  src.startsWith("asset:") ? src.slice("asset:".length) : null;
