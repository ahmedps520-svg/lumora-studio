"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { blankDoc, savePhoto } from "@/lib/photo/storage";
import { MAX_SIDE } from "@/lib/photo/types";
import { cn } from "@/lib/utils";
import { ColorField, NumField, SelectField } from "./controls";

export const DOC_PRESETS = [
  { id: "default", width: 2100, height: 1500, resolution: 300 },
  { id: "hd", width: 1920, height: 1080, resolution: 72 },
  { id: "uhd", width: 3840, height: 2160, resolution: 72 },
  { id: "square", width: 1080, height: 1080, resolution: 72 },
  { id: "portrait", width: 1080, height: 1350, resolution: 72 },
  { id: "story", width: 1080, height: 1920, resolution: 72 },
  { id: "a4", width: 2480, height: 3508, resolution: 300 },
  { id: "letter", width: 2550, height: 3300, resolution: 300 },
  { id: "banner", width: 1200, height: 628, resolution: 72 },
] as const;

type Background = "white" | "black" | "transparent" | "custom";

/** Name, size and background for a new blank photo document. */
export function NewDocumentForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("photo.newDoc");
  const router = useRouter();
  const [preset, setPreset] = useState<string>("default");
  const [name, setName] = useState("");
  const [w, setW] = useState(2100);
  const [h, setH] = useState(1500);
  const [res, setRes] = useState(300);
  const [bg, setBg] = useState<Background>("white");
  const [custom, setCustom] = useState("#F4EFE6");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const color =
        bg === "white" ? "#FFFFFF" : bg === "black" ? "#000000" : bg === "custom" ? custom : null;
      const doc = blankDoc(name.trim() || t("untitled"), w, h, color);
      doc.resolution = res;
      await savePhoto(doc);
      onDone?.();
      router.push(`/photo/${doc.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <div className="grid grid-cols-3 gap-1.5">
        {DOC_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={preset === p.id}
            data-testid={`preset-${p.id}`}
            onClick={() => {
              setPreset(p.id);
              setW(p.width);
              setH(p.height);
              setRes(p.resolution);
            }}
            className={cn(
              "flex flex-col items-start rounded-lg border px-2.5 py-2 text-start text-xs hover:bg-accent",
              preset === p.id && "border-primary bg-primary/10",
            )}
          >
            <span className="font-medium">{t(`presets.${p.id}`)}</span>
            <span className="text-muted-foreground tabular-nums">
              {p.width} × {p.height}
            </span>
          </button>
        ))}
      </div>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>{t("name")}</span>
        <input
          value={name}
          maxLength={120}
          placeholder={t("untitled")}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          data-testid="new-doc-name"
          className="h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground outline-none focus:border-ring"
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <NumField
          label={t("width")}
          value={w}
          min={1}
          max={MAX_SIDE}
          unit="px"
          onChange={(v) => {
            setW(Math.round(v));
            setPreset("custom");
          }}
          testId="new-doc-width"
        />
        <NumField
          label={t("height")}
          value={h}
          min={1}
          max={MAX_SIDE}
          unit="px"
          onChange={(v) => {
            setH(Math.round(v));
            setPreset("custom");
          }}
          testId="new-doc-height"
        />
        <NumField
          label={t("resolution")}
          value={res}
          min={1}
          max={2400}
          unit="ppi"
          onChange={setRes}
        />
      </div>
      <div className="flex items-center gap-3">
        <SelectField
          label={t("background")}
          value={bg}
          onChange={setBg}
          options={(["white", "black", "transparent", "custom"] as const).map((b) => ({
            value: b,
            label: t(`backgrounds.${b}`),
          }))}
        />
        {bg === "custom" && <ColorField value={custom} onChange={(c) => c && setCustom(c)} />}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy} data-testid="new-doc-create">
          {t("create")}
        </Button>
      </div>
    </form>
  );
}
