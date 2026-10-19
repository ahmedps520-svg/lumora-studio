"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TemplateCard } from "@/components/templates/template-card";
import { useBatches } from "@/components/templates/use-batches";
import {
  searchTemplates,
  STYLE_FONTS,
  STYLE_PALETTES,
  swatches,
  templatesForSize,
  THEME_CATEGORIES,
  type TemplateDef,
  type TemplateLocale,
} from "@/lib/templates";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";
import { pageActions } from "@/lib/store/page-actions";
import { cn } from "@/lib/utils";

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/** Templates that fit this design, plus quick colour and font styles. */
export function TemplatesPanel() {
  const t = useTranslations("editor.templates");
  const tc = useTranslations("templates.categories");
  const locale = (useLocale() === "ar" ? "ar" : "en") as TemplateLocale;
  const format = useEditorStore((s) => s.design?.format);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const fitting = useMemo(
    () => (format ? templatesForSize(format.width, format.height, format.presetId) : []),
    [format],
  );
  const shown = useMemo(
    () =>
      searchTemplates(
        fitting.filter((d) => !category || d.category === category),
        query,
        locale,
      ),
    [fitting, category, query, locale],
  );
  const { visible, hasMore, more, sentinel } = useBatches(shown, 24);
  if (!format) return null;

  const apply = async (def: TemplateDef) => {
    const { buildTemplate } = await import("@/lib/templates");
    const built = buildTemplate(def, locale, format);
    pageActions.applyTemplate(built.pages);
    toast.success(
      t(built.pages.length > 1 ? "addedPages" : "applied", { count: built.pages.length }),
    );
  };

  return (
    <div className="space-y-6" data-testid="templates-panel">
      <section>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="ps-8"
            data-testid="editor-template-search"
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[null, ...THEME_CATEGORIES].map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                category === c
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              {c ? tc(c) : t("all")}
            </button>
          ))}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{t("hint", { count: shown.length })}</p>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("none")}
          </p>
        ) : (
          <>
            <div className="columns-2 gap-3 [&>*]:mb-3">
              {visible.map((def) => (
                <TemplateCard key={def.id} def={def} onPick={(d) => void apply(d)} compact />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinel}>
                <Button variant="outline" size="sm" className="w-full" onClick={more}>
                  {t("showMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <Heading>{t("colours")}</Heading>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              onClick={() => editorActions.applyPaletteToPage(swatches(palette))}
              className="flex h-9 overflow-hidden rounded-lg ring-1 ring-border transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("applyColours")}
              data-testid={`palette-${palette.id}`}
            >
              {swatches(palette).map((color, i) => (
                <span key={i} className="flex-1" style={{ background: color }} />
              ))}
            </button>
          ))}
        </div>
      </section>

      <section>
        <Heading>{t("fonts")}</Heading>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_FONTS.map((pair) => {
            const heading = locale === "ar" ? pair.ar.heading : pair.heading;
            const body = locale === "ar" ? pair.ar.body : pair.body;
            return (
              <button
                key={pair.id}
                type="button"
                onClick={() => editorActions.applyFontPairing(heading, body)}
                className="rounded-lg border px-3 py-2 text-start transition-colors hover:bg-surface-2"
                data-testid={`fonts-${pair.id}`}
              >
                <span
                  className="block truncate text-lg leading-tight"
                  style={{
                    fontFamily: `"${heading}"`,
                    fontWeight: locale === "ar" ? pair.ar.headingWeight : pair.headingWeight,
                  }}
                >
                  {t("sample")}
                </span>
                <span
                  className="block truncate text-xs text-muted-foreground"
                  style={{ fontFamily: `"${body}"` }}
                >
                  {heading} · {body}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
