"use client";

import { Crown, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { AiError, AiSetupCard, AiShimmer, CostHint } from "@/components/ai/ai-bits";
import { DesignVariations } from "@/components/ai/design-variations";
import { PremiumRun } from "@/components/ai/premium-run";
import {
  generateVariations,
  useAiErrorMessage,
  useAiReady,
  useAiRun,
  type VariationResult,
} from "@/components/ai/hooks";
import { StylePicker } from "@/components/editor/panels/ai/design-tab";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DesignStyle } from "@/lib/ai/contract";
import type { ConvertedPage } from "@/lib/ai/design-format";
import { useAiSettings } from "@/lib/ai/settings-store";
import { createDesign, createPage } from "@/lib/document/factory";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import { saveDesign } from "@/lib/storage/designs";

const SIZES = [
  "instagramPost",
  "instagramStory",
  "presentation16x9",
  "youtubeThumbnail",
  "poster",
  "a4",
  "invitation",
  "logo",
];

/** Dashboard "Describe what you want to make…" → full, editable designs. */
export function MagicDesignBox() {
  const t = useTranslations();
  const router = useRouter();
  const { ready } = useAiReady();
  const errorMessage = useAiErrorMessage();
  const defaultStyle = useAiSettings((s) => s.defaultStyle);
  const variations = useAiSettings((s) => s.designVariations);
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState("instagramPost");
  const [style, setStyle] = useState<DesignStyle | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<VariationResult[]>([]);
  const [premium, setPremium] = useState(true);
  const [premiumRun, setPremiumRun] = useState(0);
  const tp = useTranslations("ai.premium");
  const preset = getPreset(presetId)!;
  const format = formatFromPreset(preset);
  const activeStyle = style ?? defaultStyle;

  const { run, loading, error } = useAiRun((signal) =>
    generateVariations(
      { prompt, format, style: activeStyle, count: variations },
      signal,
      errorMessage,
    ),
  );

  const generate = async () => {
    setResults([]);
    setOpen(true);
    if (!ready) return;
    if (premium) {
      setPremiumRun((n) => n + 1);
      return;
    }
    const out = await run();
    if (out) setResults(out);
  };

  const openPage = async (content: ConvertedPage) => {
    try {
      const brief = prompt.trim().slice(0, 60);
      const name = brief
        ? brief.charAt(0).toLocaleUpperCase() + brief.slice(1)
        : t(`formats.${presetId}` as never);
      const design = createDesign({
        name,
        format,
        pages: [createPage({ background: content.background, elements: content.elements })],
      });
      await saveDesign(design);
      router.push(`/editor/${design.id}`);
    } catch (e) {
      console.error(e);
      toast.error(t("home.storageError"));
    }
  };

  const use = async (index: number) => {
    const item = results[index];
    if (item?.ok) await openPage(item.result.page);
  };

  return (
    <div className="lumen rounded-3xl surface-lit p-2.5" data-testid="magic-design-box">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (prompt.trim().length >= 3) void generate();
        }}
      >
        <div className="flex items-start gap-3 rounded-2xl bg-card/70 p-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl btn-glow">
            <Sparkles className="size-4" />
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (prompt.trim().length >= 3) void generate();
              }
            }}
            rows={2}
            maxLength={1_500}
            aria-label={t("home.magic.title")}
            placeholder={t("home.magic.placeholder")}
            className="min-h-[3.25rem] w-full resize-none bg-transparent pt-1.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
            data-testid="magic-home-prompt"
          />
        </div>
        <div className="hidden px-1.5 pt-3 sm:block">
          <StylePicker value={activeStyle} onChange={setStyle} />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1.5 pt-2.5 pb-1">
          <Select value={presetId} onValueChange={setPresetId}>
            <SelectTrigger
              size="sm"
              aria-label={t("home.magic.size")}
              className="h-8 w-auto rounded-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((id) => (
                <SelectItem key={id} value={id}>
                  {t(`formats.${id}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label
            className="flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium"
            title={tp("toggleHint")}
          >
            <Crown className="size-3.5 text-amber-500" aria-hidden />
            {tp("toggle")}
            <Switch
              checked={premium}
              onCheckedChange={setPremium}
              className="scale-90"
              data-testid="home-premium-toggle"
            />
          </label>
          <div className="ms-auto flex items-center gap-2">
            {ready && !premium && (
              <CostHint task="design" chars={prompt.length} runs={variations} />
            )}
            <Button
              type="submit"
              variant="brand"
              size="sm"
              disabled={prompt.trim().length < 3 || loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {t("home.magic.generate")}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-[#F72585]" /> {t("ai.design.title")}
            </DialogTitle>
            <DialogDescription>
              {premium
                ? tp("toggleHint")
                : loading
                  ? t("ai.design.generating")
                  : t("ai.design.pick")}
            </DialogDescription>
          </DialogHeader>
          {ready === false && <AiSetupCard />}
          {ready && premium && premiumRun > 0 && (
            <div className="mx-auto w-full max-w-xl">
              <PremiumRun
                key={premiumRun}
                autoStart
                prompt={prompt}
                format={format}
                style={activeStyle}
                onUse={(page) => void openPage(page)}
              />
            </div>
          )}
          {error && <AiError message={error} />}
          {loading && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: variations }, (_, i) => (
                <AiShimmer key={i} className="aspect-[4/5]" />
              ))}
            </div>
          )}
          {!loading && results.length > 0 && (
            <DesignVariations
              results={results}
              format={format}
              columns={3}
              onUse={(i) => void use(i)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
