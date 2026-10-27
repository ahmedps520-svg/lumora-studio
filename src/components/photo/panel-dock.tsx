"use client";

import { ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { get, type PanelId, set, usePhoto } from "@/lib/photo/store";
import { cn } from "@/lib/utils";
import { PANEL_GROUPS, togglePanel } from "./commands";
import { LayersPanel } from "./panels/layers-panel";
import { PathsPanel } from "./panels/paths-panel";
import { PropertiesPanel } from "./panels/properties-panel";
import {
  AdjustmentsPanel,
  CharacterPanel,
  ColorPanel,
  HistogramPanel,
  HistoryPanel,
  InfoPanel,
  NavigatorPanel,
  SwatchesPanel,
} from "./panels/small-panels";

const CONTENT: Record<PanelId, () => ReactNode> = {
  navigator: () => <NavigatorPanel />,
  histogram: () => <HistogramPanel />,
  info: () => <InfoPanel />,
  color: () => <ColorPanel />,
  swatches: () => <SwatchesPanel />,
  character: () => <CharacterPanel />,
  properties: () => <PropertiesPanel />,
  adjustments: () => <AdjustmentsPanel />,
  history: () => <HistoryPanel />,
  layers: () => <LayersPanel />,
  paths: () => <PathsPanel />,
};

/** One group of panels shown as tabs (like a classic photo-editor dock). */
function PanelGroup({ id, panels }: { id: string; panels: PanelId[] }) {
  const t = useTranslations("photo");
  const all = usePhoto((s) => s.panels);
  const enabled = panels.filter((p) => all[p]);
  const chosen = usePhoto((s) => s.panelTabs[id]);
  const [open, setOpen] = useState(true);
  if (!enabled.length) return null;
  const active = chosen && enabled.includes(chosen) ? chosen : enabled[0]!;
  const grow = id === "bottom";

  return (
    <section
      data-testid={`panel-group-${id}`}
      className={cn("flex shrink-0 flex-col border-b", grow && open && "min-h-64 flex-1 shrink")}
    >
      <header className="flex h-8 shrink-0 items-stretch bg-surface-2/70 pe-1">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? t("collapse") : t("expand")}
          onClick={() => setOpen(!open)}
          className="flex w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", !open && "-rotate-90 rtl:rotate-90")}
          />
        </button>
        <div role="tablist" className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
          {enabled.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === active}
              data-testid={`panel-tab-${p}`}
              onClick={() => {
                set({ panelTabs: { ...get().panelTabs, [id]: p } });
                setOpen(true);
              }}
              className={cn(
                "border-b-2 border-transparent px-2 text-[11px] font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground",
                p === active && "border-primary text-foreground",
              )}
            >
              {t(`panels.${p}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={t("closePanel")}
          title={t("closePanel")}
          onClick={() => togglePanel(active)}
          className="my-auto rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </header>
      {open && (
        <div
          role="tabpanel"
          data-testid={`panel-${active}`}
          className={cn(grow ? "flex min-h-0 flex-1 flex-col" : "max-h-[34vh] overflow-y-auto")}
        >
          {CONTENT[active]()}
        </div>
      )}
    </section>
  );
}

export function PanelDock() {
  const t = useTranslations("photo");
  const any = usePhoto((s) => Object.values(s.panels).some(Boolean));
  return (
    <aside
      aria-label={t("panelsLabel")}
      data-tour="panels"
      className="flex w-72 shrink-0 flex-col overflow-y-auto border-s bg-card/80"
    >
      {PANEL_GROUPS.map((g) => (
        <PanelGroup key={g.id} id={g.id} panels={g.panels} />
      ))}
      {!any && <p className="p-4 text-xs text-muted-foreground">{t("noPanels")}</p>}
    </aside>
  );
}
