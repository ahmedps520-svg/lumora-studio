"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  Group,
  Lock,
  LockOpen,
  Trash2,
  Ungroup,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Alignment } from "@/lib/document/arrange";
import { findElement } from "@/lib/document/tree";
import type { Element } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";
import { ElementAnimation } from "./animate-section";
import {
  ChartProperties,
  CodeProperties,
  FrameProperties,
  SvgProperties,
  TableProperties,
} from "./element-editors";
import { NumberField, Section, SliderField } from "./fields";
import { ImageProperties } from "./image-properties";
import { LineProperties, ShapeProperties } from "./shape-properties";
import { PageProperties } from "./page-properties";
import { TextProperties } from "./text-properties";

function IconAction({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** "Group" for a multi-selection, "Ungroup" for a selected group. */
function GroupButton({ canGroup, canUngroup }: { canGroup: boolean; canUngroup: boolean }) {
  const t = useTranslations("editor.properties");
  if (canUngroup) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => editorActions.ungroupSelection()}
        data-testid="ungroup-button"
      >
        <Ungroup /> {t("ungroup")}
        <kbd className="ms-auto text-xs text-muted-foreground">Ctrl+Shift+G</kbd>
      </Button>
    );
  }
  if (!canGroup) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => editorActions.groupSelection()}
      data-testid="group-button"
    >
      <Group /> {t("group")}
      <kbd className="ms-auto text-xs text-muted-foreground">Ctrl+G</kbd>
    </Button>
  );
}

function ArrangeBar({ element }: { element?: Element }) {
  const t = useTranslations("editor.properties");
  const locked = element?.locked ?? false;
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <IconAction label={t("forward")} onClick={() => editorActions.reorderSelection("forward")}>
        <ArrowUp />
      </IconAction>
      <IconAction label={t("backward")} onClick={() => editorActions.reorderSelection("backward")}>
        <ArrowDown />
      </IconAction>
      <IconAction label={t("front")} onClick={() => editorActions.reorderSelection("front")}>
        <ArrowUpToLine />
      </IconAction>
      <IconAction label={t("back")} onClick={() => editorActions.reorderSelection("back")}>
        <ArrowDownToLine />
      </IconAction>
      <IconAction
        label={t("flipH")}
        onClick={() => editorActions.flipSelection("x")}
        disabled={locked}
      >
        <FlipHorizontal2 />
      </IconAction>
      <IconAction
        label={t("flipV")}
        onClick={() => editorActions.flipSelection("y")}
        disabled={locked}
      >
        <FlipVertical2 />
      </IconAction>
      <IconAction
        label={t("duplicate")}
        onClick={() => editorActions.duplicateSelection()}
        disabled={locked}
      >
        <Copy />
      </IconAction>
      {element && (
        <IconAction
          label={element.locked ? t("unlock") : t("lock")}
          onClick={() => editorActions.toggleLock(element.id)}
        >
          {element.locked ? <Lock /> : <LockOpen />}
        </IconAction>
      )}
      <IconAction
        label={t("delete")}
        onClick={() => editorActions.deleteSelection()}
        disabled={locked}
      >
        <Trash2 />
      </IconAction>
    </div>
  );
}

const ALIGNMENTS: { id: Alignment; icon: typeof AlignStartVertical }[] = [
  { id: "left", icon: AlignStartVertical },
  { id: "center", icon: AlignCenterVertical },
  { id: "right", icon: AlignEndVertical },
  { id: "top", icon: AlignStartHorizontal },
  { id: "middle", icon: AlignCenterHorizontal },
  { id: "bottom", icon: AlignEndHorizontal },
];

/** One element: align to the page. Several: align to each other (3+ can be spaced evenly). */
function AlignBar({ count, disabled }: { count: number; disabled?: boolean }) {
  const t = useTranslations("editor.menu");
  const tp = useTranslations("editor.properties");
  return (
    <div className="space-y-1.5">
      <p className="text-sm">{count > 1 ? t("alignElements") : t("alignToPage")}</p>
      {/* Physical directions on the canvas, so the order never flips. */}
      <div className="flex flex-wrap items-center gap-0.5" dir="ltr">
        {ALIGNMENTS.map(({ id, icon: Icon }) => (
          <IconAction
            key={id}
            label={t(`align.${id}`)}
            onClick={() => editorActions.alignSelection(id)}
            disabled={disabled}
          >
            <Icon />
          </IconAction>
        ))}
        {count >= 3 && (
          <>
            <IconAction
              label={tp("distributeH")}
              onClick={() => editorActions.distributeSelection("horizontal")}
              disabled={disabled}
            >
              <AlignHorizontalSpaceAround />
            </IconAction>
            <IconAction
              label={tp("distributeV")}
              onClick={() => editorActions.distributeSelection("vertical")}
              disabled={disabled}
            >
              <AlignVerticalSpaceAround />
            </IconAction>
          </>
        )}
      </div>
    </div>
  );
}

