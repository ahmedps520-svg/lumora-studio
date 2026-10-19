"use client";

import { Crown, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AiError, AiShimmer, CostHint } from "@/components/ai/ai-bits";
import { DesignVariations } from "@/components/ai/design-variations";
import { PremiumRun } from "@/components/ai/premium-run";
import {
  generateVariations,
  useAiErrorMessage,
  useAiRun,
  type VariationResult,
} from "@/components/ai/hooks";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DESIGN_STYLES, type DesignStyle } from "@/lib/ai/contract";
import { useAiSettings } from "@/lib/ai/settings-store";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";
import { cn } from "@/lib/utils";

export function StylePicker({
  value,
  onChange,
}: {
  value: DesignStyle;
  onChange: (style: DesignStyle) => void;
}) {
  const t = useTranslations("ai.design");
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("style")}>
      {DESIGN_STYLES.map((style) => (
        <button
          key={style}
          type="button"
          role="radio"
          aria-checked={value === style}
          onClick={() => onChange(style)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === style
              ? "border-transparent bg-foreground text-background"
              : "bg-card text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          )}
        >
          {t(`styles.${style}`)}
        </button>
      ))}
    </div>
  );
}

export function CountPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: 1 | 2 | 3) => void;
}) {
  const t = useTranslations("ai.design");
  return (
    <div className="inline-flex rounded-lg border bg-surface-2/60 p-0.5">
      {([1, 2, 3] as const).map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === n
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("count", { count: n })}
        </button>
      ))}
    </div>
  );
}

export function DesignTab() {
  const t = useTranslations("ai.design");
  const format = useEditorStore((s) => s.design?.format);
  const defaultStyle = useAiSettings((s) => s.defaultStyle);
  const defaultCount = useAiSettings((s) => s.designVariations);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<DesignStyle>(defaultStyle);
  const [count, setCount] = useState<1 | 2 | 3>(defaultCount);
  const [results, setResults] = useState<VariationResult[]>([]);
  const [premium, setPremium] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const errorMessage = useAiErrorMessage();
  const tp = useTranslations("ai.premium");

  const { run, loading, error } = useAiRun((signal) => {
    if (!format) return Promise.resolve([] as VariationResult[]);
    return generateVariations({ prompt, format, style, count }, signal, errorMessage);
  });

  if (!format) return null;

  const generate = async () => {
    setResults([]);
    const out = await run();
    if (out) setResults(out);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("prompt")}
        maxLength={1_500}
        rows={4}
        className="resize-none rounded-xl"
        data-testid="magic-design-prompt"
      />
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {t("style")}
        </p>
        <StylePicker value={style} onChange={setStyle} />
      </div>
      <label className="flex items-center gap-3 rounded-xl border bg-surface-2/50 p-3">
        <Crown className="size-4 shrink-0 text-amber-500" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{tp("toggle")}</span>
          <span className="block text-xs text-muted-foreground">{tp("toggleHint")}</span>
        </span>
        <Switch
          checked={premium}
          onCheckedChange={(on) => {
            setPremium(on);
            setRunKey((k) => k + 1);
          }}
          data-testid="premium-toggle"
        />
      </label>

      {premium && prompt.trim().length >= 3 && (
        <PremiumRun
          key={runKey}
          prompt={prompt}
          format={format}
          style={style}
          onUse={(page) => editorActions.replacePageContent(page)}
        />
      )}

      {!premium && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CountPicker value={count} onChange={setCount} />
            <CostHint task="design" chars={prompt.length} runs={count} />
          </div>
          <Button
            variant="brand"
            className="w-full"
            disabled={prompt.trim().length < 3 || loading}
            onClick={() => void generate()}
            data-testid="magic-design-generate"
          >
            <Sparkles /> {t("generate")}
          </Button>

          {error && <AiError message={error} />}

          {loading && (
            <div className="space-y-3" aria-live="polite">
              <p className="text-sm text-muted-foreground">{t("generating")}</p>
              {Array.from({ length: count }, (_, i) => (
                <AiShimmer key={i} className="aspect-[4/3]" />
              ))}
            </div>
          )}

          {!loading && results.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("replaceWarning")}</p>
              <DesignVariations
                results={results}
                format={format}
                onUse={(index) => {
                  const item = results[index];
                  if (item?.ok) editorActions.replacePageContent(item.result.page);
                }}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
