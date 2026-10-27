import type { Copy, Theme } from "../types";

const EMPTY: Copy = {
  kicker: "",
  title: "",
  subtitle: "",
  body: "",
  cta: "",
  date: "",
  time: "",
  place: "",
  handle: "",
  name: "",
  items: [],
  stats: [],
  quote: "",
  author: "",
};

/** Fills in the fields a theme doesn't use. */
export const copy = (c: Partial<Copy>): Copy => ({ ...EMPTY, ...c });

export const theme = (
  t: Omit<Theme, "copy"> & { en: Partial<Copy>; ar: Partial<Copy> },
): Theme => ({
  id: t.id,
  category: t.category,
  icons: t.icons,
  palettes: t.palettes,
  fonts: t.fonts,
  photos: t.photos,
  kinds: t.kinds,
  copy: { en: copy(t.en), ar: copy(t.ar) },
});
