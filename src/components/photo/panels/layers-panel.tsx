"use client";

import {
  ChevronRight,
  Contrast,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  FolderPlus,
  Link2,
  Lock,
  PaintBucket,
  Plus,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  SquareDashed,
  Trash,
  Type,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as A from "@/lib/photo/actions";
import { getPixels } from "@/lib/photo/runtime";
import { get, set, usePhoto } from "@/lib/photo/store";
import * as tree from "@/lib/photo/tree";
import { BLEND_GROUPS, type Layer, type Locks } from "@/lib/photo/types";
import { cn } from "@/lib/utils";
import { ADJUSTMENT_TYPES, openAdjustment } from "../commands";
import { NumField } from "../controls";

/** A small live picture of a layer's content (or mask). */
function Thumb({ layer, mask = false, active }: { layer: Layer; mask?: boolean; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rev = usePhoto((s) => s.rev);
  const doc = usePhoto((s) => s.doc);
  useEffect(() => {
    const c = ref.current;
    if (!c || !doc) return;
    // Redraw a moment after the last change (not on every brush frame).
    const id = window.setTimeout(() => {
      const g = c.getContext("2d")!;
      const k = Math.min(c.width / doc.width, c.height / doc.height);
      g.clearRect(0, 0, c.width, c.height);
      const w = doc.width * k;
      const h = doc.height * k;
      const ox = (c.width - w) / 2;
      const oy = (c.height - h) / 2;
      const p = getPixels(layer.id);
      if (mask) {
        g.fillStyle = "#000";
        g.fillRect(ox, oy, w, h);
        if (p.mask) g.drawImage(p.mask, ox, oy, w, h);
        return;
      }
      // Checkerboard under the content.
      for (let y = 0; y < h; y += 4)
        for (let x = 0; x < w; x += 4) {
          g.fillStyle = ((x + y) / 4) % 2 ? "#e5e5e5" : "#fff";
          g.fillRect(ox + x, oy + y, 4, 4);
        }
      if (layer.kind === "adjustment") return;
      g.drawImage(
        p.canvas,
        ox + layer.x * k,
        oy + layer.y * k,
        p.canvas.width * k,
        p.canvas.height * k,
      );
    }, 250);
    return () => window.clearTimeout(id);
  }, [rev, doc, layer, mask]);
  return (
    <canvas
      ref={ref}
      width={36}
      height={28}
      className={cn("h-7 w-9 shrink-0 rounded-sm border bg-white", active && "ring-2 ring-primary")}
    />
  );
}

function KindIcon({ layer }: { layer: Layer }) {
  if (layer.kind === "text") return <Type className="size-3.5" />;
  if (layer.kind === "shape") return <Shapes className="size-3.5" />;
  if (layer.kind === "fill") return <PaintBucket className="size-3.5" />;
  if (layer.kind === "adjustment") return <Contrast className="size-3.5" />;
  return null;
}

/**
 * Layer names are the user's data, but the ones the editor made up ("Layer 2",
 * "Background", an adjustment's type…) are shown in the interface language.
 */
export function useLayerName() {
  const t = useTranslations("photo");
  return (layer: Layer) => {
    const n = /^(Layer|Shape|Group|Path) (\d+)$/.exec(layer.name);
    if (n)
      return t(
        n[1] === "Layer"
          ? "layers.layerN"
          : n[1] === "Shape"
            ? "layers.shapeN"
            : n[1] === "Group"
              ? "layers.groupN"
              : "paths.pathN",
        { n: n[2]! },
      );
    if (layer.name === "Background") return t("layers.backgroundName");
    if (layer.name === "Merged") return t("layers.merged");
    if (layer.name === "Color Fill") return t("cmd.fillSolid");
    if (layer.name === "Gradient Fill") return t("cmd.fillGradient");
    if (layer.kind === "adjustment" && layer.name === layer.adjustment.type)
      return t(`adjustments.${layer.adjustment.type}`);
    return layer.name;
  };
}

type DropAt = "above" | "below" | "into";

function LayerRow({
  layer,
  depth,
  order,
}: {
  layer: Layer;
  depth: number;
  /** Ids of the rows as shown (top first), for Shift-click ranges. */
  order: string[];
}) {
  const t = useTranslations("photo.layers");
  const nameOf = useLayerName();
  const active = usePhoto((s) => s.activeId === layer.id);
  const picked = usePhoto((s) => s.selectedIds.includes(layer.id));
  const maskEdit = usePhoto((s) => s.maskEdit);
  const [editing, setEditing] = useState(false);
  const [drop, setDrop] = useState<DropAt | null>(null);
  const group = layer.kind === "group" ? layer : null;

  const choose = (e: React.MouseEvent) => {
    const s = get();
    const maskEdit = layer.kind === "adjustment";
    if (e.ctrlKey || e.metaKey) {
      const ids = new Set(s.selectedIds.length ? s.selectedIds : s.activeId ? [s.activeId] : []);
      if (ids.has(layer.id) && ids.size > 1) ids.delete(layer.id);
      else ids.add(layer.id);
      set({ activeId: layer.id, selectedIds: [...ids], maskEdit });
      return;
    }
    if (e.shiftKey && s.activeId) {
      const a = order.indexOf(s.activeId);
      const b = order.indexOf(layer.id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        set({ selectedIds: order.slice(lo, hi + 1), activeId: layer.id, maskEdit });
        return;
      }
    }
    set({ activeId: layer.id, selectedIds: [layer.id], maskEdit });
  };

  return (
    <li
      draggable
      data-testid="layer-row"
      data-layer-id={layer.id}
      data-kind={layer.kind}
      data-active={active || undefined}
      data-picked={picked || undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-photo-layer", layer.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("text/x-photo-layer")) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        const f = (e.clientY - r.top) / r.height;
        // Groups take a drop in their middle; elsewhere it's above or below.
        setDrop(
          group ? (f < 0.28 ? "above" : f > 0.72 ? "below" : "into") : f < 0.5 ? "above" : "below",
        );
      }}
      onDragLeave={() => setDrop(null)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("text/x-photo-layer");
        const where = drop;
        setDrop(null);
        if (!id || id === layer.id || !where) return;
        A.moveLayerTo(id, layer.id, where);
      }}
      onClick={choose}
      style={{ paddingInlineStart: 6 + depth * 14 }}
      className={cn(
        "group relative flex h-10 cursor-pointer items-center gap-1.5 border-b pe-1.5 text-xs select-none",
        active ? "bg-primary/15" : picked ? "bg-primary/8" : "hover:bg-accent/60",
        drop === "above" &&
          "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary",
        drop === "below" &&
          "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary",
        drop === "into" && "ring-2 ring-primary ring-inset",
      )}
    >
      <button
        type="button"
        aria-label={layer.visible ? t("hide") : t("show")}
        onClick={(e) => {
          e.stopPropagation();
          if (e.altKey) return A.soloLayer(layer.id);
          A.updateLayer(layer.id, { visible: !layer.visible }, "visibility");
        }}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 opacity-50" />}
      </button>
      {layer.clip && <span className="text-muted-foreground">↳</span>}
      {group ? (
        <>
          <button
            type="button"
            aria-label={group.collapsed ? t("expandGroup") : t("collapseGroup")}
            aria-expanded={!group.collapsed}
            data-testid="group-toggle"
            onClick={(e) => {
              e.stopPropagation();
              A.setCollapsed(group.id, !group.collapsed);
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform rtl:-scale-x-100",
                !group.collapsed && "rotate-90 rtl:-rotate-90",
              )}
            />
          </button>
          <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-sm border bg-surface-2 text-muted-foreground">
            {group.collapsed ? <Folder className="size-4" /> : <FolderOpen className="size-4" />}
          </span>
        </>
      ) : (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            choose(e);
            set({ maskEdit: false });
          }}
        >
          <Thumb layer={layer} active={active && !maskEdit && layer.kind !== "adjustment"} />
        </span>
      )}
      {layer.mask && (
        <span
          role="button"
          tabIndex={-1}
          title={t("mask")}
          onClick={(e) => {
            e.stopPropagation();
            if (e.shiftKey) A.toggleMask();
            else set({ activeId: layer.id, selectedIds: [layer.id], maskEdit: true });
          }}
          className={cn(
            !layer.mask.enabled &&
              "relative opacity-60 after:absolute after:inset-0 after:m-auto after:h-0.5 after:w-full after:rotate-[38deg] after:bg-destructive",
          )}
        >
          <Thumb layer={layer} mask active={active && (maskEdit || layer.kind === "adjustment")} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <KindIcon layer={layer} />
        {editing ? (
          <input
            autoFocus
            defaultValue={nameOf(layer)}
            aria-label={t("rename")}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={(e) => {
              setEditing(false);
              const v = e.target.value.trim();
              if (v && v !== layer.name && v !== nameOf(layer))
                A.updateLayer(layer.id, { name: v.slice(0, 80) }, "rename");
            }}
            className="h-5 w-full rounded border bg-background px-1 text-xs outline-none"
          />
        ) : (
          <span
            className={cn(
              "truncate",
              layer.name === "Background" && depth === 0 && "px-0.5 italic",
              group && "font-medium",
            )}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {nameOf(layer)}
          </span>
        )}
      </span>
      {Object.values(layer.styles).some((st) => (st as { enabled?: boolean })?.enabled) && (
        <button
          type="button"
          title={t("styles")}
          onClick={(e) => {
            e.stopPropagation();
            set({ dialog: { type: "layerStyle", layerId: layer.id } });
          }}
          className="text-[10px] font-semibold text-muted-foreground italic"
        >
          fx
        </button>
      )}
      {(layer.locks.all ||
        layer.locks.pixels ||
        layer.locks.position ||
        layer.locks.transparency) && (
        <Lock className={cn("size-3 text-muted-foreground", !layer.locks.all && "opacity-60")} />
      )}
    </li>
  );
}

