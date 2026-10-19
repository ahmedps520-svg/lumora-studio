/** Tables, charts, codes, frames and icons draw real pixels. */
import { describe, expect, it } from "vitest";
import {
  createChart,
  createCode,
  createFrame,
  createIcon,
  createTable,
} from "@/lib/document/elements";
import { createObject } from "@/lib/engine/mapping";
import { renderPageToCanvas } from "@/lib/engine/render";
import type { Element } from "@/lib/schema";

const FORMAT = { width: 400, height: 400 };

async function render(elements: Element[]) {
  const canvas = await renderPageToCanvas(
    { background: { type: "solid", color: "#FFFFFF" }, elements },
    FORMAT,
  );
  const ctx = canvas.getContext("2d")!;
  const px = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
  /** How many sampled pixels in a box differ from white. */
  const ink = (x: number, y: number, w: number, h: number) => {
    const data = ctx.getImageData(x, y, w, h).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i]! < 230 || data[i + 1]! < 230 || data[i + 2]! < 230) n++;
    return n;
  };
  return { px, ink };
}

const fill = (el: Element, patch: Partial<Element>): Element =>
  ({ ...el, x: 0, y: 0, width: 400, height: 400, ...patch }) as Element;

describe("rich elements", () => {
  it("draws a QR code with finder squares in the corners", async () => {
    const qr = fill(createCode(FORMAT, "https://example.com"), {});
    const { px } = await render([qr]);
    // Quiet zone is white; the first module just inside it is dark.
    expect(px(3, 3).slice(0, 3)).toEqual([255, 255, 255]);
    const n = 25; // version 2 for this URL
    const cell = 400 / (n + 4);
    expect(px(Math.round(cell * 2.5), Math.round(cell * 2.5))[0]).toBeLessThan(50);
  });

  it("draws an EAN-13 barcode", async () => {
    const code = fill(createCode(FORMAT, "590123412345", "ean13"), { height: 200 });
    const { ink } = await render([code]);
    expect(ink(0, 20, 400, 120)).toBeGreaterThan(3_000);
  });

  it("draws a table with a coloured header row", async () => {
    const table = fill(createTable(FORMAT, 3, 2, ["Name", "Score"]), { height: 300 });
    const { px, ink } = await render([table]);
    // Header fill (#F1F5F9) behind the first row.
    expect(px(100, 20).slice(0, 3)).toEqual([0xf1, 0xf5, 0xf9]);
    // Text in the header row.
    expect(ink(0, 0, 400, 100)).toBeGreaterThan(50);
  });

  it("draws bar and pie charts", async () => {
    const sample = {
      title: "",
      labels: ["a", "b", "c"],
      series: [{ name: "s", values: [5, 10, 15] }],
    };
    const bars = await render([fill(createChart(FORMAT, "bar", sample), {})]);
    expect(bars.ink(0, 0, 400, 400)).toBeGreaterThan(5_000);
    const pie = await render([
      fill(createChart(FORMAT, "pie", sample), { showLegend: false } as Partial<Element>),
    ]);
    // Inside the first slice (top right, clockwise from 12 o'clock) is coloured.
    expect(pie.px(250, 150).slice(0, 3)).not.toEqual([255, 255, 255]);
    expect(pie.ink(0, 0, 400, 400)).toBeGreaterThan(40_000);
  });

  it("draws an empty frame as its placeholder shape", async () => {
    const frame = fill(createFrame(FORMAT, "circle", null), {});
    const { px } = await render([frame]);
    // A soft gradient in the placeholder colour (with a small photo glyph in the middle).
    const [r, g, b] = px(200, 90);
    expect(Math.abs(r! - 0xe2) + Math.abs(g! - 0xe8) + Math.abs(b! - 0xf0)).toBeLessThan(60);
    expect(px(5, 5).slice(0, 3)).toEqual([255, 255, 255]); // outside the circle
  });

  it("draws an icon in its colour", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="0" y="0" width="24" height="24" fill="currentColor"/></svg>';
    const icon = fill(createIcon(FORMAT, svg, "box", "#FF0000"), {});
    const { px } = await render([icon]);
    expect(px(200, 200).slice(0, 3)).toEqual([255, 0, 0]);
  });

  it("never throws for an element it can't draw", () => {
    const broken = fill(createCode(FORMAT, "x".repeat(2_000)), {
      errorCorrection: "H",
    } as Partial<Element>);
    expect(() => createObject(broken)).not.toThrow();
  });
});
