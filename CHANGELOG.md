# Changelog

All notable changes to Lumora Studio are listed here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [0.13.0] — 2026-10-24 — A brighter website

### Changed

- **A new look for the website**, built around light — Lumora's own signature. The spark from
  the logo glows on section labels and headlines, a soft dawn rises behind the home page over the
  design canvas's dot grid, gradient words give off light, and cards **light up where your mouse
  is**. Bigger, tighter headlines, pill buttons, lit cards with deep soft shadows, and more room
  between sections. Works in light and dark mode, English and Arabic, on phones and desktops.
- **Home page:** the choice of studio (Design or Photo editor) is now the hero's main action, under
  the headline; Magic Design has its own section beside the product preview; a closing invitation
  and a proper footer (links to templates, the photo editor, settings, your account and system
  health) end the page.
- Templates, Photo, log-in, sign-up, settings and account pages share the same light and headings.
- The header is a floating glass capsule; on phones it fits (the wordmark shortens to "Lumora").

### Fixed

- Magic Design's style chips no longer squeeze into a narrow column; they get a row of their own.

## [0.12.0] — 2026-10-23 — A template library twenty times bigger

### Added

- **52,500 templates** (up from 2,484): **270 new themes** in English and Arabic — tutoring
  centres, chess tournaments, debate clubs, book fairs, creator media kits, cosplay reveals,
  SaaS pricing, insurance agencies, tea tastings, bridal trunk shows, town halls and many
  more — across education, creators, sports, marketing, business and tech. Each theme comes in
  the sizes that suit it (a café gets menus, logos and business cards; a webinar gets LinkedIn
  posts, banners and slides), and every layout comes in **four colour-and-font variants**.
- Every new theme was copy-edited in both languages: natural Arabic grammar and idiom, dates
  that match their weekdays, English and Arabic that say the same thing, no real brand names.
- Six new topics in the gallery: Beauty & fashion, Home & family, Sports, Travel, Health, and
  Arts & culture.

### Changed

