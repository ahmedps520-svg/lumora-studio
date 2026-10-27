"use client";

import { ArrowLeftRight, SquareDashedMousePointer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { set, TOOL_GROUPS, usePhoto } from "@/lib/photo/store";
import { selectTool, toggleQuickMask } from "@/lib/photo/tools";
import { cn } from "@/lib/utils";
import { TOOL_ICONS } from "./tool-icons";

function ToolGroupButton({ group }: { group: (typeof TOOL_GROUPS)[number] }) {
  const t = useTranslations("photo.tools");
  const shown = usePhoto((s) => s.groupTool[group.id] ?? group.tools[0]!);
  const active = usePhoto((s) => group.tools.includes(s.tool));
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICONS[shown];
  const many = group.tools.length > 1;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${t(shown)} (${group.key})`}
              aria-pressed={active}
              data-testid={`tool-${shown}`}
              onPointerDown={(e) => {
                // Radix opens menus on pointer down; we only open the flyout on demand.
                if (e.button === 0) e.preventDefault();
              }}
              onClick={() => {
                if (active && many) setOpen(true);
                else selectTool(shown);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (many) setOpen(true);
              }}
              className={cn(
                "relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
              )}
            >
              <Icon className="size-[18px]" />
              {many && (
                <span
                  aria-hidden
                  className="absolute end-1 bottom-1 size-1.5 bg-current opacity-60 [clip-path:polygon(100%_0,100%_100%,0_100%)] rtl:[clip-path:polygon(0_0,100%_100%,0_100%)]"
                />
              )}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t(shown)} <kbd className="ms-1 opacity-70">{group.key}</kbd>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="start" className="min-w-52">
        {group.tools.map((tool) => {
          const ToolIcon = TOOL_ICONS[tool];
          return (
            <DropdownMenuItem
              key={tool}
              onSelect={() => selectTool(tool)}
              data-testid={`tool-${tool}`}
            >
              <ToolIcon />
              {t(tool)}
              <DropdownMenuShortcut className="ms-auto">{group.key}</DropdownMenuShortcut>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColorChips() {
  const t = useTranslations("photo");
  const fg = usePhoto((s) => s.fg);
  const bg = usePhoto((s) => s.bg);
  return (
    <div className="relative mt-1 h-14 w-12" data-tour="colors">
      <label
        className="absolute start-1.5 top-1 z-10 size-7 cursor-pointer rounded-md border-2 border-white shadow-md ring-1 ring-black/30"
        style={{ background: fg }}
        title={t("foreground")}
      >
        <input
          type="color"
          aria-label={t("foreground")}
          value={fg.toLowerCase()}
          onChange={(e) => set({ fg: e.target.value.toUpperCase() })}
          className="sr-only"
        />
      </label>
      <label
        className="absolute end-1.5 top-5 size-7 cursor-pointer rounded-md border-2 border-white shadow-md ring-1 ring-black/30"
        style={{ background: bg }}
        title={t("background")}
      >
        <input
          type="color"
          aria-label={t("background")}
          value={bg.toLowerCase()}
          onChange={(e) => set({ bg: e.target.value.toUpperCase() })}
          className="sr-only"
        />
      </label>
      <button
        type="button"
        aria-label={`${t("swapColors")} (X)`}
        title={`${t("swapColors")} (X)`}
        onClick={() => set({ fg: bg, bg: fg })}
        className="absolute end-0.5 top-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftRight className="size-3" />
      </button>
      <button
        type="button"
        aria-label={`${t("defaultColors")} (D)`}
        title={`${t("defaultColors")} (D)`}
        onClick={() => set({ fg: "#000000", bg: "#FFFFFF" })}
        className="absolute start-0.5 bottom-0 flex size-3.5 items-center justify-center"
      >
        <span className="absolute start-0 top-0 size-2.5 border border-white bg-black" />
        <span className="absolute end-0 bottom-0 size-2.5 border border-black bg-white" />
      </button>
    </div>
  );
}

export function Toolbar() {
  const t = useTranslations("photo");
  const quickMask = usePhoto((s) => s.quickMask);
  return (
    <nav
      aria-label={t("toolbar")}
      data-tour="toolbar"
      className="flex w-12 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-e bg-card/80 py-2"
    >
      {TOOL_GROUPS.map((g, i) => (
        <div key={g.id} className="contents">
          {[1, 6, 11, 14, 16].includes(i) && <span className="my-1 h-px w-7 bg-border" />}
          <ToolGroupButton group={g} />
        </div>
      ))}
      <span className="my-1 h-px w-7 bg-border" />
      <ColorChips />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${t("quickMask")} (Q)`}
            data-tour="quickmask"
            aria-pressed={quickMask}
            onClick={toggleQuickMask}
            className={cn(
              "mt-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground",
              quickMask && "bg-destructive/15 text-destructive",
            )}
          >
            <SquareDashedMousePointer className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t("quickMask")} <kbd className="ms-1 opacity-70">Q</kbd>
        </TooltipContent>
      </Tooltip>
    </nav>
  );
}
