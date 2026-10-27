# Lumora Studio

**Design anything. Let AI do the heavy lifting.**

Lumora Studio is a free, web-based design editor for social posts, presentations, posters, logos,
documents and more. It has a drag-and-drop canvas and AI helpers powered by Claude. There are no
subscriptions, paywalls or watermarks. The only running cost is your own Claude API usage, which
the app keeps low and shows you.

> **Status:** the core editor and the first wave of AI features work today — see
> [What works now](#what-works-now) and the [Roadmap](#roadmap).

## What works now

- **Two studios:** the home page first asks what you want to make — a **Design** (the editor
  below) or a photo in the **Photo editor** (Lumora Photo).
- **Photo editor (Lumora Photo, at `/photo`):** a full pro photo editor in the browser. Open a
  photo (or drop one, or start a blank canvas from presets) and edit with:
  - **39 tools** in toolbar groups with the classic one-letter shortcuts: move, rectangular and
    elliptical marquee, lasso, polygonal lasso, magic wand, crop (ratios, keep/delete pixels),
    eyedropper, ruler (with straighten), spot healing, healing brush, red eye, brush, pencil,
    colour replacement, clone stamp, history brush, eraser, magic eraser, gradient (5 styles),
    paint bucket, blur, sharpen, smudge, liquify brush, dodge, burn, sponge, type, rectangle,
    ellipse, triangle, polygon, line, pen, freeform pen, path selection, hand and zoom — plus foreground/background colours and
    **Quick Mask**.
  - **Layers:** pixel, text, shape, fill and **adjustment layers**, and **groups** (nested,
    pass-through or isolated; Ctrl+G / Ctrl+Shift+G; Ctrl/Shift-click to pick several); all
    **27 blend modes**; opacity and fill; locks; **layer masks**; clipping masks; layer styles
    (drop shadow, inner shadow, outer and inner glow, **bevel & emboss**, stroke, colour and
    gradient overlay); merge, flatten, align; drag to reorder or into a group.
  - **Transform:** free transform plus **skew, distort, perspective and warp** (a 4 × 4 grid);
    moving, transforming and cropping **snap** to guides and the canvas edges and centre.
  - **Tutorial:** a step-by-step tour of every tool and panel with a practice photo (Photo home →
    **Start the tutorial**, the status bar, or Help → Tutorial).
  - **Pen tools and paths:** pen (corners and curves), freeform pen, path selection, a
    **Paths** panel, load a path as a selection (Ctrl+Enter), make a path from a selection,
    fill or stroke a path.
  - **Selections:** add/subtract/intersect, feather, select subject (on-device AI), colour range,
    grow/similar, modify (expand, contract, border, smooth), inverse, save/load.
  - **20 adjustments** (Levels, Curves, Hue/Saturation, Colour Balance, Black & White, Channel
    Mixer, Selective Colour, Gradient Map, Develop…) as layers or applied to pixels, and **50+
    filters** (blurs incl. tilt-shift and iris, distort, noise, pixelate, render, sharpen,
    stylize, lens correction, skin smoothing) with live preview.
  - **Generative fill** (describe what should appear in a selection — needs a Google AI key),
    content-aware fill, remove background, free transform, image/canvas size, rotate/flip, a
    History panel (40 steps), rulers, guides, grid, every menu (File, Edit, Image, Layer, Type,
    Select, Filter, View, Window, Help) and keyboard shortcuts. Photos autosave in your browser;
    export PNG, JPG or WebP.
- **Editor:** shapes, lines, text and **images**; move/resize/rotate on the canvas; zoom and pan;
  **groups** (Ctrl+G / Ctrl+Shift+G — move, resize and rotate as one piece); layers (rename,
  hide, lock, drag to reorder, expand groups); properties panel; undo/redo (200 steps);
  copy/paste; keyboard shortcuts; autosave to your browser — close the tab and everything is
  still there.
- **Images:** upload, drag onto the canvas, or paste with Ctrl+V. Images are stored only in your
  browser. Rounded corners and borders.
- **Background remover (free):** select an image → **Remove background**. Runs the HD
  [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) model inside Lumora itself — your photo is
  never sent to another company. The first run downloads the model once (~224 MB, about a
  minute); after that it takes a few seconds. Ctrl+Z brings the original back.
- **Title effects:** thick outlines, solid **3D sides**, drop shadows and gradient letters — the
  "game title" look — plus 20+ display fonts (Luckiest Guy, Lilita One, Bungee, Cinzel…).
- **Templates (50,000+):** Instagram posts, stories and portrait posts, Pinterest pins, Facebook
  and X posts and covers, LinkedIn posts and banners, YouTube thumbnails, 8-slide presentations,
  posters, flyers, invitations, two-sided business cards, logos, certificates, menus and résumés —
  376 themes (sales, Black Friday, skincare, birthdays, weddings, Ramadan & Eid, pizza, sushi,
  fitness, travel, dentists, law firms, podcasts, gaming, tutoring, chess clubs, SaaS pricing,
  tea tastings, town halls…), each layout in four colour-and-font variants, each in **English
  and Arabic** (Arabic
  versions are laid out right-to-left with Arabic fonts). Templates come **with real photos**
  that suit the theme, already placed. Browse them at **Templates** (search, size and topic
  filters) or in the editor's **Templates** panel, which shows the ones that fit your design and
  adds them as new pages. Every word, colour, shape, icon and photo is editable; one click
  restyles a page with a colour palette or font pairing.
- **Photos:** a free stock photo library (about 1,000 photos in 109 topics, each credited to its
  photographer) in the editor's **Photos** panel — search in English or Arabic, click to add.
  **Replace any photo** without redoing the layout: select it and click another photo, use
  **Replace** in the side panel (upload or pick a stock photo), right-click → **Replace image**,
  or drop a photo or file straight onto it. The new photo keeps the old one's place, size, shape
  and filters, cropped to fit.
- **Accounts:** sign up with email and password, confirm your email, log in, reset a forgotten
  password, change your password, and log out (header menu and **Account** page). Account emails
  (confirm, welcome, reset) are sent with **Resend**, in English or Arabic to match the site.
  Your designs still stay in your browser.
- **Right-click menus** on elements and pages (copy, paste, duplicate, layers, align, flip,
  group, lock, copy/paste style, remove background, set image as background…). Copy and paste
  work through your system clipboard, so elements move between designs and browser tabs, and
  pasted images or text land on the page.
- **Pages & presenting:** page strip (add, duplicate, delete, drag to reorder, rename), speaker
  notes, **Present** full screen, presenter view (notes, next slide, timer) and autoplay, page
  transitions, and presenter shortcuts (C confetti, B blur, D drumroll, Q quiet, U curtain…).
- **Drawing:** pen, marker, highlighter and an eraser; strokes become normal elements.
- **Animations:** 12 entrance animations (Rise, Pop, Typewriter, Wipe, Bounce…) per element or
  for the whole page, with speed and direction, a preview, and playback when presenting.
- **Download:** PNG (any size, transparent background), JPG (quality), PDF and 300 dpi print PDF
  (all pages in one file), SVG, and **MP4 video** with your animations and transitions (720p, 1080p
  or 4K). Choose all pages, the current page or specific pages; several pictures come as a ZIP.
- **Smart guides:** while dragging, elements snap to the page edges and centre and to each other
  (pink lines show what lined up); rotation snaps to 45°. Hold **Alt** to move freely. Align to
  page / align elements / space evenly from the side panel.
- **Photo editing:** 12 filter looks with intensity, brightness, contrast, saturation, warmth,
  tint, blur and vignette; **crop** with shape presets (1:1, 4:5, 16:9…); **set as page
  background** (fill, fit or repeat; transparency; colour wash; detach again).
- **More elements:** ~180 icons in 11 categories (recolourable, searchable), **frames** (square,
  circle, arch, heart, star… — drop a photo on them), **tables** (edit cells, rows/columns,
  header, stripes, colours), **charts** (bar, row, line, area, pie, donut with a data editor) and
  **QR codes** / product barcodes.
- **Home:** create a design from 27 sizes (social, video, slides, print, documents, custom size),
  reopen recent designs, move to trash.
- **AI (needs a Claude API key):**
  - **Premium design** (on by default) — Claude art-directs your brief, Google's Gemini paints
    full-bleed artwork (needs a Google AI key, see below), Claude lays out 3D titles and badges
    over it, then **looks at the finished render and polishes it** (up to 3 review rounds).
    Takes 1–3 minutes; about $0.15–0.45 per design. Without a Google key it still makes a rich
    design, just without painted artwork.
  - **Magic Design** (quick mode) — describe a design ("birthday invitation, pink and gold") and
    get up to 3 complete, editable designs in different styles in seconds. Layout problems are
    fixed automatically (text kept inside the page, readable contrast, nothing hiding text).
  - **Design Assistant** — chat with the editor: "make the title bigger", "add a button at the
    bottom", "use warmer colours". Every AI edit is one undo step.
  - **Magic Write** — rewrite, shorten, expand, fix grammar, simplify, change tone, translate,
    continue, headlines, captions, hashtags, call-to-action and emojis for any text box.
  - **Colours & fonts** — palettes and font pairings for any mood, applied to your design in
    one click (text stays readable).
  - **Fully customisable** in **Settings → AI**: quality (Fast / Balanced / Best), creativity,
    default tone, writing language, brand voice, audience, number of designs and suggestions,
    auto-apply for the assistant, cost estimates, daily budget, and your own API key.
- **English & Arabic** with right-to-left layout; light and dark themes.

---

## Run it on your computer (2 commands)

You need **Node.js 20.12 or newer** ([download the LTS version](https://nodejs.org/)).
Open a terminal in this folder and run:

```bash
npm install
```

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser. To check everything is working, open
**http://localhost:3000/health**.

To stop the app, click in the terminal and press `Ctrl + C`.

---

## Adding your Claude API key (optional, for AI features)

The app works without a key, but the AI features stay switched off until you add one.

1. Go to <https://console.anthropic.com> and sign in (or create an account).
2. Click **API Keys** → **Create Key**. Give it a name like "Lumora" and copy the key.
   It starts with `sk-ant-`.
3. In this project folder, make a copy of the file `.env.example` and name the copy
   **`.env.local`** (exactly that, with the dot at the start).
4. Open `.env.local` in a text editor and paste your key after `ANTHROPIC_API_KEY=` so the line
   looks like `ANTHROPIC_API_KEY=sk-ant-…` (no spaces, no quotes).
5. Save the file, stop the app (`Ctrl + C`) and start it again with `npm run dev`.
6. Run `npm run check-env` — it should say **ANTHROPIC_API_KEY is set**.

**Keep your key safe.** `.env.local` is never uploaded to git, and the key is only used on the
server — it is never sent to the browser. Don't paste it into chats, emails or screenshots.

### How AI costs work

- You pay Anthropic directly for what you use. There is no other running cost.
- **Daily budget cap:** `AI_DAILY_BUDGET_USD` in `.env.local` (default **$1 per day**). When the
  cap is reached, AI buttons pause with a friendly message until the next day.
- Every AI button shows an **estimated cost** before you click, and the AI panel shows
  **today's total**. A typical Magic Write request costs well under $0.001; a Magic Design costs
  a few cents per variation on Balanced.
- There is a second, per-browser **daily budget** in **Settings → Keys & usage** (default $1).
- Which model does what (edit `src/lib/ai/models.ts` to change it):

  | Setting  | Writing, palettes | Designs & assistant |
  | -------- | ----------------- | ------------------- |
  | Fast     | Claude Haiku 5.5  | Claude Haiku 5.5    |
  | Balanced | Claude Haiku 5.5  | Claude Sonnet 5.5   |
  | Best     | Claude Opus 5.5   | Claude Opus 5.5     |

- If Claude declines a request, Sonnet/Opus requests automatically retry on Anthropic's
  recommended fallback model (`fallbacks: "default"`).

## Adding a Google AI key (optional, for Premium artwork)

Premium designs use Google's Gemini image models ("Nano Banana") to paint the artwork. Image
generation is **not** in Google's free tier, so billing must be switched on (about **$0.05 per
artwork** with Nano Banana 2.1, $0.13 with Nano Banana Pro).

1. Go to <https://aistudio.google.com/apikey> and sign in with your Google account.
2. Click **Create API key**. If asked, set up billing for the project (Google Cloud Billing).
   The key starts with `AIza`.
3. Either:
   - **Recommended:** add it to `.env.local` as `GEMINI_API_KEY=AIza…`, then restart
     `npm run dev`. The key stays on the server and counts against `AI_DAILY_BUDGET_USD`; or
   - paste it in **Settings → Keys & usage → Google AI key** and press **Test key** (free —
     it only lists Google's models). It stays in your browser and is sent only with your own
     artwork requests.
4. In **Settings → Keys & usage → Premium designs** choose the artwork model (Nano Banana 2.1 or Pro) and
   how many self-review rounds Claude does (default 2).

## Accounts and emails (Resend)

Log in / sign up work out of the box on your computer: accounts are stored in a small database
file, `.data/lumora.db` (never committed), and passwords are stored only as secure hashes.

Without an email key, account emails (the confirm-your-email and reset-password links) are
**printed in the terminal** where `npm run dev` runs — copy the link from there. To really send
them:

1. Create a free account at <https://resend.com> and make an API key at
   <https://resend.com/api-keys> (it starts with `re_`).
2. Add it to `.env.local` as `RESEND_API_KEY=re_…` and restart `npm run dev`.
3. Until you verify your own domain in Resend, emails come from Resend's test address and can
   only go to the email you signed up to Resend with. After verifying a domain, set
   `EMAIL_FROM="Lumora Studio <hello@yourdomain.com>"`.
4. Log in, open **Account** and press **Send me a test email**.

Lumora sends: a confirm-your-email link when you sign up, a welcome email once it's confirmed, a
reset link when you forget your password (or press **Email me a reset link** on the Account page),
and a "your password was changed" notice after any password change. While `npm run dev` is running,
<http://localhost:3000/api/email/preview> shows every email in both languages without sending
anything.

When you put the site online, also set `BETTER_AUTH_SECRET` (32+ random characters — the
`.env.example` file shows a command that makes one) and `BETTER_AUTH_URL` (the site's address,
used in email links).

### Bring your own key

Other people using your copy of Lumora can paste **their own** key in **Settings → Keys & usage**. It stays
in their browser and is sent only with their own requests — it is never stored on the server.
A **Test key** button checks it for free (no tokens are spent). Requests made with a personal key
don't count against the site's daily budget.

---

## Useful commands

| Command              | What it does                                                     |
| -------------------- | ---------------------------------------------------------------- |
| `npm run dev`        | Start the app at http://localhost:3000                           |
| `npm run check-env`  | Check your settings and keys (never prints key values)           |
| `npm run verify`     | Full quality check: types, lint, formatting and unit tests       |
| `npm run test`       | Unit tests only                                                  |
| `npm run test:e2e`   | Browser smoke tests (starts the app automatically)               |
| `npm run build`      | Production build (what a host like Vercel runs)                  |
| `npm run format`     | Auto-format all code                                             |
| `npm run icons`      | Re-generate favicon / app icons from the logo artwork            |

The first time you run `npm run test:e2e`, install the test browser once with
`npx playwright install chromium`.

---

## Backing up your designs

Your designs are saved **in your browser** on this computer (no account, no cloud needed).
A one-click "Export all designs" (.zip) and "Import" will be in **Settings** _(Phase 3)_. Optional
cloud sync with a free Supabase account comes later and is off by default.

## Adding new templates

Templates are generated in code, so they cost nothing and stay editable (`src/lib/templates`):

- **Themes** (`content/*.ts`) hold the words in English and Arabic, plus suitable icons, palettes
  and font pairs. Add a theme, then list its id in a kind's plan in `catalog.ts`.
- **Blueprints** (`blueprints/*.ts`) are layouts written in units of 1% of the page, so one layout
  works across sizes. They measure their words first, so text never runs off the page.
- New icons: add the Lucide name to `scripts/gen-template-icons.mjs` and run
  `node scripts/gen-template-icons.mjs`.
- Review by eye: `VITE_TEMPLATE_SHEETS=1 npx vitest run --project browser tests/browser/template-sheets.test.ts`
  writes contact sheets to `.lumora-cache/sheets/` (add `VITE_SHEET_KIND=instagramPost`,
  `VITE_SHEET_LOCALE=ar`, `VITE_SHEET_PAGES=1`, or `VITE_SHEET_START=400 VITE_SHEET_COUNT=100`
  to narrow it down; `VITE_SHEET_BLUEPRINTS=photoFull,magazine` tries layouts on many themes).
- **Photos** come from `src/lib/photos/library.ts` (Unsplash photo ids by topic). Each theme
  lists its topics (`photos` in `content/*.ts`); frames fill themselves from them. To add a
  topic, add its photo ids and its name in both message files (`editor.photos.topics`). Check new
  photos for logos and fit: `VITE_TOPICS=perfume,sneakers npx vitest run --project browser
  tests/browser/photo-sheets.test.ts` writes `.lumora-cache/sheets/photos.png`.
- `tests/unit/templates.test.ts` builds every template in both languages and fails if any text
  leaves the page.

---

## Roadmap

| Phase | What                                                                              | Status  |
| ----- | --------------------------------------------------------------------------------- | ------- |
| 0     | Foundation: project setup, tooling, health page, security headers, EN/AR, themes  | ✅ Done |
| 1     | Core editor: canvas, shapes, text, layers, undo/redo, autosave                    | ✅ Done |
| 5     | AI core: cost controls, Magic Write, Design Assistant, Magic Design, palettes     | ✅ Done (moved up — needs your API key to try) |
| 6     | AI advanced: resize, translate, brand AI, slides, vision, illustrations, and more | Next    |
| 2     | Rich editing: text styling, images, snapping, groups, frames, icons, shortcuts    | ✅ Mostly done (0.4–0.5) |
| 3     | Pages, dashboard, export (PNG/JPG/SVG/PDF/PPTX), version history, present mode    | 🟡 Pages, present, PNG/JPG/SVG/PDF/MP4 done; PPTX and version history to do |
| 4     | Fonts, stock photos, brand kit, charts, tables, QR, templates browser             | 🟡 Charts, tables, QR, photos, 50,000+ templates done |
| 7     | Polish: dark mode / RTL pass, touch, offline, onboarding, performance             |         |
| 8     | Ship: templates, guide, free deployment                                           |         |

---

## Decisions and defaults

The build brief asked for sensible defaults instead of questions. Here is what was chosen and why:

| Topic          | Choice                                                         | Why                                                                                                                                               |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript     | 6.0 (not 7.0)                                                  | TypeScript 7 just shipped, but the lint tooling (`typescript-eslint`) supports up to 6.0 today.                                                   |
| Canvas engine  | Fabric.js **7** (brief said 6)                                 | 7 is the current release of the same library with the same API style; 6 is no longer the latest.                                                  |
| ESLint         | 9                                                              | Some React lint plugins don't officially support ESLint 10 yet.                                                                                   |
| Language       | Stored in a cookie, no `/ar/...` URLs                          | Simpler links, and switching language keeps you on the same page. Falls back to your browser's language.                                          |
| Arabic UI font | IBM Plex Sans Arabic                                           | Inter and Sora have no Arabic letters; Plex Arabic is open-source (OFL) and pairs well with Inter.                                                |
| Theme switch   | Small built-in switcher (instead of the `next-themes` package) | `next-themes` triggers a React warning under our strict security policy. Ours sets the theme before the first paint, so there is no flash.        |
| Colours        | Indigo for buttons; deeper sunset gradient behind white text   | The bright sunset gradient fails readability (WCAG AA) with white text, so it is used for the logo and accents, and a deeper version for buttons. |
| Security       | Per-request nonce Content-Security-Policy                      | Blocks injected scripts. Trade-off: pages render on the server per request (fine for a free host).                                                |
| Phase order    | AI core (Phase 5) built right after Phase 1                    | You asked for many customisable AI features first; AI works with text, shapes and lines today and gains images, charts etc. as later phases land. |
| AI creativity  | Steered by instructions, not "temperature"                     | The current Claude models don't accept a temperature setting, so Safe / Balanced / Bold changes the instructions instead.                          |
| Server budget  | In-memory daily counter per server instance                    | Free and simple. On serverless hosts each instance counts separately, so the real cap can be slightly higher under heavy traffic.                 |
| Background removal | BiRefNet Lite on the Lumora server (ONNX Runtime: DirectML on Windows GPUs, else CPU) | In-browser runtimes hit GPU limits and a 4 GB memory cap with high-quality models (tested on an RTX 40-series). The server has neither limit. In-browser BEN2 / MODNet stay as a backup for hosts that can't run it. |
| AI artwork     | Google Gemini image models via the Interactions API           | Claude doesn't make images. Nano Banana 2.1 is cheap and strong; Pro is selectable. Requests use `store: false`.                                    |
| Big AI layouts | JSON Schema in the prompt + Zod validation + one repair round | Layout schemas with text effects exceed the structured-output grammar limit; this keeps strict validation without that limit.                    |
| Video download | Frame-by-frame encoding with WebCodecs ([mediabunny](https://mediabunny.dev)), MP4 (H.264) with a WebM fallback | Smooth and exact on any computer (no dropped frames), usually faster than real time, and nothing is uploaded. |
| PDF download   | Lumora's own small PDF writer; each page is a high-resolution picture | No large PDF library; looks identical to the canvas. Trade-off: text in the PDF isn't selectable yet. |
| Photo filters  | Fabric's 2D filter pipeline (not WebGL) + a custom vignette | The WebGL pipeline crops photos larger than its texture size; 2D works for any photo size. |
| Templates      | Generated from layouts × themes × palettes × fonts (not saved files) | Thousands of consistent, editable designs in two languages for free, each rebuilt at the exact size of the design it goes into. |
| Stock photos   | A hand-picked list of free Unsplash photos, loaded from Unsplash's image servers | Real photos in every template with no account, key or cost; photos are credited, and branded or off-topic shots were left out. |
| Snapping       | Engine-level smart guides (6 screen px, Alt to disable)       | Works the same at every zoom level and never fights keyboard nudges.                                                                              |
| Photo editor   | Its own Canvas 2D engine (`src/lib/photo`), separate from the design editor | A raster editor needs per-pixel layers, masks and blend modes that Fabric doesn't model; plain canvases keep it fast, testable and dependency-free. |

## Known issues

- `npm audit` reports a warning in a dependency of `eslint-config-next` (the code-checking tool).
  It is only used on your computer while developing and never ships in the app.
- The HD background remover needs a server that can run native code (your computer, a VPS or
  Docker). On serverless hosts such as Vercel it switches to the in-browser models, which are
  weaker (the fast one is tuned for photos of people). Set `BACKGROUND_REMOVAL_SERVER=on|off`
  to force either way.
- The Gemini artwork step is built against Google's current API docs and covered by tests with a
  fake Google server, but it hasn't run against the real service yet (no Google key here).
- PDF downloads are pictures of each page (sharp, 300 dpi for print), so their text can't be
  selected or searched yet. SVG downloads don't include page background photos or vignettes.
- Video download needs a browser with WebCodecs (current desktop Chrome, Edge, Safari or Firefox).
  Long videos are made in memory, so very long 4K decks can use a lot of RAM.
- Accounts live in a SQLite file on the server (`.data/lumora.db`). That's right for your
  computer, a VPS or Docker, but serverless hosts (e.g. Vercel) don't keep files, so accounts need
  a hosted database there — not wired up yet. Accounts don't sync designs yet.
- The photo library is a fixed, hand-picked set (about 1,000 photos). Searching all of Unsplash
  needs a free Unsplash API key — not wired up yet. Photos load from Unsplash, so templates show
  their photos only when you're online (they're cached once seen). Template text uses made-up
  names, numbers and addresses; replace them.
- The photo editor works on the main thread, so filters on very large photos (up to 8192 px a
  side) take a few seconds. It doesn't open or save layered files from other apps, and has no
  smart objects, vector masks or channels yet (see `docs/research/photo-editor-study.md`).
  Generative fill is tested against a fake Google server only (no Google key here).
- Tables can't merge cells from the editor yet (the data model supports it), and on-canvas cell
  editing isn't there yet — edit cells in the side panel.
- This folder is inside **OneDrive**. OneDrive tries to sync `node_modules` (thousands of files),
  which can make installs slow. If that becomes annoying, move the project to a folder outside
  OneDrive (for example `C:\dev\lumora-studio`).

## Credits and licences

- Code: [MIT](LICENSE).
- Fonts: Inter, Sora, IBM Plex Sans Arabic and the display fonts in the font list — SIL Open Font
  License (or Apache 2.0), served via Google Fonts.
- Background removal: [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) (MIT),
  [BEN2](https://huggingface.co/PramaLLC/BEN2) (MIT), [MODNet](https://github.com/ZHKKKe/MODNet)
  (Apache 2.0), run with [Transformers.js](https://github.com/huggingface/transformers.js)
  (Apache 2.0) and [ONNX Runtime](https://onnxruntime.ai) (MIT).
- Icons: [Lucide](https://lucide.dev) — ISC licence (also the icon elements in designs).
- Accounts: [Better Auth](https://better-auth.com) (MIT). Email: [Resend](https://resend.com)
  Node SDK (MIT).
- Photos: [Unsplash](https://unsplash.com) — free to use under the
  [Unsplash License](https://unsplash.com/license) (no permission needed, commercial use allowed);
  each photo is credited to its photographer in the side panel. Unsplash+ photos are not used.
- Video encoding: [mediabunny](https://github.com/Vanilagy/mediabunny) — MPL-2.0 (used unmodified).
- QR codes: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — MIT. "QR Code"
  is a registered trademark of DENSO WAVE INCORPORATED.
- UI primitives: [Radix UI](https://www.radix-ui.com) (MIT) via [shadcn/ui](https://ui.shadcn.com)
  (MIT).
- The Lumora logo and all templates are original to this project.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organised.
