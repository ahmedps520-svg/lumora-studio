"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  catalog,
  featuredTemplates,
  mixKinds,
  searchTemplates,
  TEMPLATE_KINDS,
  THEME_CATEGORIES,
  type TemplateKind,
  type TemplateLocale,
} from "@/lib/templates";
import { cn } from "@/lib/utils";
import { TemplateCard } from "./template-card";
import { useBatches } from "./use-batches";
import { useCreateFromTemplate } from "./use-create-from-template";

function Chip({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** The full template library: search, filter by size and topic, click to start. */
export function TemplateGallery() {
  const t = useTranslations("templates");
  const tf = useTranslations("formats");
  const locale = (useLocale() === "ar" ? "ar" : "en") as TemplateLocale;
  const { create, creating } = useCreateFromTemplate();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TemplateKind | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const all = useMemo(() => catalog(), []);
  const shown = useMemo(() => {
    const found = searchTemplates(
      all.filter((d) => (!kind || d.kind === kind) && (!category || d.category === category)),
      query,
      locale,
    );
    // A varied mix while browsing; search results keep their order.
    return query.trim() ? found : mixKinds(found, kind !== null);
  }, [all, kind, category, query, locale]);
  const { visible, hasMore, more, sentinel } = useBatches(shown, 60);

  return (
    <div className="space-y-6">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          className="h-12 rounded-2xl ps-11 text-base"
          data-testid="template-search"
        />
      </div>
      <div className="space-y-3">
        <div
          className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={t("sizes")}
        >
          <Chip active={!kind} onClick={() => setKind(null)}>
            {t("allSizes")}
          </Chip>
          {TEMPLATE_KINDS.map((k) => (
            <Chip
              key={k}
              active={kind === k}
              onClick={() => setKind(kind === k ? null : k)}
              testId={`template-kind-${k}`}
            >
              {tf(k)}
            </Chip>
          ))}
        </div>
        <div
          className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={t("topics")}
        >
          <Chip active={!category} onClick={() => setCategory(null)}>
            {t("allTopics")}
          </Chip>
          {THEME_CATEGORIES.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {t(`categories.${c}`)}
            </Chip>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="template-count">
        {t("count", { count: shown.length })}
      </p>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          {t("none")}
        </p>
      ) : (
        <>
          <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5 [&>*]:mb-5">
            {visible.map((def) => (
              <TemplateCard key={def.id} def={def} onPick={create} disabled={creating !== null} />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinel} className="flex justify-center">
              <Button variant="outline" onClick={more} data-testid="templates-more">
                {t("showMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** A taste of the library for the home page. */
export function FeaturedTemplates() {
  const t = useTranslations("templates");
  const { create, creating } = useCreateFromTemplate();
  const defs = useMemo(() => featuredTemplates(10), []);
  return (
    <section aria-labelledby="templates-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="templates-heading" className="text-2xl font-semibold tracking-tight">
            {t("homeTitle")}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {t("homeSubtitle", { count: catalog().length })}
          </p>
        </div>
        <Button asChild variant="outline" data-testid="browse-templates">
          <Link href="/templates">
            {t("browseAll")} <ArrowRight className="rtl:-scale-x-100" />
          </Link>
        </Button>
      </div>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-5 [&>*]:mb-5">
        {defs.map((def) => (
          <TemplateCard key={def.id} def={def} onPick={create} disabled={creating !== null} />
        ))}
      </div>
    </section>
  );
}
