"use client";

import {
  ImageUp,
  Images,
  Layers,
  LayoutTemplate,
  PenLine,
  Shapes,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEditorUi, type EditorPanel } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

const ITEMS: { id: EditorPanel; icon: LucideIcon }[] = [
  { id: "ai", icon: Sparkles },
  { id: "templates", icon: LayoutTemplate },
  { id: "elements", icon: Shapes },
  { id: "photos", icon: Images },
  { id: "text", icon: Type },
  { id: "uploads", icon: ImageUp },
  { id: "draw", icon: PenLine },
  { id: "layers", icon: Layers },
];

export function LeftRail() {
  const t = useTranslations("editor.panels");
  const panel = useEditorUi((s) => s.panel);
  const togglePanel = useEditorUi((s) => s.togglePanel);

  return (
    <nav
      aria-label={t("label")}
      className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 border-e bg-card py-3"
    >
      {ITEMS.map(({ id, icon: Icon }) => {
        const active = panel === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            aria-controls={`panel-${id}`}
            onClick={() => togglePanel(id)}
            data-testid={`rail-${id}`}
            className={cn(
              "group flex w-[64px] flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl transition-all",
                active
                  ? "btn-glow text-white"
                  : "group-hover:bg-surface-2 group-focus-visible:ring-2 group-focus-visible:ring-ring",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            {t(id)}
          </button>
        );
      })}
    </nav>
  );
}
