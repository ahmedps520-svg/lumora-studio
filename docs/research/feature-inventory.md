# Design-editor feature inventory (internal research)

> Internal benchmark notes, compiled Oct 2026 from the help centre and tutorials of the
> best-known online design editor, used as a parity checklist for Lumora. Lumora's own UI and
> marketing never name other products. **†** = from tutorials / long-standing behaviour (verify).
> The "Lumora status" column at the end tracks what we have.

## 1. Editor basics

**Right-click (context) menu** — also via "⋯ More" or Shift+F10.

- Single element: Copy, Paste, Duplicate, Delete, Copy style, Lock ▸ (Lock / Lock position only),
  Layer ▸ (Forward / Backward / To front / To back, Show layers†), Align to page ▸
  (Left/Center/Right/Top/Middle/Bottom)†, Link, Comment, Alternative text, Show/Hide element
  timing, Info (attribution)†.
- Image/frame extras: Set image as background, Replace background, Detach image from background,
  Replace (frames), Apply colors to page†.
- Multiple: Group/Ungroup, Align elements, Space evenly†, Tidy up, **Download selection**,
  **Resize canvas to selection**.
- Page/background: Paste, Comment, Background color, Detach image from background, Lock page.
  Page thumbnail ⋯: Add page, Duplicate, Delete, Hide page, Add page title, Add transition, Copy
  link to this page.
- Text while editing: Cut/Copy/Paste†, Link (Ctrl+K), Copy/paste text style, Comment.
- Table cells: Merge/Unmerge; row/column ⋯: insert before/after, move, delete, size equally,
  size to content.

**Selection** — click; Shift+click add/remove; marquee drag; Ctrl+A; Esc†; Tab/Shift+Tab cycle;
Shift+W/A/S/D add nearest; F8 multi-select mode; groups: first click group, next click child;
Ctrl+click selects behind†; layers panel selects hidden elements.

**Guides & snapping** — smart guides to page/element edges & centres + equal-spacing hints†.
Rulers & guides (Shift+R), drag guides from rulers, presets (12 columns, 3 columns, 3×3, custom),
lock/clear guides; margins; print bleed (0.125 in); page views (single, thumbnails, scroll,
grid); go to page; zoom with Fit / Fill.

**Position panel** — Arrange (forward/backward/front/back; align to page; align elements; space
evenly; tidy up; W/H/ratio lock/X/Y/rotation) and Layers tab (drag reorder, groups, ⋯ menu).

**Lock** — Lock (position+style+content) vs Lock position only; page lock; Alt+Shift+L cycles.

**Transparency** slider 0–100; per-stop gradient transparency. **Copy style** (paint roller;
Alt+Ctrl+C/V). **Links** (URL / page / design; Ctrl+K). **Comments** (threads, @mentions,
resolve). **Flip/rotate** (Alt+, / Alt+.). **Floating toolbar** per selection type.

## 2. Keyboard shortcuts

