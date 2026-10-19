"use client";

import { AlertTriangle, KeyRound, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { estimateCost, formatUsd } from "@/lib/ai/cost";
import type { AiTask } from "@/lib/ai/models";
import { useAiSettings } from "@/lib/ai/settings-store";
import { cn } from "@/lib/utils";
import { useLedger } from "./hooks";

/** Shown when AI has no key yet — explains what to do, links to Settings. */
export function AiSetupCard({ className }: { className?: string }) {
  const t = useTranslations("ai.setup");
  return (
    <div className={cn("space-y-3 rounded-2xl surface-card p-5", className)} data-testid="ai-setup">
      <span className="flex size-10 items-center justify-center rounded-xl btn-glow">
        <KeyRound className="size-5" />
      </span>
      <h3 className="text-base font-semibold">{t("title")}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
      <Button asChild variant="brand" size="sm">
        <Link href="/settings?tab=keys">{t("openSettings")}</Link>
      </Button>
    </div>
  );
}

export function AiChecking() {
  const t = useTranslations("ai.setup");
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {t("checking")}
    </p>
  );
}

/** "≈ $0.0004" before running a request (hidden when the user turned it off). */
export function CostHint({
  task,
  chars,
  runs = 1,
}: {
  task: AiTask;
  chars: number;
  runs?: number;
}) {
  const t = useTranslations("ai.cost");
  const show = useAiSettings((s) => s.showCosts);
  const quality = useAiSettings((s) => s.quality);
  if (!show) return null;
  const { costUsd } = estimateCost(task, quality, chars, runs);
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {t("estimate", { cost: formatUsd(costUsd) })}
    </span>
  );
}

/** Today's spend vs the daily budget, as a slim bar. */
export function SpendMeter({ className }: { className?: string }) {
  const t = useTranslations("ai.cost");
  const ledger = useLedger();
  const budget = useAiSettings((s) => s.dailyBudgetUsd);
  const show = useAiSettings((s) => s.showCosts);
  if (!show) return null;
  const ratio = budget > 0 ? Math.min(1, ledger.spentUsd / budget) : 1;
  const last = ledger.recent[0];
  return (
    <div className={cn("space-y-1.5", className)} data-testid="spend-meter">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>{t("today", { spent: formatUsd(ledger.spentUsd), budget: formatUsd(budget) })}</span>
        {last && <span>{t("last", { cost: formatUsd(last.costUsd) })}</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            ratio > 0.9 ? "bg-destructive" : "bg-brand-gradient",
          )}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function AiError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

export function AiBadge({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full btn-glow px-2 py-0.5 text-[11px] font-semibold">
      <Sparkles className="size-3" />
      {children}
    </span>
  );
}

/** Shimmering placeholder while AI works. */
export function AiShimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gradient-to-br from-[#FF7A3D]/15 via-[#F72585]/10 to-[#7C6CF2]/15",
        className,
      )}
    />
  );
}
