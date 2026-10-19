/**
 * Element ⇄ Fabric object mapping.
 *
 * `createObject` / `applyElement` turn scene-graph elements into Fabric objects;
 * `readElement` turns (possibly user-transformed) Fabric objects back into
 * elements. Round-trips are lossless — see tests/browser/roundtrip.test.ts.
 *
 * Fabric 7 positions objects by their centre (originX/Y = "center").
 */
import {
  Ellipse,
  FabricImage,
  Gradient,
  Group,
  LayoutManager,
  Line,
  Path,
  Rect,
  Shadow,
  Textbox,
  Triangle,
  util,
  type FabricObject,
} from "fabric";
import { scaleChildren } from "@/lib/document/grouping";
import { resolveFilters } from "@/lib/document/image-filters";
import { frameCrop } from "@/lib/document/photo";
import { framePlaceholderUrl, svgDataUrl } from "@/lib/document/svg";
import type {
  BlendMode,
  Element,
  Fill,
  DrawingElement,
  GroupElement,
  ImageElement,
  LineElement,
  Shadow as ShadowValue,
  ShapeElement,
  TextElement,
} from "@/lib/schema";
import { ImageFiltersSchema } from "@/lib/schema";
import { buildChart, buildCode, buildTable } from "./composites";
import { LumoraImage, toFabricFilters } from "./image-filters";
import { ElementBoxLayout } from "./layout";
import { loadImage, loadedImage, placeholderSource } from "./images";
import { LumoraTextbox } from "./lumora-textbox";
import { angleToCoords, coordsToAngle } from "./paint";
import { shapePath } from "./shapes";
import { fabricToRuns, fontWeightNumber, runsToFabric, type FabricStyleMap } from "./text-styles";

const graphemeSplit = util.string.graphemeSplit;

// ─── Object ↔ element id ─────────────────────────────────────────────────────

const objectIds = new WeakMap<FabricObject, string>();
export const getObjectId = (obj: FabricObject) => objectIds.get(obj);
export const setObjectId = (obj: FabricObject, id: string) => void objectIds.set(obj, id);

// ─── Small converters ────────────────────────────────────────────────────────

const round = (n: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function blendToComposite(mode: BlendMode): GlobalCompositeOperation {
  return mode === "normal" ? "source-over" : mode;
}

export function compositeToBlend(op: string | undefined): BlendMode {
  if (!op || op === "source-over") return "normal";
  const modes: BlendMode[] = [
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
  ];
  return (modes as string[]).includes(op) ? (op as BlendMode) : "normal";
}

export function toFabricFill(fill: Fill): string | Gradient<"linear"> | Gradient<"radial"> | null {
  if (fill.type === "solid") return fill.color;
  if (fill.type === "none") return null;
  const { gradient } = fill;
  const colorStops = gradient.stops.map((s) => ({ offset: s.offset, color: s.color }));
  if (gradient.kind === "radial") {
    return new Gradient<"radial">({
      type: "radial",
      gradientUnits: "percentage",
      coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 },
      colorStops,
    });
  }
  return new Gradient<"linear">({
    type: "linear",
    gradientUnits: "percentage",
    coords: angleToCoords(gradient.angle),
    colorStops,
  });
}

export function fromFabricFill(value: unknown, fallback: Fill): Fill {
  if (value === null || value === undefined || value === "" || value === "transparent") {
    return { type: "none" };
  }
  if (typeof value === "string")
    return HEX.test(value) ? { type: "solid", color: value } : fallback;
  if (value instanceof Gradient) {
    const stops = value.colorStops
      .filter((s) => HEX.test(s.color))
      .map((s) => ({ offset: round(s.offset, 4), color: s.color }))
      .sort((a, b) => a.offset - b.offset);
    if (stops.length < 2) return fallback;
    if (value.type === "radial") {
      return { type: "gradient", gradient: { kind: "radial", angle: 180, stops } };
    }
    const { x1, y1, x2, y2 } = value.coords as { x1: number; y1: number; x2: number; y2: number };
    return {
      type: "gradient",
      gradient: { kind: "linear", angle: coordsToAngle({ x1, y1, x2, y2 }), stops },
    };
  }
  return fallback;
}

