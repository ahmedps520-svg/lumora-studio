import { describe, expect, it } from "vitest";
import {
  cssFilter,
  IMAGE_PRESETS,
  isNeutral,
  resetAdjustments,
  resolveFilters,
  withPreset,
  type ImageFilters,
} from "@/lib/document/image-filters";
import {
  backgroundToImage,
  clampCrop,
  coverCrop,
  cropPatch,
  imageToBackground,
} from "@/lib/document/photo";
import {
  ElementSchema,
  ImageFiltersSchema,
  type ElementInput,
  type ImageElement,
} from "@/lib/schema";

const blank = (): ImageFilters => ImageFiltersSchema.parse({});

describe("photo filters", () => {
  it("starts neutral", () => {
    const r = resolveFilters(blank());
    expect(isNeutral(r)).toBe(true);
    expect(cssFilter(r)).toBe("none");
  });

  it("scales a look by its strength and stacks manual adjustments", () => {
    const f = { ...withPreset(blank(), "vivid"), presetStrength: 0.5, saturation: 0.1 };
    const r = resolveFilters(f);
    expect(r.saturation).toBeCloseTo(IMAGE_PRESETS.vivid.saturation * 0.5 + 0.1);
    expect(r.contrast).toBeCloseTo(IMAGE_PRESETS.vivid.contrast * 0.5);
  });

  it("clamps combined values", () => {
    const r = resolveFilters({ ...withPreset(blank(), "noir"), contrast: 1 });
    expect(r.contrast).toBe(1);
    expect(r.mono).toBe(1);
  });

  it("ignores unknown preset names", () => {
    expect(isNeutral(resolveFilters({ ...blank(), preset: "nope" }))).toBe(true);
  });

  it("resets adjustments but keeps the look", () => {
    const f = resetAdjustments({ ...withPreset(blank(), "warm"), brightness: 0.4, blur: 0.2 });
    expect(f.preset).toBe("warm");
    expect(f.brightness).toBe(0);
    expect(f.blur).toBe(0);
  });

  it("previews looks with CSS filters", () => {
    expect(cssFilter(resolveFilters(withPreset(blank(), "mono")))).toContain("grayscale(1");
  });
});

const photo = (input: Partial<ElementInput> = {}) =>
  ElementSchema.parse({
    id: "p",
    type: "image",
    src: "asset:abc",
    x: 100,
    y: 100,
    width: 400,
    height: 300,
    ...input,
  } as ElementInput) as ImageElement;

describe("crop helpers", () => {
  const natural = { width: 2000, height: 1500 };

  it("finds the biggest centred crop of a shape", () => {
    expect(coverCrop(natural, { width: 1, height: 1 })).toEqual({
      x: 250,
      y: 0,
      width: 1500,
      height: 1500,
    });
    expect(coverCrop(natural, { width: 16, height: 9 })).toEqual({
      x: 0,
      y: 187.5,
      width: 2000,
      height: 1125,
    });
  });

  it("keeps crops inside the photo", () => {
    expect(clampCrop({ x: -50, y: 1400, width: 300, height: 300 }, natural)).toEqual({
      x: 0,
      y: 1200,
      width: 300,
      height: 300,
    });
  });

  it("keeps zoom and centre when the crop changes", () => {
    const el = photo(); // 400 px wide showing 2000 source px → 0.2 per px
    const patch = cropPatch(el, { x: 500, y: 0, width: 1000, height: 1500 }, natural);
    expect(patch).toMatchObject({ width: 200, height: 300, x: 200, y: 100 });
    // Back to the full photo stores no crop.
    expect(cropPatch({ ...el, ...patch } as ImageElement, null, natural).crop).toBeNull();
  });
});

describe("background photos", () => {
  it("round-trips between element and background", () => {
    const bg = imageToBackground(photo({ opacity: 0.8 }));
    expect(bg).toEqual({ type: "image", src: "asset:abc", fit: "cover", opacity: 0.8, tint: null });
    const el = backgroundToImage(
      bg as Extract<typeof bg, { type: "image" }>,
      { width: 2000, height: 1000 },
      { width: 1080, height: 1080 },
    );
    expect(el).toMatchObject({ x: 0, y: 0, width: 1080, height: 1080, opacity: 0.8 });
    expect(el.crop).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });
});
