import { describe, expect, it } from "vitest";
import { detectDirection, directionPatch, fontForText } from "@/lib/document/text";
import { googleFontsCssUrl } from "@/lib/fonts/loader";

describe("detectDirection", () => {
  it("recognises Arabic, Hebrew and Latin text", () => {
    expect(detectDirection("تخفيضات الصيف 50%")).toBe("rtl");
    expect(detectDirection("שלום עולם")).toBe("rtl");
    expect(detectDirection("Summer sale 50%")).toBe("ltr");
    expect(detectDirection("123 !!")).toBeNull();
  });

  it("goes with the majority in mixed text", () => {
    expect(detectDirection("Lumora تصميم رائع جدا")).toBe("rtl");
    expect(detectDirection("A great design by لومورا")).toBe("ltr");
  });
});

describe("directionPatch", () => {
  const base = {
    direction: "ltr" as const,
    align: "left" as const,
    fontFamily: "Sora",
    fontWeight: 700,
  };

  it("flips direction, mirrors alignment and picks an Arabic font", () => {
    expect(directionPatch(base, "مرحبا بالعالم")).toEqual({
      direction: "rtl",
      align: "right",
      fontFamily: "Cairo",
    });
    expect(directionPatch({ ...base, fontWeight: 400 }, "مرحبا").fontFamily).toBe(
      "IBM Plex Sans Arabic",
    );
  });

  it("keeps centred text centred and Arabic fonts as they are", () => {
    expect(
      directionPatch({ ...base, align: "center" as never, fontFamily: "Tajawal" }, "مرحبا"),
    ).toEqual({
      direction: "rtl",
    });
  });

  it("switches back to left-to-right for English", () => {
    expect(directionPatch({ ...base, direction: "rtl", align: "right" }, "Hello")).toEqual({
      direction: "ltr",
      align: "left",
    });
  });

  it("does nothing when nothing needs to change", () => {
    expect(directionPatch(base, "Hello")).toEqual({});
  });
});

describe("fontForText", () => {
  it("never gives Arabic text a font without Arabic letters", () => {
    expect(fontForText("مرحبا", "Sora", "Cairo", 700)).toBe("Cairo");
    expect(fontForText("مرحبا", "Sora", "Inter", 700)).toBe("Cairo");
    expect(fontForText("مرحبا", "Amiri", "Inter", 400)).toBe("Amiri");
    expect(fontForText("Hello", "Sora", "Cairo", 700)).toBe("Sora");
  });
});

describe("googleFontsCssUrl", () => {
  it("uses the lenient endpoint that tolerates missing weights/italics", () => {
    const url = googleFontsCssUrl("Playfair Display");
    expect(url).toMatch(/^https:\/\/fonts\.googleapis\.com\/css\?family=Playfair\+Display:/);
    expect(url).toContain("100,100italic");
    expect(url).toContain("900,900italic");
    expect(url).toContain("display=swap");
    expect(url).not.toContain("css2");
  });
});
