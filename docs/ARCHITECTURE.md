# Lumora Studio — Architecture

This document explains how the code is organised and why. It grows with each build phase;
sections marked _(planned)_ describe where upcoming work will live.

## Big picture

```
 Browser                                                     Server (Next.js)
┌──────────────────────────────────────────────┐            ┌──────────────────────────────┐
│ React UI (App Router pages, panels, dialogs) │            │ proxy.ts  → CSP nonce, headers│
│        │ reads/writes                        │            │ /api/health                   │
│        ▼                                     │  fetch     │ /api/ai/{write,palette,design,│
│ Zustand store + undo/redo history            │ ─────────► │   assistant,status,test-key}  │
│        │ commands                            │            │ src/lib/ai/server (guard,     │
│        ▼                                     │            │   budget, rate limit, runner) │
│ Engine (thin wrapper over Fabric.js)         │            └──────────────┬───────────────┘
│        │ renders                             │                           ▼
│        ▼                                     │                 Anthropic / stock photo APIs
│ <canvas>                                     │
│                                              │
│ Scene graph JSON (Zod schema) ◄─► IndexedDB  │
│ (single source of truth)          via Dexie  │
└──────────────────────────────────────────────┘
```

**Golden rule:** the versioned scene-graph JSON (`src/lib/schema.ts`) is the single source of
truth. The canvas is a _view_ of it. AI features read and write the same JSON. The UI never
touches Fabric directly — only through `src/lib/engine`.

## Editor data flow

1. Every edit goes through `useEditorStore.change(label, recipe)` (`src/lib/store/editor-store.ts`).
   Immer records forward + inverse patches → precise undo/redo (200 steps; edits with the same
   `mergeKey` within 1 s merge into one step, e.g. slider drags and arrow-key nudges).
2. High-level commands live in `src/lib/store/actions.ts` (add, delete, reorder, align, AI results…)
   and use pure tree helpers in `src/lib/document/*`.
3. `CanvasArea` subscribes to the store and calls `engine.renderPage(page)`. The engine reconciles
   Fabric objects by element id and skips unchanged elements (Immer keeps their object identity).
4. Canvas gestures come back via callbacks (`onTransform`, `onTextCommit`, `onSelectionChange`) and
   become store changes. Values Fabric computes (text height) are stored with `syncDerived`, which
   does not create an undo step.
5. `useAutosave` saves to IndexedDB ~1.2 s after a change and when the tab hides/closes, with a
   thumbnail from the live canvas.

## AI module (`src/lib/ai`)

| File                     | Role                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| `models.ts`              | Model ids, task profiles (max tokens, effort), routing, prices          |
| `contract.ts`            | Zod schemas for every request + the customisable `AiPrefs`              |
| `cost.ts`                | Exact cost from `usage`, pre-request estimates                          |
| `prompts/*.ts`           | Versioned system prompts (`write@1`, `design@1`, …), data-tag wrapping  |
| `design-format.ts`       | Magic Design JSON shape, conversion to scene elements, auto-fix pass    |
| `assistant-tools.ts`     | Assistant tool schemas, validation, `applyAssistantActions`             |
| `scene-summary.ts`       | Compact page description sent to the assistant                          |
| `server/*`               | `server-only`: key resolution, guard (origin, rate, budget), runner     |
| `api.ts`, `settings-store.ts`, `ledger.ts` | Browser side: requests, user settings, daily spend    |

Request lifecycle: browser `api.ts` (checks the browser budget, adds the optional personal key) →
route → `guard()` (same-origin, rate limit, key, owner budget) → `runStructured()` /
`runTools()` (cached system prompt, `output_config.effort`, Zod output format, refusal fallbacks
on Sonnet/Opus) → validate + post-process → JSON with `usage` → browser records spend.

Claude never edits the document directly: Magic Design returns a page the user chooses to apply;
the assistant returns validated tool calls that the browser applies as one undoable change.

## Folders

| Path                       | Contents                                                                 |
| -------------------------- | ------------------------------------------------------------------------ |
| `src/app`                  | Routes (App Router). `layout.tsx` sets language, direction, theme, fonts |
| `src/app/api`              | Server routes. Only place that may use secrets                           |
| `src/components/ui`        | Generic UI primitives (shadcn/ui on Radix)                               |
| `src/components/brand`     | Logo and wordmark                                                        |
| `src/components/theme`     | Light/dark/system theme provider                                         |
| `src/components/health`    | Health page building blocks                                              |
| `src/lib/config.ts`        | Public app constants                                                     |
| `src/lib/env-schema.ts`    | Zod schema for every environment variable (shared with scripts)          |
| `src/lib/env.ts`           | Server-only parsed env + feature flags (booleans only)                   |
| `src/lib/security/csp.ts`  | Content-Security-Policy builder                                          |
| `src/lib/theme.ts`         | Theme storage key + pre-paint script                                     |
| `src/i18n`                 | Locale config, request config, `setLocale` server action                 |
| `src/proxy.ts`             | Per-request nonce + CSP (Next.js 16 "proxy", formerly middleware)        |
| `messages/`                | UI translations (`en.json`, `ar.json`) — keys must match                 |
| `scripts/`                 | `check-env`, `generate-icons` (later: `seed-templates`)                  |
| `tests/unit`, `tests/e2e`  | Vitest and Playwright tests                                              |
| `public/icons`, `brand`    | Generated PWA icons and logo files                                       |

