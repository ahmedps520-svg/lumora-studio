/**
 * Lumora's built-in templates: tens of thousands of designs generated from
 * layouts × themes × palettes × fonts, in English and Arabic. Every template
 * becomes ordinary, fully editable elements. Most of the library loads on
 * demand (see ./library.ts).
 */
import { buildTemplate, kindFormat, templateName, type BuiltTemplate } from "./build";
import { catalog, getTemplateDef } from "./catalog";
import { LIBRARY_SIZE, libraryLoaded, loadTemplateLibrary, subscribeLibrary } from "./library";
import { getTheme } from "./content";
import { FONT_PAIRS, type FontPair } from "./fonts";
import { PALETTES, swatches, type Palette } from "./palettes";
import {
  TEMPLATE_KINDS,
  THEME_CATEGORIES,
  type TemplateDef,
  type TemplateKind,
  type TemplateLocale,
} from "./types";

export {
  buildTemplate,
  catalog,
  getTemplateDef,
  kindFormat,
  LIBRARY_SIZE,
  libraryLoaded,
  loadTemplateLibrary,
  subscribeLibrary,
  templateName,
  TEMPLATE_KINDS,
  THEME_CATEGORIES,
};
export type { BuiltTemplate, TemplateDef, TemplateKind, TemplateLocale };

/** Shape families: templates are offered for any design of the same family. */
export type ShapeFamily = "square" | "portrait" | "tall" | "landscape" | "wide";

export function shapeFamily(width: number, height: number): ShapeFamily {
  const r = height / width;
  if (r > 1.6) return "tall";
  if (r > 1.12) return "portrait";
  if (r >= 0.9) return "square";
  if (r >= 0.42) return "landscape";
  return "wide";
}

const families = new Map<TemplateKind, ShapeFamily>();
export function kindFamily(kind: TemplateKind): ShapeFamily {
  let family = families.get(kind);
  if (!family) {
    const f = kindFormat(kind);
    family = shapeFamily(f.width, f.height);
    families.set(kind, family);
  }
  return family;
}

/** Templates that fit a design of this size (best matches — same kind — first). */
export function templatesForSize(
  width: number,
  height: number,
  presetId?: string | null,
  defs: TemplateDef[] = catalog(),
): TemplateDef[] {
  const family = shapeFamily(width, height);
  const all = defs.filter((d) => kindFamily(d.kind) === family);
  return [...all.filter((d) => d.kind === presetId), ...all.filter((d) => d.kind !== presetId)];
}

/** A stable pseudo-random number for an id (for mixing without reshuffling on every visit). */
function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A varied order for browsing: themes mixed within each kind, and (unless
 * `byKind`) the kinds taken in turn.
 */
export function mixKinds(defs: TemplateDef[], byKind = false): TemplateDef[] {
  const hashes = new Map(defs.map((d) => [d, idHash(d.id)]));
  const mixed = [...defs].sort((a, b) => hashes.get(a)! - hashes.get(b)!);
  if (byKind) return mixed;
  const groups = new Map<string, TemplateDef[]>();
  for (const d of mixed) {
    const list = groups.get(d.kind);
    if (list) list.push(d);
    else groups.set(d.kind, [d]);
  }
  const lists = [...groups.values()];
  const out: TemplateDef[] = [];
  for (let i = 0; out.length < defs.length; i++)
    for (const list of lists) if (i < list.length) out.push(list[i]!);
  return out;
}

/** The searchable words of a theme (computed once; the catalogue is large). */
const haystacks = new Map<string, string>();
function haystack(themeId: string): string {
  let hay = haystacks.get(themeId);
  if (hay === undefined) {
    const theme = getTheme(themeId);
    hay = [
      theme.id,
      theme.category,
      ...(["en", "ar"] as const).flatMap((l) => {
        const c = theme.copy[l];
        return [c.title, c.kicker, c.subtitle, c.name];
      }),
    ]
      .join(" ")
      .toLowerCase();
    haystacks.set(themeId, hay);
  }
  return hay;
}

/** Case-insensitive search over the template's words, theme and category. */
export function searchTemplates(
  defs: TemplateDef[],
  query: string,
  locale: TemplateLocale,
): TemplateDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return defs;
  const parts = q.split(/\s+/);
  return defs.filter((d) => {
    const hay = `${haystack(d.theme)} ${d.kind.toLowerCase()}`;
    return (
      parts.every((word) => hay.includes(word)) || templateName(d, locale).toLowerCase().includes(q)
    );
  });
}

/** A varied handful for the home page: one per kind, cycling through themes. */
export function featuredTemplates(count = 12): TemplateDef[] {
  const order: TemplateKind[] = [
    "instagramPost",
    "presentation16x9",
    "youtubeThumbnail",
    "instagramStory",
    "poster",
    "businessCard",
    "invitation",
    "logo",
    "facebookPost",
    "flyer",
    "certificate",
    "menu",
  ];
  const defs = catalog();
  return order
    .map(
      (kind, i) =>
        defs.filter((d) => d.kind === kind)[i * 3 + 1] ?? defs.find((d) => d.kind === kind),
    )
    .filter((d): d is TemplateDef => Boolean(d))
    .slice(0, count);
}

/** Quick "change the look" options for the editor. */
export const STYLE_PALETTES: Palette[] = (
  [
    "sunset",
    "midnight",
    "ocean",
    "forest",
    "blush",
    "luxe",
    "citrus",
    "lavender",
    "noir",
    "candy",
    "retro",
    "crescent",
    "emerald",
    "sand",
  ] as const
).map((id) => PALETTES[id]);

export const STYLE_FONTS: FontPair[] = (
  [
    "modern",
    "impact",
    "editorial",
    "elegant",
    "friendly",
    "fun",
    "game",
    "script",
    "fashion",
    "tech",
    "classic",
    "retro",
  ] as const
).map((id) => FONT_PAIRS[id]);

export { swatches };
