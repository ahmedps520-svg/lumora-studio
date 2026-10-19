"use client";

import { Check, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ConvertedPage } from "@/lib/ai/design-format";
import { cn } from "@/lib/utils";
import { AiShimmer } from "./ai-bits";
import type { VariationResult } from "./hooks";

/** Renders a generated page to a thumbnail (Fabric is loaded lazily). */
export function DesignPreview({
  page,
  format,
  className,
}: {
  page: ConvertedPage;
  format: { width: number; height: number };
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@/lib/engine/render")
      .then((m) => m.renderPageToDataUrl(page, format, { maxSize: 520 }))
      .then((dataUrl) => !cancelled && setUrl(dataUrl))
      .catch((error: unknown) => console.error("[ai] preview failed", error));
    return () => {
      cancelled = true;
    };
  }, [page, format]);

  const style = { aspectRatio: `${format.width} / ${format.height}` };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- generated data URL
    <img
      src={url}
      alt=""
      style={style}
      className={cn("w-full rounded-lg shadow-soft ring-1 ring-black/5", className)}
    />
  ) : (
    <AiShimmer className={cn("w-full", className)} />
  );
}

export function DesignVariations({
  results,
  format,
  onUse,
  useLabel,
  columns = 1,
}: {
  results: VariationResult[];
  format: { width: number; height: number };
  onUse: (index: number) => void;
  useLabel?: string;
  columns?: 1 | 2 | 3;
}) {
  const t = useTranslations("ai.design");
  const [used, setUsed] = useState<number | null>(null);

  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
      )}
      data-testid="design-variations"
    >
      {results.map((item, index) =>
        item.ok ? (
          <div key={index} className="space-y-3 rounded-2xl surface-card p-3">
            <div className="flex items-center justify-center rounded-xl bg-surface-2 bg-dots p-3">
              <div className="w-full max-w-[280px]">
                <DesignPreview page={item.result.page} format={format} />
              </div>
            </div>
            <div className="space-y-1 px-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wand2 className="size-4 text-[#F72585]" />
                {t(`styles.${item.result.style}` as never)}
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.result.concept}</p>
              <div className="flex gap-1 pt-1">
                {item.result.palette.slice(0, 6).map((c) => (
                  <span
                    key={c}
                    className="size-4 rounded-full ring-1 ring-black/10"
                    style={{ background: c }}
                  />
                ))}
              </div>
              {item.result.fixes.filter((f) => f !== "snapped").length > 0 && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  {t("fixesLabel")}:{" "}
                  {item.result.fixes
                    .filter((f) => f !== "snapped")
                    .map((f) => t(`fix.${f}`))
                    .join(" · ")}
                </p>
              )}
            </div>
            <Button
              variant={used === index ? "secondary" : "brand"}
              size="sm"
              className="w-full"
              data-testid="use-design"
              onClick={() => {
                setUsed(index);
                onUse(index);
              }}
            >
              {used === index && <Check />}
              {useLabel ?? t("use")}
            </Button>
          </div>
        ) : (
          <div
            key={index}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground"
          >
            <span className="font-medium">{t("failed")}</span>
            <span className="text-xs">{item.message}</span>
          </div>
        ),
      )}
    </div>
  );
}
