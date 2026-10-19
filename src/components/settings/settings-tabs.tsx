"use client";

import { KeyRound, SlidersHorizontal, Sparkles, Wand2, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiSettingsSection, AiToolsSection, KeysSettingsSection } from "./ai-settings";
import { isSettingsTab, SETTINGS_TABS, type SettingsTab } from "./tabs";

const ICONS: Record<SettingsTab, LucideIcon> = {
  general: SlidersHorizontal,
  ai: Sparkles,
  tools: Wand2,
  keys: KeyRound,
};

/**
 * Settings, one topic per tab. The open tab is kept in the address (?tab=…),
 * so a reload or a shared link opens the same tab.
 */
export function SettingsTabs({ initial, general }: { initial: SettingsTab; general: ReactNode }) {
  const t = useTranslations("settings.tabs");
  const [tab, setTab] = useState<SettingsTab>(initial);

  const open = (value: string) => {
    if (!isSettingsTab(value)) return;
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <Tabs value={tab} onValueChange={open} className="gap-4">
      <TabsList className="h-auto w-full [scrollbar-width:none] justify-start gap-1 overflow-x-auto rounded-xl p-1">
        {SETTINGS_TABS.map((id) => {
          const Icon = ICONS[id];
          return (
            <TabsTrigger
              key={id}
              value={id}
              className="flex-none rounded-lg px-3 py-1.5"
              data-testid={`settings-tab-${id}`}
            >
              <Icon aria-hidden /> {t(id)}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value="general" className="space-y-4">
        {general}
      </TabsContent>
      <TabsContent value="ai">
        <AiSettingsSection />
      </TabsContent>
      <TabsContent value="tools">
        <AiToolsSection />
      </TabsContent>
      <TabsContent value="keys" className="space-y-4">
        <KeysSettingsSection />
      </TabsContent>
    </Tabs>
  );
}
