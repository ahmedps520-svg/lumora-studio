/**
 * Checks template themes and layouts: valid settings, English/Arabic parity,
 * and that every text element of every built page stays on the page.
 *
 *   npx tsx scripts/check-templates.ts --themes-file src/lib/templates/content/gen/x.ts
 *   npx tsx scripts/check-templates.ts --blueprints-file src/lib/templates/blueprints/gen/x.ts
 *   npx tsx scripts/check-templates.ts --ids instagramPost-coffee-spotlight,…
 *   npx tsx scripts/check-templates.ts --all            # the whole catalogue
 *
 * Exit code 1 when anything is wrong. Add --ids-out to print the ids that
 * were built (for the review page: /templates/review?ids=…).
 */
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { flattenElements } from "../src/lib/document/tree";
import { PHOTO_LIBRARY } from "../src/lib/photos/library";
import { buildTemplate, catalog, getTemplateDef, loadTemplateLibrary } from "../src/lib/templates";
import {
  addBlueprints,
  BLUEPRINTS,
  GEN_BY_ID,
  type Blueprint,
} from "../src/lib/templates/blueprints";
import { GENERATED_BLUEPRINTS } from "../src/lib/templates/blueprints/gen";
import type { GenBlueprint } from "../src/lib/templates/blueprints/gen-types";
import {
  ALL_THEME_KINDS,
  blueprintsForKind,
  KIND_PLANS,
  suits,
  themesForKind,
} from "../src/lib/templates/catalog";
import { THEMES } from "../src/lib/templates/content";
import { FONT_PAIRS } from "../src/lib/templates/fonts";
import { ICON_SVG } from "../src/lib/templates/icons.generated";
import { PALETTES } from "../src/lib/templates/palettes";
import {
  TEMPLATE_KINDS,
  THEME_CATEGORIES,
  type TemplateDef,
  type TemplateKind,
  type Theme,
} from "../src/lib/templates/types";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(name);

const problems: string[] = [];
const builtIds: string[] = [];
let builds = 0;

/** Builds one template in both languages and records text that leaves the page. */
function check(def: TemplateDef, overrides: { theme?: Theme; blueprint?: Blueprint } = {}) {
  for (const locale of ["en", "ar"] as const) {
    let built;
    try {
      built = buildTemplate(def, locale, undefined, overrides);
    } catch (error) {
      problems.push(`${def.id} (${locale}): ${(error as Error).message}`);
      continue;
    }
    builds++;
    const { width: W, height: H } = built.format;
    if (!built.pages.length) problems.push(`${def.id} (${locale}): no pages`);
    built.pages.forEach((page, pi) => {
      const tol = Math.min(W, H) * 0.02;
      for (const el of flattenElements(page.elements)) {
        if (el.type !== "text") continue;
        if (el.x < -tol || el.x + el.width > W + tol || el.y < -tol || el.y + el.height > H + tol) {
          const words = el.runs
            .map((r) => r.text)
            .join("")
            .slice(0, 30);
          problems.push(
            `${def.id} (${locale}) p${pi + 1}: "${words}" at ${Math.round(el.x)},${Math.round(el.y)} ${Math.round(el.width)}×${Math.round(el.height)} / ${W}×${H}`,
          );
        }
      }
    });
  }
  builtIds.push(def.id);
}

