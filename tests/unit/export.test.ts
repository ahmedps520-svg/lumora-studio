import { describe, expect, it } from "vitest";
import { fileBaseName } from "@/lib/export/download";
import { buildPdf, pxToPt } from "@/lib/export/pdf";
import { buildZip, crc32 } from "@/lib/export/zip";

const text = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

describe("buildPdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = buildPdf(
    [
      {
        widthPt: 810,
        heightPt: 810,
        image: { width: 4, height: 4, data: jpeg, filter: "DCTDecode" },
      },
      {
        widthPt: 595.28,
        heightPt: 841.89,
        image: { width: 2, height: 3, data: jpeg, filter: "FlateDecode" },
      },
    ],
    { title: "حفلة Party" },
  );
  const body = text(pdf);

  it("writes a well-formed two-page document", () => {
    expect(body.startsWith("%PDF-1.4\n")).toBe(true);
    expect(body.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(body).toContain("/Count 2");
    expect(body).toContain("/MediaBox [0 0 810 810]");
    expect(body).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(body).toContain("/Filter /DCTDecode");
    expect(body).toContain("/Filter /FlateDecode");
  });

  it("points every xref entry at its object", () => {
    const xrefAt = Number(/startxref\n(\d+)/.exec(body)![1]);
    expect(body.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = body
      .slice(xrefAt)
      .split("\n")
      .filter((line) => / 00000 n $/.test(line))
      .map((line) => Number(line.slice(0, 10)));
    expect(entries).toHaveLength(9); // catalog, pages, info + 3 per page
    entries.forEach((offset, i) =>
      expect(body.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true),
    );
  });

  it("stores the title as UTF-16 so any language survives", () => {
    expect(body).toMatch(/\/Title <FEFF[0-9A-F]+>/);
    expect(body).toContain("062D"); // ح
  });

  it("converts design px to points", () => {
    expect(pxToPt(1080)).toBe(810);
  });
});

describe("buildZip", () => {
  it("computes standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });

  it("writes local headers, a central directory and the end record", () => {
    const zip = buildZip([
      { name: "a.png", data: new Uint8Array([1, 2, 3]) },
      { name: "صفحة-2.png", data: new Uint8Array([4, 5]) },
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralAt = view.getUint32(end + 16, true);
    expect(view.getUint32(centralAt, true)).toBe(0x02014b50);
    // The second local header sits right after the first entry.
    const second = view.getUint32(centralAt + 46 + 5 + 42, true);
    expect(view.getUint32(second, true)).toBe(0x04034b50);
  });
});

describe("fileBaseName", () => {
  it("keeps names readable but safe", () => {
    expect(fileBaseName('My: "Big" / Party?')).toBe("My Big Party");
    expect(fileBaseName("   ")).toBe("design");
    expect(fileBaseName("عيد ميلاد")).toBe("عيد ميلاد");
  });
});
