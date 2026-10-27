"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatFromPreset, getPreset, pxToUnit, type FormatPreset } from "@/lib/document/formats";
import { SectionHeading } from "@/components/site/section-heading";
import { PresetPreview, PreviewStage } from "./preset-preview";
import { useCreateDesign } from "./use-create-design";

const POPULAR = [
  "instagramPost",
  "instagramStory",
  "presentation16x9",
  "youtubeThumbnail",
  "a4",
  "poster",
  "logo",
  "businessCard",
];

export function sizeLabel(preset: Pick<FormatPreset, "width" | "height" | "unit">) {
  if (preset.unit === "px") return `${preset.width} × ${preset.height} px`;
  const f = (v: number) => +pxToUnit(v, preset.unit).toFixed(1);
  return `${f(preset.width)} × ${f(preset.height)} ${preset.unit}`;
}

/** One format card: a miniature artboard on a dotted stage + name and size. */
export function FormatCard({
  preset,
  skin,
  onCreate,
  disabled,
  compact = false,
}: {
  preset: FormatPreset;
  skin: number;
  onCreate: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("formats");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onCreate}
      data-testid={compact ? `preset-${preset.id}` : `quick-${preset.id}`}
      className="group lumen flex flex-col rounded-2xl surface-lit p-2 text-start transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
    >
      <span
        className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-surface-2 ${compact ? "aspect-[16/10] p-4" : "aspect-[4/3] p-6"}`}
      >
        <span className="absolute inset-0 bg-dots opacity-70" />
        <PreviewStage className="transition-transform duration-300 group-hover:scale-[1.04]">
          <PresetPreview
            width={preset.width}
            height={preset.height}
            category={preset.category}
            skin={skin}
          />
        </PreviewStage>
      </span>
      <span className="flex items-center justify-between gap-2 px-2 pt-3 pb-1.5">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{t(preset.id as never)}</span>
          <span className="block text-xs text-muted-foreground tabular-nums" dir="ltr">
            {sizeLabel(preset)}
          </span>
        </span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground opacity-0 transition-all group-hover:bg-foreground group-hover:text-background group-hover:opacity-100 group-focus-visible:opacity-100">
          <ArrowUpRight className="size-4 rtl:-scale-x-100" />
        </span>
      </span>
    </button>
  );
}

export function QuickCreate() {
  const t = useTranslations("home");
  const { create, creating } = useCreateDesign();

  return (
    <section id="sizes" aria-labelledby="sizes-heading" className="scroll-mt-24">
      <SectionHeading
        id="sizes-heading"
        eyebrow={t("sizesEyebrow")}
        title={t("popular")}
        lead={t("sizesLead")}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {POPULAR.map((id, i) => {
          const preset = getPreset(id)!;
          return (
            <FormatCard
              key={id}
              preset={preset}
              skin={i}
              disabled={creating}
              onCreate={() => void create(formatFromPreset(preset))}
            />
          );
        })}
      </div>
    </section>
  );
}
