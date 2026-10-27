// @vitest-environment node
/**
 * Photo editor phase 2: layer groups, transform geometry, pen paths,
 * snapping and bevel shading — the pure parts, no canvas needed.
 */
import { describe, expect, it } from "vitest";
import { bevelShading } from "@/lib/photo/effects";
import {
  affineFromTriangles,
  applyH,
  bezierPatch,
  homography,
  meshFromQuad,
  perspectiveWarp,
  rectQuad,
} from "@/lib/photo/geometry";
import {
  distanceToPath,
  hitPath,
  movePathPart,
  pathBounds,
  pathD,
  simplify,
  smoothSubPath,
} from "@/lib/photo/paths";
import type { Img } from "@/lib/photo/pixels";
import { snapBox, snapTargets, snapValue } from "@/lib/photo/snap";
import * as tree from "@/lib/photo/tree";
import { DEFAULT_STYLES, type Layer, type PhotoPath, type Pt } from "@/lib/photo/types";

function layer(id: string, extra: Partial<Layer> = {}): Layer {
  return {
    id,
    name: id,
    kind: "pixel",
    visible: true,
    opacity: 1,
    fillOpacity: 1,
    blend: "normal",
    locks: { transparency: false, pixels: false, position: false, all: false },
    clip: false,
    mask: null,
    styles: structuredClone(DEFAULT_STYLES),
    x: 0,
    y: 0,
    parentId: null,
    ...extra,
  } as Layer;
}
const group = (id: string, extra: Partial<Layer> = {}) =>
  layer(id, { kind: "group", collapsed: false, passThrough: true, ...extra } as Partial<Layer>);
const ids = (ls: Layer[]) => ls.map((l) => l.id).join(" ");

describe("layer groups", () => {
  it("groups layers where the topmost one was and keeps the list well formed", () => {
    const ls = [layer("bg"), layer("a"), layer("b"), layer("c")];
    const out = tree.groupInto(ls, ["a", "c"], group("g"));
    expect(ids(out)).toBe("bg b a c g");
    expect(out.find((l) => l.id === "a")!.parentId).toBe("g");
    expect(out.find((l) => l.id === "b")!.parentId).toBeNull();
    expect(tree.isWellFormed(out)).toBe(true);
    expect(ids(tree.descendantsOf(out, "g"))).toBe("a c");
  });

  it("moves a group with its contents, and into / out of groups", () => {
    let ls = tree.groupInto(
      [layer("bg"), layer("a"), layer("b"), layer("top")],
      ["a", "b"],
      group("g"),
    );
    expect(ids(ls)).toBe("bg a b g top");
    ls = tree.moveBlock(ls, "g", "top", "above");
    expect(ids(ls)).toBe("bg top a b g");
    ls = tree.moveBlock(ls, "top", "g", "into");
    expect(ids(ls)).toBe("bg a b top g");
    expect(ls.find((l) => l.id === "top")!.parentId).toBe("g");
    ls = tree.moveBlock(ls, "a", "bg", "below");
    expect(ids(ls)).toBe("a bg b top g");
    expect(ls.find((l) => l.id === "a")!.parentId).toBeNull();
    // A group can't go inside itself.
    expect(tree.moveBlock(ls, "g", "b", "above")).toBe(ls);
    expect(tree.isWellFormed(ls)).toBe(true);
  });

  it("nests groups and ungroups without losing order", () => {
    let ls = tree.groupInto([layer("a"), layer("b"), layer("c")], ["a", "b"], group("inner"));
    ls = tree.groupInto(ls, ["inner", "c"], group("outer"));
    expect(ids(ls)).toBe("a b inner c outer");
    expect(tree.depthOf(ls, ls[0]!)).toBe(2);
    expect(tree.isWellFormed(ls)).toBe(true);
    ls = tree.ungroup(ls, "outer");
    expect(ids(ls)).toBe("a b inner c");
    expect(ls.find((l) => l.id === "inner")!.parentId).toBeNull();
    expect(tree.isWellFormed(ls)).toBe(true);
  });

  it("arranges within the group only, and knows what is shown or folded", () => {
    let ls = tree.groupInto([layer("bg"), layer("a"), layer("b")], ["a", "b"], group("g"));
    ls = tree.arrangeBlock(ls, "a", "front");
    expect(ids(ls)).toBe("bg b a g");
    ls = tree.arrangeBlock(ls, "g", "back");
    expect(ids(ls)).toBe("b a g bg");
    const g = ls.find((l) => l.id === "g") as Extract<Layer, { kind: "group" }>;
    g.visible = false;
    g.collapsed = true;
    expect(
      tree.shownInTree(
        ls,
        ls.find((l) => l.id === "a")!,
      ),
    ).toBe(false);
    expect(
      tree.folded(
        ls,
        ls.find((l) => l.id === "a")!,
      ),
    ).toBe(true);
    expect(tree.folded(ls, g)).toBe(false);
  });
});

