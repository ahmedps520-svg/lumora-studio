/**
 * Turns a template definition into real design pages for a language and size.
 * Arabic pages are drawn by the same blueprint, then mirrored right-to-left.
 */
import { createId } from "@/lib/id";
import { PEOPLE_TOPICS, topicPhotos, type StockPhoto } from "@/lib/photos";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import { ElementSchema, PageSchema, type ElementInput, type Format, type Page } from "@/lib/schema";
import { BLUEPRINTS } from "./blueprints";
import { getTheme } from "./content";
import { FONT_PAIRS } from "./fonts";
import { Kit, seeded, type PhotoPicker } from "./kit";
import { PALETTES } from "./palettes";
import type { TemplateDef, TemplateKind, TemplateLocale, Theme } from "./types";

export interface BuiltTemplate {
  name: string;
  format: Format;
  pages: Page[];
}

/** The format preset each template kind is made for. */
export function kindFormat(kind: TemplateKind): Format {
  const preset = getPreset(kind);
  if (!preset) throw new Error(`No format preset for ${kind}`);
  return formatFromPreset(preset);
}

/** Mirrors an element for right-to-left layouts. */
function mirror(el: ElementInput, W: number): ElementInput {
  const out = { ...el, x: W - el.x - el.width, rotation: -(el.rotation ?? 0) } as ElementInput &
    Record<string, unknown>;
  if (el.type === "text") {
    const align = (el as { align?: string }).align ?? "left";
    out.align = align === "left" ? "right" : align === "right" ? "left" : align;
  }
  // Asymmetric outlines (waves, slants, bursts) flip with the layout.
  if (el.type === "shape") out.flipX = !(el as { flipX?: boolean }).flipX;
  return out;
}

/** Photos for one template: the theme's (main topic first), then portraits, never repeating. */
function photoPicker(topics: Theme["photos"], seed: string): PhotoPicker {
  const rand = seeded(seed);
  const shuffled = (list: StockPhoto[]) => {
    const start = Math.floor(rand() * list.length);
    return [...list.slice(start), ...list.slice(0, start)];
  };
  // The main topic's photos first, then the others, each list rotated by the seed.
  const pools = {
    theme: topics.flatMap((t) => shuffled(topicPhotos(t))),
    people: shuffled(PEOPLE_TOPICS.flatMap((t) => topicPhotos(t))),
  };
  const used = new Set<string>();
  return {
    next(kind) {
      const pool = pools[kind];
      const photo = pool.find((p) => !used.has(p.id)) ?? pool[0] ?? null;
      if (photo) used.add(photo.id);
      return photo;
    },
  };
}

export function templateName(def: TemplateDef, locale: TemplateLocale): string {
  return getTheme(def.theme).copy[locale].title.replace(/\n/g, " ");
}

export function buildTemplate(
  def: TemplateDef,
  locale: TemplateLocale,
  size?: Format,
): BuiltTemplate {
  const theme = getTheme(def.theme);
  const blueprint = BLUEPRINTS[def.blueprint];
  if (!blueprint) throw new Error(`Unknown blueprint: ${def.blueprint}`);
  const format = size ?? kindFormat(def.kind);
  const { width: W, height: H } = format;
  const kits: Kit[] = [];
  const photos = photoPicker(theme.photos, def.id);
  const newPage = () => {
    const kit = new Kit(
      W,
      H,
      PALETTES[def.palette],
      FONT_PAIRS[def.fonts],
      theme.copy[locale],
      theme.icons,
      locale,
      `${def.id}:${kits.length}`,
      def.theme,
      photos,
    );
    kits.push(kit);
    return kit;
  };
  if ("deck" in blueprint) blueprint.deck(newPage);
  else blueprint.draw(newPage());

  const pages = kits.map((kit) =>
    PageSchema.parse({
      id: createId(),
      background: kit.background,
      elements: kit.els.map((el) => ElementSchema.parse(locale === "ar" ? mirror(el, W) : el)),
    }),
  );
  return { name: templateName(def, locale), format, pages };
}