function toFabricShadow(shadow: ShadowValue | null): Shadow | null {
  if (!shadow) return null;
  return new Shadow({
    color: shadow.color,
    blur: shadow.blur,
    offsetX: shadow.offsetX,
    offsetY: shadow.offsetY,
  });
}

function fromFabricShadow(shadow: unknown): ShadowValue | null {
  if (!(shadow instanceof Shadow) || !HEX.test(shadow.color)) return null;
  return {
    color: shadow.color,
    blur: shadow.blur,
    offsetX: shadow.offsetX,
    offsetY: shadow.offsetY,
  };
}

// ─── Look & feel of selection controls ───────────────────────────────────────

export const SELECTION_COLOR = "#6D5DF6";

function styleControls(obj: FabricObject, element: Element) {
  obj.set({
    borderColor: SELECTION_COLOR,
    cornerColor: "#FFFFFF",
    cornerStrokeColor: SELECTION_COLOR,
    cornerStyle: "circle",
    transparentCorners: false,
    cornerSize: 11,
    touchCornerSize: 32,
    borderScaleFactor: 1.5,
    padding: 0,
    lockScalingFlip: true,
    strokeUniform: true,
  });
  if (element.type === "text") obj.setControlsVisibility({ mt: false, mb: false });
  // Groups and photos only scale from the corners (proportionally), so nothing distorts.
  if (
    element.type === "group" ||
    element.type === "image" ||
    element.type === "svg" ||
    element.type === "qr"
  )
    obj.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
  if (element.type === "line") {
    obj.setControlsVisibility({ mt: false, mb: false, tl: false, tr: false, bl: false, br: false });
  }
}

// ─── Create / apply ──────────────────────────────────────────────────────────

function lineCoords(line: LineElement): [number, number, number, number] {
  return [-line.width / 2, 0, line.width / 2, 0];
}

/** Text boxes are stored by their top edge; Fabric lays them out around their centre. */
function anchorTextTop(obj: FabricObject, el: TextElement) {
  const dh = obj.height - el.height;
  if (Math.abs(dh) < 0.01) return;
  const angle = (el.rotation * Math.PI) / 180;
  obj.set({
    left: obj.left - (Math.sin(angle) * dh) / 2,
    top: obj.top + (Math.cos(angle) * dh) / 2,
  });
}

/** A group is drawn as one Fabric Group that moves, scales and rotates as a unit. */
function createGroup(element: GroupElement): Group {
  const children = element.children.map((child) => {
    // Children are stored relative to the group; Fabric builds them in page space.
    const absolute = { ...child, x: element.x + child.x, y: element.y + child.y } as Element;
    const obj = createObject(absolute);
    if (absolute.type === "text") anchorTextTop(obj, absolute);
    return obj;
  });
  return new Group(children, {
    layoutManager: new LayoutManager(new ElementBoxLayout(element)),
    subTargetCheck: false,
    interactive: false,
  });
}

// ─── Images ──────────────────────────────────────────────────────────────────

type SvgElement = Extract<Element, { type: "svg" }>;
type FrameElement = Extract<Element, { type: "frame" }>;
/** Elements drawn as one photo: images, SVG graphics, and frames holding a photo. */
type PhotoSource = ImageElement | SvgElement | FrameElement;

const NO_FILTERS = ImageFiltersSchema.parse({});

function photoSrc(el: PhotoSource): string {
  if (el.type === "image") return el.src;
  if (el.type === "svg") return svgDataUrl(el.svg, el.colorMap);
  return el.image?.src ?? framePlaceholderUrl(el.placeholderColor);
}

