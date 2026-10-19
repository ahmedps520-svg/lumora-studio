/**
 * Textbox with a solid 3D extrusion ("game title" look): before the normal
 * text is drawn, it is drawn many times, stepping back along `extrude.angle`
 * in `extrude.color`. Outlines are included, so thick outlined titles get
 * thick sides. Only the deepest layer casts the drop shadow.
 */
import { Textbox } from "fabric";

export interface Extrusion {
  /** Depth in text pixels. */
  depth: number;
  color: string;
  /** Direction the sides go, in degrees: 90 = straight down, 135 = down-left. */
  angle: number;
}

const MAX_STEPS = 48;

export class LumoraTextbox extends Textbox {
  extrude: Extrusion | null = null;
  /** While set, every fill and stroke is painted in this colour. */
  private passColor: string | null = null;

  override handleFiller<T extends "fill" | "stroke">(
    ctx: CanvasRenderingContext2D,
    property: `${T}Style`,
    filler: Parameters<Textbox["handleFiller"]>[2],
  ): { offsetX: number; offsetY: number } {
    if (!this.passColor) return super.handleFiller(ctx, property, filler);
    ctx[property] = this.passColor;
    return { offsetX: 0, offsetY: 0 };
  }

  override _renderText(ctx: CanvasRenderingContext2D) {
    const ex = this.extrude;
    if (!ex || ex.depth < 0.5) {
      super._renderText(ctx);
      return;
    }
    const steps = Math.min(MAX_STEPS, Math.max(2, Math.ceil(ex.depth)));
    const rad = (ex.angle * Math.PI) / 180;
    const dx = (Math.cos(rad) * ex.depth) / steps;
    const dy = (Math.sin(rad) * ex.depth) / steps;
    const shadow = {
      color: ctx.shadowColor,
      blur: ctx.shadowBlur,
      x: ctx.shadowOffsetX,
      y: ctx.shadowOffsetY,
    };
    const noShadow = () => {
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.shadowBlur = 0;
    };

    this.passColor = ex.color;
    try {
      for (let i = steps; i >= 1; i--) {
        ctx.save();
        if (i !== steps) noShadow();
        ctx.translate(dx * i, dy * i);
        super._renderText(ctx);
        ctx.restore();
      }
    } finally {
      this.passColor = null;
    }
    // The face sits on its own sides: no shadow of its own.
    ctx.save();
    noShadow();
    super._renderText(ctx);
    ctx.restore();
    Object.assign(ctx, {
      shadowColor: shadow.color,
      shadowBlur: shadow.blur,
      shadowOffsetX: shadow.x,
      shadowOffsetY: shadow.y,
    });
  }
}
