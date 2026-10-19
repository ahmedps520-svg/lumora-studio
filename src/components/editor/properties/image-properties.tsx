"use client";

import { Crop, ImageUp, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cssFilter,
  IMAGE_PRESET_IDS,
  isImagePreset,
  resetAdjustments,
  resolveFilters,
  withPreset,
  type ImageFilters,
  type ImagePreset,
} from "@/lib/document/image-filters";
import { loadImage } from "@/lib/engine/images";
import type { ImageElement } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { cn } from "@/lib/utils";
import { BackgroundRemover } from "./background-remover";
import { CropDialog } from "./crop-dialog";
import { PhotoCredit, ReplacePhotoButton } from "./replace-photo";
import { ColorField, Section, SliderField } from "./fields";

/** A displayable URL for an image `src` (asset ids resolve to object URLs). */
function usePhotoUrl(src: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadImage(src).then(
      (img) => !cancelled && setUrl(img.src),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [src]);
  return url;
}

const blankFilters: ImageFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  warmth: 0,
  blur: 0,
  vignette: 0,
  grayscale: false,
  sepia: false,
  duotone: null,
  preset: null,
  presetStrength: 1,
};
const BLANK = resolveFilters(blankFilters);

function FilterTile({
  url,
  preset,
  label,
  active,
  onClick,
}: {
  url: string | null;
  preset: ImagePreset | null;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const look = preset ? resolveFilters(withPreset(blankFilters, preset)) : BLANK;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="group flex flex-col items-center gap-1 text-[11px] font-medium"
      data-testid={`photo-filter-${preset ?? "none"}`}
    >
      <span
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-lg ring-2 transition",
          active ? "ring-primary" : "ring-transparent group-hover:ring-border",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of the user's photo
          <img
            src={url}
            alt=""
            className="size-full object-cover"
            style={{ filter: cssFilter(look) }}
          />
        ) : (
          <span className="block size-full bg-muted" />
        )}
        {look.vignette > 0 && (
          <span
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle, transparent 45%, rgba(0,0,0,${0.8 * look.vignette}))`,
            }}
          />
        )}
      </span>
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </button>
  );
}

const ADJUSTMENTS = [
  { key: "brightness", min: -100, max: 100 },
  { key: "contrast", min: -100, max: 100 },
  { key: "saturation", min: -100, max: 100 },
  { key: "warmth", min: -100, max: 100 },
  { key: "hue", min: -180, max: 180 },
  { key: "blur", min: 0, max: 100 },
  { key: "vignette", min: 0, max: 100 },
] as const;

export function ImageProperties({ element }: { element: ImageElement }) {
  const t = useTranslations("editor.properties");
  const tp = useTranslations("editor.photo");
  const update = (patch: Partial<ImageElement>, mergeKey?: string) =>
    editorActions.updateElement(element.id, patch, mergeKey);
  const setFilters = (filters: ImageFilters, mergeKey?: string) => update({ filters }, mergeKey);
  const disabled = element.locked;
  const maxRadius = Math.round(Math.min(element.width, element.height) / 2);
  const url = usePhotoUrl(element.src);
  const [cropping, setCropping] = useState(false);
  const filters = element.filters;
  const preset = isImagePreset(filters.preset) ? filters.preset : null;
  const adjusted = ADJUSTMENTS.some(({ key }) => filters[key] !== 0);
  const framed = element.mask !== null && element.mask.kind !== "rect";

  return (
    <>
      <Section title={t("image")}>
        <div className="grid gap-2">
          <ReplacePhotoButton target={{ id: element.id, type: "image" }} disabled={disabled} />
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setCropping(true)}
            data-testid="photo-crop"
          >
            <Crop /> {tp("crop")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => editorActions.setImageAsBackground(element.id)}
            data-testid="photo-to-background"
          >
            <ImageUp /> {tp("toBackground")}
          </Button>
        </div>
        <PhotoCredit attribution={element.attribution} />
        <BackgroundRemover element={element} />
        <CropDialog element={element} open={cropping} onOpenChange={setCropping} />
      </Section>

      <Section title={tp("filters")}>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={tp("filters")}>
          <FilterTile
            url={url}
            preset={null}
            label={tp("presets.none")}
            active={!preset}
            onClick={() => setFilters(withPreset(filters, null))}
          />
          {IMAGE_PRESET_IDS.map((id) => (
            <FilterTile
              key={id}
              url={url}
              preset={id}
              label={tp(`presets.${id}`)}
              active={preset === id}
              onClick={() => !disabled && setFilters(withPreset(filters, id))}
            />
          ))}
        </div>
        {preset && (
          <SliderField
            label={tp("intensity")}
            value={Math.round(filters.presetStrength * 100)}
            min={0}
            max={100}
            disabled={disabled}
            format={(v) => `${v}%`}
            onChange={(v) =>
              setFilters({ ...filters, presetStrength: v / 100 }, `filter-strength:${element.id}`)
            }
          />
        )}
      </Section>

      <Section title={tp("adjust")}>
        {ADJUSTMENTS.map(({ key, min, max }) => {
          const raw = filters[key];
          const value = key === "hue" ? raw : Math.round(raw * 100);
          return (
            <SliderField
              key={key}
              label={tp(`adjustments.${key}`)}
              value={value}
              min={min}
              max={max}
              disabled={disabled}
              format={(v) => (key === "hue" ? `${v}°` : `${v > 0 && min < 0 ? "+" : ""}${v}`)}
              onChange={(v) =>
                setFilters(
                  { ...filters, [key]: key === "hue" ? Math.round(v) : v / 100 },
                  `adjust:${key}:${element.id}`,
                )
              }
            />
          );
        })}
        {adjusted && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={disabled}
            onClick={() => setFilters(resetAdjustments(filters))}
          >
            <RotateCcw /> {tp("resetAdjustments")}
          </Button>
        )}
      </Section>

      <Section title={t("stroke")}>
        {!framed && (
          <SliderField
            label={t("cornerRadius")}
            value={Math.min(element.cornerRadius, maxRadius)}
            min={0}
            max={maxRadius}
            disabled={disabled}
            format={(v) => `${v}px`}
            onChange={(cornerRadius) => update({ cornerRadius }, `radius:${element.id}`)}
          />
        )}
        <ColorField
          label={t("stroke")}
          value={element.stroke?.color ?? null}
          disabled={disabled || framed}
          onChange={(color) =>
            update(
              { stroke: { color, width: element.stroke?.width || 4, dash: [] } },
              `stroke:${element.id}`,
            )
          }
        />
        <SliderField
          label={t("strokeWidth")}
          value={element.stroke?.width ?? 0}
          min={0}
          max={50}
          disabled={disabled || framed}
          format={(v) => `${v}px`}
          onChange={(width) =>
            update(
              {
                stroke:
                  width === 0
                    ? null
                    : { color: element.stroke?.color ?? "#FFFFFF", width, dash: [] },
              },
              `strokeWidth:${element.id}`,
            )
          }
        />
      </Section>
    </>
  );
}
