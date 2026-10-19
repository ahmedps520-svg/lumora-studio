/**
 * The page background as one canvas object: a colour or gradient, or a photo
 * that fills, fits or tiles the page (with its own opacity and a colour wash).
 * One object keeps element stacking simple everywhere pages are drawn.
 */
import { Rect } from "fabric";
import type { Background } from "@/lib/schema";
import { loadImage } from "./images";
import { toFabricFill } from "./mapping";

type ImageBackground = Extract<Background, { type: "image" }>;

export function backgroundFill(background: Background) {
  if (background.type === "solid") return background.color;
  if (background.type === "gradient") {
    return toFabricFill({ type: "gradient", gradient: background.gradient });
  }
  return "#FFFFFF";
}

export class PageBackground extends Rect {
  private picture: ImageBackground | null = null;
  private pixels: HTMLImageElement | null = null;
  /** Resolves once a background photo has loaded (or failed). */
  ready: Promise<void> = Promise.resolve();

  setBackground(background: Background) {
    this.set({ fill: backgroundFill(background), dirty: true });
    if (background.type !== "image") {
      this.picture = null;
      this.pixels = null;
      this.ready = Promise.resolve();
      return;
    }
    const sameSource = this.picture?.src === background.src;
    this.picture = background;
    if (sameSource && this.pixels) return;
    this.pixels = null;
    this.ready = loadImage(background.src).then(
      (img) => {
        if (this.picture?.src !== background.src) return;
        this.pixels = img;
        this.set("dirty", true);
        this.canvas?.requestRenderAll();
      },
      () => undefined,
    );
  }

  override _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);
    const picture = this.picture;
    const img = this.pixels;
    if (!picture) return;
    const w = this.width;
    const h = this.height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    if (img) {
      ctx.globalAlpha *= picture.opacity;
      const iw = img.naturalWidth || 1;
      const ih = img.naturalHeight || 1;
      if (picture.fit === "tile") {
        // Natural size, but never more than half the page per tile.
        const s = Math.min(1, w / 2 / iw, h / 2 / ih);
        const pattern = ctx.createPattern(img, "repeat");
        if (pattern) {
          pattern.setTransform(new DOMMatrix().translate(-w / 2, -h / 2).scale(s));
          ctx.fillStyle = pattern;
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
      } else {
        const s = picture.fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
        ctx.drawImage(img, (-iw * s) / 2, (-ih * s) / 2, iw * s, ih * s);
      }
      ctx.globalAlpha = 1;
    }
    if (picture.tint) {
      ctx.fillStyle = picture.tint;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
}