- The template library **loads on demand**: the gallery and the editor's Templates panel show the
  hand-written templates at once and the full library a moment later ("Loading the full
  library…"), so the home page and the editor don't download it.
- Searching and browsing stay fast with a library this size (cached search words and names,
  deferred typing).

### Fixed

- Layouts that broke on longer words: the round-badge layout no longer crashes on two-line
  headlines, slide covers fit long subtitles, banner handles and side notes stay on one line,
  and card labels never overflow.

## [0.11.0] — 2026-10-20 — Photo editor tutorial and smooth painting

### Added

- **Photo editor tutorial:** a guided tour of every area and **every tool** (62 steps in 14
  chapters). Each step points at the tool or panel, picks the tool for you and says how to try
  it, with a "you tried it" tick once you do. Jump between chapters, go back, or stop and carry
  on later where you left off. Start it from **Start the tutorial** on the Photo home (opens a
  practice photo made for it), the **Tutorial** button in the status bar, Help → Tutorial (F1),
  or the prompt shown the first time you open the editor. English and Arabic.

### Fixed

- **Painting no longer freezes the editor.** Every brush movement used to redraw the whole
  layer and the whole picture (about a second per movement on a 4K photo); now each frame
  redraws only the part the brush touched, at most once per frame, and layer thumbnails wait
  until you pause. In our test, four brush strokes on a 4K photo went from 336 freezes
  (5 minutes in total) to 4 short pauses.
- **Autosave no longer pauses painting:** it waits until a stroke ends, re-encodes only the
  layers that changed, and refreshes the gallery thumbnail at most every 15 seconds (and when
  you leave).

## [0.10.0] — 2026-10-20 — Photo editor: groups, paths and warp

### Added

- **Layer groups** in the photo editor: New group, Group layers (Ctrl+G) and Ungroup
  (Ctrl+Shift+G), nested groups, open/close in the Layers panel, drag layers into and out of
  groups, Ctrl/Shift-click to pick several layers, group opacity, blend mode ("Pass through"
  or isolated), masks and effects, Merge group. Moving a group moves everything inside it.
- **Skew, distort, perspective and warp** (Edit → Transform, or the mode switch while
  transforming): corner and side handles for the first three, a 4 × 4 grid for warp. Skew,
  distort and perspective are rendered exactly when applied.
- **New layer effects:** inner shadow, inner glow, bevel & emboss (depth, size, angle,
  altitude, highlight and shadow) and gradient overlay, in a redesigned Layer Style dialog.
- **Pen tools and paths:** pen (click for corners, drag for curves, click the first point to
  close), freeform pen, path selection (move anchors, handles or the whole path; Alt-click turns
  a point into a corner; Delete removes it), a **Paths** panel (rename, delete, fill, stroke),
  Load path as selection (Ctrl+Enter) and Make work path from a selection.
- **Snapping:** moving layers, selections, transforms and the crop box snap to guides and the
  canvas edges and centre (View → Snap, Ctrl+Shift+;), with pink guide lines; Shift keeps a
  move straight.

### Changed

- Photos saved by 0.9.0 open with the new effects switched off and an empty Paths panel.

## [0.9.0] — 2026-10-19 — Photo editor

### Added

- **Lumora Photo**, a pro photo editor at `/photo`. The home page now starts with a choice:
  **Design** or **Photo editor**; the header has a **Photo** link.
- Photo home: open a photo (file picker or drag and drop), start a blank canvas from presets
  (HD, 4K, square, portrait, story, A4, Letter, banner or custom size and background), and
  reopen recent photos (move to trash with undo).
- Editor workspace: menu bar (File, Edit, Image, Layer, Type, Select, Filter, View, Window,
  Help), tool options bar, toolbar with tool groups and flyouts, rulers, guides, grid, pixel
  grid, tabbed panel groups (Color, Swatches, Navigator, Histogram, Info · Properties,
  Adjustments, Character · Layers, History), status bar and a floating task bar.
- 36 tools: selection (marquees, lassos, magic wand, quick mask), crop, eyedropper, ruler,
  healing (spot, brush, red eye), painting (brush, pencil, colour replacement, clone stamp,
  history brush, erasers, gradient, paint bucket), local edits (blur, sharpen, smudge, liquify,
  dodge, burn, sponge), type, five shapes, hand and zoom.
- Layers with 27 blend modes, opacity/fill, locks, masks, clipping masks, layer styles, fill and
  adjustment layers; 20 adjustments; 50+ filters with live preview; free transform; image and
  canvas size; rotate/flip; crop/trim/reveal all; align to canvas; content-aware fill; select
  subject and remove background (on-device); **Generative fill** through `/api/ai/photo-fill`
  (Gemini, your own or the site's Google key; the result goes on a new masked layer).
- Undo/redo with a History panel, keyboard shortcuts (and a shortcuts sheet), clipboard paste of
  images, autosave to the browser, export to PNG/JPG/WebP.
- English and Arabic for everything in the photo editor.

## [0.8.1] — 2026-10-19 — Better account emails

### Added

- **"Your password was changed" email** after a password reset or a change on the Account page,
  with the account, the time and a button to reset the password if it wasn't you.
- **Email me a reset link** on the Account page, for when you don't remember your current
  password.
- Development-only email previews at `/api/email/preview` (every email, in both languages, with
  sample data — nothing is sent).

### Changed

- **Redesigned account emails** (confirm, welcome, reset, test): the Lumora logo travels inside
  the email, a brand gradient bar, a clear headline, one solid button, a link box for when the
  button doesn't work, and a proper footer; the welcome email lists what you can do. Laid out
  right-to-left in Arabic, with Western digits.

## [0.8.0] — 2026-10-19 — Accounts and emails

### Added

- **Accounts:** sign up (name, email, password), confirm your email, log in, forgotten password
  and reset, change password, log out. A header button shows **Log in** or your account menu; an
  **Account** page and an Account card in **Settings → General** show who is signed in. Accounts
  are stored in `.data/lumora.db` (SQLite, never committed); passwords are hashed (scrypt) and
  sessions are signed, HTTP-only cookies (Better Auth).
- **Account emails with Resend:** confirm-your-email, welcome and reset-password emails in
  English or Arabic (right-to-left), matching the site language. Without `RESEND_API_KEY` they
  are printed in the dev server's terminal. **Send me a test email** on the Account page checks the
  setup (it only ever emails your own confirmed address).
- **Test key** button for the Google AI (Gemini) key in Settings → Keys & usage — free, it only
  lists Google's models — plus a link to get a key.
- New settings: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_DATABASE_PATH`,
  `RESEND_API_KEY`, `EMAIL_FROM` (see `.env.example`); the health page shows whether email
  is on.

## [0.7.0] — 2026-10-19 — Photos and 2,400+ templates

### Added

- **Templates come with photos.** Every photo frame in a template fills itself with a free stock
  photo that suits the theme (portraits for speakers, team slides and résumés), credited to the
  photographer. The same template gets the same photos in English and Arabic, and a design never
  repeats a photo.
- **Photos panel** in the editor: about 1,000 hand-picked free Unsplash photos in 109 topics,
  searchable in English and Arabic. Click to add a photo, or drag it onto the page.
- **Replace images:** with a photo or frame selected, clicking a photo replaces it; **Replace** in
  the side panel (upload from this device or choose a stock photo); right-click → **Replace
  image**; or drop a photo or an image file onto a photo. The new picture keeps the old one's box,
  shape and filters and is cropped to cover it, in one undo step.
- **2,484 templates** (from 473): 60 new themes (Black Friday, jewellery, skincare, perfume,
  sneakers, furniture, florists, car care, groceries, electronics, online shops, reviews, pizza,
  sushi, ice cream, juice bars, shawarma, brunch, farmers' markets, art shows, film nights,
  networking, galas, engagements, grand openings, pottery, tech summits, football, dentists,
  barbers, gardening, cleaning, interior design, mental health, run clubs, hiking, camping, beach
  and city trips, hotels, pool parties, consulting, law firms, startup pitches, new team members,
  market reports, science fairs, language classes, back to school, cyber security, Mother's and
  Father's Day, National Day, Halloween, Women's Day, music releases, book launches, fitness
  challenges, beauty tutorials and stream schedules), all in English and Arabic.
- 13 new photo-led layouts: full-bleed photo, magazine cover, photo + colour panel, tilted
  instant photo, photo grid, duotone, product card, framed photo, photo strips, round photo, and
  three for landscape posts and banners.
- 6 new template sizes: Instagram portrait, Pinterest pin, Facebook cover, X post, X header and
  LinkedIn post.
- 70 more template icons; review tools for contact sheets of a slice of a kind, trial layouts and
  photo topics.

### Changed

- **Settings** are split into tabs (General, AI, AI tools, Keys & usage) and are more compact; the open tab stays in the address. Settings and the health page show the app version (read from `package.json`).
- The gallery and the editor's Templates panel load templates in batches as you scroll, and the
  gallery opens on a varied mix of sizes and themes.
- Each size uses a theme's colours and fonts in a different order, so a theme looks different in
  each size.

### Fixed

- Text beside buttons ("date · time · place") could wrap past the bottom of tall pages; it now
  falls back to a shorter note.
- Wide banners: the headline no longer runs under the icons on Facebook covers and X headers.
- Résumés leave out a job rather than run off the page with wide fonts.

## [0.6.0] — 2026-10-19 — Templates

### Added

- **473 built-in templates** in 14 kinds (Instagram post & story, YouTube thumbnail, 8-slide
  presentation, Facebook post, LinkedIn banner, poster, flyer, invitation, two-sided business card,
  logo, certificate, menu, résumé) across 46 themes and 9 topics, each in English and Arabic.
  Generated from 40 layout blueprints × themed words × 26 palettes × 16 font pairings
  (`src/lib/templates`); every part is a normal editable element.
- **Template gallery** at `/templates` (search in both languages, size and topic filters, lazy
  thumbnails) and a "Start from a template" strip on the home page; a Templates link in the header.
- **Templates panel** in the editor: templates that fit the design's shape, rebuilt at its exact
  size; fills an empty page or adds new pages (one undo step); one-click colour palettes and font
  pairings for the page.
- Contact-sheet tool for reviewing templates by eye, and a test that builds every template in both
  languages and fails if any text leaves the page.

### Changed

- Empty photo frames show a soft gradient with a photo glyph instead of a flat grey box.
- Fonts now load their Arabic glyphs too (before, Arabic text was measured with a fallback font
  until the glyphs arrived, so it could wrap past its box and bold weights could be missing).

## [0.5.0] — 2026-10-19 — Everyday editor features: pages, present, draw, animate, download

### Added

- **Research**: internal feature inventory of a leading online design editor
  (`docs/research/feature-inventory.md`) with a top-40 parity table and Lumora's status.
- **Right-click menus** for elements and pages (Radix context menu); copy/cut/paste through the
  system clipboard (`lumora/elements:v1:` + Zod-validated JSON), pasting images and plain text;
  copy/paste style (Ctrl+Alt+C/V); lock (Alt+Shift+L).
- **Pages**: page strip with thumbnails, add/duplicate/delete/reorder/rename, notes, previous/next,
  Ctrl+Enter, PageUp/PageDown.
- **Present**: full screen, presenter view, autoplay, 6 page transitions, presenter effects.
- **Drawing**: pen, marker, highlighter, eraser (`drawing` elements).
- **Animations**: 12 entrance animations per element or per page (`animation` on elements and
  pages), speed/direction, preview dialog, playback in Present mode (`src/lib/engine/animate.ts`).
- **Download**: PNG (scale, transparent), JPG (quality), PDF and print PDF (own writer), SVG,
  MP4/WebM video with animations and transitions (WebCodecs via mediabunny), page selection, ZIP
  for several pictures (own writer).
- **Smart guides & snapping** (`src/lib/engine/guides.ts`): edges/centres to page and elements,
  45° rotation snapping, live size/angle labels, Alt to move freely; align/distribute buttons.
- **Photos**: filter looks with intensity + adjustments (brightness, contrast, saturation, warmth,
  tint, blur, vignette), crop dialog with aspect presets, set/detach page background photo
  (fill/fit/tile, opacity, colour wash), circle/shape masks.
- **Elements**: icons (Lucide, recolourable SVG), frames (8 shapes, drop or pick a photo, zoom/pan),
  tables, charts (6 types + data editor), QR codes and EAN-13 barcodes — each with a side-panel
  editor. Tables/charts load their fonts and re-layout when a web font arrives.

### Changed

- Page backgrounds are one `PageBackground` object everywhere (editor, thumbnails, Present,
  downloads), so background photos render consistently.
- An element that fails to draw now shows a dashed box instead of breaking the page.
- CSP: `connect-src` allows `blob:` (downloads read pictures the page already made).
- New dependencies: `mediabunny` (video), `qrcode-generator` (QR).

## [0.4.0] — 2026-10-18 — Images, groups, background removal, Premium designs

### Added

- **Premium design** (home page and editor, on by default): Claude art-directs the brief,
  Google Gemini ("Nano Banana") paints full-bleed artwork, Claude lays out titles over it while
  looking at the art, then reviews the real render and polishes it (0–3 rounds, Settings → AI).
  Live step-by-step progress, cost estimate and exact cost. Works without artwork when no Google
  key is set. New routes: `/api/ai/premium/{plan,compose,review}`, `/api/ai/image`.
- **Title effects**: solid 3D extrusion (new `extrude` text property, rendered by a Fabric
  Textbox subclass), outlines drawn around the letters, gradient letters, shadows — available to
  every AI feature. 20+ display fonts with mood notes for the AI.
- **Images**: upload panel, drag-and-drop onto the canvas, paste from the clipboard; stored as
  Blobs in IndexedDB; rounded corners and borders; proportional resizing.
- **Background remover**: HD BiRefNet on the Lumora server (DirectML/CPU), one undo step,
  original kept; in-browser BEN2 → MODNet fallback with automatic GPU/CPU fallbacks.
- **Groups**: Ctrl+G / Ctrl+Shift+G, group buttons, expandable layer rows, moving/resizing/
  rotating as one unit, lossless ungroup (rotation, flips, opacity), assistant tools
  `group_elements` / `ungroup_elements` (prompt assistant@3).
- Settings: Google AI key (browser-only), artwork model, review rounds, backup remover model.
- Env: `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `BACKGROUND_REMOVAL_SERVER`.

### Changed

- Magic Design prompt design@2 (effects, font moods). Large layouts now use the JSON Schema in the
  prompt + Zod validation + one repair round (the compiled output grammar got too large).
- Canvas transforms are applied after Fabric finishes the gesture (fixes duplicate objects when a
  resized group is rebuilt).

## [0.3.0] — 2026-10-18 — AI core (Phase 5, moved up)

### Added

- AI module (`src/lib/ai`): model routing (Haiku 5.5 / Sonnet 5.5 / Opus 5.5 by quality),
  versioned prompts, Zod-validated structured outputs, prompt caching, server-side refusal
  fallbacks, cost estimates and exact usage costs, retries with exponential backoff (SDK).
- Cost & safety controls: owner daily budget (`AI_DAILY_BUDGET_USD`), per-visitor rate limit,
  browser daily budget, same-origin checks, bring-your-own-key (header only, never stored), free
  key test, user text always wrapped as data.
- **Magic Design** (prompt → up to 3 editable variations, auto-fixed for margins, overflow,
  contrast and hidden text) in the editor and on the home page.
- **Design Assistant** chat with 12 editing tools, applied as one undo step with "Undo AI changes".
- **Magic Write**: 14 actions (rewrite, shorten, expand, fix, simplify, tone, translate, continue,
  headlines, hashtags, captions, CTA, emojify, write from prompt).
- **Colours & fonts**: AI palettes + font pairings, one-click "apply to design" with luminance-aware
  remapping and contrast repair.
- **Settings page** with everything customisable: quality, creativity, tone, language, brand voice,
  audience, variations, suggestion count, assistant auto-apply, cost display, daily budget, API key.
- Align / distribute helpers; off-screen page renderer for previews.
- Tests with recorded AI responses (no tokens spent): routing, costs, prompt safety, conversion,
  auto-fix, assistant tools, every API route; Playwright AI smoke tests.

## [0.2.0] — 2026-10-18 — Phase 1: Core editor + premium redesign

### Added

- Versioned scene-graph schema (Zod) for every element type, migrations and damaged-file repair.
- Editor store with Immer-patch undo/redo (200 steps, merging of rapid edits).
- IndexedDB storage (Dexie) with autosave, thumbnails, trash, duplicate, snapshot fallback.
- Fabric.js 7 engine wrapper with lossless element ⇄ canvas mapping (browser round-trip tests).
- Editor: tool rail, Elements / Text / Layers panels, properties panel, zoom & pan, shortcuts.
- Home: create from 27 format presets or a custom size, recent designs.
- Premium visual system: ink-dark and warm-paper themes, glass surfaces, aurora glow, hero art.

## [0.1.0] — 2026-10-18 — Phase 0: Foundation

### Added

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 6 (strict) project.
- Tailwind CSS 4 with Lumora design tokens: sunset brand gradient, deep indigo primary, slate neutrals, 12px radius, soft shadows, 180ms transitions, light + dark themes.
- Original Lumora logo (stylised "L" with a spark), wordmark, favicon, Apple touch icon and PWA icons (`npm run icons`).
- English + Arabic UI from day one (next-intl), with automatic right-to-left layout and an Arabic UI font.
- Light / dark / system theme switch with no flash on load.
- Strict Content-Security-Policy with a fresh nonce on every request, plus standard security headers.
- `/health` page and `/api/health` endpoint showing what is switched on (never key values).
- `npm run check-env`: friendly environment check that never prints secrets and warns about keys exposed to the browser.
- `.env.example` documenting every setting.
- Tooling: ESLint 9 (flat config), Prettier (+ Tailwind class sorting), Vitest + Testing Library, Playwright.
- `npm run verify` = typecheck + lint + format check + unit tests.
