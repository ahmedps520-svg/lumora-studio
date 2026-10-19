import { describe, expect, it } from "vitest";
import { rgba, strokeToDrawing } from "@/lib/engine/drawing";
import { DrawingElementSchema } from "@/lib/schema";

describe("strokeToDrawing", () => {
  it("moves the stroke into its own padded box", () => {
    const el = strokeToDrawing(
      [
        ["M", 100, 200],
        ["Q", 150, 260, 300, 220],
        ["L", 400, 210],
      ],
      { tool: "pen", color: "#112233", width: 10, opacity: 0.8 },
    )!;
    expect(DrawingElementSchema.safeParse(el).success).toBe(true);
    // Padding = half the stroke + 1 px.
    expect(el.x).toBe(94);
    expect(el.y).toBe(194);
    expect(el.width).toBe(312);
    expect(el.height).toBe(72);
    expect(el.sourceWidth).toBe(el.width);
    expect(el.strokes[0]).toMatchObject({
      color: "#112233",
      width: 10,
      opacity: 0.8,
      mode: "brush",
    });
    expect(el.strokes[0]!.d).toBe("M 6 6 Q 56 66 206 26 L 306 16");
  });

  it("marks highlighter strokes and handles a single dot", () => {
    const dot = strokeToDrawing(
      [
        ["M", 10, 10],
        ["L", 10, 10],
      ],
      {
        tool: "highlighter",
        color: "#FFD166",
        width: 20,
        opacity: 0.4,
      },
    )!;
    expect(dot.strokes[0]!.mode).toBe("highlighter");
    expect(dot.width).toBe(22);
  });

  it("rejects empty paths", () => {
    expect(strokeToDrawing([], { tool: "pen", color: "#000000", width: 4, opacity: 1 })).toBeNull();
  });
});

describe("rgba", () => {
  it("turns hex + opacity into a CSS colour", () => {
    expect(rgba("#FF8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)");
    expect(rgba("#0f0", 1)).toBe("rgba(0, 255, 0, 1)");
  });
});
