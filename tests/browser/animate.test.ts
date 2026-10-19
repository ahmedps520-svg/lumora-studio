/** Entrance animations: start states, timing, and an exact restore at the end. */
import { StaticCanvas, type Textbox } from "fabric";
import { afterEach, describe, expect, it } from "vitest";
import { effectiveAnimation, playEntrance, SPEED_MS } from "@/lib/engine/animate";
import { createObject } from "@/lib/engine/mapping";
import { ElementSchema, type Element, type ElementInput, type Page } from "@/lib/schema";

const el = (input: ElementInput): Element => ElementSchema.parse(input);
const FORMAT = { width: 1000, height: 800 };

const box = (id: string, extra: Partial<ElementInput> = {}) =>
  el({
    id,
    type: "shape",
    kind: "rect",
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    fill: { type: "solid", color: "#FF7A3D" },
    ...extra,
  } as ElementInput);

let canvas: StaticCanvas | null = null;
afterEach(() => {
  void canvas?.dispose();
  canvas = null;
});

function setup(elements: Element[], animation: Page["animation"] = null) {
  canvas = new StaticCanvas(document.createElement("canvas"), {
    ...FORMAT,
    renderOnAddRemove: false,
  });
  const objects = elements.map(createObject);
  canvas.add(...objects);
  const base = objects.map((o) => ({
    left: o.left,
    top: o.top,
    opacity: o.opacity,
    scaleX: o.scaleX,
    scaleY: o.scaleY,
    angle: o.angle,
    clipPath: o.clipPath,
  }));
  const playback = playEntrance(canvas, objects, { elements, animation }, FORMAT, {
    manual: true,
  });
  return { objects, base, playback };
}

describe("effectiveAnimation", () => {
  it("prefers the element's own animation over the page's", () => {
    const own = box("a", { animation: { kind: "pop", speed: "fast", direction: "up" } });
    const plain = box("b");
    const page = {
      animation: { kind: "fade" as const, speed: "slow" as const, direction: "up" as const },
    };
    expect(effectiveAnimation(own, page)?.kind).toBe("pop");
    expect(effectiveAnimation(plain, page)?.kind).toBe("fade");
    expect(effectiveAnimation(plain, { animation: null })).toBeNull();
  });
});

describe("playEntrance", () => {
  it("starts hidden/offset and ends exactly where the element is", () => {
    const { objects, base, playback } = setup([
      box("fade", { animation: { kind: "fade", speed: "medium", direction: "up" } }),
      box("rise", { animation: { kind: "rise", speed: "medium", direction: "up" } }),
      box("pop", { animation: { kind: "pop", speed: "medium", direction: "up" } }),
      box("pan", { animation: { kind: "pan", speed: "medium", direction: "left" } }),
      box("still"),
    ]);
    const [fade, rise, pop, pan, still] = objects;
    expect(fade!.opacity).toBe(0);
    expect(rise!.top).toBeGreaterThan(base[1]!.top);
    expect(pop!.scaleX).toBeLessThan(base[2]!.scaleX);
    // "left" moves leftwards, so it starts to the right.
    expect(pan!.left).toBeGreaterThan(base[3]!.left);
    // No animation → untouched.
    expect(still!.opacity).toBe(base[4]!.opacity);
    expect(playback.duration).toBe(SPEED_MS.medium);

    playback.seek(SPEED_MS.medium / 2);
    expect(fade!.opacity).toBeGreaterThan(0);
    expect(fade!.opacity).toBeLessThan(1);

    playback.finish();
    objects.forEach((o, i) => {
      const b = base[i]!;
      expect([o.left, o.top, o.opacity, o.scaleX, o.scaleY, o.angle]).toEqual([
        b.left,
        b.top,
        b.opacity,
        b.scaleX,
        b.scaleY,
        b.angle,
      ]);
    });
  });

  it("staggers page-wide animations in stacking order", () => {
    const { objects, playback } = setup([box("a"), box("b"), box("c")], {
      kind: "fade",
      speed: "fast",
      direction: "up",
    });
    // The third one waits two steps, so it's still invisible after the first finishes.
    playback.seek(SPEED_MS.fast);
    expect(objects[0]!.opacity).toBe(1);
    expect(objects[2]!.opacity).toBeLessThan(1);
    expect(playback.duration).toBeGreaterThan(SPEED_MS.fast);
  });

  it("types text in and restores the full text", () => {
    const text = el({
      id: "t",
      type: "text",
      x: 50,
      y: 50,
      width: 600,
      height: 80,
      runs: [{ text: "Hello animated world" }],
      animation: { kind: "typewriter", speed: "fast", direction: "up" },
    } as ElementInput);
    const { objects, base, playback } = setup([text]);
    const box = objects[0] as Textbox;
    expect(box.text).toBe("");
    playback.seek(playback.duration / 2);
    expect(box.text.length).toBeGreaterThan(0);
    expect(box.text.length).toBeLessThan("Hello animated world".length);
    playback.finish();
    expect(box.text).toBe("Hello animated world");
    expect(box.top).toBe(base[0]!.top);
  });

  it("wipes behind a temporary clip and removes it afterwards", () => {
    const { objects, playback } = setup([
      box("w", { animation: { kind: "wipe", speed: "medium", direction: "right" } }),
    ]);
    expect(objects[0]!.clipPath).toBeTruthy();
    playback.finish();
    expect(objects[0]!.clipPath).toBeUndefined();
  });

  it("plays on its own clock and resolves when done", async () => {
    canvas = new StaticCanvas(document.createElement("canvas"), FORMAT);
    const element = box("a", { animation: { kind: "fade", speed: "fast", direction: "up" } });
    const obj = createObject(element);
    canvas.add(obj);
    const playback = playEntrance(canvas, [obj], { elements: [element], animation: null }, FORMAT);
    await playback.done;
    expect(obj.opacity).toBe(1);
  });
});
