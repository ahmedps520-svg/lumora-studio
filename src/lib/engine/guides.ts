/**
 * Smart guides: while you drag, edges and centres snap to the page and to
 * other elements, with pink lines showing what lined up. Rotation snaps to
 * 45° steps, and resizing/rotating shows the size or angle. Hold Alt to move
 * freely.
 */
import { ActiveSelection, type Canvas, type FabricObject, type TBBox } from "fabric";
import { getObjectId } from "./mapping";

export const GUIDE_COLOR = "#F72585";
/** Snap distance in screen pixels (independent of zoom). */
const SNAP_PX = 6;
const ROTATE_STEP = 45;
const ROTATE_SNAP_DEG = 4;

interface Line {
  axis: "x" | "y";
  at: number;
  from: number;
  to: number;
}

interface Stop {
  at: number;
  /** Extent of the thing we lined up with, along the other axis. */
  from: number;
  to: number;
}

type Size = { width: number; height: number };

/** Edges and centre of a box along one axis. */
const xsOf = (b: TBBox) => [b.left, b.left + b.width / 2, b.left + b.width];
const ysOf = (b: TBBox) => [b.top, b.top + b.height / 2, b.top + b.height];

/**
 * The smallest shift (within `threshold`) that puts one of `values` on a stop,
 * or null when nothing is close enough.
 */