function validateTheme(t: Theme, known: Set<string>) {
  const where = `theme "${t.id}"`;
  if (!/^[a-z][a-zA-Z0-9]*$/.test(t.id)) problems.push(`${where}: id must be camelCase`);
  if (known.has(t.id)) problems.push(`${where}: id already exists`);
  if (!(THEME_CATEGORIES as readonly string[]).includes(t.category))
    problems.push(`${where}: unknown category "${t.category}"`);
  for (const i of t.icons) if (!ICON_SVG[i]) problems.push(`${where}: unknown icon "${i}"`);
  if (!t.icons.length) problems.push(`${where}: needs at least one icon`);
  for (const p of t.palettes)
    if (!(p in PALETTES)) problems.push(`${where}: unknown palette "${p}"`);
  if (t.palettes.length < 3) problems.push(`${where}: needs at least 3 palettes`);
  for (const f of t.fonts) if (!(f in FONT_PAIRS)) problems.push(`${where}: unknown fonts "${f}"`);
  if (t.fonts.length < 3) problems.push(`${where}: needs at least 3 font pairs`);
  for (const ph of t.photos)
    if (!(ph in PHOTO_LIBRARY)) problems.push(`${where}: unknown photo topic "${ph}"`);
  if (!t.photos.length) problems.push(`${where}: needs at least one photo topic`);
  for (const k of t.kinds ?? [])
    if (!(TEMPLATE_KINDS as readonly string[]).includes(k) || !KIND_PLANS[k as TemplateKind])
      problems.push(`${where}: unknown kind "${k}"`);
  const { en, ar } = t.copy;
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const a = en[key];
    const b = ar[key];
    const has = (v: unknown) => (Array.isArray(v) ? v.length : Boolean(v));
    if (has(a) !== has(b)) problems.push(`${where}: "${key}" is set in one language only`);
  }
  for (const [l, c] of Object.entries(t.copy)) {
    if (!c.title.trim()) problems.push(`${where} (${l}): title is empty`);
    if (!c.kicker.trim()) problems.push(`${where} (${l}): kicker is empty`);
    if (!c.subtitle.trim()) problems.push(`${where} (${l}): subtitle is empty`);
    if (!c.cta.trim()) problems.push(`${where} (${l}): cta is empty`);
    if (c.title.length > 40)
      problems.push(`${where} (${l}): title is too long (${c.title.length} > 40)`);
    if (c.subtitle.length > 70)
      problems.push(`${where} (${l}): subtitle is too long (${c.subtitle.length} > 70)`);
    if (c.body.length > 160)
      problems.push(`${where} (${l}): body is too long (${c.body.length} > 160)`);
    if (c.items.some((i) => i.length > 28))
      problems.push(`${where} (${l}): an item is too long (max 28 characters)`);
    if (c.stats.some(([n, label]) => n.length > 7 || label.length > 14))
      problems.push(`${where} (${l}): a stat is too long (number ≤ 7, label ≤ 14 characters)`);
    if (c.quote.length > 110) problems.push(`${where} (${l}): quote is too long (max 110)`);
  }
  if (/[؀-ۿ]/.test(JSON.stringify(t.copy.en)))
    problems.push(`${where}: Arabic letters in the English copy`);
  if (!/[؀-ۿ]/.test(t.copy.ar.title))
    problems.push(`${where}: the Arabic title has no Arabic letters`);
}

/** Every template a theme would get, with its first and last palette/font combination. */
function defsForTheme(t: Theme): TemplateDef[] {
  const out: TemplateDef[] = [];
  const kinds = [...new Set([...ALL_THEME_KINDS, ...(t.kinds ?? [])])];
  for (const kind of kinds) {
    for (const blueprint of blueprintsForKind(kind)) {
      if (!suits(blueprint, t)) continue;
      const combos = [
        [t.palettes[0]!, t.fonts[0]!],
        [t.palettes[t.palettes.length - 1]!, t.fonts[t.fonts.length - 1]!],
      ] as const;
      combos.forEach(([palette, fonts], v) =>
        out.push({
          id: `${kind}-${t.id}-${blueprint}${v ? "-b" : ""}`,
          kind,
          theme: t.id,
          category: t.category,
          blueprint,
          palette,
          fonts,
        }),
      );
    }
  }
  return out;
}

async function loadModule(file: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(resolve(file)).href)) as Record<string, unknown>;
}

/** The generated theme files other than `file`. */
async function otherThemeFiles(file: string): Promise<string[]> {
  const dir = "src/lib/templates/content/gen";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .map((f) => resolve(dir, f))
    .filter((f) => f !== resolve(file));
}

