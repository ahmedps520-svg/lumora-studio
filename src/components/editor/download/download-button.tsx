"use client";

import {
  Download,
  FileImage,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Printer,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_DOWNLOAD,
  VIDEO_SIZES,
  VideoUnsupportedError,
  type DownloadOptions,
  type DownloadType,
} from "@/lib/export/download";
import type { Design } from "@/lib/schema";
import { useEditorStore } from "@/lib/store/editor-store";
import { cn } from "@/lib/utils";
import { SliderField } from "../properties/fields";

const TYPES: { id: DownloadType; icon: LucideIcon }[] = [
  { id: "png", icon: ImageIcon },
  { id: "jpg", icon: FileImage },
  { id: "pdf", icon: FileText },
  { id: "pdf-print", icon: Printer },
  { id: "svg", icon: Shapes },
  { id: "video", icon: FileVideo },
];

type PageChoice = "all" | "current" | "custom";

/** The last choices, remembered while the editor is open. */
const useDownloadChoices = create<{
  options: typeof DEFAULT_DOWNLOAD;
  remember: (options: typeof DEFAULT_DOWNLOAD) => void;
}>((set) => ({ options: DEFAULT_DOWNLOAD, remember: (options) => set({ options }) }));

function sizeLabel(design: Design, options: typeof DEFAULT_DOWNLOAD): string {
  const { width, height } = design.format;
  if (options.type === "video") {
    const scale = options.videoSize / Math.min(width, height);
    const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
    return `${even(width)} × ${even(height)} px`;
  }
  const s = options.scale;
  return `${Math.round(width * s)} × ${Math.round(height * s)} px`;
}

function DownloadPanel({ onDone }: { onDone: () => void }) {
  const t = useTranslations("editor.download");
  const design = useEditorStore((s) => s.design);
  const pageId = useEditorStore((s) => s.pageId);
  const options = useDownloadChoices((s) => s.options);
  const remember = useDownloadChoices((s) => s.remember);
  const [pages, setPages] = useState<PageChoice>("all");
  const [custom, setCustom] = useState<string[]>(() => (pageId ? [pageId] : []));
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  if (!design) return null;

  const update = (patch: Partial<typeof options>) => remember({ ...options, ...patch });
  const pageIds =
    pages === "all"
      ? design.pages.map((p) => p.id)
      : pages === "current"
        ? [pageId ?? design.pages[0]!.id]
        : design.pages.filter((p) => custom.includes(p.id)).map((p) => p.id);
  const busy = progress !== null;
  const raster = options.type === "png" || options.type === "jpg";
  const zipped = pageIds.length > 1 && (raster || options.type === "svg");
  const seconds = Math.round(
    design.pages
      .filter((p) => pageIds.includes(p.id))
      .reduce((sum, p) => sum + (p.durationMs ?? 5_000), 0) / 1_000,
  );

  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    try {
      const { createDownload, saveFile } = await import("@/lib/export/download");
      const full: DownloadOptions = { ...options, pageIds };
      const result = await createDownload(design, full, {
        onProgress: (f) => setProgress(Math.round(f * 100)),
        signal: controller.signal,
      });
      saveFile(result);
      toast.success(t("done", { name: result.filename }));
      onDone();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[download]", error);
      toast.error(error instanceof VideoUnsupportedError ? t("videoUnsupported") : t("failed"));
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4" data-testid="download-panel">
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("fileType")}</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t("fileType")}>
          {TYPES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={options.type === id}
              disabled={busy}
              onClick={() => update({ type: id })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-medium transition-colors disabled:opacity-60",
                options.type === id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              data-testid={`download-type-${id}`}
            >
              <Icon className="size-5" />
              {t(`types.${id}.name`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t(`types.${options.type}.hint`)}</p>
      </div>

      {raster && (
        <SliderField
          label={t("size")}
          value={options.scale}
          min={0.5}
          max={4}
          step={0.25}
          format={(v) => `×${v}`}
          onChange={(scale) => update({ scale })}
        />
      )}
      {(raster || options.type === "video") && (
        <p className="-mt-2 text-xs text-muted-foreground tabular-nums" dir="ltr">
          {sizeLabel(design, options)}
        </p>
      )}
      {options.type === "jpg" && (
        <SliderField
          label={t("quality")}
          value={Math.round(options.quality * 100)}
          min={10}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => update({ quality: v / 100 })}
        />
      )}
      {(options.type === "png" || options.type === "svg") && (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{t("transparent")}</span>
          <Switch
            checked={options.transparent}
            onCheckedChange={(transparent) => update({ transparent })}
            data-testid="download-transparent"
          />
        </label>
      )}
      {options.type === "video" && (
        <div className="space-y-1.5">
          <p className="text-sm">{t("videoQuality")}</p>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
            {VIDEO_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={options.videoSize === size}
                onClick={() => update({ videoSize: size })}
                className={cn(
                  "rounded-md py-1 text-xs font-medium transition-colors",
                  options.videoSize === size
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {size === 2160 ? "4K" : `${size}p`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("videoHint", { seconds })}</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">{t("pages")}</p>
        <Select value={pages} onValueChange={(v) => setPages(v as PageChoice)} disabled={busy}>
          <SelectTrigger className="w-full" data-testid="download-pages">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allPages", { count: design.pages.length })}</SelectItem>
            <SelectItem value="current">{t("currentPage")}</SelectItem>
            {design.pages.length > 1 && <SelectItem value="custom">{t("choosePages")}</SelectItem>}
          </SelectContent>
        </Select>
        {pages === "custom" && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
            {design.pages.map((page, i) => (
              <label key={page.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={custom.includes(page.id)}
                  onChange={(e) =>
                    setCustom((ids) =>
                      e.target.checked ? [...ids, page.id] : ids.filter((id) => id !== page.id),
                    )
                  }
                />
                {page.name || t("pageNumber", { number: i + 1 })}
              </label>
            ))}
          </div>
        )}
        {zipped && <p className="text-xs text-muted-foreground">{t("zipHint")}</p>}
      </div>

      {busy ? (
        <div className="space-y-2" data-testid="download-progress">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> {t("working")}
            </span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} />
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => abort.current?.abort()}
          >
            {t("cancel")}
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          onClick={() => void start()}
          disabled={pageIds.length === 0}
          data-testid="download-start"
        >
          <Download /> {t("download")}
        </Button>
      )}
    </div>
  );
}

export function DownloadButton() {
  const t = useTranslations("editor.download");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" data-testid="download-button">
          <Download /> <span className="hidden lg:inline">{t("button")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <DownloadPanel onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