/** The photo an element shows, as an image element (frames need the photo's size to crop). */
function asImage(el: PhotoSource, natural: { width: number; height: number } | null): ImageElement {
  if (el.type === "image") return el;
  const common = { ...el, type: "image" as const, alt: "", attribution: null };
  if (el.type === "svg") {
    return {
      ...common,
      src: photoSrc(el),
      crop: null,
      filters: NO_FILTERS,
      mask: null,
      cornerRadius: 0,
      stroke: null,
    } as ImageElement;
  }
  const image = el.image ?? {
    src: photoSrc(el),
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    filters: NO_FILTERS,
  };
  return {
    ...common,
    src: image.src,
    crop: natural ? frameCrop(natural, el, image) : null,
    filters: image.filters,
    mask:
      el.shape === "ellipse"
        ? { kind: "ellipse", pathData: null, viewBox: null }
        : el.shape === "path"
          ? {
              kind: "path",
              pathData: el.pathData,
              viewBox: el.pathViewBox ?? { width: 100, height: 100 },
            }
          : null,
    cornerRadius: el.shape === "rect" ? el.cornerRadius : 0,
    stroke: el.stroke,
  } as ImageElement;
}

/** Drawn as a photo (empty frames show a placeholder picture). Not a type guard. */
const isPhoto = (el: Element): boolean =>
  el.type === "image" || el.type === "svg" || el.type === "frame";

/** The element each image object should show once its pixels arrive. */
const latestImage = new WeakMap<FabricObject, PhotoSource>();
const pendingImages = new WeakMap<FabricObject, Promise<void>>();

/** Shows a grey placeholder at once, then swaps in the real pixels when loaded. */
function createImageObject(element: PhotoSource): FabricImage {
  const src = photoSrc(element);
  const cached = loadedImage(src);
  const img = new LumoraImage(cached ?? placeholderSource());
  if (cached) return img;
  const ready = loadImage(src).then(
    (source) => {
      img.setElement(source);
      // Only the size/crop changes; the centre (and so the position) stays put.
      applyImage(img, latestImage.get(img) ?? element);
      img.setCoords();
      img.set("dirty", true);
      img.group?.set("dirty", true);
      img.canvas?.requestRenderAll();
    },
    () => undefined, // Missing or broken image: keep the placeholder.
  );
  pendingImages.set(img, ready);
  return img;
}

/** Resolves once every image in `obj` (or inside a group) has loaded or failed. */
export async function whenImagesLoaded(obj: FabricObject): Promise<void> {
  const pending: Promise<void>[] = [];
  const walk = (o: FabricObject) => {
    const p = pendingImages.get(o);
    if (p) pending.push(p);
    if (o instanceof Group) o.getObjects().forEach(walk);
  };
  walk(obj);
  await Promise.all(pending);
}

/** Filters last applied to each photo (re-running them is the slow part). */
const appliedFilters = new WeakMap<FabricImage, string>();

function applyFilters(obj: FabricImage, el: ImageElement, loaded: boolean) {
  const resolved = resolveFilters(el.filters);
  if (obj instanceof LumoraImage) obj.vignette = resolved.vignette;
  if (!loaded) return;
  const key = JSON.stringify({ ...resolved, vignette: 0 });
  if (appliedFilters.get(obj) === key) return;
  appliedFilters.set(obj, key);
  obj.filters = toFabricFilters(resolved);
  obj.applyFilters();
}

/** The clip outline for a framed photo, in the image's own (unscaled) pixels. */
function maskClip(
  el: ImageElement,
  crop: { width: number; height: number },
  scaleX: number,
  scaleY: number,
) {
  const mask = el.mask;
  if (mask?.kind === "ellipse") return new Ellipse({ rx: crop.width / 2, ry: crop.height / 2 });
  if (mask?.kind === "path" && mask.pathData && mask.viewBox) {
    const sx = crop.width / mask.viewBox.width;
    const sy = crop.height / mask.viewBox.height;
    const path = new Path(mask.pathData, { scaleX: sx, scaleY: sy });
    // Fabric centres a path on its own outline; place it by the view box instead.
    path.set({
      left: (path.pathOffset.x - mask.viewBox.width / 2) * sx,
      top: (path.pathOffset.y - mask.viewBox.height / 2) * sy,
    });
    return path;
  }
  const r = Math.min(el.cornerRadius, el.width / 2, el.height / 2);
  return r > 0
    ? new Rect({ width: crop.width, height: crop.height, rx: r / scaleX, ry: r / scaleY })
    : undefined;
}

