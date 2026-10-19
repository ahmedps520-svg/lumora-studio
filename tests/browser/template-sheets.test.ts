/**
 * Contact sheets of the built-in templates, for reviewing them by eye.
 * Off by default; run with:
 *   VITE_TEMPLATE_SHEETS=1 npx vitest run --project browser tests/browser/template-sheets.test.ts
 * Optional filters: VITE_SHEET_KIND=instagramPost VITE_SHEET_LOCALE=ar
 * Part of a big kind: VITE_SHEET_START=400 VITE_SHEET_COUNT=100
 * Try layouts on many themes before they're in the catalogue:
 *   VITE_SHEET_KIND=instagramPost VITE_SHEET_BLUEPRINTS=photoFull,magazine
 */
import { describe, it } from "vitest";
import { commands } from "vitest/browser";
import { renderPageToCanvas } from "@/lib/engine/render";
import { scalePhotos } from "@/lib/photos";
import { buildTemplate } from "@/lib/templates/build";
import { catalog } from "@/lib/templates/catalog";
import { THEMES } from "@/lib/templates/content";
import type { TemplateDef, TemplateKind, TemplateLocale } from "@/lib/templates/types";

const env = import.meta.env as unknown as Record<string, string | undefined>;
const enabled = Boolean(env.VITE_TEMPLATE_SHEETS);
const CELL = 300;
const COLS = 5;
const PER_SHEET = 20;

describe.skipIf(!enabled)("template contact sheets", () => {
  it("renders every template", async () => {
    const locale = (env.VITE_SHEET_LOCALE ?? "en") as TemplateLocale;
    const trial = env.VITE_SHEET_BLUEPRINTS?.split(",");
    const defs: TemplateDef[] = trial
      ? trial.flatMap((blueprint) =>
          THEMES.filter((_, i) => i % Number(env.VITE_SHEET_EVERY ?? 3) === 0).map((t, i) => ({
            id: `${blueprint}-${t.id}`,
            kind: (env.VITE_SHEET_KIND ?? "instagramPost") as TemplateKind,
            theme: t.id,
            category: t.category,
            blueprint,
            palette: t.palettes[i % t.palettes.length]!,
            fonts: t.fonts[i % t.fonts.length]!,
          })),
        )
      : catalog()
          .filter((d) => !env.VITE_SHEET_KIND || d.kind === env.VITE_SHEET_KIND)
          // VITE_SHEET_START / VITE_SHEET_COUNT look at part of a big kind.
          .slice(Number(env.VITE_SHEET_START ?? 0))
          .slice(0, Number(env.VITE_SHEET_COUNT ?? Infinity));
    // VITE_SHEET_PAGES=1 shows every page (decks, two-sided cards), not just the first.
    const allPages = Boolean(env.VITE_SHEET_PAGES);
    const cells = defs.flatMap((d) => {
      const b = buildTemplate(d, locale);
      return (allPages ? b.pages : b.pages.slice(0, 1)).map((page, i) => ({
        id: allPages ? `${d.id} p${i + 1}` : d.id,
        built: { ...b, pages: [page] },
      }));
    });
    for (let start = 0; start < cells.length; start += PER_SHEET) {
      const chunk = cells.slice(start, start + PER_SHEET);
      const built = chunk.map((c) => c.built);
      const aspect = Math.max(...built.map((b) => b.format.height / b.format.width));
      const cellH = Math.round(CELL * Math.min(aspect, 2)) + 22;
      const rows = Math.ceil(chunk.length / COLS);
      const sheet = document.createElement("canvas");
      sheet.width = COLS * (CELL + 10) + 10;
      sheet.height = rows * (cellH + 10) + 10;
      const ctx = sheet.getContext("2d")!;
      ctx.fillStyle = "#8a8f98";
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      for (const [i, b] of built.entries()) {
        const scale = Math.min(CELL / b.format.width, (cellH - 22) / b.format.height);
        const page = b.pages[0]!;
        const small = { ...page, elements: scalePhotos(page.elements, scale * 2) };
        const canvas = await renderPageToCanvas(small, b.format, { scale });
        const x = 10 + (i % COLS) * (CELL + 10);
        const y = 10 + Math.floor(i / COLS) * (cellH + 10);
        ctx.drawImage(canvas, x, y);
        ctx.fillStyle = "#000";
        ctx.font = "11px sans-serif";
        ctx.fillText(chunk[i]!.id.slice(0, 52), x, y + cellH - 6);
      }
      const data = sheet.toDataURL("image/png").split(",")[1]!;
      const page = String(
        start / PER_SHEET + 1 + Number(env.VITE_SHEET_START ?? 0) / PER_SHEET,
      ).padStart(2, "0");
      const name = `${trial ? "trial-" : ""}${env.VITE_SHEET_KIND ?? "all"}-${locale}-${page}.png`;
      await commands.writeFile(`.lumora-cache/sheets/${name}`, data, "base64");
    }
  }, 600_000);
});
