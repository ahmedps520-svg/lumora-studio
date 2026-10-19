/**
 * Turns resolved photo filters into Fabric filters, and adds what Fabric
 * lacks: a soft vignette drawn over the photo (inside its corners/clip).
 */
import { config, FabricImage, filters } from "fabric";
import type { ResolvedFilters } from "@/lib/document/image-filters";

// The 2D backend handles photos of any size (the WebGL one is capped by its
// texture size and would crop big photos).
config.enableGLFiltering = false;

type Matrix = number[];
const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const lerp = (a: Matrix, b: Matrix, t: number) => a.map((v, i) => v + (b[i]! - v) * t);

/** Luma weights (Rec. 709). */
const L = [0.2126, 0.7152, 0.0722] as const;
const MONO: Matrix = [...L, 0, 0, ...L, 0, 0, ...L, 0, 0, 0, 0, 0, 1, 0];
const SEPIA: Matrix = [
  0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0,
];

/** Warm pushes red/yellow up and blue down (cool does the opposite). */
function warmthMatrix(w: number): Matrix {
  const m = [...IDENTITY];
  m[4] = 0.09 * w;
  m[9] = 0.025 * w;
  m[14] = -0.09 * w;
  return m;
}

/** Maps brightness onto a gradient from the shadow colour to the highlight colour. */
export function duotoneMatrix(shadow: string, highlight: string): Matrix {
  const rgb = (hex: string) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6);
    const n = parseInt(full, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const s = rgb(shadow);
  const h = rgb(highlight);
  const row = (i: number) => [...L.map((w) => w * (h[i]! - s[i]!)), 0, s[i]!];
  return [...row(0), ...row(1), ...row(2), 0, 0, 0, 1, 0];
}

export function toFabricFilters(r: ResolvedFilters): filters.BaseFilter<string, object>[] {
  const list: filters.BaseFilter<string, object>[] = [];
  if (r.duotone) list.push(new filters.ColorMatrix({ matrix: duotoneMatrix(...r.duotone) }));
  if (r.mono > 0) list.push(new filters.ColorMatrix({ matrix: lerp(IDENTITY, MONO, r.mono) }));
  if (r.sepia > 0) list.push(new filters.ColorMatrix({ matrix: lerp(IDENTITY, SEPIA, r.sepia) }));
  if (r.warmth) list.push(new filters.ColorMatrix({ matrix: warmthMatrix(r.warmth) }));
  if (r.brightness) list.push(new filters.Brightness({ brightness: r.brightness * 0.5 }));
  if (r.contrast) list.push(new filters.Contrast({ contrast: r.contrast * 0.6 }));
  if (r.saturation) list.push(new filters.Saturation({ saturation: r.saturation }));
  if (r.hue) list.push(new filters.HueRotation({ rotation: r.hue / 180 }));
  if (r.blur) list.push(new filters.Blur({ blur: r.blur * 0.35 }));
  return list;
}

/** A photo that can also darken its edges (vignette, 0–1). */
export class LumoraImage extends FabricImage {
  vignette = 0;

  override _renderFill(ctx: CanvasRenderingContext2D) {
    super._renderFill(ctx);
    if (this.vignette <= 0) return;
    const w = this.width;
    const h = this.height;
    const radius = Math.hypot(w, h) / 2;
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.35, 0, 0, radius);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${(0.85 * this.vignette).toFixed(3)})`);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
