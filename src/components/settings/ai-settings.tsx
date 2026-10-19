"use client";

import {
  CheckCircle2,
  CircleDashed,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAiReady, useLedger, useMounted } from "@/components/ai/hooks";
import { CountPicker, StylePicker } from "@/components/editor/panels/ai/design-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { testApiKey, testGoogleKey } from "@/lib/ai/api";
import { CREATIVITY, TONES, type Creativity, type Tone } from "@/lib/ai/contract";
import { formatUsd } from "@/lib/ai/cost";
import { AI_QUALITIES, MODEL_IDS, MODEL_LABELS, PRICING, type AiQuality } from "@/lib/ai/models";
import { useAiSettings } from "@/lib/ai/settings-store";
import { BACKGROUND_MODELS, type BackgroundModel } from "@/lib/background/protocol";
import { LANGUAGE_CODES, languageName } from "@/lib/languages";
import { cn } from "@/lib/utils";

export function Card({
  title,
  children,
  id,
  aside,
}: {
  title: string;
  children: ReactNode;
  id?: string;
  /** Shown at the end of the title row (a status badge, a reset button…). */
  aside?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 rounded-2xl surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-start sm:gap-6">
      <div>
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const QUALITY_MODELS: Record<AiQuality, string[]> = {
  fast: [MODEL_IDS.haiku],
  balanced: [MODEL_IDS.haiku, MODEL_IDS.sonnet],
  best: [MODEL_IDS.opus],
};

/** "Test key", "Remove" and the result, under a key field. */
function KeyTestRow({
  value,
  test,
  onRemove,
  testId,
}: {
  value: string;
  test: (key: string) => Promise<{ ok: boolean }>;
  onRemove: () => void;
  testId: string;
}) {
  const t = useTranslations("settings.ai");
  const [testing, setTesting] = useState(false);
  // The result belongs to the key that was tested (editing the key clears it).
  const [result, setResult] = useState<{ key: string; ok: boolean } | null>(null);
  const shown = result?.key === value ? result : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!value || testing}
        data-testid={`${testId}-test`}
        onClick={async () => {
          setTesting(true);
          const r = await test(value);
          setResult({ key: value, ok: r.ok });
          setTesting(false);
        }}
      >
        {testing && <Loader2 className="animate-spin" />}
        {testing ? t("testing") : t("test")}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {t("remove")}
        </Button>
      )}
      {shown?.ok === true && (
        <span className="flex items-center gap-1 text-sm text-success" data-testid={`${testId}-ok`}>
          <CheckCircle2 className="size-4" /> {t("keyOk")}
        </span>
      )}
      {shown?.ok === false && (
        <span
          className="flex items-center gap-1 text-sm text-destructive"
          data-testid={`${testId}-bad`}
        >
          <XCircle className="size-4" /> {t("keyBad")}
        </span>
      )}
    </div>
  );
}

function ApiKeyField() {
  const t = useTranslations("settings.ai");
  const apiKey = useAiSettings((s) => s.apiKey);
  const update = useAiSettings((s) => s.update);
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="api-key"
            type={visible ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            value={apiKey}
            placeholder={t("apiKeyPlaceholder")}
            onChange={(e) => update({ apiKey: e.target.value.trim() })}
            className="ps-9 font-mono"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={visible ? t("hide") : t("show")}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      <KeyTestRow
        value={apiKey}
        test={testApiKey}
        onRemove={() => update({ apiKey: "" })}
        testId="api-key"
      />
      <a
        href="https://console.anthropic.com/settings/keys"
        target="_blank"
        rel="noreferrer noopener"
        className="inline-block text-xs text-primary underline-offset-4 hover:underline"
      >
        {t("getKey")}
      </a>
    </div>
  );
}

/** Bring-your-own Google AI key for Premium artwork (kept in this browser only). */
function GoogleKeyField() {
  const t = useTranslations("settings.ai");
  const googleKey = useAiSettings((s) => s.googleKey);
  const update = useAiSettings((s) => s.update);
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="google-key"
            type={visible ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            value={googleKey}
            placeholder={t("googleKeyPlaceholder")}
            onChange={(e) => update({ googleKey: e.target.value.trim() })}
            className="ps-9 font-mono"
            data-testid="google-key"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={visible ? t("hide") : t("show")}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      <KeyTestRow
        value={googleKey}
        test={testGoogleKey}
        onRemove={() => update({ googleKey: "" })}
        testId="google-key"
      />
      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noreferrer noopener"
        className="inline-block text-xs text-primary underline-offset-4 hover:underline"
      >
        {t("getGoogleKey")}
      </a>
    </div>
  );
}

