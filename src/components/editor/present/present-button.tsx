"use client";

import { ChevronDown, MonitorPlay, Play, Presentation, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditorStore } from "@/lib/store/editor-store";
import { useEditorUi, type PresentMode } from "@/lib/store/ui-store";

/** Starts a show from the open page (or from the first page). */
export function startPresenting(mode: PresentMode, fromStart = false) {
  const { design, pageId } = useEditorStore.getState();
  if (!design) return;
  const index = fromStart
    ? 0
    : Math.max(
        0,
        design.pages.findIndex((p) => p.id === pageId),
      );
  useEditorUi.getState().present(mode, index);
}

export function PresentButton() {
  const t = useTranslations("editor.present");
  return (
    <div className="flex items-center">
      <Button
        variant="secondary"
        size="sm"
        className="rounded-e-none"
        onClick={() => startPresenting("fullscreen")}
        data-testid="present-button"
      >
        <Play /> <span className="hidden md:inline">{t("button")}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-s-none border-s border-border/60 px-1.5"
            aria-label={t("options")}
            data-testid="present-menu"
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => startPresenting("fullscreen")}>
            <Play /> {t("modes.fullscreen")}
            <DropdownMenuShortcut>Ctrl+Alt+P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => startPresenting("presenter")}>
            <MonitorPlay /> {t("modes.presenter")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => startPresenting("autoplay")}>
            <Repeat /> {t("modes.autoplay")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => startPresenting("fullscreen", true)}>
            <Presentation /> {t("fromStart")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
