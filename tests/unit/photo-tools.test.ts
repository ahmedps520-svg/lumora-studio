/**
 * Photo editor helpers that don't need a real canvas: gradient geometry,
 * the Generative Fill context area and keyboard shortcut matching.
 */
import { describe, expect, it } from "vitest";
import { commandForCombo, comboOf, formatKeys } from "@/components/photo/commands";
import { fillRegion } from "@/lib/photo/generative";
import { gradientAt } from "@/lib/photo/tools";

describe("gradient tool geometry", () => {
  // A drag from (0,0) to (100,0).
  const at = (kind: Parameters<typeof gradientAt>[0], x: number, y: number) =>
    gradientAt(kind, x, y, 1, 0, 100);

  it("runs 0 → 1 along the drag for each style", () => {
    expect(at("linear", 0, 0)).toBe(0);
    expect(at("linear", 50, 30)).toBe(0.5);
    expect(at("linear", 100, 0)).toBe(1);
    expect(at("radial", 0, 50)).toBe(0.5);
    expect(at("reflected", -50, 0)).toBe(0.5);
    expect(at("reflected", 50, 0)).toBe(0.5);
    expect(at("diamond", 25, 25)).toBe(0.5);
    expect(at("angle", 10, 0)).toBeCloseTo(0, 5);
    expect(at("angle", 0, 10)).toBeCloseTo(0.25, 5);
  });
});

describe("generative fill area", () => {
  it("adds a margin around the selection and stays inside the image", () => {
    expect(fillRegion({ x: 400, y: 300, width: 200, height: 100 }, 2000, 1000)).toEqual({
      x: 300,
      y: 200,
      width: 400,
      height: 300,
    });
    const edge = fillRegion({ x: 0, y: 0, width: 50, height: 50 }, 120, 90);
    expect(edge).toEqual({ x: 0, y: 0, width: 98, height: 90 });
  });
});

describe("keyboard shortcuts", () => {
  const key = (k: string, mods: Partial<KeyboardEventInit> = {}) =>
    comboOf(new KeyboardEvent("keydown", { key: k, ...mods }));

  it("maps key presses to menu commands", () => {
    expect(commandForCombo(key("z", { ctrlKey: true }))).toBe("undo");
    expect(commandForCombo(key("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(commandForCombo(key("z", { metaKey: true }))).toBe("undo");
    expect(commandForCombo(key("}", { ctrlKey: true, shiftKey: true }))).toBe("bringToFront");
    expect(commandForCombo(key("]", { ctrlKey: true }))).toBe("bringForward");
    expect(commandForCombo(key("Backspace"))).toBe("clear");
    expect(commandForCombo(key("t", { ctrlKey: true }))).toBe("freeTransform");
    expect(commandForCombo(key("k"))).toBeNull();
  });

  it("shows shortcuts with the platform's modifier", () => {
    expect(formatKeys("Mod+Shift+Z")).toMatch(/^(Ctrl\+Shift\+Z|⌘⇧Z)$/);
  });
});
