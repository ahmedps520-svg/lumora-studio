"use client";

import { Check, Copy, Plus, RefreshCw, Wand2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AiError, AiShimmer, CostHint } from "@/components/ai/ai-bits";
import { useAiRun } from "@/components/ai/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { aiWrite } from "@/lib/ai/api";
import { TONES, type Tone, type WriteAction } from "@/lib/ai/contract";
import { useAiSettings } from "@/lib/ai/settings-store";
import { LANGUAGE_CODES, languageName } from "@/lib/languages";
import { createText } from "@/lib/document/factory";
import { plainText } from "@/lib/document/text";
import { findElement } from "@/lib/document/tree";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";

const QUICK_ACTIONS: WriteAction[] = [
  "rewrite",
  "shorten",
  "expand",
  "fix",
  "simplify",
  "headlines",
  "caption",
  "hashtags",
  "cta",
  "continue",
  "emojify",
];

export function WriteTab() {
  const t = useTranslations("ai.write");
  const tTones = useTranslations("settings.ai.tones");
  const locale = useLocale();
  const writeCount = useAiSettings((s) => s.writeCount);
  const page = useEditorStore(selectCurrentPage);
  const selection = useEditorStore((s) => s.selection);
  const format = useEditorStore((s) => s.design?.format);
  const selected = selection.length === 1 && page ? findElement(page, selection[0]!) : undefined;
  const textElement = selected?.type === "text" ? selected : undefined;
  const sourceText = textElement ? plainText(textElement) : "";

  const [instruction, setInstruction] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [language, setLanguage] = useState<string>(locale === "ar" ? "en" : "ar");
  const [results, setResults] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<WriteAction | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [usedIndex, setUsedIndex] = useState<number | null>(null);

  const { run, loading, error } = useAiRun(async (signal, action: WriteAction) =>
    aiWrite(
      {
        action,
        text: action === "write" ? "" : sourceText,
        instruction: action === "write" ? prompt : instruction,
        targetTone: action === "tone" ? tone : undefined,
        targetLanguage: action === "translate" ? languageName(language, "en") : undefined,
        count: writeCount,
      },
      signal,
    ),
  );

  const go = async (action: WriteAction) => {
    setLastAction(action);
    setUsedIndex(null);
    const response = await run(action);
    if (response) setResults(response.results);
  };

  const addToPage = (text: string) => {
    if (!format) return;
    editorActions.addElements([createText("body", format, { runs: [{ text, style: {} }] })]);
  };

  return (
    <div className="space-y-4">
      {textElement ? (
        <section className="space-y-3">
          <div className="rounded-xl surface-card p-3">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {t("selected")}
            </p>
            <p className="mt-1 line-clamp-3 text-sm" dir="auto">
              {sourceText}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void go(action)}
                className="justify-start"
                data-testid={`write-${action}`}
              >
                {t(`actions.${action}`)}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-1.5">
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger size="sm" aria-label={t("tone")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.filter((x) => x !== "auto").map((x) => (
                  <SelectItem key={x} value={x}>
                    {tTones(x)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => void go("tone")}>
              {t("actions.tone")}
            </Button>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger size="sm" aria-label={t("language")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {languageName(code, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void go("translate")}
            >
              {t("actions.translate")}
            </Button>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="write-instruction">
              {t("instruction")}
            </label>
            <Input
              id="write-instruction"
              value={instruction}
              maxLength={600}
              placeholder={t("instructionPlaceholder")}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </div>
          <CostHint task="write" chars={sourceText.length + instruction.length} />
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("selectText")}</p>
          <label className="text-sm font-medium" htmlFor="write-prompt">
            {t("newPrompt")}
          </label>
          <Textarea
            id="write-prompt"
            value={prompt}
            rows={3}
            maxLength={600}
            placeholder={t("newPlaceholder")}
            onChange={(e) => setPrompt(e.target.value)}
            className="resize-none rounded-xl"
          />
          <div className="flex items-center justify-between gap-2">
            <CostHint task="write" chars={prompt.length} />
            <Button
              variant="brand"
              size="sm"
              disabled={!prompt.trim() || loading}
              onClick={() => void go("write")}
            >
              <Wand2 /> {t("generate")}
            </Button>
          </div>
        </section>
      )}

      {error && <AiError message={error} />}

      {(loading || results.length > 0) && (
        <section className="space-y-2" aria-live="polite">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {t("results")}
            </h3>
            {lastAction && !loading && (
              <Button variant="ghost" size="xs" onClick={() => void go(lastAction)}>
                <RefreshCw /> {t("regenerate")}
              </Button>
            )}
          </div>
          {loading
            ? Array.from({ length: Math.min(writeCount, 3) }, (_, i) => (
                <AiShimmer key={i} className="h-16" />
              ))
            : results.map((result, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-xl surface-card p-3"
                  data-testid="write-result"
                >
                  <p className="text-sm whitespace-pre-wrap" dir="auto">
                    {result}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {textElement ? (
                      <Button
                        size="xs"
                        variant={usedIndex === index ? "secondary" : "default"}
                        onClick={() => {
                          editorActions.setTextContent(textElement.id, result);
                          setUsedIndex(index);
                        }}
                      >
                        {usedIndex === index && <Check />} {t("apply")}
                      </Button>
                    ) : (
                      <Button size="xs" onClick={() => addToPage(result)}>
                        <Plus /> {t("addAsText")}
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard?.writeText(result);
                        setCopied(index);
                        setTimeout(() => setCopied(null), 1_500);
                      }}
                    >
                      {copied === index ? <Check /> : <Copy />}{" "}
                      {copied === index ? t("copied") : t("copy")}
                    </Button>
                  </div>
                </div>
              ))}
        </section>
      )}
    </div>
  );
}
