import { describe, expect, it } from "vitest";
import {
  angleToCoords,
  contrastRatio,
  coordsToAngle,
  fillToCss,
  normalizeHex,
} from "@/lib/engine/paint";
import { polygonPoints, shapePath, starPoints } from "@/lib/engine/shapes";
import { fabricToRuns, normalizeRuns, runsToFabric } from "@/lib/engine/text-styles";
import type { TextRun } from "@/lib/schema";

describe("text runs ⇄ Fabric styles", () => {
  it("converts runs to text + per-character styles across lines", () => {
    const runs: TextRun[] = [
      { text: "Hi ", style: {} },
      { text: "you\nthere", style: { fontWeight: 700, color: "#FF0000" } },
    ];
    const { text, styles } = runsToFabric(runs);
    expect(text).toBe("Hi you\nthere");
    expect(styles[0]?.[2]).toBeUndefined();
    expect(styles[0]?.[3]).toEqual({ fontWeight: 700, fill: "#FF0000" });
    expect(styles[1]?.[0]).toEqual({ fontWeight: 700, fill: "#FF0000" });
    expect(Object.keys(styles[1] ?? {})).toHaveLength(5);
  });

  it("round-trips back to normalized runs", () => {
    const runs: TextRun[] = [
      { text: "a", style: {} },
      { text: "b", style: {} },
      { text: "c\nd", style: { italic: true, underline: true } },
      { text: "", style: { strike: true } },
    ];
    const { text, styles } = runsToFabric(runs);
    expect(fabricToRuns(text, styles)).toEqual(normalizeRuns(runs));
    expect(normalizeRuns(runs)).toEqual([
      { text: "ab", style: {} },
      { text: "c\nd", style: { italic: true, underline: true } },
    ]);
  });

  it("handles emoji and empty text", () => {
    const runs: TextRun[] = [{ text: "🎉 ok", style: { color: "#00FF00" } }];
    const { text, styles } = runsToFabric(runs);
    expect(Object.keys(styles[0] ?? {})).toHaveLength(4);
    expect(fabricToRuns(text, styles)).toEqual(runs);
    expect(fabricToRuns("", {})).toEqual([{ text: "", style: {} }]);
  });
});

describe("paint helpers", () => {
  it("converts CSS gradient angles both ways", () => {
    for (const angle of [0, 45, 90, 135, 180, 270, 315]) {
      expect(coordsToAngle(angleToCoords(angle))).toBe(angle);
    }
    expect(angleToCoords(90)).toEqual({ x1: 0, y1: 0.5, x2: 1, y2: 0.5 });
    expect(angleToCoords(180)).toEqual({ x1: 0.5, y1: 0, x2: 0.5, y2: 1 });
  });

  it("builds CSS for swatches", () => {
    expect(fillToCss({ type: "solid", color: "#123456" })).toBe("#123456");
    expect(fillToCss({ type: "none" })).toBe("transparent");
    expect(
      fillToCss({
        type: "gradient",
        gradient: {
          kind: "linear",
          angle: 90,
          stops: [
            { offset: 0, color: "#000000" },
            { offset: 1, color: "#FFFFFF" },
          ],
        },
      }),
    ).toBe("linear-gradient(90deg, #000000 0%, #FFFFFF 100%)");
  });

  it("computes WCAG contrast", () => {
    expect(normalizeHex("#f0a")).toBe("#FF00AA");
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#3A2E8F")).toBeGreaterThan(4.5);
    expect(contrastRatio("#FFFFFF", "#FF7A3D")).toBeLessThan(3);
  });
});

describe("shape outlines", () => {
  const bounds = (pts: [number, number][]) => ({
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxY: Math.max(...pts.map((p) => p[1])),
  });

  it("fills the 100×100 box", () => {
    for (const pts of [
      polygonPoints(5),
      polygonPoints(3),
      starPoints(5, 0.5),
      starPoints(12, 0.8),
    ]) {
      const b = bounds(pts);
      expect(b.minX).toBeCloseTo(0);
      expect(b.maxX).toBeCloseTo(100);
      expect(b.minY).toBeCloseTo(0);
      expect(b.maxY).toBeCloseTo(100);
    }
    expect(starPoints(5, 0.5)).toHaveLength(10);
  });

  it("returns null for natively drawn shapes", () => {
    const base = { sides: 5, innerRadius: 0.5, pathData: null };
    expect(shapePath({ ...base, kind: "rect" })).toBeNull();
    expect(shapePath({ ...base, kind: "ellipse" })).toBeNull();
    expect(shapePath({ ...base, kind: "star" })).toMatch(/^M.* Z$/);
    expect(shapePath({ ...base, kind: "path", pathData: "M0 0 L1 1" })).toBe("M0 0 L1 1");
  });
});