function GeometryFields({ element }: { element: Element }) {
  const t = useTranslations("editor.properties");
  const isGroup = element.type === "group";
  const update = (patch: Partial<Element>, mergeKey?: string) => {
    // A group's size scales everything inside it (proportionally).
    if (isGroup && (patch.width !== undefined || patch.height !== undefined)) {
      editorActions.resizeGroup(element.id, patch.width, patch.height, mergeKey);
    } else editorActions.updateElement(element.id, patch, mergeKey);
  };
  const disabled = element.locked;
  const autoHeight = element.type === "text" && element.autoFit === "autoHeight";
  const isLine = element.type === "line";

  return (
    <Section title={t("position")}>
      <AlignBar count={1} disabled={disabled} />
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t("x")}
          ariaLabel="X"
          testId="prop-x"
          value={element.x}
          disabled={disabled}
          onCommit={(x, k) => update({ x }, k)}
        />
        <NumberField
          label={t("y")}
          ariaLabel="Y"
          testId="prop-y"
          value={element.y}
          disabled={disabled}
          onCommit={(y, k) => update({ y }, k)}
        />
        <NumberField
          label={t("width")}
          ariaLabel={t("widthFull")}
          testId="prop-width"
          value={element.width}
          min={1}
          disabled={disabled}
          onCommit={(width, k) => update({ width }, k)}
        />
        <NumberField
          label={t("height")}
          ariaLabel={t("heightFull")}
          testId="prop-height"
          value={element.height}
          min={1}
          disabled={disabled || autoHeight || isLine}
          onCommit={(height, k) => update({ height }, k)}
        />
        <NumberField
          label="°"
          ariaLabel={t("rotation")}
          testId="prop-rotation"
          value={element.rotation}
          min={-360}
          max={360}
          disabled={disabled}
          onCommit={(rotation, k) => update({ rotation }, k)}
        />
      </div>
      <SliderField
        label={t("opacity")}
        value={Math.round(element.opacity * 100)}
        min={0}
        max={100}
        format={(v) => `${v}%`}
        disabled={disabled}
        onChange={(v) => update({ opacity: v / 100 }, `opacity:${element.id}`)}
      />
    </Section>
  );
}

function ElementProperties({ element, topLevel }: { element: Element; topLevel: boolean }) {
  const t = useTranslations("editor.properties");
  return (
    <>
      <Section>
        <ArrangeBar element={element} />
        {element.locked && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t("locked")}
          </p>
        )}
        {element.type === "group" && (
          <>
            <p className="text-sm text-muted-foreground">
              {t("groupOf", { count: element.children.length })}
            </p>
            <GroupButton canGroup={false} canUngroup={!element.locked} />
          </>
        )}
      </Section>
      {element.type === "text" && <TextProperties element={element} />}
      {element.type === "shape" && <ShapeProperties element={element} />}
      {element.type === "line" && <LineProperties element={element} />}
      {element.type === "image" && <ImageProperties element={element} />}
      {element.type === "svg" && <SvgProperties element={element} />}
      {element.type === "frame" && <FrameProperties element={element} />}
      {element.type === "table" && <TableProperties element={element} />}
      {element.type === "chart" && <ChartProperties element={element} />}
      {element.type === "qr" && <CodeProperties element={element} />}
      <GeometryFields element={element} />
      {/* Only whole elements on the page animate (not parts of a group). */}
      {topLevel && <ElementAnimation elements={[element]} />}
    </>
  );
}

export function PropertiesPanel() {
  const t = useTranslations("editor.properties");
  const page = useEditorStore(selectCurrentPage);
  const selection = useEditorStore((s) => s.selection);
  const single = selection.length === 1 && page ? findElement(page, selection[0]!) : undefined;
  const ids = new Set(selection);
  const groupable = page ? page.elements.filter((e) => ids.has(e.id) && !e.locked) : [];
  const canUngroup = groupable.some((e) => e.type === "group");
  const topLevelSelected = page ? page.elements.filter((e) => ids.has(e.id)) : [];

  return (
    <aside
      aria-label={t("title")}
      className="hidden w-64 shrink-0 flex-col border-s bg-card md:flex xl:w-72"
      data-testid="properties-panel"
    >
      <ScrollArea className="min-h-0 flex-1">
        {selection.length === 0 && <PageProperties />}
        {single && (
          <ElementProperties
            key={single.id}
            element={single}
            topLevel={page!.elements.some((e) => e.id === single.id)}
          />
        )}
        {selection.length > 1 && (
          <Section>
            <p className="text-sm font-medium">{t("multiple", { count: selection.length })}</p>
            <ArrangeBar />
            <AlignBar count={selection.length} />
            <GroupButton canGroup={groupable.length >= 2} canUngroup={false} />
            {canUngroup && <GroupButton canGroup={false} canUngroup />}
          </Section>
        )}
        {selection.length > 1 && topLevelSelected.length > 0 && (
          <ElementAnimation elements={topLevelSelected} />
        )}
      </ScrollArea>
    </aside>
  );
}
