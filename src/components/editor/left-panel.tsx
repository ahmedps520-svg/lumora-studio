"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorUi, type EditorPanel } from "@/lib/store/ui-store";
import { AiPanel } from "./panels/ai/ai-panel";
import { DrawPanel } from "./panels/draw-panel";
import { ElementsPanel } from "./panels/elements-panel";
import { LayersPanel } from "./panels/layers-panel";
import { PhotosPanel } from "./panels/photos-panel";
import { TemplatesPanel } from "./panels/templates-panel";
import { TextPanel } from "./panels/text-panel";
import { UploadsPanel } from "./panels/uploads-panel";

export function LeftPanel({ panel }: { panel: EditorPanel }) {
  const t = useTranslations("editor.panels");
  const setPanel = useEditorUi((s) => s.setPanel);

  return (
    <aside
      id={`panel-${panel}`}
      aria-label={t(panel)}
      className="absolute inset-y-0 start-[76px] z-20 flex w-[340px] max-w-[calc(100vw-76px)] shrink-0 flex-col border-e bg-card shadow-lifted lg:static lg:z-auto lg:shadow-none"
    >
      <div className="flex h-14 items-center justify-between px-4">
        <h2 className="text-lg font-semibold">{t(panel)}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("closePanel")}
          onClick={() => setPanel(null)}
        >
          <X />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 pb-6">
          {panel === "ai" && <AiPanel />}
          {panel === "templates" && <TemplatesPanel />}
          {panel === "elements" && <ElementsPanel />}
          {panel === "photos" && <PhotosPanel />}
          {panel === "text" && <TextPanel />}
          {panel === "uploads" && <UploadsPanel />}
          {panel === "draw" && <DrawPanel />}
          {panel === "layers" && <LayersPanel />}
        </div>
      </ScrollArea>
    </aside>
  );
}
