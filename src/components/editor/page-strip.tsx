"use client";

import { ArrowLeft, ArrowRight, Copy, FilePlus2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Format, Page } from "@/lib/schema";
import { useEditorStore } from "@/lib/store/editor-store";
import { pageActions } from "@/lib/store/page-actions";
import { cn } from "@/lib/utils";
import { ContextItems, DropdownItems, type MenuItemSpec } from "./menu-items";
import { usePageThumbnail } from "./use-page-thumbnail";

/** The commands for one page (shared by its "…" menu and right-click menu). */
export function usePageMenu(pageId: string, index: number, count: number): MenuItemSpec[] {
  const t = useTranslations("editor.pages");
  return [
    {
      id: "page-add",
      label: t("addAfter"),
      icon: FilePlus2,
      shortcut: "Ctrl+↵",
      onSelect: () => pageActions.addPage(pageId),
    },
    {
      id: "page-duplicate",
      label: t("duplicate"),
      icon: Copy,
      onSelect: () => pageActions.duplicatePage(pageId),
    },
    {
      id: "page-left",
      label: t("moveLeft"),
      icon: ArrowLeft,
      disabled: index === 0,
      separator: true,
      onSelect: () => pageActions.movePage(pageId, index - 1),
    },
    {
      id: "page-right",
      label: t("moveRight"),
      icon: ArrowRight,
      disabled: index >= count - 1,
      onSelect: () => pageActions.movePage(pageId, index + 1),
    },
    {
      id: "page-delete",
      label: count > 1 ? t("delete") : t("clear"),
      icon: Trash2,
      destructive: true,
      separator: true,
      onSelect: () => pageActions.deletePage(pageId),
    },
  ];
}

function PageThumb({
  page,
  index,
  count,
  format,
  active,
  onDragStart,
  onDrop,
}: {
  page: Page;
  index: number;
  count: number;
  format: Format;
  active: boolean;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const t = useTranslations("editor.pages");
  const url = usePageThumbnail(page, format);
  const menu = usePageMenu(page.id, index, count);
  const [over, setOver] = useState(false);
  const label = page.name || t("page", { number: index + 1 });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <li
          className="group relative shrink-0"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            onDrop();
          }}
          data-testid="page-thumb"
        >
          <button
            type="button"
            onClick={() => useEditorStore.getState().setPage(page.id)}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={label}
            className={cn(
              "block h-[72px] overflow-hidden rounded-lg bg-white ring-2 transition-shadow",
              active ? "ring-primary" : "ring-transparent hover:ring-border",
              over && "ring-primary/60",
            )}
            style={{ aspectRatio: `${format.width} / ${format.height}` }}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element -- generated preview
              <img src={url} alt="" className="size-full object-cover" draggable={false} />
            )}
          </button>
          <span className="pointer-events-none absolute start-1.5 bottom-1 rounded bg-black/55 px-1.5 text-[10px] font-semibold text-white tabular-nums">
            {index + 1}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={t("options", { number: index + 1 })}
                className="absolute end-1 top-1 size-6 opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownItems items={menu} />
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextItems items={menu} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Horizontal strip of all pages: click to open, drag to reorder, + to add. */
export function PageStrip() {
  const t = useTranslations("editor.pages");
  const pages = useEditorStore((s) => s.design?.pages);
  const format = useEditorStore((s) => s.design?.format);
  const pageId = useEditorStore((s) => s.pageId);
  const [dragging, setDragging] = useState<string | null>(null);
  if (!pages || !format) return null;

  return (
    <div
      className="pointer-events-auto max-w-[min(100%,56rem)] rounded-2xl surface-glass p-2"
      role="region"
      aria-label={t("title")}
      data-testid="page-strip"
    >
      <ul className="flex items-center gap-2 overflow-x-auto p-1">
        {pages.map((page, index) => (
          <PageThumb
            key={page.id}
            page={page}
            index={index}
            count={pages.length}
            format={format}
            active={page.id === pageId}
            onDragStart={() => setDragging(page.id)}
            onDrop={() => {
              if (dragging && dragging !== page.id) pageActions.movePage(dragging, index);
              setDragging(null);
            }}
          />
        ))}
        <li className="shrink-0">
          <Button
            variant="outline"
            className="h-[72px] w-14 border-dashed"
            aria-label={t("add")}
            title={t("add")}
            onClick={() => pageActions.addPage(pages.at(-1)?.id)}
            data-testid="page-add"
          >
            <Plus />
          </Button>
        </li>
      </ul>
    </div>
  );
}
