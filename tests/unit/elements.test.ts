import { describe, expect, it } from "vitest";
import { ean13CheckDigit, ean13Pattern, normalizeEan13, qrMatrix } from "@/lib/document/codes";
import {
  addTableColumn,
  addTableRow,
  createChart,
  createCode,
  createFrame,
  createIcon,
  createTable,
  removeTableColumn,
  removeTableRow,
  setCellText,
} from "@/lib/document/elements";
import { fontFaces, usesFontFamily } from "@/lib/document/fonts";
import { frameCrop } from "@/lib/document/photo";
import { recolorSvg, svgColors, svgDataUrl, svgSize } from "@/lib/document/svg";
import { ElementSchema } from "@/lib/schema";

const FORMAT = { width: 1080, height: 1080 };

describe("codes", () => {
  it("computes EAN-13 check digits", () => {
    expect(ean13CheckDigit("590123412345")).toBe(7);
    expect(normalizeEan13("590123412345")).toBe("5901234123457");
    expect(normalizeEan13("5901234123457")).toBe("5901234123457");
    expect(normalizeEan13("5901234123458")).toBeNull();
    expect(normalizeEan13("hello")).toBeNull();
  });

  it("draws 95 modules with the standard guards", () => {
    const bits = ean13Pattern("5901234123457");
    expect(bits).toHaveLength(95);
    expect(bits.startsWith("101")).toBe(true);
    expect(bits.slice(45, 50)).toBe("01010");
    expect(bits.endsWith("101")).toBe(true);
  });

  it("encodes QR codes, including Arabic text", () => {
    const small = qrMatrix("hi");
    expect(small).toHaveLength(21); // version 1
    expect(small[0]!.slice(0, 7).every(Boolean)).toBe(true); // finder pattern
    const arabic = qrMatrix("مرحبا بالعالم");
    expect(arabic.length).toBeGreaterThanOrEqual(21);
  });
});

describe("svg helpers", () => {
  const svg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path fill="#f00" d="M0 0h1"/><circle style="fill:#00FF00;stroke:none"/></svg>';

  it("lists and swaps colours", () => {
    expect(svgColors(svg)).toEqual(["currentColor", "#FF0000", "#00FF00"]);
    const out = recolorSvg(svg, { "#FF0000": "#123456", currentColor: "#ABCDEF" });
    expect(out).toContain('fill="#123456"');
    expect(out).toContain('stroke="#ABCDEF"');
    expect(out).toContain("fill:#00FF00");
  });

  it("gives the root a size and makes a data URL", () => {
    expect(svgSize(svg)).toEqual({ width: 24, height: 24 });
    const url = svgDataUrl(svg, { currentColor: "#FFFFFF" });
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    const markup = decodeURIComponent(url.split(",")[1]!);
    expect(markup).toContain('width="24" height="24"');
    expect(markup).toContain("xmlns=");
    expect(markup).toContain('stroke="#FFFFFF"');
  });
});

describe("element factories", () => {
  it("creates valid, centred elements", () => {
    const made = [
      createIcon(FORMAT, "<svg viewBox='0 0 24 24'></svg>", "heart"),
      createFrame(FORMAT, "circle", null),
      createFrame(FORMAT, "arch", "M0 100 L0 50 Z"),
      createTable(FORMAT, 3, 4, ["A", "B"]),
      createChart(FORMAT, "bar", {
        title: "T",
        labels: ["a", "b"],
        series: [{ name: "s", values: [1, 2] }],
      }),
      createChart(FORMAT, "pie", {
        title: "",
        labels: ["a", "b"],
        series: [
          { name: "s", values: [1, 2] },
          { name: "extra", values: [3, 4] },
        ],
      }),
      createCode(FORMAT, "https://example.com"),
    ];
    for (const el of made) {
      expect(ElementSchema.safeParse(el).success).toBe(true);
      expect(el.x + el.width / 2).toBeCloseTo(540, 0);
    }
    const [, circle, arch, table, , pie] = made;
    expect(circle).toMatchObject({ type: "frame", shape: "ellipse" });
    expect(arch).toMatchObject({ shape: "path", pathViewBox: { width: 100, height: 100 } });
    expect(table!.type === "table" && table.rows[0]!.map((c) => c.text)).toEqual([
      "A",
      "B",
      "",
      "",
    ]);
    // Pies show one series.
    expect(pie!.type === "chart" && pie.series).toHaveLength(1);
  });

  it("edits tables", () => {
    const table = createTable(FORMAT, 2, 2);
    let rows = setCellText(table.rows, 1, 1, "x");
    expect(rows[1]![1]!.text).toBe("x");
    expect(rows[0]).toBe(table.rows[0]); // untouched rows are reused
    rows = addTableRow(addTableColumn(rows));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.length === 3)).toBe(true);
    rows = removeTableColumn(removeTableRow(rows));
    expect(rows).toHaveLength(2);
    expect(removeTableRow(removeTableRow(rows))).toHaveLength(1);
  });
});

describe("frames and fonts", () => {
  it("crops photos to cover a frame, with zoom and pan", () => {
    const natural = { width: 2000, height: 1000 };
    const frame = { width: 500, height: 500 };
    expect(frameCrop(natural, frame, { scale: 1, offsetX: 0, offsetY: 0 })).toEqual({
      x: 500,
      y: 0,
      width: 1000,
      height: 1000,
    });
    const zoomed = frameCrop(natural, frame, { scale: 2, offsetX: 0, offsetY: 0 });
    expect(zoomed.width).toBe(500);
    // Panning right shows more of the left side.
    expect(frameCrop(natural, frame, { scale: 1, offsetX: 100, offsetY: 0 }).x).toBe(300);
  });

  it("knows which fonts tables and charts need", () => {
    const table = { ...createTable(FORMAT, 2, 2), fontFamily: "Cairo" };
    const faces = fontFaces([table]);
    expect(faces.map((f) => `${f.family}:${f.weight}`)).toEqual(["Cairo:400", "Cairo:700"]);
    expect(usesFontFamily(table, "Cairo")).toBe(true);
    expect(usesFontFamily(table, "Inter")).toBe(false);
  });
});
