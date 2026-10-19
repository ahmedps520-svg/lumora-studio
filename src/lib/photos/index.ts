/**
 * Built-in stock photos (see `library.ts`): lookup by topic, image URLs at the
 * size they're shown, and the credit each photo carries.
 */
import { PHOTO_LIBRARY, type PhotoTopic } from "./library";

export { PHOTO_LIBRARY, type PhotoTopic };

export interface StockPhoto {
  /** Unsplash photo id (the part after "photo-" in its image URL). */
  id: string;
  /** The photographer's Unsplash username. */
  author: string;
  topic: PhotoTopic;
}

export const PHOTO_TOPICS = Object.keys(PHOTO_LIBRARY) as PhotoTopic[];

/** Portraits for avatars, team slides and speaker cards. */
export const PEOPLE_TOPICS: PhotoTopic[] = [
  "smiling-woman-portrait",
  "man-portrait",
  "business-portrait",
  "professional-headshot",
];

const parsed = new Map<PhotoTopic, StockPhoto[]>();

export function topicPhotos(topic: PhotoTopic): StockPhoto[] {
  let list = parsed.get(topic);
  if (!list) {
    list = PHOTO_LIBRARY[topic].split(" ").map((entry) => {
      const [id, author] = entry.split("@") as [string, string];
      return { id, author, topic };
    });
    parsed.set(topic, list);
  }
  return list;
}

/** Every photo once (some appear under more than one topic). */
export function allPhotos(): StockPhoto[] {
  const seen = new Set<string>();
  const out: StockPhoto[] = [];
  for (const topic of PHOTO_TOPICS)
    for (const photo of topicPhotos(topic)) {
      if (seen.has(photo.id)) continue;
      seen.add(photo.id);
      out.push(photo);
    }
  return out;
}

const HOST = "https://images.unsplash.com/";
const WIDTHS = [200, 400, 800, 1200, 1600, 2400];

/** The photo's image URL, `width` pixels wide (rounded up to a few cached sizes). */
export function photoUrl(id: string, width = 1200): string {
  const w = WIDTHS.find((v) => v >= width) ?? WIDTHS[WIDTHS.length - 1]!;
  return `${HOST}photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
}

/** Width to load so a photo of unknown shape still covers a `w` × `h` box. */
export function coverWidth(w: number, h: number): number {
  return Math.max(w, h * 1.5);
}

/** The same built-in photo at another width (other image URLs come back unchanged). */
export function resizePhotoUrl(src: string, width: number): string {
  const id = stockPhotoId(src);
  return id ? photoUrl(id, width) : src;
}

/** The Unsplash photo id behind a built-in photo URL, or null. */
export function stockPhotoId(src: string): string | null {
  if (!src.startsWith(HOST)) return null;
  return /^photo-([A-Za-z0-9-]+)/.exec(src.slice(HOST.length))?.[1] ?? null;
}

const UTM = "utm_source=lumora_studio&utm_medium=referral";

/** Unsplash's home page (credited under the Photos panel). */
export const UNSPLASH_URL = `https://unsplash.com/?${UTM}`;

/** The photographer's Unsplash profile (where credits link to). */
export const authorUrl = (author: string) => `https://unsplash.com/@${author}?${UTM}`;

export function photoAttribution(photo: Pick<StockPhoto, "author">) {
  return { provider: "unsplash" as const, author: photo.author, url: authorUrl(photo.author) };
}

/** Topics whose name (in either language) or slug matches a search. */
export function searchTopics(query: string, labels: (topic: PhotoTopic) => string): PhotoTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return PHOTO_TOPICS.filter((topic) => {
    const hay = `${topic.replaceAll("-", " ")} ${labels(topic)}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

interface PhotoHolder {
  type: string;
  width: number;
  height: number;
  src?: string;
  image?: { src: string } | null;
  children?: PhotoHolder[];
}

/**
 * The elements with built-in photos loaded at `scale` × their size (small
 * previews don't need full-size photos). Returns new objects; others unchanged.
 */
export function scalePhotos<T extends PhotoHolder>(elements: T[], scale: number): T[] {
  return elements.map((el) => {
    const width = coverWidth(el.width, el.height) * scale;
    if (el.type === "frame" && el.image)
      return { ...el, image: { ...el.image, src: resizePhotoUrl(el.image.src, width) } };
    if (el.type === "image" && el.src) return { ...el, src: resizePhotoUrl(el.src, width) };
    if (el.type === "group" && el.children)
      return { ...el, children: scalePhotos(el.children, scale) };
    return el;
  });
}