function LockButtons({ layer }: { layer: Layer }) {
  const t = useTranslations("photo.layers");
  const items: { key: keyof Locks; label: string; short: string }[] = [
    { key: "transparency", label: t("lockTransparency"), short: "▦" },
    { key: "pixels", label: t("lockPixels"), short: "✎" },
    { key: "position", label: t("lockPosition"), short: "✥" },
    { key: "all", label: t("lockAll"), short: "🔒" },
  ];
  return (
    <span className="flex items-center gap-0.5">
      <span className="me-1 text-[11px] text-muted-foreground">{t("lock")}</span>
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          title={i.label}
          aria-label={i.label}
          aria-pressed={layer.locks[i.key]}
          onClick={() =>
            A.updateLayer(
              layer.id,
              { locks: { ...layer.locks, [i.key]: !layer.locks[i.key] } },
              "lock",
            )
          }
          className={cn(
            "flex size-5 items-center justify-center rounded text-[11px] text-muted-foreground hover:bg-accent",
            layer.locks[i.key] && "bg-primary/15 text-primary",
          )}
        >
          {i.short}
        </button>
      ))}
    </span>
  );
}

const NO_LAYERS: Layer[] = [];

export function LayersPanel() {
  const t = useTranslations("photo");
  const layers = usePhoto((s) => s.doc?.layers ?? NO_LAYERS);
  const active = usePhoto((s) => s.doc?.layers.find((l) => l.id === s.activeId) ?? null);
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null);
  const [fillDraft, setFillDraft] = useState<number | null>(null);
  const rows = [...layers].reverse().filter((l) => !tree.folded(layers, l));
  const order = rows.map((l) => l.id);

  return (
    <div className="flex min-h-0 flex-col" data-testid="layers-panel">
      {active && (
        <div className="space-y-1.5 border-b px-2 py-2">
          <div className="flex items-center gap-2">
            <select
              aria-label={t("layers.blendMode")}
              value={active.kind === "group" && active.passThrough ? "passThrough" : active.blend}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "passThrough")
                  A.updateLayer(active.id, { passThrough: true } as Partial<Layer>, "blend");
                else
                  A.updateLayer(
                    active.id,
                    { blend: v as Layer["blend"], passThrough: false } as Partial<Layer>,
                    "blend",
                  );
              }}
              onKeyDown={(e) => e.stopPropagation()}
              data-testid="layer-blend"
              className="h-6 min-w-0 flex-1 rounded-md border bg-background/60 px-1 text-xs outline-none"
            >
              {active.kind === "group" && (
                <option value="passThrough">{t("layers.passThrough")}</option>
              )}
              {BLEND_GROUPS.map((g, i) => (
                <optgroup key={i} label="──────">
                  {g.map((m) => (
                    <option key={m} value={m}>
                      {t(`blend.${m}`)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <NumField
              label={t("layers.opacity")}
              value={opacityDraft ?? active.opacity}
              min={0}
              max={1}
              scale={100}
              unit="%"
              onChange={(v) => {
                setOpacityDraft(v);
                A.previewLayer(active.id, { opacity: v });
              }}
              onCommit={(v) => {
                setOpacityDraft(null);
                A.updateLayer(active.id, { opacity: v }, "opacity");
              }}
              testId="layer-opacity"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <LockButtons layer={active} />
            <NumField
              label={t("layers.fill")}
              value={fillDraft ?? active.fillOpacity}
              min={0}
              max={1}
              scale={100}
              unit="%"
              onChange={(v) => {
                setFillDraft(v);
                A.previewLayer(active.id, { fillOpacity: v });
              }}
              onCommit={(v) => {
                setFillDraft(null);
                A.updateLayer(active.id, { fillOpacity: v }, "opacity");
              }}
            />
          </div>
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={t("panels.layers")}>
        {rows.map((l) => (
          <LayerRow key={l.id} layer={l} depth={tree.depthOf(layers, l)} order={order} />
        ))}
      </ul>
      <div className="flex items-center justify-end gap-0.5 border-t px-1.5 py-1">
        <IconButton
          label={t("cmd.clippingMask")}
          onClick={() => active && A.updateLayer(active.id, { clip: !active.clip }, "clip")}
        >
          <Link2 />
        </IconButton>
        <IconButton
          label={t("cmd.layerStyle")}
          onClick={() => active && set({ dialog: { type: "layerStyle", layerId: active.id } })}
        >
          <Sparkles />
        </IconButton>
        <IconButton
          label={t("layers.addMask")}
          onClick={() => A.addMask(get().selection ? "selection" : "reveal")}
          testId="add-mask"
        >
          <SquareDashed />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("layers.newFillOrAdjustment")}
              title={t("layers.newFillOrAdjustment")}
              data-testid="new-adjustment-layer"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-4"
            >
              <SlidersHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-96">
            <DropdownMenuItem onSelect={() => A.addFillLayer("solid")}>
              {t("cmd.fillSolid")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => A.addFillLayer("gradient")}>
              {t("cmd.fillGradient")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {ADJUSTMENT_TYPES.map((a) => (
              <DropdownMenuItem
                key={a}
                onSelect={() => openAdjustment(a, "layer")}
                data-testid={`adjustment-layer-${a}`}
              >
                {t(`adjustments.${a}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          label={t("cmd.newGroup")}
          onClick={() => (A.pickedIds().length > 1 ? A.groupLayers() : A.newGroup())}
          testId="new-group"
        >
          <FolderPlus />
        </IconButton>
        <IconButton label={t("cmd.newLayer")} onClick={() => A.addPixelLayer()} testId="new-layer">
          <Plus />
        </IconButton>
        <IconButton label={t("cmd.duplicateLayer")} onClick={() => A.duplicateLayer()}>
          <Copy />
        </IconButton>
        <IconButton
          label={t("cmd.deleteLayer")}
          onClick={() => A.deleteLayer()}
          disabled={
            layers.filter((l) => l.kind !== "group").length <= 1 && active?.kind !== "group"
          }
          testId="delete-layer"
        >
          <Trash />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