function applyImage(obj: FabricImage, photo: PhotoSource) {
  latestImage.set(obj, photo);
  // The original pixels (a filtered photo draws from a canvas copy).
  const source = obj._originalElement as HTMLImageElement | HTMLCanvasElement;
  const loaded = source instanceof HTMLImageElement;
  const w = (loaded ? source.naturalWidth : source.width) || 1;
  const h = (loaded ? source.naturalHeight : source.height) || 1;
  const el = asImage(photo, loaded ? { width: w, height: h } : null);
  let crop = { x: 0, y: 0, width: w, height: h };
  if (loaded && el.crop) {
    const x = Math.min(Math.max(0, el.crop.x), w - 1);
    const y = Math.min(Math.max(0, el.crop.y), h - 1);
    crop = { x, y, width: Math.min(el.crop.width, w - x), height: Math.min(el.crop.height, h - y) };
  }
  const scaleX = Math.max(0.01, el.width) / crop.width;
  const scaleY = Math.max(0.01, el.height) / crop.height;
  obj.set({
    cropX: crop.x,
    cropY: crop.y,
    width: crop.width,
    height: crop.height,
    scaleX,
    scaleY,
  });
  // The clip path lives in the image's own (unscaled) pixels.
  obj.set("clipPath", maskClip(el, crop, scaleX, scaleY));
  // A border follows the box, so framed (non-rectangular) photos go without one.
  applyStroke(obj, el.mask && el.mask.kind !== "rect" ? null : el.stroke);
  applyFilters(obj, el, loaded);
}

/** Freehand strokes, drawn in their own box and scaled to the element size. */
function createDrawing(element: DrawingElement): Group {
  const paths = element.strokes.map(
    (stroke) =>
      new Path(stroke.d, {
        fill: "",
        stroke: stroke.color,
        strokeWidth: stroke.width,
        opacity: stroke.opacity,
        strokeLineCap: stroke.mode === "highlighter" ? "square" : "round",
        strokeLineJoin: "round",
        objectCaching: false,
      }),
  );
  return new Group(paths, {
    layoutManager: new LayoutManager(
      new ElementBoxLayout({
        x: 0,
        y: 0,
        width: element.sourceWidth,
        height: element.sourceHeight,
      }),
    ),
    subTargetCheck: false,
    interactive: false,
  });
}

/** A dashed box shown when an element can't be drawn (it stays selectable and editable). */
const fallbackObject = () =>
  new Rect({ fill: "#E2E8F0", stroke: "#94A3B8", strokeDashArray: [8, 6], strokeWidth: 2 });

export function createObject(element: Element): FabricObject {
  let obj: FabricObject;
  try {
    obj = buildObject(element);
  } catch (error) {
    // One broken element must never take the whole page down with it.
    console.warn("[canvas] could not draw element", element.type, error);
    obj = fallbackObject();
  }
  setObjectId(obj, element.id);
  styleControls(obj, element);
  applyElement(obj, element);
  return obj;
}

function buildObject(element: Element): FabricObject {
  let obj: FabricObject;
  if (element.type === "group") {
    obj = createGroup(element);
  } else if (element.type === "drawing") {
    obj = createDrawing(element);
  } else if (isPhoto(element)) {
    obj = createImageObject(element as PhotoSource);
  } else if (element.type === "table") {
    obj = buildTable(element);
  } else if (element.type === "chart") {
    obj = buildChart(element);
  } else if (element.type === "qr") {
    obj = buildCode(element);
  } else if (element.type === "text") {
    obj = new LumoraTextbox("", { width: Math.max(1, element.width) });
  } else if (element.type === "line") {
    obj = new Line(lineCoords(element));
  } else if (element.type === "shape") {
    const d = shapePath(element);
    if (d) obj = new Path(d);
    else if (element.kind === "ellipse") obj = new Ellipse();
    else if (element.kind === "triangle") obj = new Triangle();
    else obj = new Rect();
  } else {
    obj = fallbackObject();
  }
  return obj;
}

