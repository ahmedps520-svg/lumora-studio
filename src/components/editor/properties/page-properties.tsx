"use client";

import { ImageMinus, Unlink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pxToUnit } from "@/lib/document/formats";
import { PAGE_TRANSITIONS, type Background, type PageTransition } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";
import { pageActions } from "@/lib/store/page-actions";
import { PageAnimation } from "./animate-section";
import { ColorField, Section, SliderField } from "./fields";

type ImageBackground = Extract<Background, { type: "image" }>;

/** Splits "#RRGGBBAA" into colour + strength (0–1). */
function splitTint(tint: string | null): { color: string; strength: number } {
  if (!tint) return { color: "#000000", strength: 0 };
  const color = tint.slice(0, 7);
  const alpha = tint.length === 9 ? parseInt(tint.slice(7), 16) / 255 : 1;
  return { color, strength: alpha };
}

function joinTint(color: string, strength: number): string | null {
  if (strength <= 0) return null;
  const alpha = Math.round(Math.min(1, strength) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${color.slice(0, 7).toUpperCase()}${alpha}`;
}

function BackgroundPhoto({ pageId, background }: { pageId: string; background: ImageBackground }) {
  const t = useTranslations("editor.photo.background");
  const set = (patch: Partial<ImageBackground>, mergeKey?: string) =>
    editorActions.setBackground({ ...background, ...patch }, mergeKey);
  const tint = splitTint(background.tint);
  return (
    <Section title={t("title")}>
      <label className="block space-y-1.5 text-sm">
        <span>{t("fit")}</span>
        <Select
          value={background.fit}
          onValueChange={(fit) => set({ fit: fit as ImageBackground["fit"] })}
        >
          <SelectTrigger className="w-full" data-testid="background-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["cover", "contain", "tile"] as const).map((fit) => (
              <SelectItem key={fit} value={fit}>
                {t(`fits.${fit}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <SliderField
        label={t("opacity")}
        value={Math.round(background.opacity * 100)}
        min={0}
        max={100}
        format={(v) => `${v}%`}
        onChange={(v) => set({ opacity: v / 100 }, `bg-opacity:${pageId}`)}
      />
      <ColorField
        label={t("tint")}
        value={tint.strength > 0 ? tint.color : null}
        onChange={(hex) => set({ tint: joinTint(hex, tint.strength || 0.35) }, `bg-tint:${pageId}`)}
      />
      {tint.strength > 0 && (
        <SliderField
          label={t("tint")}
          value={Math.round(tint.strength * 100)}
          min={0}
          max={90}
          format={(v) => `${v}%`}
          onChange={(v) => set({ tint: joinTint(tint.color, v / 100) }, `bg-tint:${pageId}`)}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void editorActions.detachBackgroundImage()}
          data-testid="background-detach"
        >
          <Unlink /> {t("detach")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editorActions.setBackground({ type: "solid", color: "#FFFFFF" })}
        >
          <ImageMinus /> {t("remove")}
        </Button>
      </div>
    </Section>
  );
}

export function PageProperties() {
  const t = useTranslations("editor.properties");
  const tp = useTranslations("editor.present");
  const tf = useTranslations("formats");
  const page = useEditorStore(selectCurrentPage);
  const format = useEditorStore((s) => s.design?.format);
  if (!page || !format) return null;

  const background = page.background;
  const color = background.type === "solid" ? background.color : null;
  const size =
    format.unit === "px"
      ? `${format.width} × ${format.height} px`
      : `${+pxToUnit(format.width, format.unit).toFixed(1)} × ${+pxToUnit(format.height, format.unit).toFixed(1)} ${format.unit} · ${format.dpi} dpi`;
  const presetName =
    format.presetId && tf.has(format.presetId as never)
      ? tf(format.presetId as never)
      : tf("custom");

  return (
    <>
      <Section title={t("page")}>
        <div className="text-sm">
          <div className="font-medium">{presetName}</div>
          <div className="text-muted-foreground tabular-nums" dir="ltr">
            {size}
          </div>
        </div>
      </Section>
      <Section title={t("background")}>
        <ColorField
          label={t("background")}
          value={color}
          testId="page-background"
          onChange={(hex) =>
            editorActions.setBackground({ type: "solid", color: hex }, `background:${page.id}`)
          }
        />
      </Section>
      {background.type === "image" && <BackgroundPhoto pageId={page.id} background={background} />}
      <Section title={tp("pageSettings")}>
        <label className="block space-y-1.5 text-sm">
          <span>{tp("transition")}</span>
          <Select
            value={page.transition}
            onValueChange={(v) => pageActions.setTransition(page.id, v as PageTransition)}
          >
            <SelectTrigger className="w-full" data-testid="page-transition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_TRANSITIONS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {tp(`transitions.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <SliderField
          label={tp("duration")}
          value={Math.round((page.durationMs ?? 5_000) / 500) / 2}
          min={1}
          max={30}
          step={0.5}
          format={(v) => tp("seconds", { value: v })}
          onChange={(v) => pageActions.setDuration(page.id, Math.round(v * 1_000))}
        />
      </Section>
      <PageAnimation page={page} />
    </>
  );
}
