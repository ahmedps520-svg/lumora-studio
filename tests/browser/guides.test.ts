/** Smart guides: snapping while dragging and rotating. */
import { Canvas, Rect, type FabricObject } from "fabric";
import { afterEach, describe, expect, it } from "vitest";
import { nearestSnap, SmartGuides, snapAngle } from "@/lib/engine/guides";
import { setObjectId } from "@/lib/engine/mapping";

const PAGE = { width: 1000, height: 800 };
let canvas: Canvas | null = null;
let off: (() => void) | null = null;

afterEach(() => {
  off?.();
  void canvas?.dispose();
  canvas = null;
});

function box(id: string, left: number, top: number, width: number, height: number) {
  // Fabric 7 positions by centre; the stroke is off so the box is exactly its size.
  const rect = new Rect({
    left: left + width / 2,
    top: top + height / 2,
    width,
    height,
    strokeWidth: 0,
  });
  setObjectId(rect, id);
  return rect;
}

function setup(...objects: FabricObject[]) {
  const el = document.createElement("canvas");
  document.body.appendChild(el);
  canvas = new Canvas(el, { ...PAGE, enableRetinaScaling: false });
  canvas.add(...objects);
  const guides = new SmartGuides(
    canvas,
    () => PAGE,
    () => false,
  );
  off = guides.bind();
  return guides;
}

const move = (target: FabricObject, left: number, top: number, altKey = false) => {
  target.set({ left, top });
  target.setCoords();
  canvas!.fire("object:moving", { target, e: { altKey } } as never);
};

describe("nearestSnap / snapAngle", () => {
  it("picks the closest stop within reach", () => {
    expect(nearestSnap([10, 50, 93], [0, 100], 12)).toBe(7);
    expect(nearestSnap([10, 50, 90], [0, 100], 5)).toBeNull();
    expect(nearestSnap([497], [500, 480], 6)).toBe(3);
  });

  it("snaps angles near 45° steps only", () => {
    expect(snapAngle(43)).toBe(45);
    expect(snapAngle(-2)).toBe(-0);
    expect(snapAngle(30)).toBe(30);
  });
});

describe("SmartGuides", () => {
  it("snaps an element's centre to the page centre", () => {
    const a = box("a", 0, 0, 200, 100);
    setup(a);
    // Centre at x = 504 → within 6px of 500.
    move(a, 504, 300);
    expect(a.left).toBe(500);
    // Far from everything vertically: unchanged.
    expect(a.top).toBe(300);
  });

  it("lines edges up with other elements", () => {
    const other = box("other", 100, 100, 300, 50); // left 100, right 400
    const a = box("a", 600, 500, 100, 100);
    setup(other, a);
    // a's left edge at 403 → snaps to other's right edge (400).
    move(a, 403 + 50, 600);
    expect(a.left - 50).toBe(400);
  });

  it("lets you move freely while Alt is held", () => {
    const a = box("a", 0, 0, 200, 100);
    setup(a);
    move(a, 504, 300, true);
    expect(a.left).toBe(504);
  });

  it("can be switched off", () => {
    const a = box("a", 0, 0, 200, 100);
    const guides = setup(a);
    guides.enabled = false;
    move(a, 504, 300);
    expect(a.left).toBe(504);
  });

  it("snaps rotation to 45° steps", () => {
    const a = box("a", 100, 100, 200, 100);
    setup(a);
    a.rotate(88);
    canvas!.fire("object:rotating", { target: a, e: {} } as never);
    expect(a.angle).toBe(90);
  });
});
