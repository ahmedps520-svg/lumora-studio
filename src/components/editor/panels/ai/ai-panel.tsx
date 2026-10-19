"use client";

import { MessageSquareText, Palette, PenLine, Wand2, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AiChecking, AiSetupCard, SpendMeter } from "@/components/ai/ai-bits";
import { useAiReady } from "@/components/ai/hooks";
import { cn } from "@/lib/utils";
import { AssistantTab } from "./assistant-tab";
import { DesignTab } from "./design-tab";
import { PaletteTab } from "./palette-tab";
import { WriteTab } from "./write-tab";

type Tab = "assistant" | "write" | "design" | "palette";

const TABS: { id: Tab; icon: LucideIcon }[] = [
  { id: "assistant", icon: MessageSquareText },
  { id: "write", icon: PenLine },
  { id: "design", icon: Wand2 },
  { id: "palette", icon: Palette },
];

/** The AI studio in the editor's left panel: assistant chat, writing, design, colours. */
export function AiPanel() {
  const t = useTranslations("ai");
  const { ready } = useAiReady();
  const [tab, setTab] = useState<Tab>("assistant");

  if (ready === null) return <AiChecking />;
  if (!ready) return <AiSetupCard />;

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-[420px] flex-col gap-3">
      <div
        role="tablist"
        aria-label={t("panelTitle")}
        className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1"
      >
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`ai-tab-${id}`}
            onClick={() => setTab(id)}
            data-testid={`ai-tab-${id}`}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-all",
              tab === id
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4", tab === id && "text-[#F72585]")} />
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>
      <div id={`ai-tab-${tab}`} role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
        {tab === "assistant" && <AssistantTab />}
        {tab === "write" && <WriteTab />}
        {tab === "design" && <DesignTab />}
        {tab === "palette" && <PaletteTab />}
      </div>
      <SpendMeter />
    </div>
  );
}