| `src/lib/schema.ts`        | The document model (Zod) — single source of truth                        |
| `src/lib/document`         | Factory, formats, migrations/repair, tree ops, arrange, palette, contrast |
| `src/lib/engine`           | Fabric wrapper: mapping, engine, shapes, text styles, off-screen render  |
| `src/lib/store`            | Editor store (undo/redo), actions, UI store                              |
| `src/lib/storage`          | Dexie database + design repository                                       |
| `src/lib/fonts`            | Google Fonts loader + starter catalogue                                  |
| `src/lib/ai`               | AI module (see below)                                                    |
| `src/components/editor`    | Editor shell, canvas, panels (incl. `panels/ai`), properties             |
| `src/components/ai`        | Shared AI UI: setup card, cost hint, spend meter, design variations      |
| `src/components/home`      | Dashboard pieces: hero art, Magic Design box, format gallery, recents    |
| `src/components/settings`  | Settings page sections                                                   |

Planned: `src/lib/export`, `src/templates`, more panels and dialogs.

## Key decisions

### Security

- **CSP with nonces.** `src/proxy.ts` creates a random nonce per request and sends a
  Content-Security-Policy with `script-src 'nonce-…' 'strict-dynamic'`. Next.js stamps the nonce on
  its own scripts. Injected `<script>` tags cannot run. Styles allow `'unsafe-inline'` because
  server-rendered Radix primitives use inline `style` attributes. `'wasm-unsafe-eval'` is allowed
  for the in-browser background remover (Phase 6). Every external host is listed in `csp.ts`.
- **Secrets stay on the server.** Only `src/lib/env.ts` (marked `server-only`) reads keys. The
  health endpoint reports booleans. `findLeakedSecrets` + `npm run check-env` warn if a secret is
  named `NEXT_PUBLIC_*` (which would ship it to every browser).
- Static headers (`nosniff`, `X-Frame-Options: DENY`, referrer and permissions policy) are set in
  `next.config.ts`.

### Internationalisation and RTL

- `next-intl` without URL prefixes. Locale = `lumora-locale` cookie → else `Accept-Language` → else
  English. `setLocale` (server action) writes the cookie, then the page refreshes in place.
- `<html lang dir>` is set from the locale; Tailwind logical utilities (`ms-`, `pe-`, `start-`)
  make the layout mirror automatically.
- `src/i18n/types.d.ts` makes every `t("key")` type-checked against `messages/en.json`; a unit test
  checks Arabic has the same keys.

### Theming

- Design tokens are CSS variables in `src/app/globals.css`, exposed to Tailwind via `@theme inline`.
- Dark mode = `<html data-theme="dark">`. A tiny inline script (with the CSP nonce) sets it before
  the first paint; `ThemeProvider` keeps it in sync afterwards (tabs, OS changes). We use an
  attribute React doesn't manage, so root-layout re-renders never wipe it.

### Rendering

- Pages render dynamically (needed for per-request CSP nonces and the language cookie).
  Static files (icons, manifest) are still static.

## Testing

- `npm run verify` — `tsc --noEmit`, ESLint, Prettier check, Vitest.
- Vitest runs in jsdom with `fake-indexeddb`; `server-only` is stubbed so server modules are
  testable.
- Playwright (`tests/e2e`) starts `next dev` (or reuses one on port 3000) and checks the health API,
  the health page in a real browser (no console errors), the CSP header and Arabic RTL.

## Accounts and email (0.8.0)

- `src/lib/auth/server.ts` configures Better Auth: email + password with required email
  confirmation, password reset, and `nextCookies()`. The database is Node's built-in
  `node:sqlite` (`DatabaseSync`) at `AUTH_DATABASE_PATH` (default `.data/lumora.db`); tables
  are created on first use with `getMigrations`. The session secret is `BETTER_AUTH_SECRET`,
  else one generated once into `.data/auth-secret`.
- `/api/auth/[...all]` hands every account request to Better Auth. Pages: `/signup`, `/login`
  (`?next=` is limited to paths on this site), `/forgot-password`, `/reset-password`,
  `/account`. The browser side uses `authClient` (`src/lib/auth/client.ts`); server pages use
  `currentUser()`.
- `src/lib/email`: `renderEmail` builds the text + HTML of each email from the `email` messages
  (language from the site cookie, else Accept-Language); `sendEmail` sends through Resend, or
  prints in development when there's no key. `/api/email/test` emails only the signed-in user's
  own confirmed address.

## Photos (0.7.0)

- `src/lib/photos` holds the built-in library (`library.ts`: Unsplash photo ids and
  photographers by topic) and helpers: `photoUrl` (a few cached widths on images.unsplash.com,
  already allowed by the CSP), `photoAttribution` (stored on the image or frame), `scalePhotos`
  (small photos for thumbnails), `searchTopics`.
