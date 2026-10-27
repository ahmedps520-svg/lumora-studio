# Writing template themes and layouts

Lumora's templates are generated: **layouts (blueprints) × themes × palettes × fonts**, in
English and Arabic. A theme is the words, photos, icons and colour/font choices of a subject
(a coffee shop sale, a wedding invitation…); a layout is a function that draws any theme at any
size with the drawing kit. New ones go in `src/lib/templates/content/gen/*.ts` (themes) and
`src/lib/templates/blueprints/gen/*.ts` (layouts); `node scripts/gen-template-index.mjs`
registers every file in those folders.

Check your file before you're done — it must print `0 problem(s)`:

```bash
npx tsx scripts/check-templates.ts --themes-file src/lib/templates/content/gen/<file>.ts
npx tsx scripts/check-templates.ts --blueprints-file src/lib/templates/blueprints/gen/<file>.ts
```

Then `npx prettier --write <file>` and `npx eslint <file> --max-warnings=0`.

## Themes

One file exports one or more `Theme[]` arrays built with `theme()` from `../helpers`:

```ts
import { theme } from "../helpers";

export const THEMES_CAFES: Theme[] = [
  theme({
    id: "matchaBar", // unique camelCase; never reuse an existing id
    category: "food", // marketing events food lifestyle business education tech holidays creators beauty home sports travel health arts
    photos: ["coffee-shop", "fresh-juice"], // 1–3 topics from src/lib/photos/library.ts (PHOTO_LIBRARY keys); the first is the main one
    icons: ["coffee", "leaf", "sparkles"], // 2–3 names from src/lib/templates/icons.generated.ts (ICON_SVG keys)
    palettes: ["mint", "sand", "forest", "citrus"], // 3–5 ids from src/lib/templates/palettes.ts, best first
    fonts: ["friendly", "editorial", "playful"], // 3–4 ids from src/lib/templates/fonts.ts, best first
    kinds: ["flyer", "menu", "facebookCover", "logo", "businessCard"], // sizes beyond posts/stories (see below)
    en: { kicker, title, subtitle, body, cta, date?, time?, place?, handle?, name?, items?, stats?, quote?, author? },
    ar: { … the same fields, written natively in Arabic (not translated word for word) … },
  }),
];
```

- **Every theme gets** Instagram post, story, portrait post and Facebook post. `kinds` adds the
  sizes the subject really suits: `poster flyer pinterestPin invitation youtubeThumbnail xPost
  linkedinPost linkedinBanner facebookCover xHeader presentation16x9 businessCard logo
  certificate menu resume`. A café: flyer, menu, facebookCover, logo, businessCard. A webinar:
  poster, linkedinPost, linkedinBanner, xPost, youtubeThumbnail, presentation16x9. Pick 4–9.
- **Words are placeholders people will replace**, so they must read like a finished, premium
  design: specific, confident, no lorem ipsum, no real brands or people. Made-up business
  names are fine ("Bean & Bloom"). Keep lengths: title ≤ 40 characters (use `\n` for a line
  break in long titles), subtitle ≤ 70, body ≤ 160, cta ≤ 20, items ≤ 28 each (3–4 items),
  stats number ≤ 7 and label ≤ 14 (1–3 stats), quote ≤ 110.
- Fill `date`, `time`, `place` for anything with an occasion (events, launches, classes);
  `items` for lists (menus, tips, features, agenda); `stats` for numbers (prices, discounts,
  counts); `quote` + `author` for testimonials and quotes. Layouts only appear for themes that
  have the words they need, so richer themes get more templates.
- Arabic must be fluent, natural Arabic with proper diacritics where idiomatic ("طازج",
  "اشترِ"), Arabic digits are fine but Western digits are standard; the same fields must be
  set in both languages (the checker enforces it). Prices: `$` in English, `ر.س` in Arabic.
- Choose palettes and fonts that fit the mood (dark `luxe`/`noir`/`midnight` for premium and
  nightlife, `blush`/`candy`/`peach` for sweet and feminine, `corporate`/`sky` for business,
  `retro`/`terracotta`/`sand` for warm and crafty, `electric`/`arcade` for gaming and tech).

## Layouts

One file exports one or more `GenBlueprint[]` arrays (type in `../gen-types`):

```ts
import type { Kit } from "../../kit";
import type { GenBlueprint } from "../gen-types";
import { details, itemsOf, statOf } from "../shared";

export const LAYOUTS_NEON: GenBlueprint[] = [
  {
    id: "neonFrame",
    kinds: ["instagramPost", "instagramStory", "instagramPortrait", "poster"],
    needs: (c) => Boolean(c.cta), // optional: words the layout needs
    draw(k: Kit) { … },
  },
  { id: "deckSplit", kinds: ["presentation16x9"], deck(page) { … 6–8 pages … } },
];
```

- Read `src/lib/templates/kit.ts` first: `k.u` is 1% of the shorter side (write every size in
  units of `u`), `k.W`/`k.H`, `k.p` palette, `k.f` fonts, `k.c` the theme's words, `k.tall`,
  `k.landscape`, `k.rtl`, `k.rand()` (deterministic). Draw with `k.text`, `k.title`, `k.rect`,
  `k.circle`, `k.ellipse`, `k.path(PATHS.x…)`, `k.pill`, `k.icon(k.ic(n), …)`, `k.frame`
  (photo frames, filled automatically), `k.glow`, `k.bar`, `k.dots`, `k.confetti`, `k.chart`,
  `k.table`, `k.qr`, `k.bgSolid`, `k.bgGradient`, `k.grad`, `k.radial`, `k.on(color)` for
  readable text on a colour, `k.pick(bg, candidates)`, `k.alpha(color, a)`.
- **Measure before you place**: `k.fitBox(text, { w, maxH, max, lines })` and
  `k.heightOf(text, size, w, font)` give the biggest size that fits; every text block must
  stay inside the page for *every* theme and both languages (the checker builds your layout
  with every eligible theme at every size you list and fails on any overflow). Give the
  headline whatever room is left after measuring the smaller parts, as the existing layouts
  in `blueprints/social.ts` do.
- Use the palette roles, never fixed colours: `p.bg`, `p.bg2`, `p.surface`, `p.ink`, `p.soft`,
  `p.primary`, `p.secondary`, `p.accent`; text on a coloured shape uses `k.on(thatColor)`.
- Arabic pages are mirrored automatically; don't mirror anything yourself. Don't use
  `Math.random` or dates. Don't name other design products anywhere.
- A premium layout has one clear idea (a strong shape, a photo treatment, a typographic
  move), generous margins (≥ 7u), a clear hierarchy (kicker → headline → subtitle → details →
  button), decorative elements that don't fight the words, and works at 1:1, 4:5 and 9:16 when
  it lists those sizes (`k.tall` for story-specific spacing).
