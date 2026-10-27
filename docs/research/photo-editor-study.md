# Pro photo editor study (internal)

Internal research for **Lumora Photo**, the photo editor inside Lumora Studio. It inventories the
feature set of the market-leading desktop photo editor (Adobe Photoshop, 2026 releases) so we can
reach parity. **The product never names other brands** — UI text, icons and layout are our own;
only the feature set is matched. Statuses: ✅ in Lumora Photo · 🟡 partly · ⬜ not yet.

Sources: Adobe help pages for the [selection tools](https://helpx.adobe.com/photoshop/desktop/make-selections/get-started-selections/selection-tools-overview.html),
[painting tools](https://helpx.adobe.com/photoshop/desktop/apply-painting-techniques/fill-objects-selections-layers/painting-tools-overview.html),
[retouch tools](https://helpx.adobe.com/photoshop/desktop/repair-retouch/remove-objects-fill-space/retouch-tools-overview.html),
[drawing tools](https://helpx.adobe.com/photoshop/desktop/draw-shapes-paths/create-shapes/drawing-tools-overview.html),
[navigation and measuring](https://helpx.adobe.com/photoshop/desktop/use-grids-measurement-guides/alignment-grids-guides/navigation-and-measuring-tools-overview.html),
[toolbar customisation](https://helpx.adobe.com/photoshop/desktop/get-started/set-up-toolbars-panels/customize-the-toolbar.html),
[2026 release notes](https://helpx.adobe.com/photoshop/desktop/whats-new/photoshop-on-desktop-release-notes.html)
(January 2026 Remove tool / Generative Fill model choice and reference images; April 2026
distraction removal; May 2026 on-device vs cloud generative processing), plus long-standing,
well-documented menu structures.

## 1. Workspace anatomy

| Area | What it does | Lumora Photo |
| --- | --- | --- |
| Menu bar | File, Edit, Image, Layer, Type, Select, Filter, View, Window, Help | ✅ (all but 3D/Plugins) |
| Options bar | Settings of the active tool (size, hardness, opacity, flow, tolerance, feather…) | ✅ |
| Toolbar | ~70 tools in groups (nested, long-press/right-click for the rest), FG/BG colours, quick mask, screen modes | ✅ groups + flyouts, colours, swap/default |
| Document tabs | Several open images | 🟡 one document per window; recent photos list on Home |
| Canvas | Zoom, pan, rotate view, rulers, guides, grid, pixel grid, checkerboard transparency | ✅ zoom/pan, rulers, guides (drag from rulers), grid, pixel grid (from 1000%), checkerboard · ⬜ rotate view |
| Panels | Layers, Channels, Paths, History, Adjustments, Properties, Color, Swatches, Navigator, Histogram, Info, Character, Paragraph, Actions, Brushes… | ✅ Layers, Paths, History, Adjustments, Properties, Color, Swatches, Navigator, Histogram, Info, Character, in three tabbed groups · ⬜ Channels, Actions, Brushes |
| Status bar | Zoom %, document size, info | ✅ |
| Contextual task bar | Next-step actions for the selection | ✅ floating bar: with a selection — generative fill, remove, fill, mask, inverse, deselect; without — select subject, remove background |

## 2. Tools (default groups, shortcut)

| Group / key | Tools | Lumora Photo |
| --- | --- | --- |
| Move (V) | Move, Artboard | ✅ Move (layer or selection contents) · ⬜ Artboard |
| Marquee (M) | Rectangular, Elliptical, Single row, Single column | ✅ rectangular, elliptical · ⬜ single row/column |
| Lasso (L) | Lasso, Polygonal, Magnetic | ✅ lasso, polygonal · ⬜ magnetic |
| Object selection (W) | Object Selection, Quick Selection, Magic Wand | ✅ magic wand (tolerance, contiguous, all layers) · 🟡 "Select subject" via the on-device subject model · ⬜ quick selection brush |
| Crop (C) | Crop, Perspective Crop, Slice, Slice Select | ✅ crop (free, ratio presets, delete/keep pixels) · ⬜ perspective crop, slices |
| Frame (K) | Frame | ⬜ (the design editor has frames) |
| Eyedropper (I) | Eyedropper, Color Sampler, Ruler, Note, Count | ✅ eyedropper (point/3×3/5×5, current/all layers) · ✅ ruler (distance + angle, straighten layer) · ⬜ sampler, note, count |
| Healing (J) | Spot Healing, Remove, Healing Brush, Patch, Content-Aware Move, Red Eye | ✅ spot healing (texture-aware fill), healing brush (alt-click source, colour matched), red eye · 🟡 Remove = spot healing with a larger radius + generative fill · ⬜ patch, content-aware move |
| Brush (B) | Brush, Pencil, Color Replacement, Mixer Brush | ✅ brush (size, hardness, opacity, flow, spacing, blend mode), pencil (hard-edged), color replacement · ⬜ mixer brush |
| Clone (S) | Clone Stamp, Pattern Stamp | ✅ clone stamp (aligned, sample current/all) · ⬜ pattern stamp |
| History brush (Y) | History Brush, Art History Brush | ✅ history brush (paints from the opened image) · ⬜ art history |
| Eraser (E) | Eraser, Background Eraser, Magic Eraser | ✅ eraser, magic eraser (tolerance) · ⬜ background eraser |
| Gradient (G) | Gradient, Paint Bucket, Material Drop | ✅ gradient (linear, radial, angle, reflected, diamond; FG→BG, FG→transparent), paint bucket (tolerance, contiguous) |
| Blur (R) | Blur, Sharpen, Smudge | ✅ all three (strength) · ✅ liquify brush in the same group |
| Dodge (O) | Dodge, Burn, Sponge | ✅ all three (range, exposure / saturate-desaturate) |
| Pen (P) | Pen, Freeform Pen, Curvature, Add/Delete/Convert anchor | ✅ pen (click for corners, drag for curves, close on the first point), freeform pen (smoothed) · 🟡 convert = Alt-click with path selection, delete = Delete key · ⬜ curvature pen, add-anchor tool |
| Type (T) | Horizontal, Vertical, Type masks | ✅ horizontal type layers (font, size, weight, colour, alignment, Arabic) · ⬜ vertical, type masks |
| Path selection (A) | Path Selection, Direct Selection | ✅ one tool: drag anchors or handles, or the outline to move the whole path |
| Shape (U) | Rectangle, Ellipse, Triangle, Polygon, Line, Custom Shape | ✅ rectangle (radius), ellipse, triangle, polygon, line (fill, stroke) · ⬜ custom shapes |
| Hand (H) | Hand, Rotate View | ✅ hand (also Space) · ⬜ rotate view |
| Zoom (Z) | Zoom | ✅ (click/alt-click, ctrl +/−, fit, 100%) |
| Colours (D, X) | Default colours, swap | ✅ |
| Quick Mask (Q) | Paint a selection | ✅ |
| Screen modes (F) | Standard, full screen | 🟡 hide panels (Tab) |

## 3. Menus

**File:** New, Open, Open Recent, Close, Save, Save As, Export As (PNG/JPG/WebP + quality,
scale), Export layers, Place Embedded, Revert, Print, File Info. → ✅ New (presets, size, background),
Open (from computer or drag-drop on the Photo home), Place (as a layer; pasting an image also
adds a layer), Save (autosaves in the browser), Export As (PNG/JPG/WebP, quality, scale), quick
PNG export, Revert (to how it was opened) · ⬜ Print, File info, open recent from the menu
(the Photo home lists recent photos).

**Edit:** Undo/Redo, Step Backward/Forward, Fade, Cut, Copy, Copy Merged, Paste, Paste Special
(in place, into, outside), Clear, Search, Check Spelling, Find and Replace Text, Fill (colour,
content-aware, generative), Stroke, Content-Aware Fill, Generative Fill/Expand, Content-Aware
Scale, Puppet Warp, Perspective Warp, Free Transform, Transform (scale, rotate, skew, distort,
perspective, warp, rotate 90/180, flip), Auto-Align/Auto-Blend Layers, Define Brush/Pattern,
Preferences, Keyboard Shortcuts. → ✅ undo/redo (history), cut/copy/copy merged/paste/paste in
place, clear, fill (FG, BG, colour, black/white/50% gray, content-aware), stroke
(inside/center/outside), free transform (move, scale, rotate, flip), transform menu (rotate
90/180, flip, skew, distort, perspective, warp with a 4 × 4 grid), generative fill (AI, needs a
Google AI key), content-aware fill · ⬜ puppet warp, content-aware scale, auto-align/blend,
custom brushes/patterns.

**Image:** Mode (RGB, Grayscale, Bitmap…), Adjustments (see §5), Auto Tone, Auto Contrast, Auto
Color, Image Size (resample methods), Canvas Size (anchor), Image Rotation (90°, 180°, arbitrary,
flip canvas), Crop, Trim, Reveal All, Duplicate, Apply Image, Calculations, Variables, Trap,
Analysis. → ✅ adjustments (destructive), auto tone/contrast/color, image size (bicubic-quality
resampling, constrain proportions), canvas size (anchor, extension colour), rotation and flip,
crop to selection, trim (transparent/top-left colour), reveal all, duplicate (as a new photo),
grayscale mode ·
⬜ apply image, calculations, CMYK/Lab modes.

**Layer:** New layer/via copy/via cut, Duplicate, Delete, Rename, Layer Style (Drop Shadow,
Inner Shadow, Outer/Inner Glow, Bevel & Emboss, Satin, Color/Gradient/Pattern Overlay, Stroke),
New Fill Layer, New Adjustment Layer, Layer Mask (reveal all, hide all, from selection, apply,
delete, disable), Vector Mask, Clipping Mask, Smart Objects, Group, Arrange, Align, Distribute,
Lock, Merge Down/Visible, Flatten, Rasterize, Matting (defringe). → ✅ new/via copy/via cut,
duplicate, delete, rename, groups (new, group/ungroup, nested, collapse, pass-through or
isolated blending, merge group), layer styles (drop shadow, inner shadow, outer and inner glow,
bevel & emboss, stroke, color and gradient overlay),
fill layers (solid colour, gradient), adjustment layers, layer masks (all of the listed
commands, plus invert/feather mask in Properties), clipping masks, arrange, align to canvas
(six edges/centres), lock, merge down/visible, flatten, rasterize · ⬜ satin, pattern
overlay, bevel contour/texture, smart objects, vector masks, distribute, defringe.

**Type:** fonts, size, anti-aliasing, orientation, warp text, convert to shape. → ✅ the
Character panel (font, size, weight, colour, alignment, line height, tracking) · ⬜ warp text.

**Select:** All, Deselect, Reselect, Inverse, All Layers, Color Range, Focus Area, Subject, Sky,
Select and Mask, Modify (Border, Smooth, Expand, Contract, Feather), Grow, Similar, Transform
Selection, Edit in Quick Mask, Load/Save Selection. → ✅ all, deselect, reselect, inverse, color
range (fuzziness), subject (on-device model), modify (border, smooth, expand, contract, feather),
grow, similar, quick mask, save/load selection (one saved slot), make work path / load path
as selection · ⬜ sky, focus area, all
layers, transform selection, select-and-mask workspace.

**Filter:** Last Filter, Convert for Smart Filters, Neural Filters, Filter Gallery, Adaptive
Wide Angle, Camera Raw Filter, Lens Correction, Liquify, Vanishing Point; categories in §6.

**View:** Proof, Zoom In/Out, Fit on Screen, 100%, 200%, Print Size, Screen Mode, Extras, Show
(selection edges, guides, grid, pixel grid), Rulers, Snap, Lock/Clear Guides, New Guide.
→ ✅ zoom commands (in, out, fit, 100%, typed zoom in the status bar), rulers, guides (drag
from rulers, new guide, clear), grid, pixel grid when zoomed in, show selection edges,
snapping (move, transform and crop snap to guides and the canvas edges/centre) · ⬜ lock
guides, proof colours, 200%/print size.

**Window:** workspaces, panels on/off, arrange. → ✅ show/hide each panel (tabbed groups),
hide all panels (Tab), reset workspace · ⬜ saved workspaces.

## 4. Layers and blending

Layer kinds: pixel, adjustment, fill (solid/gradient/pattern), type, shape, smart object, group,
frame, 3D (removed), video. Blend modes (27): Normal, Dissolve; Darken, Multiply, Color Burn,
Linear Burn, Darker Color; Lighten, Screen, Color Dodge, Linear Dodge (Add), Lighter Color;
Overlay, Soft Light, Hard Light, Vivid Light, Linear Light, Pin Light, Hard Mix; Difference,
Exclusion, Subtract, Divide; Hue, Saturation, Color, Luminosity. Opacity and Fill, lock
transparency/pixels/position/all, layer masks, clipping masks.

→ ✅ pixel, adjustment, fill, type and shape layers; all 27 blend modes (16 native canvas modes,
the other 11 computed per pixel); opacity and fill opacity; locks (transparency, pixels,
position, all); masks; clipping; groups (nested, pass-through or isolated, with masks and
effects). ⬜ smart objects, video.

## 5. Adjustments (as adjustment layers and destructive commands)

Brightness/Contrast, Levels (per channel, input/output, gamma, auto), Curves (per channel,
points), Exposure (exposure, offset, gamma), Vibrance (vibrance, saturation), Hue/Saturation
(hue, saturation, lightness, colorize), Color Balance (shadows/midtones/highlights, preserve
luminosity), Black & White (six colour sliders, tint), Photo Filter (warming, cooling, colour,
density), Channel Mixer, Color Lookup (LUTs), Invert, Posterize, Threshold, Gradient Map,
Selective Color, Shadows/Highlights, HDR Toning, Desaturate, Match Color, Replace Color, Equalize.

→ ✅ every one except Color Lookup (⬜ LUT files), Match Color (⬜) and HDR Toning (⬜). Levels
has no Auto button of its own (Image → Auto Tone/Contrast/Color cover it) and Photo Filter takes
any colour rather than named presets.

## 6. Filters

| Category | Filters | Lumora Photo |
| --- | --- | --- |
| Blur | Average, Blur, Blur More, Box, Gaussian, Lens, Motion, Radial, Shape, Smart, Surface | ✅ average, blur, blur more, box, gaussian, motion, radial (spin/zoom), surface · ⬜ lens, shape, smart |
| Blur Gallery | Field, Iris, Tilt-Shift, Path, Spin | ✅ tilt-shift, iris (radial focus) · ⬜ field, path, spin |
| Distort | Displace, Pinch, Polar Coordinates, Ripple, Shear, Spherize, Twirl, Wave, ZigZag | ✅ pinch, polar coordinates, ripple, spherize, twirl, wave, zigzag · ⬜ displace, shear |
| Noise | Add Noise, Despeckle, Dust & Scratches, Median, Reduce Noise | ✅ all |
| Pixelate | Color Halftone, Crystallize, Facet, Fragment, Mezzotint, Mosaic, Pointillize | ✅ color halftone, crystallize, fragment, mezzotint, mosaic, pointillize · ⬜ facet |
| Render | Clouds, Difference Clouds, Fibers, Lens Flare, Lighting Effects, Flame, Picture Frame, Tree | ✅ clouds, difference clouds, fibers, lens flare, vignette · ⬜ lighting effects, flame, frame, tree |
| Sharpen | Sharpen, Sharpen Edges, Sharpen More, Smart Sharpen, Unsharp Mask, Shake Reduction | ✅ sharpen, sharpen more, sharpen edges, unsharp mask, smart sharpen (radius/amount + noise reduction) · ⬜ shake reduction |
| Stylize | Diffuse, Emboss, Extrude, Find Edges, Oil Paint, Solarize, Tiles, Trace Contour, Wind | ✅ diffuse, emboss, find edges, oil paint, solarize, tiles, trace contour, wind · ⬜ extrude |
| Other | Custom (kernel), High Pass, HSB/HSL, Maximum, Minimum, Offset | ✅ all |
| Camera Raw-style | Basic (temperature, tint, exposure, contrast, highlights, shadows, whites, blacks, texture, clarity, dehaze, vibrance, saturation), vignette, grain | ✅ "Develop" dialog with these sliders |
| Liquify | Forward warp, reconstruct, pucker, bloat, face-aware | 🟡 Liquify brush (push, pinch, bloat, restore) |
| Lens Correction | Distortion, chromatic aberration, vignette | ✅ distortion + vignette |
| Neural Filters | Skin smoothing, colorize, style transfer, super zoom, depth blur… | 🟡 skin smoothing (surface blur) · ⬜ the rest |
| Filter Gallery | Artistic, Brush Strokes, Sketch, Texture | ⬜ |

Every filter dialog shows a live preview on the canvas and respects the active selection.

## 7. AI features

| Feature | Lumora Photo |
| --- | --- |
| Generative Fill / Expand | ✅ Generative fill (selection + prompt, Gemini image model with the owner's or your own Google AI key; result on a new masked layer) · 🟡 expand = Canvas Size, select the new area, Generative fill |
| Remove tool / distraction removal | 🟡 spot healing + content-aware fill (local, free) and generative fill with "remove" |
| Select Subject / Object Selection | ✅ Select subject with the on-device subject model (same as the design editor's background remover) |
| Remove Background | ✅ (layer mask from the subject) |
| Sky replacement, Neural filters | ⬜ |
| Content-Aware Fill | ✅ texture-aware fill from the surroundings (local) |

## 8. How it's built

- Routes `/photo` (open / new / recent) and `/photo/[id]` (the editor); the home page first asks
  what you want to make (Design or Photo editor).
- Documents live in IndexedDB (`photos` for the list + `photoData` with the document settings and
  one PNG per pixel layer and per mask), autosaved a moment after each change.
- The engine is Canvas 2D (`src/lib/photo`): each layer has its own canvas placed at x/y (masks
  are document-size); the compositor walks layers with blend modes, masks, clipping, adjustment
  layers and styles; filters and adjustments are pure functions on `ImageData` (unit-tested).
- Tools turn pointer input into strokes (brush dabs with spacing/flow, clone/heal sources),
  region edits (dodge, blur, liquify…) and selections (8-bit masks).
- History keeps snapshots of the layers an action touched (40 steps).
- Generative fill posts the area around the selection (selection painted magenta) to
  `/api/ai/photo-fill`, which validates input and output with Zod and keeps the key server-side.
- Groups are rows in the same flat layer list (`parentId`, contents directly below the group);
  `tree.ts` keeps that order, the compositor renders a group straight through or into its own
  buffer. Skew/distort/perspective use a projective map (`geometry.ts`, exact per-pixel on
  Apply), warp a 4 × 4 Bézier patch drawn as a triangle mesh (`transform.ts`). Paths are anchors
  with Bézier handles (`paths.ts`); snapping is `snap.ts`; bevel shading is `effects.ts`.
- Still to come: smart objects, layer comps, actions, LUTs, vector masks, channels, WebGL for
  very large images.
