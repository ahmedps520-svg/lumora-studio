/** Shared types for Lumora's built-in templates. */
import type { PhotoTopic } from "@/lib/photos/library";
import type { FontPairId } from "./fonts";
import type { PaletteId } from "./palettes";

export type TemplateLocale = "en" | "ar";

/** The words a template shows. Blueprints use whichever fields they need. */
export interface Copy {
  /** Small label above the headline ("LIMITED TIME"). */
  kicker: string;
  /** The headline; `\n` for a line break. */
  title: string;
  subtitle: string;
  /** One or two sentences. */
  body: string;
  /** Button / call to action. */
  cta: string;
  date: string;
  time: string;
  place: string;
  /** @handle or website. */
  handle: string;
  /** Brand, host or person. */
  name: string;
  /** 3–4 short list items (tips, features, menu dishes, agenda…). */
  items: string[];
  /** Big numbers with labels. */
  stats: [string, string][];
  /** A short quote and who said it. */
  quote: string;
  author: string;
}

export const THEME_CATEGORIES = [
  "marketing",
  "events",
  "food",
  "lifestyle",
  "business",
  "education",
  "tech",
  "holidays",
  "creators",
] as const;
export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

export interface Theme {
  id: string;
  category: ThemeCategory;
  /** Lucide icon names (kebab-case) that suit the theme; the first is the main one. */
  icons: string[];
  palettes: PaletteId[];
  fonts: FontPairId[];
  /** Photo topics that fill the theme's photo frames (the first is the main one). */
  photos: PhotoTopic[];
  copy: Record<TemplateLocale, Copy>;
}

/** Template families shown in the gallery (each maps to a format preset). */
export const TEMPLATE_KINDS = [
  "instagramPost",
  "instagramStory",
  "instagramPortrait",
  "youtubeThumbnail",
  "presentation16x9",
  "facebookPost",
  "facebookCover",
  "xPost",
  "xHeader",
  "linkedinPost",
  "linkedinBanner",
  "pinterestPin",
  "poster",
  "flyer",
  "invitation",
  "businessCard",
  "logo",
  "certificate",
  "menu",
  "resume",
] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export interface TemplateDef {
  /** Stable id (used for thumbnails and links). */
  id: string;
  kind: TemplateKind;
  theme: string;
  category: ThemeCategory;
  blueprint: string;
  palette: PaletteId;
  fonts: FontPairId;
}