- Themes list photo topics; `buildTemplate` gives each template a seeded `PhotoPicker`, and
  `Kit.frame` fills frames from it (`photo: "people"` for portraits, `false` for empty).
- Placing photos goes through `editorActions.placePhoto`: it fills a frame, replaces an image
  (`replaceImage` keeps the box and crops the new photo to cover it with `coverCrop`), or adds
  a new image. The Photos panel, the Replace button, the right-click item and drops onto the
  canvas (files or photos dragged from the panel) all use it.

## Templates (0.6.0)

- `src/lib/templates` generates the library at runtime: `catalog.ts` combines kinds × themes ×
  blueprints (balanced so each layout is used about equally, and only for themes whose words suit
  it), `build.ts` draws a template with a `Kit` (`kit.ts`: text that measures and fits, shapes,
  glows, icons, frames, charts, tables, QR) and parses every element through the Zod schema.
- Blueprints are written left-to-right in units of 1% of the page; Arabic pages are drawn by the
  same blueprint and mirrored (x, rotation, text alignment, shape flips) with Arabic font pairs.
- Templates are rebuilt at any size of the same shape family (`templatesForSize`), so the editor
  panel can apply a post template to a custom-size post.
- Icons come from `icons.generated.ts` (Lucide markup, produced by `scripts/gen-template-icons.mjs`).

## Pages, animation, downloads, photos and rich elements (0.5.0)

- **Page background** — `engine/background.ts` (`PageBackground`, a Rect subclass) draws a
  colour/gradient or a photo (cover/contain/tile, opacity, tint). The editor engine, thumbnails,
  `PagePlayer` and every download use it, so stacking indices stay "background + elements".
- **Animations** — `engine/animate.ts` puts objects into a start state and eases them to their
  real state (`playEntrance` → `{ done, finish, seek, duration }`). `seek` makes video export
  frame-exact; `PagePlayer.show(page, { animate, manual })` drives it.
- **Downloads** — `lib/export/`: `download.ts` (formats, page choice, ZIP), `pdf.ts` (picture
  PDF writer; JPEG or lossless Flate via `CompressionStream`), `zip.ts` (stored ZIP + CRC-32),
  `video.ts` (PagePlayer at a fixed size → 2D compositing canvas for transitions → mediabunny
  `CanvasSource`). Rendering goes through `engine/render.ts` (`renderPageToCanvas`,
  `renderPageToSvg`).
- **Smart guides** — `engine/guides.ts` listens to Fabric's moving/scaling/rotating events,
  snaps in scene units (6 screen px ÷ zoom) and draws on the top canvas between renders.
- **Photos** — filters live in the scene graph (`ImageElement.filters`: preset + strength +
  manual adjustments); `document/image-filters.ts` resolves them, `engine/image-filters.ts`
  maps them to Fabric filters (2D backend) and `LumoraImage` adds the vignette. Crops/masks are
  applied in `mapping.ts` (`maskClip`).
- **Rich elements** — SVG icons and filled frames render as photos (`asImage` in mapping:
  SVG → data URL, frames → cover crop + mask); empty frames as shapes; tables, charts and codes
  are Fabric groups built by `engine/composites.ts` in their own box and rebuilt whenever their
  layout key changes (`compositeKey`). Pure helpers (codes, svg, photo, elements, fonts) live in
  `lib/document` and are unit-tested.

## Images, background removal and Premium design (0.4.0)

- **Images** — `src/lib/storage/assets.ts` stores uploads as Blobs in IndexedDB (`asset:<id>`);
  `src/lib/engine/images.ts` loads them once; `mapping.ts` draws them with `FabricImage`
  (placeholder first, crop + scale to the element box, corner radius via `clipPath`).
- **Background removal** — `src/lib/background/`. `jobs.ts` sends the image to
  `/api/image/remove-background` (`server-remover.ts`: BiRefNet Lite via Transformers.js +
  onnxruntime-node, DirectML → CPU, model cached in `.lumora-cache/`). If the server can't
  (503/offline), `remove-background.ts` uses a Web Worker (`worker.ts`) with BEN2 (WebGPU) →
  MODNet, remembering GPU failures per browser. The cut-out becomes a new asset; swapping it in
  is one undo step.
- **Groups** — `src/lib/document/grouping.ts` (group/ungroup/refit/scale, all lossless);
  the engine draws a group as one Fabric `Group` with a fixed layout matching the element box.
- **3D text** — `src/lib/engine/lumora-textbox.ts` draws the `extrude` sides before the face.
- **Premium design** — orchestrated in the browser (`src/components/ai/premium.ts`) so each step
  can show progress: `/api/ai/premium/plan` (Claude, art direction) → `/api/ai/image` (Gemini,
  `src/lib/ai/server/gemini.ts`) → `/api/ai/premium/compose` (Claude sees the artwork) →
  render with `renderPageToDataUrl` → `/api/ai/premium/review` (Claude sees the render), 0–3×.
  Shapes live in `src/lib/ai/premium.ts`, prompts in `src/lib/ai/prompts/premium.ts`.
  `runRich` (in `server/run.ts`) streams with adaptive thinking, puts the JSON Schema in the
  system prompt and validates with Zod (one repair round).
