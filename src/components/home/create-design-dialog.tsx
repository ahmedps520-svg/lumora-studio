"use client";

import { Plus, Ruler } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  customFormat,
  FORMAT_PRESETS,
  formatFromPreset,
  type FormatCategory,
  type SizeUnit,
} from "@/lib/document/formats";
import { cn } from "@/lib/utils";
import { FormatCard } from "./quick-create";
import { useCreateDesign } from "./use-create-design";

const CATEGORIES: FormatCategory[] = [
  "social",
  "video",
  "presentation",
  "document",
  "print",
  "other",
];
const MIN_PX = 16;
const MAX_PX = 20_000;

function CustomSizeForm() {
  const t = useTranslations("createDialog");
  const { create, creating } = useCreateDesign();
  const [width, setWidth] = useState("1080");
  const [height, setHeight] = useState("1080");
  const [unit, setUnit] = useState<SizeUnit>("px");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const format = customFormat(Number(width), Number(height), unit);
    const ok = [format.width, format.height].every(
      (v) => Number.isFinite(v) && v >= MIN_PX && v <= MAX_PX,
    );
    if (!ok) return setError(t("invalidSize", { min: MIN_PX, max: MAX_PX }));
    setError(null);
    void create(format);
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl surface-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2">
          <Ruler className="size-4" />
        </span>
        <h3 className="font-semibold">{t("custom")}</h3>
      </div>
      <div className="grid grid-cols-[1fr_1fr_6.5rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="custom-width">{t("width")}</Label>
          <Input
            id="custom-width"
            inputMode="decimal"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="custom-height">{t("height")}</Label>
          <Input
            id="custom-height"
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="custom-unit">{t("unit")}</Label>
          <Select value={unit} onValueChange={(v) => setUnit(v as SizeUnit)}>
            <SelectTrigger id="custom-unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["px", "mm", "cm", "in"] as const).map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={creating}>
        {t("createCustom")}
      </Button>
    </form>
  );
}

export function CreateDesignDialog({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();
  const { create, creating } = useCreateDesign();
  const [category, setCategory] = useState<FormatCategory | "all">("all");
  const presets = FORMAT_PRESETS.filter((p) => category === "all" || p.category === category);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button variant="brand" size="sm" data-testid="create-design-compact">
            <Plus /> <span className="hidden sm:inline">{t("home.createShort")}</span>
          </Button>
        ) : (
          <Button variant="brand" size="xl" data-testid="create-design">
            <Plus /> {t("home.createDesign")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-xl">{t("createDialog.title")}</DialogTitle>
          <DialogDescription>{t("createDialog.description")}</DialogDescription>
          <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  category === c
                    ? "border-transparent bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {c === "all" ? t("createDialog.all") : t(`createDialog.categories.${c}`)}
              </button>
            ))}
          </div>
        </DialogHeader>
        <div className="max-h-[calc(88dvh-9.5rem)] space-y-6 overflow-y-auto bg-background/60 p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {presets.map((preset, i) => (
              <FormatCard
                key={preset.id}
                preset={preset}
                skin={i}
                compact
                disabled={creating}
                onCreate={() => void create(formatFromPreset(preset))}
              />
            ))}
          </div>
          <CustomSizeForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
