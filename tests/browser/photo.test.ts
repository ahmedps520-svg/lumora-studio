/** Photo filters, frames and background photos render for real. */
import { describe, expect, it } from "vitest";
import { renderPageToCanvas } from "@/lib/engine/render";
import { ElementSchema, type Background, type Element, type ElementInput } from "@/lib/schema";

const FORMAT = { width: 200, height: 200 };

/** A 100×100 PNG: left half red, right half blue. */
function testPhoto(): string {
  const c = document.createElement("canvas");
  c.width = 100;
  c.height = 100;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#FF0000";
  ctx.fillRect(0, 0, 50, 100);
  ctx.fillStyle = "#0000FF";
  ctx.fillRect(50, 0, 50, 100);
  return c.toDataURL("image/png");
}

const SRC = testPhoto();

const photo = (input: Partial<ElementInput> = {}): Element =>
  ElementSchema.parse({
    id: "p",
    type: "image",
    src: SRC,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    ...input,
  } as ElementInput);

async function render(
  elements: Element[],
  background: Background = { type: "solid", color: "#FFFFFF" },
) {
  const canvas = await renderPageToCanvas({ background, elements }, FORMAT);
  const ctx = canvas.getContext("2d")!;
  return (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
}

describe("photo rendering", () => {
  it("draws the photo unchanged without filters", async () => {
    const px = await render([photo()]);
    expect(px(40, 100).slice(0, 3)).toEqual([255, 0, 0]);
    expect(px(160, 100).slice(0, 3)).toEqual([0, 0, 255]);
  });

  it("applies a black-and-white look", async () => {
    const px = await render([photo({ filters: { preset: "mono", presetStrength: 1 } } as never)]);
    const [r, g, b] = px(40, 100);
    expect(Math.abs(r! - g!)).toBeLessThan(4);
    expect(Math.abs(g! - b!)).toBeLessThan(4);
  });

  it("warms up the picture", async () => {
    const px = await render([photo({ filters: { warmth: 1 } } as never)]);
    const [r, , b] = px(160, 100); // blue half
    expect(r).toBeGreaterThan(10);
    expect(b).toBeLessThan(255);
  });

  it("darkens the corners with a vignette", async () => {
    const plain = await render([photo()]);
    const vignetted = await render([photo({ filters: { vignette: 1 } } as never)]);
    expect(vignetted(2, 2)[0]).toBeLessThan(plain(2, 2)[0]! - 60);
    // The middle stays close to the original.
    expect(vignetted(60, 100)[0]).toBeGreaterThan(200);
  });

  it("clips a photo to a circle frame", async () => {
    const px = await render([photo({ mask: { kind: "ellipse" } } as never)]);
    expect(px(2, 2).slice(0, 3)).toEqual([255, 255, 255]); // outside the circle: page
    expect(px(40, 100).slice(0, 3)).toEqual([255, 0, 0]);
  });
});

describe("background photos", () => {
  const bg = (patch: Partial<Extract<Background, { type: "image" }>> = {}): Background => ({
    type: "image",
    src: SRC,
    fit: "cover",
    opacity: 1,
    tint: null,
    ...patch,
  });

  it("fills the page", async () => {
    const px = await render([], bg());
    expect(px(10, 10).slice(0, 3)).toEqual([255, 0, 0]);
    expect(px(190, 190).slice(0, 3)).toEqual([0, 0, 255]);
  });

  it("applies opacity and a colour wash", async () => {
    const faded = await render([], bg({ opacity: 0.5 }));
    expect(faded(10, 100)[1]).toBeGreaterThan(100); // red over white → pink
    const washed = await render([], bg({ tint: "#00FF0080" }));
    expect(washed(10, 100)[1]).toBeGreaterThan(100); // green wash over red
  });

  it("can repeat as a pattern", async () => {
    const px = await render([], bg({ fit: "tile" }));
    // Tiles are at most half the page, so blue shows up in the left half too.
    expect(px(75, 50).slice(0, 3)).toEqual([0, 0, 255]);
  });
});
