"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { FILTERS, type FilterCategory } from "@/lib/photo/filters";
import { useSaveState } from "@/lib/photo/session";
import { get, set, usePhoto } from "@/lib/photo/store";
import { cn } from "@/lib/utils";
import {
  ADJUSTMENT_TYPES,
  COMMANDS,
  type Command,
  type CommandId,
  formatKeys,
  openAdjustment,
  PANEL_IDS,
  runFilter,
  togglePanel,
} from "./commands";

function Item({ id, children }: { id: CommandId; children?: ReactNode }) {
  const t = useTranslations("photo.cmd");
  const c: Command = COMMANDS[id];
  const enabled = c.enabled ? c.enabled() : true;
  const label = children ?? t(id);
  if (c.checked)
    return (
      <MenubarCheckboxItem
        checked={c.checked()}
        disabled={!enabled}
        onSelect={() => c.run()}
        data-testid={`cmd-${id}`}
      >
        {label}
        {c.keys && <MenubarShortcut>{formatKeys(c.keys)}</MenubarShortcut>}
      </MenubarCheckboxItem>
    );
  return (
    <MenubarItem disabled={!enabled} onSelect={() => c.run()} data-testid={`cmd-${id}`}>
      {label}
      {c.keys && <MenubarShortcut>{formatKeys(c.keys)}</MenubarShortcut>}
    </MenubarItem>
  );
}

function Sub({
  label,
  children,
  disabled,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <MenubarSub>
      <MenubarSubTrigger disabled={disabled}>{label}</MenubarSubTrigger>
      <MenubarSubContent>{children}</MenubarSubContent>
    </MenubarSub>
  );
}

const FILTER_MENU: FilterCategory[] = [
  "blur",
  "blurGallery",
  "distort",
  "noise",
  "pixelate",
  "render",
  "sharpen",
  "stylize",
  "other",
];

function FilterMenu() {
  const t = useTranslations("photo");
  const canFilter = usePhoto((s) => {
    const l = s.doc?.layers.find((x) => x.id === s.activeId);
    return Boolean(l && l.kind !== "adjustment");
  });
  const last = usePhoto((s) => s.lastFilter);
  return (
    <MenubarContent>
      <Item id="lastFilter">
        {last
          ? t("cmd.lastFilterNamed", { name: t(`filters.names.${last.id}` as never) })
          : t("cmd.lastFilter")}
      </Item>
      <MenubarSeparator />
      <Item id="developFilter" />
      {["lensCorrection", "skinSmoothing"].map((id) => (
        <MenubarItem
          key={id}
          disabled={!canFilter}
          onSelect={() => runFilter(id)}
          data-testid={`filter-${id}`}
        >
          {t(`filters.names.${id}` as never)}…
        </MenubarItem>
      ))}
      <MenubarSeparator />
      {FILTER_MENU.map((cat) => (
        <Sub key={cat} label={t(`filters.categories.${cat}`)} disabled={!canFilter}>
          {FILTERS.filter((f) => f.category === cat).map((f) => (
            <MenubarItem key={f.id} onSelect={() => runFilter(f.id)} data-testid={`filter-${f.id}`}>
              {t(`filters.names.${f.id}` as never)}
              {f.params.length ? "…" : ""}
            </MenubarItem>
          ))}
        </Sub>
      ))}
    </MenubarContent>
  );
}

function DocName() {
  const t = useTranslations("photo");
  const name = usePhoto((s) => s.doc?.name ?? "");
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const d = get().doc;
    if (d && draft !== null && draft.trim() && draft !== name)
      set({ doc: { ...d, name: draft.trim().slice(0, 120) }, dirty: true, rev: get().rev + 1 });
    setDraft(null);
  };
  return (
    <input
      aria-label={t("docName")}
      data-testid="photo-name"
      value={draft ?? name}
      maxLength={120}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className="h-7 w-[min(24vw,14rem)] truncate rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium outline-none hover:border-border focus-visible:border-ring"
    />
  );
}

function SaveBadge() {
  const t = useTranslations("photo.save");
  const state = useSaveState((s) => s.state);
  const dirty = usePhoto((s) => s.dirty);
  const shown = state === "saved" && dirty ? "unsaved" : state;
  return (
    <span
      role="status"
      data-testid="photo-save-status"
      data-state={shown}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground",
        shown === "saved" && "text-success",
        shown === "error" && "border-destructive/40 text-destructive",
      )}
    >
      {t(shown)}
    </span>
  );
}

