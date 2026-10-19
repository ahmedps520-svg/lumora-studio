"use client";

import { Check, Palette, RefreshCw, Type } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AiError, AiShimmer, CostHint } from "@/components/ai/ai-bits";
import { useAiRun } from "@/components/ai/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiPalettes } from "@/lib/ai/api";
import type { AiPalette } from "@/lib/ai/contract";
import { collectColors } from "@/lib/document/palette";
import { loadFont } from "@/lib/fonts/loader";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";

const MOODS = ["sunset", "ocean", "forest", "luxury", "pastel", "neon"] as const;

function PaletteCard({ palette }: { palette: AiPalette }) {
  const t = useTranslations("ai.palette");
  const [done, setDone] = useState<"colors" | "fonts" | null>(null);

  useEffect(() => {
    void loadFont(palette.headingFont, 700);
    void loadFont(palette.bodyFont, 400);
  }, [palette.headingFont, palette.bodyFont]);

  return (
    <div className="space-y-3 rounded-2xl surface-card p-3" data-testid="palette-card">
      <div className="flex h-14 overflow-hidden rounded-xl ring-1 ring-black/5">
        {palette.colors.map((c) => (
          <span key={c} className="flex-1" style={{ background: c }} title={c} />
        ))}
      </div>
      <div className="space-y-0.5 px-1">
        <p className="text-sm font-semibold">{palette.name}</p>
        <p className="text-xs text-muted-foreground">{palette.mood}</p>
      </div>
      <div className="rounded-xl bg-surface-2 px-3 py-2">
        <p
          className="text-lg leading-tight font-bold"
          style={{ fontFamily: `"${palette.headingFont}"` }}
        >
          {palette.headingFont}
        </p>
        <p
          className="text-xs text-muted-foreground"
          style={{ fontFamily: `"${palette.bodyFont}"` }}
        >
          {palette.bodyFont}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          size="xs"
          variant={done === "colors" ? "secondary" : "default"}
          onClick={() => {
            editorActions.applyPaletteToPage(palette.colors);
            setDone("colors");
          }}
        >
          {done === "colors" ? <Check /> : <Palette />} {t("applyColors")}
        </Button>
        <Button
          size="xs"
          variant={done === "fonts" ? "secondary" : "outline"}
          onClick={() => {
            editorActions.applyFontPairing(palette.headingFont, palette.bodyFont);
            setDone("fonts");
          }}
        >
          {done === "fonts" ? <Check /> : <Type />} {t("applyFonts")}
        </Button>
      </div>
    </div>
  );
}

export function PaletteTab() {
  const t = useTranslations("ai.palette");
  const [prompt, setPrompt] = useState("");
  const [palettes, setPalettes] = useState<AiPalette[]>([]);

  const { run, loading, error } = useAiRun((signal, text: string, fromDesign: boolean) => {
    const page = selectCurrentPage(useEditorStore.getState());
    return aiPalettes(
      {
        prompt: text,
        count: 4,
        currentColors: fromDesign && page ? collectColors(page).slice(0, 12) : [],
      },
      signal,
    );
  });

  const go = async (text: string, fromDesign = false) => {
    if (!text.trim()) return;
    const result = await run(text, fromDesign);
    if (result) setPalettes(result.palettes);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void go(prompt);
        }}
      >
        <Input
          value={prompt}
          maxLength={600}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("prompt")}
        />
        <Button type="submit" variant="brand" disabled={!prompt.trim() || loading}>
          {t("generate")}
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((mood) => (
          <button
            key={mood}
            type="button"
            disabled={loading}
            onClick={() => {
              setPrompt(t(`moods.${mood}`));
              void go(t(`moods.${mood}`));
            }}
            className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {t(`moods.${mood}`)}
          </button>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={loading}
        onClick={() => void go(prompt || t("fromDesign"), true)}
      >
        <RefreshCw /> {t("fromDesign")}
      </Button>
      <CostHint task="palette" chars={prompt.length} />

      {error && <AiError message={error} />}
      {loading && Array.from({ length: 2 }, (_, i) => <AiShimmer key={i} className="h-44" />)}
      {!loading && palettes.map((p, i) => <PaletteCard key={`${p.name}-${i}`} palette={p} />)}
    </div>
  );
}