Basic: Ctrl+Z / Ctrl+Y / Shift+Ctrl+Z, Ctrl+A, Ctrl+K link, Ctrl+Enter add page,
Ctrl+Backspace delete empty page, `/` quick actions, Alt+1 layers, Alt+Ctrl+G go to page.
Add: T text, R rectangle, C circle, L line, Shift+\\ elbowed line, S sticky note.
Elements: Ctrl+D, Ctrl+G, Ctrl+Shift+G, Alt+Shift+L lock, Ctrl+] / Ctrl+[, Alt+Ctrl+] / [ front
/ back, Alt+Shift+T tidy up, arrows nudge (Shift ×10), Alt+, / . rotate, Ctrl+arrows resize.
Text: Shift+Ctrl+F font menu, Ctrl+F find/replace, Ctrl+B/I/U, Shift+Ctrl+S strike,
Shift+Ctrl+K uppercase, Shift+Ctrl+L/C/R align, Shift+Ctrl+. / , size ±1, Alt+Ctrl+↑/↓ line
spacing, Alt+Ctrl+. / , letter spacing, Ctrl+Shift+7/8 lists, Alt+Ctrl+C/V text style.
Zoom: Ctrl+ +/−, Ctrl+0 actual size, Alt+Ctrl+0 fit, Shift+Ctrl+0 fill. View: Shift+R rulers,
Alt+Ctrl+1/2/3 views, Alt+Ctrl+P present.

## 3. Pasting

Elements (with styles) within/between designs and tabs; pages; clipboard images → image
elements (+ Uploads)†; external text → new text box (or into the edited box)†; spreadsheet ranges
→ tables†; supported URLs → embeds (YouTube, Maps, …); SVG stays vector; Paste style separate.

## 4. Text

Add text box / heading / subheading / body; font combinations; brand text styles (H1–H5, body);
page numbers. Formatting: font, size, colour + gradient, B/I/U/S, alignment, lists, letter &
line spacing, anchor, case, sub/superscript, kerning, ligatures, vertical text, find & replace.
Effects: Drop shadow, Glow, Echo, Outline, Background, Splice, Hollow, Glitch, Neon, Curve
(−100…100); quick styles. Text boxes auto-grow; side handles rewrap; corner handles scale font.

## 5. Elements

Shapes (incl. flowchart; fill/gradient, stroke style/weight, corner rounding, sides, star inner
depth, text inside, swap shape, convert to frame). Lines (start/end markers: arrow, triangle,
circle, square, diamond, bar; dash styles; straight/elbowed/curved; connectors that stay
attached; labels). Graphics/stickers (recolourable vectors, GIFs, emoji). Frames (masks, device
mockups; double-click to reposition). Grids (cells, spacing). Tables (rows/columns, merge,
borders, fills, size equally, paste from spreadsheets). Charts (bar/row variants, line, area,
pie, donut, scatter, bubble, treemap, funnel, radar, progress ring/bar/dial, pictogram; data
editor; legend, labels, axes, colours). QR code (URL, colours, margin). Icons, sticky notes.

## 6. Photos

Edit: AI tools (magic edit/eraser/expand…), BG remover, upscale. Adjust: auto; temperature,
tint; brightness, contrast, highlights, shadows, whites, blacks; vibrance, saturation;
sharpness, clarity, vignette; invert; per-colour HSB. Filters (presets + intensity, duotone).
Crop (aspect presets, rotate, smart crop, perspective). Set/replace/detach background; flip;
transparency; stroke & corner rounding; blur (brush / whole); shadows (glow, drop, angle, page
lift, curved, backdrop).

## 7. Drawing

Tools ▸ Draw: Pen, Marker, Highlighter, Eraser (Glow pen in the older app†); colour; thickness &
transparency; Shift = straight line; shape assist (hold 1 s → rectangle/circle/arrow/…); strokes
become normal elements; temporary draw-on-page while presenting.

## 8. Animations

Page / Element / Text tabs; Magic Animate. Styles: Rise, Pan, Fade, Pop, Wipe, Blur,
Succession, Breathe, Baseline, Drift, Tectonic, Tumble; Neon, Scrapbook, Stomp; Photo flow /
rise / zoom; text: Typewriter, Ascend, Shift, Block, Burst, Bounce, Roll, Skate. Add-ons:
Rotate, Flicker, Pulse, Wiggle. Settings: enter/exit/both, direction, speed, by
character/word/line†, appear on click (presentations) with click order, element timing.
Motion paths. Page transitions: Match & move, Dissolve, Slide, Circle wipe, Line wipe, Color
wipe, Flow, Stack, Chop† (0.1–2.5 s).

## 9. Presentations

Present full screen; Presenter view (notes, next slide, timer); Present and record; Autoplay;
remote control; live Q&A. Magic shortcuts: B blur, C confetti, D drumroll, M mic drop, O
bubbles, Q quiet, U curtain, 0–9 timer, ? help. Notes (AI-generated too). Pages: Ctrl+Enter
add, duplicate, delete, reorder, hide page, lock page, page titles, copy link to page, slide
duration (apply to all).

## 10. Video & audio

Multi-track timeline, trim/split, playback speed/loop, audio library, voiceover, captions,
recording.

## 11. Download & share

All/this/custom pages; save download settings; download selection; bulk download. JPG (size,
quality / size limit), PNG (size, compress, **transparent background**), SVG (transparent),
PDF (digital/print presets; crop marks & bleed; RGB/CMYK; flatten; include notes; compress),
PPTX, MP4 (480p–4K), GIF (size scale, transparent). Share: collaborators & roles, links, present,
social, embed, website, print.

## 12. Projects & home

Search & filters, recents, starred, folders (nested, pinning), trash (30 days), version history
(preview, restore, copy), templates, brand kit (palettes, fonts H1–H5/body, logos), resize /
magic switch (custom size, copy & resize, translate, transform to doc), file menu.

## Top 40 parity items (by user-visible impact)

Status as of 0.5.0: ✅ done · 🟡 partly · ⬜ not yet.

| #   | Item                                                               | Lumora status                                                                                        |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Select/transform (click, shift-click, marquee; move/resize/rotate) | ✅                                                                                                   |
| 2   | Reliable undo/redo                                                 | ✅                                                                                                   |
| 3   | Smart guides & snapping with spacing hints                         | 🟡 page/element edges & centres, 45° rotation, size/angle labels (Alt = free); no spacing hints yet  |
| 4   | Contextual floating toolbar                                        | 🟡 per-type side panel instead of a floating bar                                                     |
| 5   | Rich text boxes                                                    | 🟡 font, size, colour/gradient, B/I/U/S, align, spacing, auto-height; no lists/case yet              |
| 6   | Copy/paste/duplicate across pages/designs + external images & text | ✅ system clipboard                                                                                  |
| 7   | Right-click menu                                                   | ✅ element + page menus                                                                              |
| 8   | Layering commands + layers panel                                   | ✅                                                                                                   |
| 9   | Group/ungroup                                                      | ✅ (children selectable from Layers)                                                                 |
| 10  | Align & distribute                                                 | ✅ align to page/elements, space evenly; no tidy-up                                                  |
| 11  | Image workflow (upload, drag-drop, paste, crop, replace)           | ✅ crop dialog with shapes; replace (button, right-click, drop on photo); ~1,000 free stock photos   |
| 12  | Frames & grids                                                     | 🟡 8 frame shapes (drop/pick to fill, zoom, pan); no grids                                           |
| 13  | Shapes                                                             | 🟡 fill/gradient, stroke, corners, sides; no text-in-shape/swap                                      |
| 14  | Lines & connectors                                                 | 🟡 caps & dashes; no elbowed/attached connectors                                                     |
| 15  | Multi-page canvas                                                  | 🟡 strip, add/duplicate/delete/reorder, notes; no hide page/grid view                                |
| 16  | PNG/JPG export (size, quality, transparent, page selection)        | ✅ (+ ZIP for several pages)                                                                         |
| 17  | PDF export                                                         | 🟡 multi-page standard + 300 dpi print (as pictures); no vector text/links/bleed                     |
| 18  | Shortcut set                                                       | ✅ most of the set                                                                                   |
| 19  | Zoom & pan                                                         | ✅                                                                                                   |
| 20  | Position panel                                                     | ✅ X/Y/W/H/rotation + align bar                                                                      |
| 21  | Transparency & gradients                                           | ✅                                                                                                   |
| 22  | Text effects                                                       | 🟡 shadow, outline, background, 3D extrusion; no neon/glitch/curve                                   |
| 23  | Photo adjust & filters (+ duotone)                                 | ✅ 12 looks + intensity, 7 adjustments (duotone used by templates; no duotone picker yet)           |
| 24  | Templates                                                          | ✅ 2,484 templates in 20 kinds with photos, EN/AR, gallery + editor panel (plus AI Magic Design)     |
| 25  | Lock                                                               | 🟡 lock; no position-only / page lock                                                                |
| 26  | Copy style                                                         | ✅                                                                                                   |
| 27  | Colour picker                                                      | 🟡 picker + hex + palettes; no eyedropper/document colours                                           |
| 28  | Rulers & guides                                                    | ⬜                                                                                                   |
| 29  | Background remover                                                 | ✅ on-device model                                                                                   |
| 30  | Present mode                                                       | ✅ full screen, presenter view, autoplay                                                             |
| 31  | Animations & page transitions                                      | ✅ 12 entrance styles, per element or whole page, 6 transitions                                      |
| 32  | Animated export (MP4/GIF)                                          | 🟡 MP4 (WebM fallback) up to 4K; no GIF                                                              |
| 33  | Tables                                                             | 🟡 cells, rows/columns, header, stripes, colours; merging only in the data model                     |
| 34  | Charts                                                             | ✅ bar, row, line, area, pie, donut + data editor                                                    |
| 35  | Drawing                                                            | ✅ pen, marker, highlighter, eraser                                                                  |
| 36  | Projects (folders, search, star, trash)                            | 🟡 recents + trash                                                                                   |
| 37  | Version history                                                    | ⬜                                                                                                   |
| 38  | Resize design                                                      | ⬜                                                                                                   |
| 39  | Links kept in PDF & present                                        | ⬜                                                                                                   |
| 40  | Presenter view & notes + magic shortcuts                           | ✅                                                                                                   |

Also new in 0.5.0 (outside the top 40): QR codes and EAN-13 barcodes, ~180 recolourable icons,
page background photos (fill/fit/tile, opacity, colour wash, set/detach), SVG download.

Sources: the editor's help centre articles on layers/alignment, locking, guides, margins &
bleed, page views, copy style, hyperlinks, comments, keyboard shortcuts, embeds, tables, text
effects, shapes, lines & connectors, frames, grids, charts, image editing, filters, crop,
background remover, drawing, animations, page transitions, presenting, notes, page management,
downloads (file types, transparent background, flattened PDF, video, selection), projects,
folders, starring, trash, version history, brand kit and resize; plus third-party tutorials
(jennifermaker.com, fontbundles.net, bringyourownlaptop.com, fallontravels.com,
lashondabrown.com, sociallysorted.com.au).
