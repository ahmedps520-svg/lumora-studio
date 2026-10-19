"use client";

import { Check, Crown, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DesignStyle } from "@/lib/ai/contract";
import { estimateCost, formatUsd } from "@/lib/ai/cost";
import type { ConvertedPage } from "@/lib/ai/design-format";
import { IMAGE_PRICES } from "@/lib/ai/premium";
import { useAiSettings } from "@/lib/ai/settings-store";
import { cn } from "@/lib/utils";
import { AiError } from "./ai-bits";
import { DesignPreview } from "./design-variations";
import { useAiRun, useCanPaint } from "./hooks";
import {
  generatePremiumDesign,
  type PremiumProgress,
  type PremiumResult,
  type PremiumStep,
} from "./premium";

const STEPS: PremiumStep[] = ["plan", "art", "layout", "review"];

/** Rough total before starting: Claude steps + the artwork. */
export function usePremiumEstimate(chars: number, canPaint: boolean) {
  const quality = useAiSettings((s) => s.quality);
  const art = useAiSettings((s) => s.premiumArt);
  const reviews = useAiSettings((s) => s.premiumReviews);
  const claude =
    estimateCost("artDirect", quality, chars).costUsd +
    estimateCost("compose", quality, chars).costUsd +
    estimateCost("review", quality, chars, reviews).costUsd;
  return claude + (canPaint ? IMAGE_PRICES[art]["2K"] : 0);
}

function Step({
  state,
  label,
  detail,
}: {
  state: "done" | "active" | "waiting";
  label: string;
  detail?: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
          state === "done" && "border-transparent bg-emerald-500 text-white",
          state === "active" && "border-primary text-primary",
          state === "waiting" && "text-muted-foreground",
        )}
      >
        {state === "done" ? (
          <Check className="size-3.5" />
        ) : state === "active" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : null}
      </span>
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", state === "waiting" && "text-muted-foreground")}>
          {label}
        </p>
        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      </div>
    </li>
  );
}

/**
 * Runs a Premium design with live progress (concept → artwork → layout →
 * review rounds) and shows the result with a "Use this design" button.
 */
export function PremiumRun({
  prompt,
  format,
  style,
  onUse,
  autoStart = false,
}: {
  prompt: string;
  format: { width: number; height: number };
  style: DesignStyle;
  onUse: (page: ConvertedPage, result: PremiumResult) => void;
  autoStart?: boolean;
}) {
  const t = useTranslations("ai.premium");
  const canPaint = useCanPaint();
  const art = useAiSettings((s) => s.premiumArt);
  const reviews = useAiSettings((s) => s.premiumReviews);
  const estimate = usePremiumEstimate(prompt.length, Boolean(canPaint));
  const [progress, setProgress] = useState<PremiumProgress | null>(null);
  const [result, setResult] = useState<PremiumResult | null>(null);
  const [started, setStarted] = useState(false);

  const { run, loading, error } = useAiRun((signal) =>
    generatePremiumDesign(
      { prompt, format, style, canPaint: Boolean(canPaint), quality: art, reviews },
      signal,
      setProgress,
    ),
  );

  const start = async () => {
    setStarted(true);
    setResult(null);
    setProgress(null);
    const out = await run();
    if (out) setResult(out);
  };

  // Start by itself (e.g. right after "Generate" on the home page) once we know about artwork.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current || canPaint === null) return;
    autoStarted.current = true;
    queueMicrotask(() => void start());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once
  }, [autoStart, canPaint]);

  const stepIndex = progress ? STEPS.indexOf(progress.step) : -1;
  const stateOf = (step: PremiumStep): "done" | "active" | "waiting" => {
    const i = STEPS.indexOf(step);
    if (result) return "done";
    if (i < stepIndex) return "done";
    return i === stepIndex && loading ? "active" : "waiting";
  };

  if (!started) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{canPaint ? t("intro") : t("introNoArt")}</p>
        <Button className="w-full" variant="brand" onClick={() => void start()}>
          <Crown /> {t("start")}
          <span className="ms-auto text-xs opacity-80">≈ {formatUsd(estimate)}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite" data-testid="premium-run">
      {!result && (
        <ol className="space-y-3">
          <Step
            state={stateOf("plan")}
            label={t("steps.plan")}
            detail={
              progress?.plan ? `“${progress.plan.title}” — ${progress.plan.concept}` : undefined
            }
          />
          {canPaint && (
            <Step
              state={stateOf("art")}
              label={t(art === "pro" ? "steps.artPro" : "steps.art")}
              detail={t("steps.artDetail")}
            />
          )}
          <Step state={stateOf("layout")} label={t("steps.layout")} />
          {reviews > 0 && (
            <Step
              state={stateOf("review")}
              label={t("steps.review")}
              detail={
                progress?.step === "review"
                  ? t("steps.round", { round: progress.round ?? 1, rounds: progress.rounds ?? 1 })
                  : undefined
              }
            />
          )}
        </ol>
      )}

      {!result && (progress?.previewUrl || progress?.artUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- local preview
        <img
          src={progress.previewUrl ?? progress.artUrl}
          alt=""
          className="w-full rounded-lg object-cover shadow-soft ring-1 ring-black/5"
          style={{ aspectRatio: `${format.width} / ${format.height}` }}
        />
      )}

      {error && (
        <div className="space-y-2">
          <AiError message={error} />
          <Button variant="outline" size="sm" onClick={() => void start()}>
            <RotateCcw /> {t("retry")}
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <DesignPreview page={result.page} format={format} />
          {result.artworkError && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {t("noArtwork", { reason: result.artworkError })}
            </p>
          )}
          {result.notes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <Wand2 className="me-1 inline size-3.5" aria-hidden />
              {result.notes.at(-1)}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="brand"
              className="flex-1"
              onClick={() => onUse(result.page, result)}
              data-testid="premium-use"
            >
              <Check /> {t("use")}
            </Button>
            <Button variant="outline" onClick={() => void start()} aria-label={t("retry")}>
              <RotateCcw />
            </Button>
          </div>
          <p className="text-end text-xs text-muted-foreground tabular-nums">
            {t("cost", { cost: formatUsd(result.costUsd) })}
          </p>
        </div>
      )}
    </div>
  );
}