/**
 * True when `next` can be applied to the existing object; false means the
 * engine must build a fresh object (different Fabric class or path outline).
 */
const isComposite = (el: Element) => el.type === "table" || el.type === "chart" || el.type === "qr";

/** Everything that changes how a table/chart/code is laid out (moving it doesn't). */
function compositeKey(el: Element): string {
  const {
    x: _x,
    y: _y,
    rotation: _r,
    opacity: _o,
    visible: _v,
    locked: _l,
    name: _n,
    flipX: _fx,
    flipY: _fy,
    blendMode: _b,
    shadow: _s,
    animation: _a,
    ...layout
  } = el;
  return JSON.stringify(layout);
}

/** The size a table/chart/code group was laid out at. */
const builtSize = new WeakMap<FabricObject, { width: number; height: number }>();

export function canUpdateInPlace(prev: Element, next: Element): boolean {
  if (prev.type !== next.type) return false;
  if (prev.type === "shape" && next.type === "shape") {
    return prev.kind === next.kind && shapePath(prev) === shapePath(next);
  }
  if (prev.type === "line" && next.type === "line") return prev.width === next.width;
  if (prev.type === "image" && next.type === "image") return prev.src === next.src;
  if (prev.type === "svg" && next.type === "svg") {
    return prev.svg === next.svg && JSON.stringify(prev.colorMap) === JSON.stringify(next.colorMap);
  }
  if (prev.type === "frame" && next.type === "frame") {
    return (
      photoSrc(prev) === photoSrc(next) &&
      prev.shape === next.shape &&
      prev.pathData === next.pathData
    );
  }
  if (isComposite(prev) && isComposite(next)) return compositeKey(prev) === compositeKey(next);
  if (prev.type === "drawing" && next.type === "drawing") {
    return (
      prev.strokes === next.strokes &&
      prev.sourceWidth === next.sourceWidth &&
      prev.sourceHeight === next.sourceHeight
    );
  }
  if (prev.type === "group" && next.type === "group") {
    // Moving / rotating a group keeps its children; anything else rebuilds it.
    return (
      prev.children === next.children && prev.width === next.width && prev.height === next.height
    );
  }
  return true;
}

function applyCommon(obj: FabricObject, el: Element) {
  obj.set({
    angle: el.rotation,
    opacity: el.opacity,
    visible: el.visible,
    evented: el.visible,
    flipX: el.flipX,
    flipY: el.flipY,
    globalCompositeOperation: blendToComposite(el.blendMode),
    shadow: toFabricShadow(el.shadow),
    lockMovementX: el.locked,
    lockMovementY: el.locked,
    lockRotation: el.locked,
    lockScalingX: el.locked,
    lockScalingY: el.locked,
    hasControls: !el.locked,
    hoverCursor: el.locked ? "default" : "move",
  });
}

function applyStroke(
  obj: FabricObject,
  stroke: { color: string; width: number; dash: number[] } | null,
) {
  obj.set({
    stroke: stroke && stroke.width > 0 ? stroke.color : null,
    strokeWidth: stroke?.width ?? 0,
    strokeDashArray: stroke && stroke.dash.length > 0 ? stroke.dash : null,
  });
}

function applyText(obj: Textbox, el: TextElement, skipContent: boolean) {
  // While the user is typing, Fabric owns the characters; only restyle the box.
  if (!skipContent) {
    const { text, styles } = runsToFabric(el.runs, graphemeSplit);
    obj.set({ text, styles });
  }
  obj.set({
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.italic ? "italic" : "normal",
    underline: el.underline,
    linethrough: el.strike,
    textAlign: el.align,
    lineHeight: el.lineHeight,
    charSpacing: el.letterSpacing,
    fill: toFabricFill(el.fill),
    backgroundColor: el.backgroundColor ?? "",
    direction: el.direction,
    width: Math.max(1, el.width),
    scaleX: 1,
    scaleY: 1,
    // Outlines sit around the letters (not over them) with smooth corners.
    paintFirst: "stroke",
    strokeLineJoin: "round",
  });
  applyStroke(obj, el.stroke);
  if (obj instanceof LumoraTextbox) {
    obj.extrude = el.extrude && el.extrude.depth > 0 ? { ...el.extrude } : null;
    // The cache canvas is sized to the box; 3D sides reach outside it.
    obj.set({ objectCaching: !obj.extrude, dirty: true });
  }
}