export function PhotoMenuBar() {
  const t = useTranslations("photo");
  const tc = useTranslations("common");
  const panels = usePhoto((s) => s.panels);
  const hasDoc = usePhoto((s) => Boolean(s.doc));
  const busy = usePhoto((s) => s.busy);

  return (
    <header className="relative z-20 flex h-10 shrink-0 items-center gap-1 border-b bg-card px-2">
      <Link href="/photo" aria-label={t("allPhotos")} className="rounded-md p-0.5">
        <LogoMark className="size-6" decorative />
      </Link>
      <Menubar className="ms-1" data-tour="menubar">
        <MenubarMenu>
          <MenubarTrigger data-testid="menu-file">{t("menu.file")}</MenubarTrigger>
          <MenubarContent>
            <Item id="newDoc" />
            <Item id="open" />
            <Item id="place" />
            <MenubarSeparator />
            <Item id="save" />
            <Item id="revert" />
            <Item id="exportAs" />
            <Item id="quickExport" />
            <MenubarSeparator />
            <Item id="close" />
            <Item id="home" />
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-edit">{t("menu.edit")}</MenubarTrigger>
          <MenubarContent>
            <Item id="undo" />
            <Item id="redo" />
            <Item id="stepBackward" />
            <MenubarSeparator />
            <Item id="cut" />
            <Item id="copy" />
            <Item id="copyMerged" />
            <Item id="paste" />
            <Item id="pasteInPlace" />
            <Item id="clear" />
            <MenubarSeparator />
            <Item id="generativeFill" />
            <Item id="contentAwareFill" />
            <Item id="fill" />
            <Item id="stroke" />
            <MenubarSeparator />
            <Item id="freeTransform" />
            <Sub label={t("cmd.transform")} disabled={!hasDoc}>
              <Item id="skew" />
              <Item id="distort" />
              <Item id="perspective" />
              <Item id="warp" />
              <MenubarSeparator />
              <Item id="rotateLayer180" />
              <Item id="rotateLayerCw" />
              <Item id="rotateLayerCcw" />
              <MenubarSeparator />
              <Item id="flipLayerH" />
              <Item id="flipLayerV" />
            </Sub>
            <MenubarSeparator />
            <Item id="shortcuts" />
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-image">{t("menu.image")}</MenubarTrigger>
          <MenubarContent>
            <Sub label={t("cmd.mode")} disabled={!hasDoc}>
              <Item id="grayscale" />
            </Sub>
            <Sub label={t("cmd.adjustments")} disabled={!hasDoc}>
              {ADJUSTMENT_TYPES.map((a) => (
                <MenubarItem
                  key={a}
                  onSelect={() => openAdjustment(a, "pixels")}
                  data-testid={`adjust-${a}`}
                >
                  {t(`adjustments.${a}`)}
                  {["invert", "desaturate", "equalize"].includes(a) ? "" : "…"}
                </MenubarItem>
              ))}
            </Sub>
            <MenubarSeparator />
            <Item id="autoTone" />
            <Item id="autoContrast" />
            <Item id="autoColor" />
            <MenubarSeparator />
            <Item id="imageSize" />
            <Item id="canvasSize" />
            <Sub label={t("cmd.imageRotation")} disabled={!hasDoc}>
              <Item id="rotate180" />
              <Item id="rotate90cw" />
              <Item id="rotate90ccw" />
              <MenubarSeparator />
              <Item id="flipCanvasH" />
              <Item id="flipCanvasV" />
            </Sub>
            <Item id="cropToSelection" />
            <Item id="trim" />
            <Item id="trimTopLeft" />
            <Item id="revealAll" />
            <Item id="duplicateDoc" />
            <MenubarSeparator />
            <Item id="removeBackground" />
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-layer">{t("menu.layer")}</MenubarTrigger>
          <MenubarContent>
            <Item id="newLayer" />
            <Item id="newGroup" />
            <Item id="group" />
            <Item id="ungroup" />
            <Item id="duplicateLayer" />
            <Item id="deleteLayer" />
            <MenubarSeparator />
            <Item id="layerViaCopy" />
            <Item id="layerViaCut" />
            <MenubarSeparator />
            <Item id="layerStyle" />
            <Sub label={t("cmd.newFillLayer")} disabled={!hasDoc}>
              <Item id="fillSolid" />
              <Item id="fillGradient" />
            </Sub>
            <Sub label={t("cmd.newAdjustmentLayer")} disabled={!hasDoc}>
              {ADJUSTMENT_TYPES.map((a) => (
                <MenubarItem key={a} onSelect={() => openAdjustment(a, "layer")}>
                  {t(`adjustments.${a}`)}
                </MenubarItem>
              ))}
            </Sub>
            <Sub label={t("cmd.layerMask")} disabled={!hasDoc}>
              <Item id="maskReveal" />
              <Item id="maskHide" />
              <Item id="maskSelection" />
              <MenubarSeparator />
              <Item id="maskToggle" />
              <Item id="maskToSelection" />
              <Item id="maskApply" />
              <Item id="maskDelete" />
            </Sub>
            <Item id="clippingMask" />
            <MenubarSeparator />
            <Sub label={t("cmd.arrange")} disabled={!hasDoc}>
              <Item id="bringToFront" />
              <Item id="bringForward" />
              <Item id="sendBackward" />
              <Item id="sendToBack" />
            </Sub>
            <Sub label={t("cmd.align")} disabled={!hasDoc}>
              <Item id="alignLeft" />
              <Item id="alignCenterH" />
              <Item id="alignRight" />
              <MenubarSeparator />
              <Item id="alignTop" />
              <Item id="alignMiddle" />
              <Item id="alignBottom" />
            </Sub>
            <Item id="rasterize" />
            <MenubarSeparator />
            <Item id="mergeDown" />
            <Item id="mergeGroup" />
            <Item id="mergeVisible" />
            <Item id="flatten" />
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-type">{t("menu.type")}</MenubarTrigger>
          <MenubarContent>
            <Item id="typeTool" />
            <Item id="biggerText" />
            <Item id="smallerText" />
            <Item id="rasterizeType" />
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-select">{t("menu.select")}</MenubarTrigger>
          <MenubarContent>
            <Item id="selectAll" />
            <Item id="deselect" />
            <Item id="reselect" />
            <Item id="inverse" />
            <MenubarSeparator />
            <Item id="selectSubject" />
            <Item id="colorRange" />
            <MenubarSeparator />
            <Sub label={t("cmd.modify")} disabled={!hasDoc}>
              <Item id="border" />
              <Item id="smooth" />
              <Item id="expand" />
              <Item id="contract" />
              <Item id="feather" />
            </Sub>
            <Item id="grow" />
            <Item id="similar" />
            <MenubarSeparator />
            <Item id="quickMask" />
            <MenubarSeparator />
            <Item id="saveSelection" />
            <Item id="loadSelection" />
            <MenubarSeparator />
            <Item id="pathToSelection" />
            <Item id="selectionToPath" />
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-filter">{t("menu.filter")}</MenubarTrigger>
          <FilterMenu />
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-view">{t("menu.view")}</MenubarTrigger>
          <MenubarContent>
            <Item id="zoomIn" />
            <Item id="zoomOut" />
            <Item id="fitOnScreen" />
            <Item id="actualPixels" />
            <MenubarSeparator />
            <Item id="extras" />
            <Item id="rulers" />
            <Item id="grid" />
            <Item id="snap" />
            <Item id="guides" />
            <MenubarSeparator />
            <Item id="newGuide" />
            <Item id="clearGuides" />
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-window">{t("menu.window")}</MenubarTrigger>
          <MenubarContent>
            {PANEL_IDS.map((p) => (
              <MenubarCheckboxItem key={p} checked={panels[p]} onSelect={() => togglePanel(p)}>
                {t(`panels.${p}`)}
              </MenubarCheckboxItem>
            ))}
            <MenubarSeparator />
            <Item id="hidePanels" />
            <Item id="resetWorkspace" />
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger data-testid="menu-help">{t("menu.help")}</MenubarTrigger>
          <MenubarContent>
            <Item id="tutorial" />
            <Item id="shortcuts" />
            <MenubarItem asChild>
              <Link href="/settings">{tc("settings")}</Link>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <span className="mx-1 h-5 w-px bg-border" />
      <DocName />
      {busy && (
        <span role="status" className="animate-pulse text-[11px] text-muted-foreground">
          {t(`busy.${busy}` as never)}
        </span>
      )}

      <div className="ms-auto flex items-center gap-1">
        {hasDoc && <SaveBadge />}
        <LanguageSwitcher />
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label={tc("settings")}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </header>
  );
}
