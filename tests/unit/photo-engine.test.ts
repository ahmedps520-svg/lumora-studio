// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_TYPES,
  applyAdjustment,
  autoLevels,
  createAdjustment,
  curveLut,
} from "@/lib/photo/adjustments";
import { blendInto, NATIVE_BLEND, SEPARABLE } from "@/lib/photo/blend";
import { defaultParams, FILTERS } from "@/lib/photo/filters";
import { contentAwareFill, smoothFill } from "@/lib/photo/inpaint";
import {
  cloneImg,
  createImg,
  hexToRgb,
  histogram,
  hslToRgb,
  type Img,
  rgbToHex,
  rgbToHsl,
} from "@/lib/photo/pixels";
import {
  border,
  combine,
  ellipseMask,
  expand,
  feather,
  invert,
  isEmpty,
  magicWand,
  maskBounds,
  outline,
  polygonMask,
  rectMask,
} from "@/lib/photo/selection";
import { BLEND_MODES } from "@/lib/photo/types";

/** A 16×16 test image: a horizontal gray ramp with a red square in the middle. */
function testImage(): Img {
  const img = createImg(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      const v = x * 16;
      img.data.set(x >= 6 && x < 10 && y >= 6 && y < 10 ? [220, 30, 30, 255] : [v, v, v, 255], i);
    }
  return img;
}

const px = (img: Img, x: number, y: number) => [
  ...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4),
];

describe("colour helpers", () => {
  it("round-trips hex and HSL", () => {
    expect(rgbToHex(...hexToRgb("#3A2E8F"))).toBe("#3A2E8F");
    const [h, s, l] = rgbToHsl(255, 128, 0);
    expect(hslToRgb(h, s, l).map(Math.round)).toEqual([255, 128, 0]);
  });
});

describe("adjustments", () => {
  it("leave the image unchanged at their default settings", () => {
    const neutral = ADJUSTMENT_TYPES.filter(
      (t) =>
        ![
          "invert",
          "posterize",
          "threshold",
          "gradientMap",
          "blackWhite",
          "photoFilter",
          "shadowsHighlights",
          "desaturate",
          "equalize",
        ].includes(t),
    );
    for (const type of neutral) {
      const img = testImage();
      const before = cloneImg(img);
      applyAdjustment(img, createAdjustment(type));
      let maxDiff = 0;
      for (let i = 0; i < img.data.length; i++)
        maxDiff = Math.max(maxDiff, Math.abs(img.data[i]! - before.data[i]!));
      expect(maxDiff, type).toBeLessThanOrEqual(2);
    }
  });

  it("invert, threshold and desaturate do what they say", () => {
    const img = testImage();
    applyAdjustment(img, { type: "invert" });
    expect(px(img, 0, 0)).toEqual([255, 255, 255, 255]);
    const t = testImage();
    applyAdjustment(t, { type: "threshold", level: 128 });
    expect(px(t, 2, 0)[0]).toBe(0);
    expect(px(t, 14, 0)[0]).toBe(255);
    const g = testImage();
    applyAdjustment(g, { type: "desaturate" });
    const [r, gg, b] = px(g, 7, 7);
    expect(r).toBe(gg);
    expect(gg).toBe(b);
  });

  it("curves interpolate smoothly through their points", () => {
    const table = curveLut([
      [0, 0],
      [128, 200],
      [255, 255],
    ]);
    expect(table[128]).toBe(200);
    expect(table[0]).toBe(0);
    expect(table[64]!).toBeGreaterThan(64);
  });

  it("hue/saturation can colorize, and auto contrast stretches the range", () => {
    const img = testImage();
    applyAdjustment(img, {
      type: "hueSaturation",
      hue: 200,
      saturation: 50,
      lightness: 0,
      colorize: true,
    });
    const [r, , b] = px(img, 8, 0);
    expect(b!).toBeGreaterThan(r!);
    const dull = createImg(8, 1);
    for (let x = 0; x < 8; x++) dull.data.set([100 + x * 5, 100 + x * 5, 100 + x * 5, 255], x * 4);
    autoLevels(dull, "contrast");
    expect(dull.data[0]).toBe(0);
    expect(dull.data[7 * 4]).toBe(255);
  });

  it("counts a histogram", () => {
    const h = histogram(testImage());
    expect(h.r.reduce((a, b) => a + b, 0)).toBe(256);
  });
});

