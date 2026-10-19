/** Downloads render real files in a real browser. */
import { describe, expect, it } from "vitest";
import { createDesign, createPage } from "@/lib/document/factory";
import { createDownload, DEFAULT_DOWNLOAD, type DownloadOptions } from "@/lib/export/download";
import { ElementSchema, type Design, type ElementInput } from "@/lib/schema";

function sampleDesign(): Design {
  const design = createDesign({
    name: "Export test",
    format: { width: 400, height: 300, unit: "px", dpi: 96, presetId: null },
  });
  const shape = ElementSchema.parse({
    id: "box",
    type: "shape",
    kind: "rect",
    x: 50,
    y: 50,
    width: 200,
    height: 120,
    fill: { type: "solid", color: "#FF7A3D" },
    animation: { kind: "pop", speed: "fast", direction: "up" },
  } as ElementInput);
  const text = ElementSchema.parse({
    id: "title",
    type: "text",
    x: 20,
    y: 200,
    width: 360,
    height: 60,
    runs: [{ text: "Hello" }],
  } as ElementInput);
  design.pages[0]!.elements = [shape, text];
  design.pages[0]!.background = { type: "solid", color: "#102030" };
  design.pages[0]!.durationMs = 600;
  const second = createPage();
  second.durationMs = 600;
  second.transition = "slide";
  design.pages.push(second);
  return design;
}

const run = (design: Design, patch: Partial<DownloadOptions>) =>
  createDownload(design, {
    ...DEFAULT_DOWNLOAD,
    pageIds: design.pages.map((p) => p.id),
    ...patch,
  });

async function decode(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return {
    width: bitmap.width,
    height: bitmap.height,
    pixel: (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data,
  };
}

describe("createDownload", () => {
  it("renders a PNG at the chosen size, with or without background", async () => {
    const design = sampleDesign();
    const one = { pageIds: [design.pages[0]!.id] };
    const png = await run(design, { ...one, type: "png", scale: 2 });
    expect(png.filename).toBe("Export test.png");
    const image = await decode(png.blob);
    expect([image.width, image.height]).toEqual([800, 600]);
    expect([...image.pixel(4, 4)]).toEqual([0x10, 0x20, 0x30, 255]);
    // The orange box is drawn at its full end state (animations don't apply to pictures).
    expect([...image.pixel(300, 220)].slice(0, 3)).toEqual([0xff, 0x7a, 0x3d]);

    const clear = await decode(
      (await run(design, { ...one, type: "png", transparent: true })).blob,
    );
    expect(clear.pixel(4, 4)[3]).toBe(0);
  });

  it("zips several pages and writes multi-page PDFs", async () => {
    const design = sampleDesign();
    const zip = await run(design, { type: "jpg" });
    expect(zip.filename).toBe("Export test.zip");
    expect(zip.blob.type).toBe("application/zip");

    for (const type of ["pdf", "pdf-print"] as const) {
      const pdf = await run(design, { type });
      const head = new TextDecoder("latin1").decode(new Uint8Array(await pdf.blob.arrayBuffer()));
      expect(head.startsWith("%PDF-1.4")).toBe(true);
      expect(head).toContain("/Count 2");
      expect(head).toContain("/MediaBox [0 0 300 225]");
    }
  });

  it("writes SVG with live text", async () => {
    const design = sampleDesign();
    const svg = await run(design, { type: "svg", pageIds: [design.pages[0]!.id] });
    const markup = await svg.blob.text();
    expect(markup).toContain("<svg");
    expect(markup).toContain("Hello");
    expect(markup).toContain("fonts.googleapis.com");
  });

  it("encodes a video of every page", async () => {
    const design = sampleDesign();
    const video = await run(design, { type: "video", videoSize: 720 });
    expect(video.blob.type).toMatch(/^video\/(mp4|webm)$/);
    expect(video.blob.size).toBeGreaterThan(1_000);
  }, 60_000);
});
