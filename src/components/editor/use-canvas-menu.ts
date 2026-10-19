"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eraser,
  FilePlus2,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  ImageUp,
  Images,
  Layers,
  LayoutGrid,
  Lock,
  LockOpen,
  Paintbrush,
  PaintbrushVertical,
  Pencil,
  Scissors,
  Trash2,
  Ungroup,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { removeElementBackground } from "@/lib/background/jobs";
import { findElement } from "@/lib/document/tree";
import type { Alignment } from "@/lib/document/arrange";
import type { Element } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";
import { pageActions } from "@/lib/store/page-actions";
import { useEditorUi } from "@/lib/store/ui-store";
import type { MenuItemSpec } from "./menu-items";

const ALIGN_ICONS: Record<Alignment, MenuItemSpec["icon"]> = {
  left: AlignStartVertical,
  center: AlignCenterVertical,
  right: AlignEndVertical,
  top: AlignStartHorizontal,
  middle: AlignCenterHorizontal,
  bottom: AlignEndHorizontal,
};

/**
 * The right-click menu for whatever is selected (or for the page when
 * nothing is). Also used by the layers panel.
 */
export function useCanvasMenu(): MenuItemSpec[] {
  const t = useTranslations("editor.menu");
  const tb = useTranslations("editor.background");
  const page = useEditorStore(selectCurrentPage);
  const selection = useEditorStore((s) => s.selection);
  if (!page) return [];

  const elements = selection
    .map((id) => findElement(page, id))
    .filter((e): e is Element => Boolean(e));
  const canPaste = editorActions.hasClipboard();

  if (elements.length === 0) {
    return [
      {
        id: "paste",
        label: t("paste"),
        icon: ClipboardPaste,
        shortcut: "Ctrl+V",
        disabled: !canPaste,
        onSelect: () => editorActions.paste(),
      },
      {
        id: "select-all",
        label: t("selectAll"),
        icon: LayoutGrid,
        shortcut: "Ctrl+A",
        disabled: page.elements.length === 0,
        onSelect: () => editorActions.selectAll(),
      },
      {
        id: "add-page",
        label: t("addPage"),
        icon: FilePlus2,
        shortcut: "Ctrl+↵",
        separator: true,
        onSelect: () => pageActions.addPage(),
      },
      {
        id: "duplicate-page",
        label: t("duplicatePage"),
        icon: CopyPlus,
        onSelect: () => pageActions.duplicatePage(page.id),
      },
      {
        id: "delete-page",
        label: t("deletePage"),
        icon: Trash2,
        destructive: true,
        onSelect: () => pageActions.deletePage(page.id),
      },
    ];
  }

  const single = elements.length === 1 ? elements[0]! : null;
  const allLocked = elements.every((e) => e.locked);
  const topLevel = new Set(page.elements.map((e) => e.id));
  const groupable = elements.filter((e) => topLevel.has(e.id) && !e.locked).length >= 2;
  const ungroupable = elements.some((e) => e.type === "group" && !e.locked);
  const alignments: Alignment[] = ["left", "center", "right", "top", "middle", "bottom"];

  const items: (MenuItemSpec | false | null | undefined)[] = [
    single?.type === "text" &&
      !single.locked && {
        id: "edit-text",
        label: t("editText"),
        icon: Pencil,
        shortcut: "Enter",
        onSelect: () => useEditorUi.getState().engine?.editText(single.id, false),
      },
    {
      id: "copy",
      label: t("copy"),
      icon: Copy,
      shortcut: "Ctrl+C",
      separator: true,
      onSelect: () => void editorActions.copySelection(),
    },
    {
      id: "cut",
      label: t("cut"),
      icon: Scissors,
      shortcut: "Ctrl+X",
      disabled: allLocked,
      onSelect: () => editorActions.cutSelection(),
    },
    {
      id: "paste",
      label: t("paste"),
      icon: ClipboardPaste,
      shortcut: "Ctrl+V",
      disabled: !canPaste,
      onSelect: () => editorActions.paste(),
    },
    {
      id: "duplicate",
      label: t("duplicate"),
      icon: CopyPlus,
      shortcut: "Ctrl+D",
      disabled: allLocked,
      onSelect: () => editorActions.duplicateSelection(),
    },
    {
      id: "delete",
      label: t("delete"),
      icon: Trash2,
      shortcut: "Del",
      destructive: true,
      disabled: allLocked,
      onSelect: () => editorActions.deleteSelection(),
    },
    {
      id: "copy-style",
      label: t("copyStyle"),
      icon: Paintbrush,
      shortcut: "Ctrl+Alt+C",
      separator: true,
      onSelect: () => {
        if (editorActions.copyStyle()) toast.success(t("styleCopied"));
      },
    },
    {
      id: "paste-style",
      label: t("pasteStyle"),
      icon: PaintbrushVertical,
      shortcut: "Ctrl+Alt+V",
      disabled: !editorActions.hasCopiedStyle() || allLocked,
      onSelect: () => editorActions.pasteStyle(),
    },
    {
      id: "layer",
      label: t("layer"),
      icon: Layers,
      separator: true,
      items: [
        {
          id: "front",
          label: t("front"),
          icon: ArrowUpToLine,
          shortcut: "Ctrl+Shift+]",
          onSelect: () => editorActions.reorderSelection("front"),
        },
        {
          id: "forward",
          label: t("forward"),
          icon: ArrowUp,
          shortcut: "Ctrl+]",
          onSelect: () => editorActions.reorderSelection("forward"),
        },
        {
          id: "backward",
          label: t("backward"),
          icon: ArrowDown,
          shortcut: "Ctrl+[",
          onSelect: () => editorActions.reorderSelection("backward"),
        },
        {
          id: "back",
          label: t("back"),
          icon: ArrowDownToLine,
          shortcut: "Ctrl+Shift+[",
          onSelect: () => editorActions.reorderSelection("back"),
        },
      ],
    },
    {
      id: "align",
      label: elements.length > 1 ? t("alignElements") : t("alignToPage"),
      icon: AlignCenterVertical,
      disabled: allLocked,
      items: alignments.map((a) => ({
        id: `align-${a}`,
        label: t(`align.${a}`),
        icon: ALIGN_ICONS[a],
        onSelect: () => editorActions.alignSelection(a),
      })),
    },
    {
      id: "flip",
      label: t("flip"),
      icon: FlipHorizontal2,
      disabled: allLocked,
      items: [
        {
          id: "flip-h",
          label: t("flipH"),
          icon: FlipHorizontal2,
          onSelect: () => editorActions.flipSelection("x"),
        },
        {
          id: "flip-v",
          label: t("flipV"),
          icon: FlipVertical2,
          onSelect: () => editorActions.flipSelection("y"),
        },
      ],
    },
    groupable && {
      id: "group",
      label: t("group"),
      icon: Group,
      shortcut: "Ctrl+G",
      separator: true,
      onSelect: () => editorActions.groupSelection(),
    },
    ungroupable && {
      id: "ungroup",
      label: t("ungroup"),
      icon: Ungroup,
      shortcut: "Ctrl+Shift+G",
      separator: !groupable,
      onSelect: () => editorActions.ungroupSelection(),
    },
    {
      id: "lock",
      label: allLocked ? t("unlock") : t("lock"),
      icon: allLocked ? LockOpen : Lock,
      shortcut: "Alt+Shift+L",
      separator: !groupable && !ungroupable,
      onSelect: () => editorActions.toggleLockSelection(),
    },
    (single?.type === "image" || single?.type === "frame") &&
      !single.locked && {
        id: "replace-image",
        label: t("replaceImage"),
        icon: Images,
        separator: true,
        // The Photos panel swaps the selected photo on click (and links to uploads).
        onSelect: () => useEditorUi.getState().setPanel("photos"),
      },
    single?.type === "image" &&
      !single.locked && {
        id: "remove-background",
        label: tb("remove"),
        icon: Eraser,
        onSelect: () => {
          void removeElementBackground(single.id, {
            assetName: tb("assetName", { name: single.name || tb("image") }),
          })
            .then((outcome) => {
              if (outcome === "done" || outcome === "fallback") toast.success(tb("done"));
            })
            .catch(() => toast.error(tb("failed")));
        },
      },
    single?.type === "image" &&
      !single.locked && {
        id: "set-background",
        label: t("setAsBackground"),
        icon: ImageUp,
        onSelect: () => editorActions.setImageAsBackground(single.id),
      },
  ];
  return items.filter((i): i is MenuItemSpec => Boolean(i));
}
