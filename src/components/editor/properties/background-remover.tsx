"use client";

import { Eraser, Loader2, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  removeElementBackground,
  useBackgroundJobs,
  warmUpBackgroundRemoval,
} from "@/lib/background/jobs";
import type { ImageElement } from "@/lib/schema";
import { useEditorStore } from "@/lib/store/editor-store";

const mb = (bytes: number) => Math.max(1, Math.round(bytes / 1e6));

/** One-click, free background removal (done by Lumora itself — never another company). */
export function BackgroundRemover({ element }: { element: ImageElement }) {
  const t = useTranslations("editor.background");
  const job = useBackgroundJobs((s) => s.jobs[element.id]);
  const progress = job?.progress;

  // Get the AI model ready as soon as an image is selected, so the click feels instant.
  useEffect(() => warmUpBackgroundRemoval(), []);

  const start = async () => {
    try {
      const outcome = await removeElementBackground(element.id, {
        assetName: t("assetName", { name: element.name || t("image") }),
      });
      if (outcome === "done" || outcome === "fallback") {
        toast.success(t("done"), {
          description: outcome === "fallback" ? t("usedFast") : undefined,
          action: { label: t("undo"), onClick: () => useEditorStore.getState().undo() },
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(t("failed"), {
        description: error instanceof Error ? error.message.slice(0, 200) : undefined,
      });
    }
  };

  if (job) {
    const downloading = progress?.stage === "download" && progress.total > 0;
    return (
      <div className="space-y-2 rounded-xl border bg-muted/40 p-3" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          <span className="flex-1">
            {downloading
              ? t("downloading", { loaded: mb(progress.loaded), total: mb(progress.total) })
              : progress?.stage === "processing"
                ? t("working")
                : progress?.stage === "preparing"
                  ? t("preparing")
                  : t("starting")}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("cancel")}
            onClick={() => job.cancel()}
          >
            <X />
          </Button>
        </div>
        <Progress
          value={downloading ? (progress.loaded / progress.total) * 100 : 100}
          className={downloading ? undefined : "animate-pulse"}
          aria-label={t("progress")}
        />
        {downloading && <p className="text-xs text-muted-foreground">{t("downloadOnce")}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={element.locked}
        onClick={() => void start()}
        data-testid="remove-background"
      >
        <Eraser /> {t("remove")}
        <span className="ms-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          {t("free")}
        </span>
      </Button>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
        {t("privacy")}
      </p>
    </div>
  );
}