describe("transform geometry", () => {
  const near = (a: Pt, b: Pt) => {
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
  };

  it("maps a rectangle's corners onto any four points", () => {
    const src = rectQuad(0, 0, 100, 50);
    const dst: Pt[] = [
      [10, 20],
      [130, 5],
      [120, 90],
      [0, 70],
    ];
    const h = homography(src, dst)!;
    src.forEach((p, i) => near(applyH(h, p[0], p[1]), dst[i]!));
  });

  it("finds the affine map between two triangles", () => {
    const m = affineFromTriangles([0, 0], [10, 0], [0, 10], [5, 5], [25, 5], [5, 35])!;
    const at = (x: number, y: number): Pt => [
      m[0] * x + m[2] * y + m[4],
      m[1] * x + m[3] * y + m[5],
    ];
    near(at(10, 0), [25, 5]);
    near(at(0, 10), [5, 35]);
    near(at(5, 5), [15, 20]);
  });

  it("warps pixels onto a moved rectangle exactly", () => {
    const src: Img = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]),
    };
    const out = perspectiveWarp(src, rectQuad(3, 4, 2, 1))!;
    expect(out.x).toBe(3);
    expect(out.y).toBe(4);
    expect([...out.img.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...out.img.data.slice(4, 8)]).toEqual([0, 0, 255, 255]);
  });

  it("starts a warp mesh flat, with corners on the shape", () => {
    const q = rectQuad(0, 0, 90, 60);
    const mesh = meshFromQuad(q);
    expect(mesh).toHaveLength(16);
    near(bezierPatch(mesh, 0, 0), [0, 0]);
    near(bezierPatch(mesh, 1, 1), [90, 60]);
    near(bezierPatch(mesh, 0.5, 0.5), [45, 30]);
  });
});

describe("pen paths", () => {
  const tri: PhotoPath = {
    id: "p",
    name: "Path 1",
    subpaths: [
      {
        closed: true,
        points: [
          { x: 0, y: 0, in: null, out: null },
          { x: 100, y: 0, in: null, out: null },
          { x: 50, y: 80, in: null, out: [60, 90] },
        ],
      },
    ],
  };

  it("writes SVG path data with lines, curves and closing", () => {
    expect(pathD(tri)).toBe("M0 0 L100 0 L50 80 C60 90 0 0 0 0 Z");
  });

  it("measures, hits and moves anchors and handles", () => {
    expect(pathBounds(tri)!.width).toBeCloseTo(100, 0);
    expect(hitPath(tri, 99, 1, 4)).toEqual({ sub: 0, index: 1, part: "anchor" });
    expect(hitPath(tri, 60, 89, 4)).toEqual({ sub: 0, index: 2, part: "out" });
    expect(distanceToPath(tri, 50, -3)).toBeCloseTo(3, 5);
    const moved = movePathPart(tri.subpaths[0]!, 2, "anchor", 55, 85);
    expect(moved.points[2]).toMatchObject({ x: 55, y: 85, out: [65, 95] });
    const handle = movePathPart(
      { closed: false, points: [{ x: 0, y: 0, in: [-5, 0], out: [5, 0] }] },
      0,
      "out",
      0,
      10,
    );
    expect(handle.points[0]!.in).toEqual([0, -10]);
  });

  it("turns a freehand line into a few smooth anchors", () => {
    const line: Pt[] = Array.from({ length: 50 }, (_, i) => [i, i < 25 ? 0 : i - 25]);
    const pts = simplify(line, 1);
    expect(pts.length).toBe(3);
    const sp = smoothSubPath(pts, false);
    expect(sp.points[0]!.in).toBeNull();
    expect(sp.points[2]!.out).toBeNull();
    expect(sp.points[1]!.in).not.toBeNull();
  });
});

describe("snapping", () => {
  const targets = snapTargets(1000, 800, { horizontal: [300], vertical: [] });

  it("pulls a box edge or centre onto the nearest line within the threshold", () => {
    const s = snapBox({ x: 6, y: 296, width: 100, height: 50 }, targets, 8);
    expect(s.dx).toBe(-6);
    expect(s.dy).toBe(4);
    expect(s.lines).toEqual({ x: [0], y: [300] });
    const c = snapBox({ x: 447, y: 100, width: 100, height: 50 }, targets, 8);
    expect(c.dx).toBe(3); // centre 497 → 500
    expect(snapBox({ x: 200, y: 100, width: 10, height: 10 }, targets, 8)).toMatchObject({
      dx: 0,
      dy: 0,
    });
    expect(snapValue(995, targets.x, 8)).toBe(1000);
  });
});

describe("bevel", () => {
  it("lights the edges facing the light and shades the others", () => {
    const w = 40;
    const h = 40;
    const alpha = new Float32Array(w * h);
    for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) alpha[y * w + x] = 255;
    const shade = bevelShading(alpha, w, h, { size: 6, angle: 135, altitude: 30, depth: 1 });
    // Light from the top-left: the top-left edge is lit, the bottom-right is dark.
    expect(shade[12 * w + 12]!).toBeGreaterThan(0.05);
    expect(shade[27 * w + 27]!).toBeLessThan(-0.05);
    expect(Math.abs(shade[20 * w + 20]!)).toBeLessThan(0.05);
  });
});
