/**
 * Font pairings for templates, each with an Arabic counterpart (the Latin
 * display fonts have no Arabic letters). `width` is the average letter width
 * in ems, used to size headlines so they fit.
 */

export interface FontPair {
  id: string;
  heading: string;
  headingWeight: number;
  body: string;
  bodyWeight: number;
  /** Headlines in capitals. */
  caps: boolean;
  /** Letter spacing for headlines (thousandths of an em). */
  tracking: number;
  /** Average letter width of the heading font, in ems. */
  width: number;
  /** A friendly script or accent font for small flourishes (optional). */
  accent?: string;
  ar: { heading: string; headingWeight: number; body: string; width: number };
}

const AR_BOLD = { heading: "Cairo", headingWeight: 800, body: "Tajawal", width: 0.52 };
const AR_DISPLAY = { heading: "Lalezar", headingWeight: 400, body: "Cairo", width: 0.5 };
const AR_ELEGANT = { heading: "El Messiri", headingWeight: 700, body: "Tajawal", width: 0.52 };
const AR_CLASSIC = { heading: "Amiri", headingWeight: 700, body: "Amiri", width: 0.5 };
const AR_KUFI = { heading: "Reem Kufi", headingWeight: 700, body: "Tajawal", width: 0.56 };

export const FONT_PAIRS = {
  modern: {
    id: "modern",
    heading: "Sora",
    headingWeight: 800,
    body: "Inter",
    bodyWeight: 400,
    caps: false,
    tracking: -20,
    width: 0.66,
    ar: AR_BOLD,
  },
  impact: {
    id: "impact",
    heading: "Anton",
    headingWeight: 400,
    body: "Inter",
    bodyWeight: 500,
    caps: true,
    tracking: 10,
    width: 0.47,
    ar: AR_DISPLAY,
  },
  bebas: {
    id: "bebas",
    heading: "Bebas Neue",
    headingWeight: 400,
    body: "Montserrat",
    bodyWeight: 500,
    caps: true,
    tracking: 30,
    width: 0.4,
    ar: AR_DISPLAY,
  },
  editorial: {
    id: "editorial",
    heading: "Playfair Display",
    headingWeight: 800,
    body: "DM Sans",
    bodyWeight: 400,
    caps: false,
    tracking: -10,
    width: 0.6,
    accent: "Playfair Display",
    ar: AR_ELEGANT,
  },
  elegant: {
    id: "elegant",
    heading: "Cinzel",
    headingWeight: 700,
    body: "Lora",
    bodyWeight: 400,
    caps: true,
    tracking: 60,
    width: 0.72,
    ar: AR_CLASSIC,
  },
  friendly: {
    id: "friendly",
    heading: "Poppins",
    headingWeight: 800,
    body: "Poppins",
    bodyWeight: 400,
    caps: false,
    tracking: -10,
    width: 0.7,
    ar: AR_BOLD,
  },
  playful: {
    id: "playful",
    heading: "Fredoka",
    headingWeight: 700,
    body: "Poppins",
    bodyWeight: 400,
    caps: false,
    tracking: 0,
    width: 0.6,
    ar: AR_DISPLAY,
  },
  fun: {
    id: "fun",
    heading: "Lilita One",
    headingWeight: 400,
    body: "Poppins",
    bodyWeight: 500,
    caps: false,
    tracking: 0,
    width: 0.56,
    ar: AR_DISPLAY,
  },
  game: {
    id: "game",
    heading: "Luckiest Guy",
    headingWeight: 400,
    body: "Montserrat",
    bodyWeight: 600,
    caps: true,
    tracking: 20,
    width: 0.62,
    ar: AR_DISPLAY,
  },
  script: {
    id: "script",
    heading: "Pacifico",
    headingWeight: 400,
    body: "Montserrat",
    bodyWeight: 500,
    caps: false,
    tracking: 0,
    width: 0.66,
    ar: AR_ELEGANT,
  },
  fashion: {
    id: "fashion",
    heading: "Abril Fatface",
    headingWeight: 400,
    body: "DM Sans",
    bodyWeight: 400,
    caps: false,
    tracking: 0,
    width: 0.62,
    ar: AR_ELEGANT,
  },
  tech: {
    id: "tech",
    heading: "Russo One",
    headingWeight: 400,
    body: "Inter",
    bodyWeight: 400,
    caps: false,
    tracking: 0,
    width: 0.7,
    ar: AR_KUFI,
  },
  classic: {
    id: "classic",
    heading: "Montserrat",
    headingWeight: 800,
    body: "Open Sans",
    bodyWeight: 400,
    caps: true,
    tracking: 40,
    width: 0.7,
    ar: AR_BOLD,
  },
  marker: {
    id: "marker",
    heading: "Permanent Marker",
    headingWeight: 400,
    body: "Poppins",
    bodyWeight: 500,
    caps: false,
    tracking: 0,
    width: 0.64,
    ar: AR_DISPLAY,
  },
  news: {
    id: "news",
    heading: "Oswald",
    headingWeight: 700,
    body: "Roboto",
    bodyWeight: 400,
    caps: true,
    tracking: 10,
    width: 0.48,
    ar: AR_BOLD,
  },
  retro: {
    id: "retro",
    heading: "Righteous",
    headingWeight: 400,
    body: "DM Sans",
    bodyWeight: 500,
    caps: false,
    tracking: 0,
    width: 0.64,
    ar: AR_KUFI,
  },
} satisfies Record<string, FontPair>;

export type FontPairId = keyof typeof FONT_PAIRS;
export const FONT_PAIR_IDS = Object.keys(FONT_PAIRS) as FontPairId[];

/** Average letter widths (ems) of body/other fonts, for text measuring. */
const BODY_WIDTH: Record<string, number> = {
  Inter: 0.55,
  Montserrat: 0.6,
  "DM Sans": 0.54,
  Lora: 0.52,
  Poppins: 0.6,
  "Open Sans": 0.56,
  Roboto: 0.54,
  Cairo: 0.5,
  Tajawal: 0.48,
  Amiri: 0.48,
};

export function fontWidth(family: string, pair?: FontPair): number {
  if (pair && family === pair.heading) return pair.width;
  if (pair && family === pair.ar.heading) return pair.ar.width;
  return BODY_WIDTH[family] ?? 0.56;
}
