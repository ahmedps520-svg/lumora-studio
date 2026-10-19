/**
 * Entrance animations for a shown page (Present mode, previews, video export).
 * Each animation is a start state (opacity, offset, scale, angle, clip,
 * typed characters) eased into the element's real state. Objects are put in
 * their start state before the first frame, so nothing flashes.
 */
import { Rect, Textbox, type FabricObject, type StaticCanvas } from "fabric";
import type { Animation, Element, Page } from "@/lib/schema";
import { getObjectId } from "./mapping";

export const SPEED_MS: Record<Animation["speed"], number> = {
  slow: 1_150,
  medium: 750,
  fast: 450,
};
/** How long a page transition takes (Present mode and video downloads). */
export const PAGE_TRANSITION_MS = 480;
/** Delay between elements when the whole page animates. */
const STAGGER_MS = 110;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => {
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
const easeOutBounce = (t: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

interface Base {
  left: number;
  top: number;
  opacity: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  text?: string;
  height?: number;
  clipPath?: FabricObject["clipPath"];
}

interface Track {
  obj: FabricObject;
  base: Base;
  animation: Animation;
  delay: number;
  duration: number;
}

/** The animation an element actually gets (its own, else the page's). */
export function effectiveAnimation(element: Element, page: Pick<Page, "animation">) {
  return element.animation ?? page.animation ?? null;
}

function offsetFor(direction: Animation["direction"], distance: number) {
  switch (direction) {
    case "up":
      return { x: 0, y: distance };
    case "down":
      return { x: 0, y: -distance };
    case "left":
      return { x: distance, y: 0 };
    case "right":
      return { x: -distance, y: 0 };
  }
}

/** Puts one object into its state at progress `t` (0 = start, 1 = done). */
function apply(track: Track, t: number, page: { width: number; height: number }) {
  const { obj, base, animation } = track;
  const k = easeOut(t);
  const set = (props: Partial<Base>) => obj.set(props as Record<string, unknown>);
  const fade = { opacity: base.opacity * Math.min(1, t * 1.6) };

  switch (animation.kind) {
    case "fade":
      set({ opacity: base.opacity * k });
      break;
    case "rise":
    case "pan":
    case "drift": {
      const distance =
        animation.kind === "drift"
          ? Math.min(page.width, page.height) * 0.05
          : animation.kind === "rise"
            ? page.height * 0.08
            : page.width * 0.12;
      const o = offsetFor(animation.kind === "rise" ? "up" : animation.direction, distance);
      set({ ...fade, left: base.left + o.x * (1 - k), top: base.top + o.y * (1 - k) });
      break;
    }
    case "bounce": {
      const b = easeOutBounce(t);
      set({ ...fade, top: base.top - page.height * 0.18 * (1 - b) });
      break;
    }
    case "pop": {
      const s = 0.6 + 0.4 * easeOutBack(t);
      set({ ...fade, scaleX: base.scaleX * s, scaleY: base.scaleY * s });
      break;
    }
    case "zoom": {
      const s = 1.25 - 0.25 * k;
      set({ opacity: base.opacity * k, scaleX: base.scaleX * s, scaleY: base.scaleY * s });
      break;
    }
    case "breathe": {
      const s = 0.92 + 0.08 * k;
      set({ opacity: base.opacity * k, scaleX: base.scaleX * s, scaleY: base.scaleY * s });
      break;
    }
    case "stomp": {
      const s = 1 + 0.6 * (1 - easeOutBounce(t));
      set({ ...fade, scaleX: base.scaleX * s, scaleY: base.scaleY * s });
      break;
    }
    case "tumble": {
      const s = 0.7 + 0.3 * k;
      set({
        ...fade,
        angle: base.angle - 25 * (1 - k),
        scaleX: base.scaleX * s,
        scaleY: base.scaleY * s,
      });
      break;
    }
    case "wipe": {
      // Reveal behind a growing clip box (in the object's own coordinates).
      const clip = obj.clipPath as Rect | undefined;
      if (clip && clip !== base.clipPath) {
        const w = obj.width;
        const h = obj.height;
        const horizontal = animation.direction === "left" || animation.direction === "right";
        const size = Math.max(0.0001, k);
        clip.set({
          width: horizontal ? w * size : w,
          height: horizontal ? h : h * size,
          left: horizontal
            ? animation.direction === "left"
              ? w / 2 - (w * size) / 2
              : -w / 2 + (w * size) / 2
            : 0,
          top: horizontal
            ? 0
            : animation.direction === "up"
              ? h / 2 - (h * size) / 2
              : -h / 2 + (h * size) / 2,
        });
        obj.set("dirty", true);
      } else set({ opacity: base.opacity * k });
      break;
    }
    case "typewriter": {
      if (obj instanceof Textbox && base.text !== undefined) {
        const chars = [...base.text];
        const count = Math.round(chars.length * t);
        obj.set({ text: chars.slice(0, count).join("") });
        obj.initDimensions();
        // Keep the top edge where it is while lines appear.
        obj.set({ top: base.top - (base.height ?? obj.height) / 2 + obj.height / 2 });
      } else set({ opacity: base.opacity * k });
      break;
    }
  }
  obj.setCoords();
}

function restore(track: Track) {
  const { obj, base } = track;
  obj.set({
    left: base.left,
    top: base.top,
    opacity: base.opacity,
    scaleX: base.scaleX,
    scaleY: base.scaleY,
    angle: base.angle,
  });
  if (base.text !== undefined && obj instanceof Textbox) {
    obj.set({ text: base.text });
    obj.initDimensions();
  }
  if (track.animation.kind === "wipe") obj.set({ clipPath: base.clipPath, dirty: true });
  obj.setCoords();
}

export interface Playback {
  /** Resolves when every animation has finished (or was stopped). */
  done: Promise<void>;
  /** Jumps to the end state immediately. */
  finish: () => void;
  /** Renders the state at `ms` without running a clock (for video export). */
  seek: (ms: number) => void;
  /** Total length in ms. */
  duration: number;
}

/**
 * Plans and (unless `manual`) plays the entrance animations of a page whose
 * objects are on `canvas`. Call it right after adding the objects, before the
 * first render.
 */
export function playEntrance(
  canvas: StaticCanvas,
  objects: FabricObject[],
  page: Pick<Page, "elements" | "animation">,
  format: { width: number; height: number },
  options: { manual?: boolean } = {},
): Playback {
  const byId = new Map(page.elements.map((e) => [e.id, e]));
  const tracks: Track[] = [];
  let order = 0;
  for (const obj of objects) {
    const element = byId.get(getObjectId(obj) ?? "");
    const animation = element ? effectiveAnimation(element, page) : null;
    if (!element || !animation) continue;
    const pageWide = !element.animation;
    const base: Base = {
      left: obj.left,
      top: obj.top,
      opacity: obj.opacity,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle,
      clipPath: obj.clipPath,
    };
    if (animation.kind === "typewriter" && obj instanceof Textbox) {
      base.text = obj.text;
      base.height = obj.height;
    }
    if (animation.kind === "wipe" && !obj.clipPath) {
      obj.set({ clipPath: new Rect({ width: obj.width, height: obj.height, left: 0, top: 0 }) });
    }
    const duration = SPEED_MS[animation.speed] * (animation.kind === "typewriter" ? 2.2 : 1);
    tracks.push({ obj, base, animation, delay: pageWide ? order++ * STAGGER_MS : 0, duration });
  }

  const total = tracks.reduce((m, tr) => Math.max(m, tr.delay + tr.duration), 0);
  const seek = (ms: number) => {
    for (const track of tracks) {
      const t = Math.min(1, Math.max(0, (ms - track.delay) / track.duration));
      if (t >= 1) restore(track);
      else apply(track, t, format);
    }
    canvas.requestRenderAll();
  };
  seek(0);

  let stopped = false;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (resolveDone = resolve));
  const finish = () => {
    if (stopped) return;
    stopped = true;
    tracks.forEach(restore);
    canvas.requestRenderAll();
    resolveDone();
  };

  if (tracks.length === 0) finish();
  else if (!options.manual) {
    const start = performance.now();
    const frame = (now: number) => {
      if (stopped) return;
      const elapsed = now - start;
      if (elapsed >= total) return finish();
      seek(elapsed);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  return { done, finish, seek, duration: total };
}
