/**
 * Starter font list for the editor (all Google Fonts, SIL OFL / Apache).
 * The full searchable Google Fonts library arrives in Phase 4.
 */
export interface FontEntry {
  family: string;
  category: "sans" | "serif" | "display" | "handwriting" | "mono";
  /** True if the family includes Arabic glyphs. */
  arabic?: boolean;
  /** Only one weight exists (bolder settings would be faked by the browser). */
  singleWeight?: boolean;
  /** What it's good for — shown to the AI when it picks fonts. */
  mood?: string;
}

export const STARTER_FONTS: readonly FontEntry[] = [
  { family: "Inter", category: "sans", mood: "clean, neutral UI/body text" },
  { family: "Sora", category: "sans", mood: "modern geometric headings" },
  { family: "Poppins", category: "sans", mood: "friendly geometric, bold headings and buttons" },
  { family: "Montserrat", category: "sans", mood: "confident, wide; strong in heavy weights" },
  { family: "Roboto", category: "sans" },
  { family: "Open Sans", category: "sans" },
  { family: "DM Sans", category: "sans" },
  { family: "Oswald", category: "sans", mood: "condensed, sporty, news headlines" },
  { family: "Playfair Display", category: "serif", mood: "elegant, editorial, weddings" },
  { family: "Lora", category: "serif" },
  { family: "Merriweather", category: "serif" },
  { family: "Cinzel", category: "serif", mood: "epic, cinematic, fantasy, luxury capitals" },
  {
    family: "Abril Fatface",
    category: "serif",
    singleWeight: true,
    mood: "bold fashion/editorial",
  },
  { family: "Bebas Neue", category: "display", singleWeight: true, mood: "tall condensed caps" },
  { family: "Anton", category: "display", singleWeight: true, mood: "heavy condensed impact" },
  {
    family: "Luckiest Guy",
    category: "display",
    singleWeight: true,
    mood: "chunky cartoon game titles, YouTube thumbnails",
  },
  {
    family: "Lilita One",
    category: "display",
    singleWeight: true,
    mood: "rounded heavy, playful games and kids",
  },
  { family: "Titan One", category: "display", singleWeight: true, mood: "bubbly bold, fun" },
  { family: "Bangers", category: "display", singleWeight: true, mood: "comic book action" },
  { family: "Bungee", category: "display", singleWeight: true, mood: "blocky signage, urban" },
  {
    family: "Press Start 2P",
    category: "display",
    singleWeight: true,
    mood: "8-bit pixel/retro games, blocky voxel worlds (use small sizes)",
  },
  { family: "Silkscreen", category: "display", mood: "pixel font, retro gaming" },
  { family: "Black Ops One", category: "display", singleWeight: true, mood: "military, action" },
  { family: "Russo One", category: "display", singleWeight: true, mood: "tech, esports, racing" },
  { family: "Archivo Black", category: "display", singleWeight: true, mood: "heavy grotesque" },
  { family: "Righteous", category: "display", singleWeight: true, mood: "retro futuristic" },
  { family: "Fredoka", category: "display", mood: "soft rounded, kids, friendly" },
  { family: "Pacifico", category: "handwriting", singleWeight: true, mood: "retro script" },
  { family: "Lobster", category: "handwriting", singleWeight: true, mood: "bold script, food" },
  { family: "Permanent Marker", category: "handwriting", singleWeight: true, mood: "marker" },
  { family: "Caveat", category: "handwriting", mood: "casual handwriting" },
  { family: "JetBrains Mono", category: "mono" },
  { family: "Cairo", category: "sans", arabic: true },
  { family: "Tajawal", category: "sans", arabic: true },
  { family: "IBM Plex Sans Arabic", category: "sans", arabic: true },
  { family: "Noto Kufi Arabic", category: "sans", arabic: true },
  { family: "Amiri", category: "serif", arabic: true },
  { family: "Reem Kufi", category: "display", arabic: true },
  {
    family: "Lalezar",
    category: "display",
    arabic: true,
    singleWeight: true,
    mood: "heavy Arabic display titles",
  },
  { family: "El Messiri", category: "display", arabic: true, mood: "elegant Arabic headings" },
];

const SINGLE_WEIGHT = new Set(STARTER_FONTS.filter((f) => f.singleWeight).map((f) => f.family));

/** The weight to actually use (single-weight families only come in 400). */
export function usableWeight(family: string, weight: number): number {
  return SINGLE_WEIGHT.has(family) ? 400 : weight;
}