function scaleStroke<T extends { width: number } | null>(s: T, k: number): T {
  return s && k !== 1 ? { ...s, width: round(Math.min(1000, s.width * k), 2) } : s;
}

function applyShape(obj: FabricObject, el: ShapeElement) {
  obj.set({ fill: toFabricFill(el.fill) });
  applyStroke(obj, el.stroke);
  if (obj instanceof Path) {
    // Paths keep their 100×100 outline and are scaled to the element box.
    obj.set({
      scaleX: Math.max(0.01, el.width) / (obj.width || 1),
      scaleY: Math.max(0.01, el.height) / (obj.height || 1),
    });
  } else if (obj instanceof Ellipse) {
    obj.set({ rx: el.width / 2, ry: el.height / 2, scaleX: 1, scaleY: 1 });
  } else if (obj instanceof Rect) {
    const r = Math.min(el.cornerRadius, el.width / 2, el.height / 2);
    obj.set({ width: el.width, height: el.height, rx: r, ry: r, scaleX: 1, scaleY: 1 });
  } else {
    obj.set({ width: el.width, height: el.height, scaleX: 1, scaleY: 1 });
  }
}

/**
 * Pushes every property of `element` onto `obj` (idempotent).
 * `skipContent` leaves the characters of a text being edited untouched.
 */
export function applyElement(
  obj: FabricObject,
  element: Element,
  options: { skipContent?: boolean } = {},
) {
  if (element.type === "text" && obj instanceof Textbox) {
    applyText(obj, element, options.skipContent ?? false);
  } else if (element.type === "shape") applyShape(obj, element);
  else if (isPhoto(element) && obj instanceof FabricImage) applyImage(obj, element as PhotoSource);
  else if (isComposite(element)) {
    const built = builtSize.get(obj) ?? { width: obj.width, height: obj.height };
    builtSize.set(obj, built);
    obj.set({
      scaleX: Math.max(0.01, element.width) / (built.width || 1),
      scaleY: Math.max(0.01, element.height) / (built.height || 1),
    });
  } else if (element.type === "drawing") {
    obj.set({
      scaleX: Math.max(0.01, element.width) / element.sourceWidth,
      scaleY: Math.max(0.01, element.height) / element.sourceHeight,
    });
  } else if (element.type === "line") {
    obj.set({ scaleX: 1, scaleY: 1, strokeLineCap: element.lineCap });
    applyStroke(obj, element.stroke);
  } else {
    obj.set({ width: element.width, height: element.height, scaleX: 1, scaleY: 1 });
  }
  applyCommon(obj, element);
  // Position last: the centre of the element box.
  obj.set({ left: element.x + element.width / 2, top: element.y + element.height / 2 });
  obj.setCoords();
}

// ─── Read back ───────────────────────────────────────────────────────────────

export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** Absolute geometry, also correct for objects inside a multi-selection. */
export function readGeometry(obj: FabricObject): Geometry {
  const center = obj.getCenterPoint();
  const scaling = obj.getObjectScaling();
  const width = obj.width * scaling.x;
  const height = obj.height * scaling.y;
  let rotation = obj.getTotalAngle() % 360;
  if (rotation < 0) rotation += 360;
  return {
    x: round(center.x - width / 2),
    y: round(center.y - height / 2),
    width: round(width),
    height: round(height),
    rotation: round(rotation) === 360 ? 0 : round(rotation),
    scaleX: scaling.x,
    scaleY: scaling.y,
  };
}

/**
 * Reads an object back into an element. `base` supplies anything Fabric does
 * not hold (name, role, lock state…).
 */
