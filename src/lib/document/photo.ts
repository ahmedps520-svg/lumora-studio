/**
 * Photo helpers: cropping, and moving a photo into (or out of) the page
 * background. Pure functions over the scene graph.
 */
import { createId } from "@/lib/id";
import { ElementSchema, type Background, type ImageElement, type ElementInput } from "@/lib/schema";

type Size = { width: number; height: number };
export type Crop = NonNullable<ImageElement["crop"]>;

const round = (n: number) => Math.round(n * 100) / 100;

/** The largest centred part of an image with the same shape as `box`. */
export function coverCrop(natural: Size, box: Size): Crop {
  const scale = Math.max(box.width / natural.width, box.height / natural.height);
  const width = Math.min(natural.width, box.width / scale);
  const height = Math.min(natural.height, box.height / scale);
  return {
    x: round((natural.width - width) / 2),
    y: round((natural.height - height) / 2),
    width: round(width),
    height: round(height),
  };
}

/** Keeps a crop inside the image and at least 8 px in each direction. */
export function clampCrop(crop: Crop, natural: Size): Crop {
  const width = Math.min(natural.width, Math.max(8, crop.width));
  const height = Math.min(natural.height, Math.max(8, crop.height));
  return {
    x: round(Math.min(Math.max(0, crop.x), natural.width - width)),
    y: round(Math.min(Math.max(0, crop.y), natural.height - height)),
    width: round(width),
    height: round(height),
  };
}

/**
 * The element change for a new crop: the photo keeps its zoom level (pixels
 * per source pixel) and its centre, so only the visible part changes.
 */
export function cropPatch(
  el: ImageElement,
  crop: Crop | null,
  natural: Size,
): Partial<ImageElement> {
  const current = el.crop ?? { x: 0, y: 0, width: natural.width, height: natural.height };
  const next = crop ?? { x: 0, y: 0, width: natural.width, height: natural.height };
  const scale = el.width / current.width;
  const width = round(next.width * scale);
  const height = round(next.height * scale);
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const full =
    next.x === 0 && next.y === 0 && next.width === natural.width && next.height === natural.height;
  return {
    crop: full ? null : next,
    width,
    height,
    x: round(cx - width / 2),
    y: round(cy - height / 2),
  };
}

/** A photo as a page background (it fills the page). */
export function imageToBackground(el: ImageElement): Background {
  return { type: "image", src: el.src, fit: "cover", opacity: el.opacity, tint: null };
}

/** A background photo as a normal element covering the page. */
export function backgroundToImage(
  background: Extract<Background, { type: "image" }>,
  natural: Size,
  format: Size,
): ImageElement {
  return ElementSchema.parse({
    id: createId(),
    type: "image",
    name: "",
    src: background.src,
    x: 0,
    y: 0,
    width: format.width,
    height: format.height,
    opacity: background.opacity,
    crop: coverCrop(natural, format),
  } as ElementInput) as ImageElement;
}

/**
 * The part of a photo a frame shows: the photo covers the frame (× `scale`),
 * moved by `offset` px (in frame space) from centred.
 */
export function frameCrop(
  natural: Size,
  frame: Size,
  image: { scale: number; offsetX: number; offsetY: number },
): Crop {
  const s =
    Math.max(frame.width / natural.width, frame.height / natural.height) * Math.max(1, image.scale);
  const width = Math.min(natural.width, frame.width / s);
  const height = Math.min(natural.height, frame.height / s);
  const cx = natural.width / 2 - image.offsetX / s;
  const cy = natural.height / 2 - image.offsetY / s;
  return clampCrop({ x: cx - width / 2, y: cy - height / 2, width, height }, natural);
}
