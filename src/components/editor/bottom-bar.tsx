"use client";

import {
  ChevronLeft,
  ChevronRight,
  LayoutPanelTop,
  Maximize,
  Minus,
  MoveHorizontal,
  NotebookPen,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";
import { pageActions } from "@/lib/store/page-actions";
import { useEditorUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { PageStrip } from "./page-strip";

const PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8];

function IconButton({
  label,
  onClick,
  children,
  disabled,
  pressed,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  pressed?: boolean;
  testId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className={cn(pressed && "bg-accent text-accent-foreground")}
          data-testid={testId}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Speaker notes for the open page (shown in presenter view). */
function NotesButton() {
  const t = useTranslations("editor.pages");
  const page = useEditorStore(selectCurrentPage);
  if (!page) return null;
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("notes")}
              className={cn(page.notes && "text-primary")}
              data-testid="notes-button"
            >
              <NotebookPen />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("notes")}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" className="w-80 space-y-2">
        <p className="text-sm font-medium">{t("notes")}</p>
        <Textarea
          key={page.id}
          defaultValue={page.notes}
          onChange={(e) => pageActions.setNotes(page.id, e.target.value)}
          placeholder={t("notesPlaceholder")}
          rows={6}
          dir="auto"
          className="resize-none"
          data-testid="notes-input"
        />
      </PopoverContent>
    </Popover>
  );
}

export function BottomBar() {
  const t = useTranslations("editor.zoom");
  const tp = useTranslations("editor.pages");
  const zoom = useEditorStore((s) => s.zoom);
  const pageCount = useEditorStore((s) => s.design?.pages.length ?? 1);
  const pageIndex = useEditorStore((s) =>
    Math.max(0, s.design?.pages.findIndex((p) => p.id === s.pageId) ?? 0),
  );
  const engine = useEditorUi((s) => s.engine);
  const pagesOpen = useEditorUi((s) => s.pagesOpen);
  const setPagesOpen = useEditorUi((s) => s.setPagesOpen);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3">
      {pagesOpen && <PageStrip />}
      <div className="pointer-events-auto flex items-center gap-1 rounded-full surface-glass px-2 py-1">
        <NotesButton />
        <div className="mx-1 h-5 w-px bg-border" />
        <IconButton
          label={tp("previous")}
          disabled={pageIndex === 0}
          onClick={() => pageActions.step(-1)}
        >
          <ChevronLeft className="rtl:-scale-x-100" />
        </IconButton>
        <span
          className="px-1 text-xs text-muted-foreground tabular-nums"
          data-testid="page-indicator"
        >
          {t("page", { current: pageIndex + 1, total: pageCount })}
        </span>
        <IconButton
          label={tp("next")}
          disabled={pageIndex >= pageCount - 1}
          onClick={() => pageActions.step(1)}
        >
          <ChevronRight className="rtl:-scale-x-100" />
        </IconButton>
        <IconButton
          label={pagesOpen ? tp("hidePages") : tp("showPages")}
          pressed={pagesOpen}
          onClick={() => setPagesOpen(!pagesOpen)}
          testId="pages-toggle"
        >
          <LayoutPanelTop />
        </IconButton>
        <IconButton label={tp("add")} onClick={() => pageActions.addPage()} testId="page-add-quick">
          <Plus />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <IconButton label={`${t("out")} (Ctrl −)`} onClick={() => engine?.zoomOut()}>
          <Minus />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="min-w-16 tabular-nums"
              aria-label={t("label")}
              data-testid="zoom-level"
            >
              {Math.round(zoom * 100)}%
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem onSelect={() => engine?.fit()}>
              <Maximize /> {t("fit")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => engine?.fill()}>
              <MoveHorizontal /> {t("fill")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {PRESETS.map((z) => (
              <DropdownMenuItem
                key={z}
                onSelect={() => engine?.setZoom(z)}
                className="tabular-nums"
              >
                {Math.round(z * 100)}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton label={`${t("in")} (Ctrl +)`} onClick={() => engine?.zoomIn()}>
          <Plus />
        </IconButton>
      </div>
    </div>
  );
}
