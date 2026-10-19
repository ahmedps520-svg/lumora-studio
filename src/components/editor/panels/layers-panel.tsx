"use client";

import {
  ChartColumn,
  ChevronRight,
  Eye,
  EyeOff,
  Group,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Minus,
  PenTool,
  QrCode,
  Shapes,
  Sparkles,
  Square,
  Table,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type DragEvent, type KeyboardEvent } from "react";
import type { Element, ElementType } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { ContextItems } from "../menu-items";
import { useCanvasMenu } from "../use-canvas-menu";

const TYPE_ICONS: Record<ElementType, LucideIcon> = {
  text: Type,
  image: ImageIcon,
  shape: Shapes,
  svg: Sparkles,
  line: Minus,
  group: Group,
  frame: Square,
  table: Table,
  chart: ChartColumn,
  qr: QrCode,
  drawing: PenTool,
};

function useLabel() {
  const t = useTranslations("editor.layers.types");
  return (element: Element) => {
    if (element.name) return element.name;
    if (element.type === "text") {
      const text = element.runs
        .map((r) => r.text)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (text) return text.length > 36 ? `${text.slice(0, 36)}…` : text;
    }
    return t(element.type);
  };
}

/** The elements inside a group (read-only rows; clicking one selects the whole group). */
function GroupChildren({
  elements,
  groupId,
  depth,
}: {
  elements: Element[];
  groupId: string;
  depth: number;
}) {
  const t = useTranslations("editor.layers");
  const labelFor = useLabel();
  return (
    <ul className="space-y-0.5" data-testid="layer-children">
      {[...elements].reverse().map((child) => {
        const Icon = TYPE_ICONS[child.type];
        return (
          <li key={child.id}>
            <div
              className={cn(
                "group flex items-center gap-2 rounded-lg py-1 pe-2 hover:bg-muted",
                !child.visible && "opacity-60",
              )}
              style={{ paddingInlineStart: `${0.5 + depth * 1.25}rem` }}
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-start text-xs text-muted-foreground"
                onClick={() => useEditorStore.getState().select([groupId])}
              >
                {labelFor(child)}
              </button>
              <button
                type="button"
                aria-label={child.visible ? t("hide") : t("show")}
                title={child.visible ? t("hide") : t("show")}
                onClick={() => editorActions.toggleVisibility(child.id)}
                className={cn(
                  "rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:opacity-100",
                  child.visible && "opacity-0 group-hover:opacity-100",
                )}
              >
                {child.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
            </div>
            {child.type === "group" && (
              <GroupChildren elements={child.children} groupId={groupId} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LayerRow({
  element,
  index,
  selected,
  onDragStart,
  onDrop,
}: {
  element: Element;
  /** Stack index (0 = bottom). */
  index: number;
  selected: boolean;
  onDragStart: (id: string) => void;
  onDrop: (index: number) => void;
}) {
  const t = useTranslations("editor.layers");
  const label = useLabel()(element);
  const [renaming, setRenaming] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const menu = useCanvasMenu();
  const Icon = TYPE_ICONS[element.type];

  const select = (additive: boolean) => {
    const { selection, select } = useEditorStore.getState();
    if (additive) {
      select(
        selection.includes(element.id)
          ? selection.filter((id) => id !== element.id)
          : [...selection, element.id],
      );
    } else select([element.id]);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      editorActions.moveElement(element.id, index + (e.key === "ArrowUp" ? 1 : -1));
    } else if (e.key === "F2") {
      e.preventDefault();
      setRenaming(true);
    }
  };

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onContextMenu={() => {
              // Right-click acts on this layer (selecting it first).
              if (!selected) useEditorStore.getState().select([element.id]);
            }}
            draggable={!renaming}
            onDragStart={(e: DragEvent) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart(element.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(true);
            }}
            onDragLeave={() => setDropTarget(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropTarget(false);
              onDrop(index);
            }}
            className={cn(
              "group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5",
              selected ? "border-primary/40 bg-accent" : "hover:bg-muted",
              dropTarget && "border-t-primary",
              !element.visible && "opacity-60",
            )}
            data-testid="layer-row"
          >
            {element.type === "group" && (
              <button
                type="button"
                aria-label={expanded ? t("collapse") : t("expand")}
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="-me-1 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                data-testid="layer-expand"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform rtl:-scale-x-100",
                    expanded && "rotate-90",
                  )}
                />
              </button>
            )}
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {renaming ? (
              <input
                autoFocus
                defaultValue={element.name || label}
                aria-label={t("renameHint")}
                maxLength={200}
                className="min-w-0 flex-1 rounded border bg-background px-1 text-sm outline-none focus-visible:border-ring"
                onBlur={(e) => {
                  editorActions.renameElement(element.id, e.target.value.trim());
                  setRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenaming(false);
                }}
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-start text-sm"
                aria-pressed={selected}
                title={t("renameHint")}
                onClick={(e) => select(e.shiftKey || e.ctrlKey || e.metaKey)}
                onDoubleClick={() => setRenaming(true)}
                onKeyDown={onKeyDown}
              >
                {label}
                {element.type === "group" && (
                  <span className="ms-1.5 text-xs text-muted-foreground">
                    {t("groupCount", { count: element.children.length })}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              aria-label={element.visible ? t("hide") : t("show")}
              title={element.visible ? t("hide") : t("show")}
              onClick={() => editorActions.toggleVisibility(element.id)}
              className={cn(
                "rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:opacity-100",
                element.visible && "opacity-0 group-hover:opacity-100",
              )}
            >
              {element.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
            <button
              type="button"
              aria-label={element.locked ? t("unlock") : t("lock")}
              title={element.locked ? t("unlock") : t("lock")}
              onClick={() => editorActions.toggleLock(element.id)}
              className={cn(
                "rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:opacity-100",
                !element.locked && "opacity-0 group-hover:opacity-100",
              )}
            >
              {element.locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextItems items={menu} />
        </ContextMenuContent>
      </ContextMenu>
      {element.type === "group" && expanded && (
        <GroupChildren elements={element.children} groupId={element.id} depth={1} />
      )}
    </li>
  );
}

export function LayersPanel() {
  const t = useTranslations("editor.layers");
  const page = useEditorStore(selectCurrentPage);
  const selection = useEditorStore((s) => s.selection);
  const [dragging, setDragging] = useState<string | null>(null);

  if (!page) return null;
  if (page.elements.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  // Top of the stack first, like most design tools.
  const rows = page.elements.map((element, index) => ({ element, index })).reverse();

  return (
    <ul className="space-y-0.5" aria-label={t("title")}>
      {rows.map(({ element, index }) => (
        <LayerRow
          key={element.id}
          element={element}
          index={index}
          selected={selection.includes(element.id)}
          onDragStart={setDragging}
          onDrop={(targetIndex) => {
            if (dragging && dragging !== element.id)
              editorActions.moveElement(dragging, targetIndex);
            setDragging(null);
          }}
        />
      ))}
    </ul>
  );
}
