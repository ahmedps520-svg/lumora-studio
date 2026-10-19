import { describe, expect, it } from "vitest";
import ar from "@messages/ar.json";
import en from "@messages/en.json";
import { getDirection, isLocale, negotiateLocale } from "@/i18n/config";

/** Flattens {a: {b: "x"}} into ["a.b"]. */
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n config", () => {
  it("knows which locales are supported", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("uses right-to-left for Arabic only", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("xx")).toBe("ltr");
  });

  it("negotiates from Accept-Language", () => {
    expect(negotiateLocale("ar-EG,ar;q=0.9,en;q=0.8")).toBe("ar");
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.5")).toBe("en");
    expect(negotiateLocale("de-DE,ar;q=0.7")).toBe("ar");
    expect(negotiateLocale("en;q=0.2,ar;q=0.9")).toBe("ar");
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
  });
});

describe("translations", () => {
  it("Arabic has exactly the same keys as English", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("has no empty strings", () => {
    const values = (obj: object): string[] =>
      Object.values(obj).flatMap((v) => (typeof v === "string" ? [v] : values(v as object)));
    for (const v of [...values(en), ...values(ar)]) expect(v.trim()).not.toBe("");
  });
});