describe("blending", () => {
  it("covers all 27 modes, natively or per pixel", () => {
    for (const mode of BLEND_MODES) {
      const handled =
        mode in NATIVE_BLEND ||
        mode in SEPARABLE ||
        ["dissolve", "darkerColor", "lighterColor"].includes(mode);
      expect(handled, mode).toBe(true);
    }
  });

  it("multiplies, screens and subtracts like the formulas say", () => {
    const run = (mode: (typeof BLEND_MODES)[number]) => {
      const dst = createImg(1, 1, [200, 100, 50, 255]);
      const src = createImg(1, 1, [128, 128, 128, 255]);
      blendInto(dst, src, mode);
      return [...dst.data];
    };
    expect(run("multiply")[0]).toBe(Math.round((200 * 128) / 255));
    expect(run("subtract")[0]).toBe(72);
    expect(run("normal")).toEqual([128, 128, 128, 255]);
    expect(run("screen")[2]).toBeGreaterThan(128);
  });

  it("respects opacity", () => {
    const dst = createImg(1, 1, [0, 0, 0, 255]);
    blendInto(dst, createImg(1, 1, [255, 255, 255, 255]), "linearLight", 0.5);
    expect(dst.data[0]).toBeGreaterThan(100);
    expect(dst.data[0]).toBeLessThan(160);
  });
});

describe("filters", () => {
  it("all run on a small image without errors and keep its size", () => {
    for (const f of FILTERS) {
      const img = testImage();
      f.apply(img, defaultParams(f), { fg: "#000000", bg: "#FFFFFF", seed: 3 });
      expect(img.width, f.id).toBe(16);
      expect(img.data.length, f.id).toBe(16 * 16 * 4);
      for (const v of img.data) expect(Number.isFinite(v), f.id).toBe(true);
    }
  });

  it("gaussian blur softens edges and mosaic makes blocks", () => {
    const img = testImage();
    FILTERS.find((f) => f.id === "gaussianBlur")!.apply(
      img,
      { radius: 4 },
      { fg: "#000", bg: "#fff", seed: 1 },
    );
    expect(px(img, 7, 7)[1]!).toBeGreaterThan(30);
    const m = testImage();
    FILTERS.find((f) => f.id === "mosaic")!.apply(
      m,
      { cellSize: 4 },
      { fg: "#000", bg: "#fff", seed: 1 },
    );
    expect(px(m, 0, 0)).toEqual(px(m, 3, 3));
  });
});

describe("selections", () => {
  it("builds, combines and inverts masks", () => {
    const a = rectMask(10, 10, 0, 0, 5, 10);
    const b = rectMask(10, 10, 3, 0, 5, 10);
    expect(maskBounds(combine(a, b, "add"))).toEqual({ x: 0, y: 0, width: 8, height: 10 });
    expect(maskBounds(combine(a, b, "intersect"))).toEqual({ x: 3, y: 0, width: 2, height: 10 });
    expect(maskBounds(combine(a, b, "subtract"))).toEqual({ x: 0, y: 0, width: 3, height: 10 });
    expect(maskBounds(invert(a))).toEqual({ x: 5, y: 0, width: 5, height: 10 });
    expect(isEmpty(combine(a, a, "subtract"))).toBe(true);
  });

  it("draws ellipses and lassos with soft edges", () => {
    const e = ellipseMask(20, 20, 0, 0, 20, 20);
    expect(e.data[10 * 20 + 10]).toBe(255);
    expect(e.data[0]).toBe(0);
    const tri = polygonMask(20, 20, [
      [0, 0],
      [20, 0],
      [0, 20],
    ]);
    expect(tri.data[2 * 20 + 2]).toBe(255);
    expect(tri.data[18 * 20 + 18]).toBe(0);
  });

  it("expands, contracts, borders and feathers", () => {
    const m = rectMask(20, 20, 5, 5, 10, 10);
    expect(maskBounds(expand(m, 2))).toEqual({ x: 3, y: 3, width: 14, height: 14 });
    expect(maskBounds(expand(m, -2))).toEqual({ x: 7, y: 7, width: 6, height: 6 });
    expect(border(m, 2).data[10 * 20 + 10]).toBe(0);
    const f = feather(m, 4);
    expect(f.data[5 * 20 + 10]!).toBeGreaterThan(0);
    expect(f.data[5 * 20 + 10]!).toBeLessThan(255);
  });

  it("magic wand flood-fills similar colours", () => {
    const sel = magicWand(testImage(), 7, 7, 10, true);
    expect(maskBounds(sel)).toEqual({ x: 6, y: 6, width: 4, height: 4 });
    expect(outline(sel).length).toBeGreaterThan(0);
  });
});

describe("filling holes", () => {
  it("fills a hole with the surrounding colour", () => {
    const img = createImg(20, 20, [40, 160, 90, 255]);
    const hole = new Uint8Array(400);
    for (let y = 8; y < 12; y++)
      for (let x = 8; x < 12; x++) {
        hole[y * 20 + x] = 1;
        img.data.set([255, 0, 0, 255], (y * 20 + x) * 4);
      }
    const a = cloneImg(img);
    smoothFill(a, hole);
    expect(px(a, 10, 10)).toEqual([40, 160, 90, 255]);
    contentAwareFill(img, hole);
    expect(px(img, 10, 10)).toEqual([40, 160, 90, 255]);
  });
});