function PremiumSettings() {
  const t = useTranslations("settings.ai");
  const premiumArt = useAiSettings((s) => s.premiumArt);
  const premiumReviews = useAiSettings((s) => s.premiumReviews);
  const update = useAiSettings((s) => s.update);
  return (
    <Card title={t("premium")}>
      <Row label={t("googleKey")} hint={t("googleKeyHint")} htmlFor="google-key">
        <GoogleKeyField />
      </Row>
      <Row label={t("premiumArt")} htmlFor="premium-art">
        <Select
          value={premiumArt}
          onValueChange={(v) => update({ premiumArt: v as "standard" | "pro" })}
        >
          <SelectTrigger id="premium-art" className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["standard", "pro"] as const).map((id) => (
              <SelectItem key={id} value={id}>
                {t(`premiumArtOptions.${id}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label={t("premiumReviews")} hint={t("premiumReviewsHint")}>
        <div className="inline-flex rounded-lg border bg-surface-2/60 p-0.5">
          {([0, 1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={premiumReviews === n}
              onClick={() => update({ premiumReviews: n })}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                premiumReviews === n
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("premiumReviewsValue", { count: n })}
            </button>
          ))}
        </div>
      </Row>
    </Card>
  );
}

/** Mounted-only wrapper: settings live in this browser, so the server can't render them. */
function Mounted({ children, height }: { children: ReactNode; height: number }) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="rounded-2xl" style={{ height }} />;
  return <>{children}</>;
}

/** AI tab: connection, quality and how Claude writes. */
export function AiSettingsSection() {
  return (
    <Mounted height={640}>
      <AiPreferences />
    </Mounted>
  );
}

function AiPreferences() {
  const t = useTranslations("settings.ai");
  const locale = useLocale();
  const settings = useAiSettings();
  const { ready, source } = useAiReady();

  return (
    <Card
      title={t("title")}
      id="ai"
      aside={
        <span
          data-testid="ai-connection"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
            ready ? "text-success" : "text-muted-foreground",
          )}
        >
          {ready ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
          {source === "user"
            ? t("status.user")
            : source === "owner"
              ? t("status.owner")
              : t("status.none")}
        </span>
      }
    >
      <p className="-mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>

      {/* Quality */}
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("quality.label")}>
        {AI_QUALITIES.map((q) => (
          <button
            key={q}
            type="button"
            role="radio"
            aria-checked={settings.quality === q}
            onClick={() => settings.update({ quality: q })}
            data-testid={`quality-${q}`}
            className={cn(
              "rounded-xl border p-3 text-start transition-all",
              settings.quality === q
                ? "border-transparent bg-accent ring-2 ring-ring"
                : "bg-card hover:-translate-y-0.5 hover:shadow-soft",
            )}
          >
            <span className="block font-semibold">{t(`quality.${q}`)}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {t(`quality.${q}Desc`)}
            </span>
            <span className="mt-2 block space-y-0.5">
              {QUALITY_MODELS[q].map((model) => (
                <span
                  key={model}
                  className="block text-[11px] text-muted-foreground tabular-nums"
                  dir="ltr"
                >
                  {t("pricing", {
                    model: MODEL_LABELS[model as keyof typeof MODEL_LABELS],
                    input: `$${PRICING[model as keyof typeof PRICING].input}`,
                    output: `$${PRICING[model as keyof typeof PRICING].output}`,
                  })}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>

      <Row label={t("creativity.label")}>
        <div className="inline-flex rounded-xl border bg-surface-2/60 p-1">
          {CREATIVITY.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={settings.creativity === c}
              onClick={() => settings.update({ creativity: c as Creativity })}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                settings.creativity === c
                  ? "bg-card shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`creativity.${c}`)}
            </button>
          ))}
        </div>
      </Row>

      <Row label={t("tone")} htmlFor="ai-tone">
        <Select value={settings.tone} onValueChange={(v) => settings.update({ tone: v as Tone })}>
          <SelectTrigger id="ai-tone" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((tone) => (
              <SelectItem key={tone} value={tone}>
                {t(`tones.${tone}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label={t("language")} htmlFor="ai-language">
        <Select
          value={settings.language === "auto" ? "auto" : settings.language}
          onValueChange={(v) => settings.update({ language: v })}
        >
          <SelectTrigger id="ai-language" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t("languageAuto")}</SelectItem>
            {LANGUAGE_CODES.map((code) => (
              <SelectItem key={code} value={languageName(code, "en")}>
                {languageName(code, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label={t("brandVoice")} hint={t("brandVoiceHint")} htmlFor="ai-voice">
        <Textarea
          id="ai-voice"
          rows={3}
          maxLength={600}
          value={settings.brandVoice}
          onChange={(e) => settings.update({ brandVoice: e.target.value })}
          className="resize-none rounded-xl"
        />
      </Row>

      <Row label={t("audience")} hint={t("audienceHint")} htmlFor="ai-audience">
        <Input
          id="ai-audience"
          maxLength={200}
          value={settings.audience}
          onChange={(e) => settings.update({ audience: e.target.value })}
        />
      </Row>
      <ResetButton />
    </Card>
  );
}

/** "Reset to defaults" for every AI preference (keys are kept). */
function ResetButton() {
  const t = useTranslations("settings.ai");
  const settings = useAiSettings();
  return (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const { apiKey, googleKey } = settings;
          settings.reset();
          settings.update({ apiKey, googleKey });
          toast.success(t("resetDone"));
        }}
      >
        <RotateCcw /> {t("reset")}
      </Button>
    </div>
  );
}

/** Tools tab: defaults for Magic Design, Magic Write, the assistant and the background remover. */
export function AiToolsSection() {
  return (
    <Mounted height={420}>
      <AiTools />
    </Mounted>
  );
}

function AiTools() {
  const t = useTranslations("settings.ai");
  const tDesign = useTranslations("ai.design");
  const settings = useAiSettings();
  return (
    <Card title={t("tools")}>
      <Row label={t("design")}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{t("variations")}</span>
            <CountPicker
              value={settings.designVariations}
              onChange={(n) => settings.update({ designVariations: n })}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">{t("defaultStyle")}</span>
            <StylePicker
              value={settings.defaultStyle}
              onChange={(s) => settings.update({ defaultStyle: s })}
            />
          </div>
          <p className="sr-only">{tDesign("title")}</p>
        </div>
      </Row>

      <Row label={t("writing")}>
        <div className="flex items-center gap-4">
          <Slider
            aria-label={t("writeCount")}
            className="max-w-56"
            min={1}
            max={5}
            step={1}
            value={[settings.writeCount]}
            onValueChange={([v]) => v && settings.update({ writeCount: v })}
          />
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("writeCount")}: {settings.writeCount}
          </span>
        </div>
      </Row>

      <Row label={t("assistant")} hint={t("assistantAutoApplyHint")} htmlFor="ai-autoapply">
        <label className="flex items-center gap-3 text-sm">
          <Switch
            id="ai-autoapply"
            checked={settings.assistantAutoApply}
            onCheckedChange={(v) => settings.update({ assistantAutoApply: v })}
          />
          {t("assistantAutoApply")}
        </label>
      </Row>

      <Row label={t("backgroundModel")} hint={t("backgroundModelHint")} htmlFor="ai-bg-model">
        <Select
          value={settings.backgroundModel}
          onValueChange={(v) => settings.update({ backgroundModel: v as BackgroundModel })}
        >
          <SelectTrigger id="ai-bg-model" className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BACKGROUND_MODELS) as BackgroundModel[]).map((id) => (
              <SelectItem key={id} value={id}>
                {t(`backgroundModels.${id}`, { size: BACKGROUND_MODELS[id].approxMb })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
    </Card>
  );
}

/** Keys & usage tab: your own keys, spending limits and the premium design add-on. */
export function KeysSettingsSection() {
  return (
    <Mounted height={560}>
      <KeysAndUsage />
    </Mounted>
  );
}

function KeysAndUsage() {
  const t = useTranslations("settings.ai");
  const settings = useAiSettings();
  const ledger = useLedger();
  return (
    <>
      <Card title={t("keys")}>
        <Row label={t("apiKey")} hint={t("apiKeyHint")} htmlFor="api-key">
          <ApiKeyField />
        </Row>
      </Card>
      <Card title={t("costs")}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={settings.showCosts}
              onCheckedChange={(v) => settings.update({ showCosts: v })}
            />
            {t("showCosts")}
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="ai-budget">{t("dailyBudget")}</Label>
            <Input
              id="ai-budget"
              type="number"
              inputMode="decimal"
              min={0}
              max={1000}
              step={0.5}
              value={settings.dailyBudgetUsd}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0 && v <= 1_000)
                  settings.update({ dailyBudgetUsd: v });
              }}
              className="w-32 tabular-nums"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">{t("dailyBudgetHint")}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("spentToday", { spent: formatUsd(ledger.spentUsd), count: ledger.requests })}
            </p>
          </div>
        </div>
      </Card>
      <PremiumSettings />
    </>
  );
}