export function readElement(obj: FabricObject, base: Element): Element {
  const geo = readGeometry(obj);
  const common = {
    x: geo.x,
    y: geo.y,
    width: geo.width,
    height: geo.height,
    rotation: geo.rotation,
    opacity: round(obj.opacity, 4),
    visible: obj.visible,
    flipX: obj.flipX,
    flipY: obj.flipY,
    blendMode: compositeToBlend(obj.globalCompositeOperation),
    shadow: fromFabricShadow(obj.shadow),
  };
  const stroke = (fallbackDash: number[] = []) =>
    obj.stroke && typeof obj.stroke === "string" && obj.strokeWidth > 0 && HEX.test(obj.stroke)
      ? { color: obj.stroke, width: obj.strokeWidth, dash: obj.strokeDashArray ?? fallbackDash }
      : null;

  if (base.type === "text" && obj instanceof Textbox) {
    // Corner-dragging scales text: turn the scale into a new font size.
    const scale = geo.scaleY;
    const scaled = Math.abs(scale - 1) > 1e-3;
    const runs = fabricToRuns(obj.text, obj.styles as FabricStyleMap, graphemeSplit).map((run) =>
      scaled && run.style.fontSize
        ? { ...run, style: { ...run.style, fontSize: round(run.style.fontSize * scale, 1) } }
        : run,
    );
    return {
      ...base,
      ...common,
      runs,
      fontFamily: obj.fontFamily,
      fontSize: scaled ? round(obj.fontSize * scale, 1) : obj.fontSize,
      fontWeight: fontWeightNumber(obj.fontWeight) ?? base.fontWeight,
      italic: obj.fontStyle === "italic",
      underline: obj.underline,
      strike: obj.linethrough,
      align: (["left", "center", "right", "justify"] as const).includes(
        obj.textAlign as TextElement["align"],
      )
        ? (obj.textAlign as TextElement["align"])
        : base.align,
      lineHeight: obj.lineHeight,
      letterSpacing: obj.charSpacing,
      fill: fromFabricFill(obj.fill, base.fill),
      // Outline thickness and 3D depth grow with the text.
      stroke: scaleStroke(stroke(base.stroke?.dash), scaled ? scale : 1),
      extrude:
        base.extrude && scaled
          ? { ...base.extrude, depth: round(Math.min(500, base.extrude.depth * scale), 1) }
          : base.extrude,
      backgroundColor:
        typeof obj.backgroundColor === "string" && HEX.test(obj.backgroundColor)
          ? obj.backgroundColor
          : null,
      direction: obj.direction === "rtl" ? "rtl" : "ltr",
    };
  }

  if (base.type === "shape") {
    let cornerRadius = base.cornerRadius;
    if (obj instanceof Rect && !(obj instanceof Triangle)) {
      // A non-uniform resize scales the corner too; keep the smaller axis.
      cornerRadius = round(obj.rx * Math.min(geo.scaleX, geo.scaleY));
    }
    return {
      ...base,
      ...common,
      fill: fromFabricFill(obj.fill, base.fill),
      stroke: stroke(base.stroke?.dash),
      cornerRadius,
    };
  }

  if (base.type === "line") {
    // Lines only change length (width); their height is the stroke thickness.
    const centerY = geo.y + geo.height / 2;
    return {
      ...base,
      ...common,
      y: round(centerY - base.height / 2),
      height: base.height,
      stroke: stroke(base.stroke.dash) ?? base.stroke,
    };
  }

  if (base.type === "image") {
    // Pixels and crop don't change on the canvas; a resize scales the rounded corners.
    const k = Math.min(geo.width / (base.width || 1), geo.height / (base.height || 1));
    return {
      ...base,
      ...common,
      stroke: stroke(base.stroke?.dash),
      cornerRadius: Math.abs(k - 1) > 1e-3 ? round(base.cornerRadius * k) : base.cornerRadius,
    };
  }

  if (base.type === "group") {
    // Resizing a group resizes everything inside it.
    const scaled = Math.abs(geo.scaleX - 1) > 1e-3 || Math.abs(geo.scaleY - 1) > 1e-3;
    return {
      ...base,
      ...common,
      children: scaled ? scaleChildren(base.children, geo.scaleX, geo.scaleY) : base.children,
    };
  }

  return { ...base, ...common };
}
