import { describe, expect, it } from "vitest";
import { flattenElements } from "@/lib/document/tree";
import {
  buildTemplate,
  catalog,
  featuredTemplates,
  kindFormat,
  LIBRARY_SIZE,
  libraryLoaded,
  loadTemplateLibrary,
  searchTemplates,
  shapeFamily,
  templatesForSize,
  TEMPLATE_KINDS,
  type TemplateDef,
} from "@/lib/templates";
import { BLUEPRINTS, GEN_BY_ID } from "@/lib/templates/blueprints";
import { GENERATED_BLUEPRINTS } from "@/lib/templates/blueprints/gen";
import { THEMES } from "@/lib/templates/content";
import { GENERATED_THEMES } from "@/lib/templates/content/gen";
import { ICON_SVG } from "@/lib/templates/icons.generated";

// The built-in themes and layouts are there at once; the full library is a separate download.
const builtIn = catalog().length;
await loadTemplateLibrary();

describe("template library", () => {
  it("loads the generated themes and layouts on demand", () => {
    expect(libraryLoaded()).toBe(true);
    expect(catalog().length).toBeGreaterThan(builtIn * 3);
    expect(GEN_BY_ID.size).toBe(GENERATED_BLUEPRINTS.length);
  });

  it("has unique theme and layout ids across all files", () => {
    const themeIds = THEMES.map((t) => t.id);
    expect(new Set(themeIds).size).toBe(themeIds.length);
    expect(THEMES.length).toBe(themeIds.length);
    for (const t of GENERATED_THEMES) expect(THEMES).toContain(t);
    const layoutIds = GENERATED_BLUEPRINTS.map((b) => b.id);
    expect(new Set(layoutIds).size).toBe(layoutIds.length);
  });

  it("is as big as the app says (shown as LIBRARY_SIZE+)", () => {
    expect(catalog().length).toBeGreaterThanOrEqual(LIBRARY_SIZE);
    expect(catalog().length).toBeLessThan(LIBRARY_SIZE * 1.1);
  });
});

describe("template catalogue", () => {
  const defs = catalog();

  it("has thousands of templates with unique ids, in every kind", () => {
    expect(defs.length).toBeGreaterThanOrEqual(50_000);
    expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
    for (const kind of TEMPLATE_KINDS) expect(defs.some((d) => d.kind === kind)).toBe(true);
    for (const d of defs) expect(BLUEPRINTS[d.blueprint]).toBeTruthy();
  });

  it("only uses icons that exist", () => {
    for (const theme of THEMES)
      for (const icon of theme.icons) expect(ICON_SVG[icon], icon).toBeTruthy();
  });

  it("has the same words in English and Arabic for every theme", () => {
    for (const theme of THEMES) {
      const { en, ar } = theme.copy;
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        const a = en[key];
        const b = ar[key];
        expect(Array.isArray(a) ? (a as unknown[]).length : Boolean(a), `${theme.id}.${key}`).toBe(
          Array.isArray(b) ? (b as unknown[]).length : Boolean(b),
        );
      }
    }
  });

  it("finds templates by words in either language", () => {
    expect(searchTemplates(defs, "birthday", "en").length).toBeGreaterThan(3);
    expect(searchTemplates(defs, "عيد ميلاد", "ar").length).toBeGreaterThan(3);
    expect(searchTemplates(defs, "zzzz", "en")).toEqual([]);
  });

  it("offers templates for a design's shape, its own size first", () => {
    expect(shapeFamily(1080, 1920)).toBe("tall");
    expect(shapeFamily(1920, 1080)).toBe("landscape");
    expect(shapeFamily(1584, 396)).toBe("wide");
    const story = templatesForSize(1080, 1920, "instagramStory");
    expect(story[0]!.kind).toBe("instagramStory");
    expect(story.every((d) => ["instagramStory"].includes(d.kind))).toBe(true);
    expect(featuredTemplates(10)).toHaveLength(10);
  });
});

describe("built templates", () => {
  const defs = catalog();
  // The whole catalogue is checked by `npx tsx scripts/check-templates.ts --all`; here a
  // spread sample: every layout at every size it appears in, with varied themes and variants.
  const sample = (() => {
    const perKey = new Map<string, TemplateDef[]>();
    for (const d of defs) {
      const key = `${d.kind}|${d.blueprint}`;
      const list = perKey.get(key);
      if (list) list.push(d);
      else perKey.set(key, [d]);
    }
    // Up to four per layout and size, spread over its themes.
    const out: TemplateDef[] = [];
    for (const list of perKey.values()) {
      const step = Math.max(1, Math.floor(list.length / 4));
      for (let i = 0; i < list.length && i < step * 4; i += step) out.push(list[i]!);
    }
    return out;
  })();

  it("samples every layout in every size", () => {
    const keys = new Set(defs.map((d) => `${d.kind}|${d.blueprint}`));
    expect(new Set(sample.map((d) => `${d.kind}|${d.blueprint}`)).size).toBe(keys.size);
  });

  it.each(["en", "ar"] as const)("build valid pages that stay on the page (%s)", (locale) => {
    const problems: string[] = [];
    for (const def of sample) {
      const built = buildTemplate(def, locale);
      const { width: W, height: H } = built.format;
      expect(built.pages.length).toBeGreaterThan(0);
      built.pages.forEach((page, pi) => {
        for (const el of flattenElements(page.elements)) {
          if (el.type !== "text") continue;
          const tol = Math.min(W, H) * 0.02;
          if (
            el.x < -tol ||
            el.x + el.width > W + tol ||
            el.y < -tol ||
            el.y + el.height > H + tol
          ) {
            const words = el.runs
              .map((r) => r.text)
              .join("")
              .slice(0, 30);
            problems.push(
              `${def.id} p${pi + 1}: "${words}" at ${Math.round(el.y)}+${el.height} / ${H}`,
            );
          }
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it("mirrors Arabic layouts right-to-left", () => {
    const def = defs.find((d) => d.blueprint === "listTips")!;
    const en = buildTemplate(def, "en").pages[0]!;
    const ar = buildTemplate(def, "ar").pages[0]!;
    const W = kindFormat(def.kind).width;
    const title = (p: typeof en) =>
      p.elements.find((e) => e.type === "text" && e.role === "heading")!;
    const [a, b] = [title(en), title(ar)];
    expect(b.x).toBeCloseTo(W - a.x - a.width, 0);
    expect(b.type === "text" && b.align).toBe("right");
    expect(b.type === "text" && b.direction).toBe("rtl");
    expect(b.type === "text" && b.fontFamily).not.toBe(a.type === "text" && a.fontFamily);
  });

  it("builds at any size of the same shape", () => {
    const def = defs.find((d) => d.kind === "instagramPost")!;
    const built = buildTemplate(def, "en", {
      width: 2000,
      height: 2000,
      unit: "px",
      dpi: 96,
      presetId: null,
    });
    expect(built.format.width).toBe(2000);
    // Text stays on the page (decorations may bleed off the edges on purpose).
    const texts = built.pages[0]!.elements.filter((e) => e.type === "text");
    expect(Math.max(...texts.map((e) => e.x + e.width))).toBeLessThanOrEqual(2000 * 1.02);
  });
});