async function main() {
  const themesFile = opt("--themes-file");
  const blueprintsFile = opt("--blueprints-file");
  const ids = opt("--ids");

  if (themesFile) {
    // The file's themes are built with every layout, generated ones included.
    addBlueprints(GENERATED_BLUEPRINTS);
    const mod = await loadModule(themesFile);
    const themes = Object.values(mod)
      .filter((v): v is Theme[] => Array.isArray(v))
      .flat();
    if (!themes.length) problems.push(`${themesFile}: exports no theme arrays`);
    // Ids taken by the hand-written themes and by the other generated files.
    const known = new Set(THEMES.map((t) => t.id));
    for (const other of await otherThemeFiles(themesFile))
      for (const v of Object.values(await loadModule(other)))
        if (Array.isArray(v)) for (const t of v as Theme[]) known.add(t.id);
    const seen = new Set<string>();
    for (const t of themes) {
      validateTheme(t, known);
      if (seen.has(t.id)) problems.push(`theme "${t.id}": duplicated in this file`);
      seen.add(t.id);
      if (!problems.some((p) => p.startsWith(`theme "${t.id}"`)))
        for (const def of defsForTheme(t)) check(def, { theme: t });
    }
    console.log(`${themes.length} theme(s) checked`);
  }

  // Everything else checks against the full library.
  if (blueprintsFile || ids || flag("--all")) await loadTemplateLibrary();

  if (blueprintsFile) {
    const mod = await loadModule(blueprintsFile);
    const bps = Object.values(mod)
      .filter((v): v is GenBlueprint[] => Array.isArray(v))
      .flat();
    if (!bps.length) problems.push(`${blueprintsFile}: exports no layout arrays`);
    for (const bp of bps) {
      const where = `layout "${bp.id}"`;
      if (!/^[a-z][a-zA-Z0-9]*$/.test(bp.id)) problems.push(`${where}: id must be camelCase`);
      // Already registered through the gen index is fine; clashing with a hand-written one is not.
      if (BLUEPRINTS[bp.id] && !GEN_BY_ID.has(bp.id)) problems.push(`${where}: id already exists`);
      if (!bp.kinds?.length) problems.push(`${where}: needs at least one kind`);
      for (const k of bp.kinds ?? [])
        if (!KIND_PLANS[k]) problems.push(`${where}: unknown kind "${k}"`);
      if (!bp.draw && !bp.deck) problems.push(`${where}: needs draw() or deck()`);
      if (problems.some((p) => p.startsWith(where))) continue;
      const blueprint: Blueprint = bp.deck ? { deck: bp.deck } : { draw: bp.draw! };
      for (const kind of bp.kinds) {
        for (const theme of themesForKind(kind)) {
          if (bp.needs && !(bp.needs(theme.copy.en) && bp.needs(theme.copy.ar))) continue;
          const combos = [
            [theme.palettes[0]!, theme.fonts[0]!],
            [theme.palettes[theme.palettes.length - 1]!, theme.fonts[theme.fonts.length - 1]!],
          ] as const;
          combos.forEach(([palette, fonts], v) =>
            check(
              {
                id: `${kind}-${theme.id}-${bp.id}${v ? "-b" : ""}`,
                kind,
                theme: theme.id,
                category: theme.category,
                blueprint: bp.id,
                palette,
                fonts,
              },
              { blueprint },
            ),
          );
        }
      }
    }
    console.log(`${bps.length} layout(s) checked`);
  }

  if (ids) {
    for (const id of ids.split(",")) {
      const def = getTemplateDef(id.trim());
      if (!def) problems.push(`unknown template id "${id}"`);
      else check(def);
    }
  }

  if (flag("--all")) {
    const defs = catalog();
    console.log(`${defs.length} templates in the catalogue`);
    for (const def of defs) check(def);
  }

  console.log(`${builds} page sets built, ${problems.length} problem(s)`);
  if (flag("--ids-out")) console.log("ids:", builtIds.join(","));
  if (problems.length) {
    for (const p of problems.slice(0, 200)) console.log(" -", p);
    if (problems.length > 200) console.log(` … and ${problems.length - 200} more`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
