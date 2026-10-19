"use client";

import { Layers } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { kindFormat, templateName, type TemplateDef, type TemplateLocale } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { useTemplateThumbnail } from "./use-template-thumbnail";

const PAGE_COUNTS: Record<string, number> = { presentation16x9: 8, businessCard: 2 };

/** A template thumbnail with its name; renders lazily when scrolled into view. */
export function TemplateCard({
  def,
  onPick,
  disabled,
  compact = false,
  showKind = true,
}: {
  def: TemplateDef;
  onPick: (def: TemplateDef) => void;
  disabled?: boolean;
  compact?: boolean;
  showKind?: boolean;
}) {
  const t = useTranslations();
  const locale = (useLocale() === "ar" ? "ar" : "en") as TemplateLocale;
  const format = kindFormat(def.kind);
  const { ref, url } = useTemplateThumbnail(def, locale, compact ? 280 : 420);
  const pages = PAGE_COUNTS[def.kind];
  const name = templateName(def, locale);

  return (
    <button
      type="button"
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={() => onPick(def)}
      disabled={disabled}
      className="group block w-full break-inside-avoid text-start focus-visible:outline-none disabled:opacity-60"
      title={name}
      data-testid={`template-${def.id}`}
    >
      <span
        className={cn(
          "relative block overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lifted group-hover:ring-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring",
        )}
        style={{ aspectRatio: `${format.width} / ${format.height}` }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated preview
          <img src={url} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <span className="block size-full animate-pulse bg-gradient-to-br from-surface-2 to-muted" />
        )}
        {pages && (
          <span className="absolute end-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            <Layers className="size-3" /> {pages}
          </span>
        )}
      </span>
      {!compact && (
        <span className="mt-2 block px-0.5">
          <span className="block truncate text-sm font-medium">{name}</span>
          {showKind && (
            <span className="block truncate text-xs text-muted-foreground">
              {t(`formats.${def.kind}` as never)}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