export function nearestSnap(values: number[], stops: number[], threshold: number): number | null {
  let best: number | null = null;
  for (const v of values) {
    for (const s of stops) {
      const d = s - v;
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  return best;
}

/** Snaps an angle to the nearest 45° step when it's within a few degrees of it. */
export function snapAngle(angle: number): number {
  const nearest = Math.round(angle / ROTATE_STEP) * ROTATE_STEP;
  return Math.abs(nearest - angle) <= ROTATE_SNAP_DEG ? nearest : angle;
}

const altHeld = (e: unknown) => Boolean((e as { altKey?: boolean } | undefined)?.altKey);

export class SmartGuides {
  private lines: Line[] = [];
  private label: { text: string; x: number; y: number } | null = null;
  private stops: { x: Stop[]; y: Stop[] } | null = null;
  private drawn = false;
  enabled = true;

  constructor(
    private readonly canvas: Canvas,
    private readonly page: () => Size | null,
    /** Objects that are never snap targets (the page background). */
    private readonly ignore: (obj: FabricObject) => boolean,
  ) {}

  bind(): () => void {
    const c = this.canvas;
    const offs = [
      c.on("object:moving", ({ target, e }) => this.onMove(target, altHeld(e))),
      c.on("object:scaling", ({ target }) => this.showSize(target)),
      c.on("object:resizing", ({ target }) => this.showSize(target)),
      c.on("object:rotating", ({ target, e }) => this.onRotate(target, altHeld(e))),
      c.on("mouse:up", () => this.reset()),
      c.on("before:render", () => {
        if (this.drawn) {
          c.clearContext(c.contextTop);
          this.drawn = false;
        }
      }),
      c.on("after:render", () => this.draw()),
    ];
    return () => offs.forEach((off) => off());
  }

  private reset() {
    const had = this.lines.length > 0 || this.label !== null;
    this.lines = [];
    this.label = null;
    this.stops = null;
    if (had) this.canvas.requestRenderAll();
  }

  /** Everything the moving objects can line up with: page edges/centre and other elements. */
  private collectStops(target: FabricObject, page: Size) {
    const moving = new Set<FabricObject>(
      target instanceof ActiveSelection ? target.getObjects() : [target],
    );
    const x: Stop[] = [0, page.width / 2, page.width].map((at) => ({
      at,
      from: 0,
      to: page.height,
    }));
    const y: Stop[] = [0, page.height / 2, page.height].map((at) => ({
      at,
      from: 0,
      to: page.width,
    }));
    for (const obj of this.canvas.getObjects()) {
      if (moving.has(obj) || this.ignore(obj) || !obj.visible || !getObjectId(obj)) continue;
      const b = obj.getBoundingRect();
      for (const at of xsOf(b)) x.push({ at, from: b.top, to: b.top + b.height });
      for (const at of ysOf(b)) y.push({ at, from: b.left, to: b.left + b.width });
    }
    return { x, y };
  }

  private onMove(target: FabricObject, free: boolean) {
    const page = this.page();
    if (!this.enabled || free || !page) {
      if (this.lines.length) this.lines = [];
      return;
    }
    this.stops ??= this.collectStops(target, page);
    const threshold = SNAP_PX / this.canvas.getZoom();
    const box = target.getBoundingRect();
    const dx = nearestSnap(
      xsOf(box),
      this.stops.x.map((s) => s.at),
      threshold,
    );
    const dy = nearestSnap(
      ysOf(box),
      this.stops.y.map((s) => s.at),
      threshold,
    );
    if (dx !== null || dy !== null) {
      target.set({ left: target.left + (dx ?? 0), top: target.top + (dy ?? 0) });
      target.setCoords();
    }
    this.lines = this.linesFor(target.getBoundingRect());
  }

  /** Guide lines for every edge/centre that now sits exactly on a stop. */
  private linesFor(box: TBBox): Line[] {
    if (!this.stops) return [];
    const lines = new Map<string, Line>();
    const add = (axis: "x" | "y", at: number, from: number, to: number) => {
      const key = `${axis}:${Math.round(at * 2)}`;
      const line = lines.get(key);
      if (line) {
        line.from = Math.min(line.from, from);
        line.to = Math.max(line.to, to);
      } else lines.set(key, { axis, at, from, to });
    };
    for (const v of xsOf(box)) {
      for (const s of this.stops.x) {
        if (Math.abs(s.at - v) < 0.5) {
          add("x", s.at, Math.min(s.from, box.top), Math.max(s.to, box.top + box.height));
        }
      }
    }
    for (const v of ysOf(box)) {
      for (const s of this.stops.y) {
        if (Math.abs(s.at - v) < 0.5) {
          add("y", s.at, Math.min(s.from, box.left), Math.max(s.to, box.left + box.width));
        }
      }
    }
    return [...lines.values()];
  }

  private onRotate(target: FabricObject, free: boolean) {
    if (this.enabled && !free) {
      const snapped = snapAngle(target.angle);
      if (snapped !== target.angle) {
        target.rotate(snapped);
        target.setCoords();
      }
    }
    const angle = ((Math.round(target.angle) % 360) + 360) % 360;
    this.placeLabel(target, `${angle}°`);
  }

  private showSize(target: FabricObject) {
    const width = Math.round(target.width * Math.abs(target.scaleX));
    const height = Math.round(target.height * Math.abs(target.scaleY));
    this.placeLabel(target, `${width} × ${height}`);
  }

  private placeLabel(target: FabricObject, text: string) {
    const box = target.getBoundingRect();
    this.label = { text, x: box.left + box.width / 2, y: box.top + box.height };
  }

  private draw() {
    if (this.lines.length === 0 && !this.label) return;
    const ctx = this.canvas.contextTop;
    const v = this.canvas.viewportTransform;
    const toScreen = (x: number, y: number) => ({ x: v[0] * x + v[4], y: v[3] * y + v[5] });
    ctx.save();
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const line of this.lines) {
      const a = line.axis === "x" ? toScreen(line.at, line.from) : toScreen(line.from, line.at);
      const b = line.axis === "x" ? toScreen(line.at, line.to) : toScreen(line.to, line.at);
      // Half-pixel offset keeps 1px lines crisp.
      const ax = line.axis === "x" ? Math.round(a.x) + 0.5 : a.x;
      const ay = line.axis === "y" ? Math.round(a.y) + 0.5 : a.y;
      ctx.moveTo(ax, ay);
      ctx.lineTo(line.axis === "x" ? ax : b.x, line.axis === "y" ? ay : b.y);
    }
    ctx.stroke();
    if (this.label) {
      const p = toScreen(this.label.x, this.label.y);
      ctx.font = "600 12px system-ui, sans-serif";
      const w = ctx.measureText(this.label.text).width + 16;
      const h = 22;
      const x = p.x - w / 2;
      const y = p.y + 14;
      ctx.fillStyle = "rgba(24, 18, 43, 0.92)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 11);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label.text, p.x, y + h / 2 + 0.5);
    }
    ctx.restore();
    this.drawn = true;
  }
}
