"use client";

import {
  Aperture,
  ChartSpline,
  Contrast,
  Droplets,
  Eclipse,
  Grid2x2,
  Layers2,
  type LucideIcon,
  Palette,
  Paintbrush,
  Rainbow,
  ScanLine,
  SlidersHorizontal,
  Sun,
  SunMoon,
  Sunset,
  SwatchBook,
  Thermometer,
  Wand,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "@/lib/photo/pixels";
import { flatten } from "@/lib/photo/runtime";
import { get, goToHistory, set, usePhoto } from "@/lib/photo/store";
import type { AdjustmentType } from "@/lib/photo/types";
import { cn } from "@/lib/utils";
import { ADJUSTMENT_TYPES, openAdjustment } from "../commands";
import { HistogramGraph } from "../adjustment-editor";
import { useHistoryLabel } from "../labels";
import { CharacterControls } from "./properties-panel";

const ADJ_ICONS: Partial<Record<AdjustmentType, LucideIcon>> = {
  brightnessContrast: Sun,
  levels: ScanLine,
  curves: ChartSpline,
  exposure: Aperture,
  vibrance: Droplets,
  hueSaturation: Rainbow,
  colorBalance: SunMoon,
  blackWhite: Eclipse,
  photoFilter: Thermometer,
  channelMixer: Layers2,
  invert: Contrast,
  posterize: Grid2x2,
  threshold: ScanLine,
  gradientMap: Sunset,
  selectiveColor: Palette,
  shadowsHighlights: SlidersHorizontal,
  desaturate: Paintbrush,
  equalize: SlidersHorizontal,
  replaceColor: SwatchBook,
  develop: Wand,
};

export function AdjustmentsPanel() {
  const t = useTranslations("photo");
  return (
    <div className="grid grid-cols-5 gap-1 p-2">
      {ADJUSTMENT_TYPES.map((a) => {
        const Icon = ADJ_ICONS[a] ?? SlidersHorizontal;
        return (
          <button
            key={a}
            type="button"
            title={t(`adjustments.${a}`)}
            aria-label={t(`adjustments.${a}`)}
            onClick={() => openAdjustment(a, "layer")}
            data-testid={`adj-panel-${a}`}
            className="flex aspect-square items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

export function HistoryPanel() {
  const t = useTranslations("photo");
  const label = useHistoryLabel();
  const history = usePhoto((s) => s.history);
  const index = usePhoto((s) => s.historyIndex);
  const name = usePhoto((s) => s.doc?.name ?? "");
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Scroll the list only (scrollIntoView would also scroll the whole dock).
    const list = ref.current;
    const item = list?.querySelector<HTMLElement>("[aria-current=step]");
    if (!list || !item) return;
    const top = item.offsetTop - list.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = top + item.offsetHeight - list.clientHeight;
  }, [index]);
  return (
    <ol
      ref={ref}
      className="relative min-h-0 flex-1 overflow-y-auto py-1 text-xs"
      aria-label={t("panels.history")}
      data-testid="history-panel"
    >
      <li>
        <button
          type="button"
          aria-current={index === 0 ? "step" : undefined}
          onClick={() => goToHistory(0)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1 text-start hover:bg-accent",
            index === 0 && "bg-primary/12 font-medium",
          )}
        >
          <span className="size-3 rounded-sm border bg-muted" /> {t("history.open", { name })}
        </button>
      </li>
      {history.map((h, i) => (
        <li key={i}>
          <button
            type="button"
            aria-current={index === i + 1 ? "step" : undefined}
            onClick={() => goToHistory(i + 1)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1 text-start hover:bg-accent",
              index === i + 1 && "bg-primary/12 font-medium",
              i + 1 > index && "text-muted-foreground/60",
            )}
          >
            <span className="size-3" />
            {label(h.label)}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function ColorPanel() {
  const t = useTranslations("photo");
  const fg = usePhoto((s) => s.fg);
  const [h, s, l] = rgbToHsl(...hexToRgb(fg));
  const [r, g, b] = hexToRgb(fg);
  const put = (hex: string) => set({ fg: hex.toUpperCase() });
  const row = (
    label: string,
    value: number,
    max: number,
    onChange: (v: number) => void,
    track: string,
  ) => (
    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="w-3">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow"
        style={{ background: track }}
      />
      <span className="w-7 text-end tabular-nums">{Math.round(value)}</span>
    </label>
  );
  return (
    <div className="space-y-1.5 p-3" dir="ltr">
      <div className="flex items-center gap-2">
        <span className="size-6 rounded border" style={{ background: fg }} />
        <input
          aria-label={t("hex")}
          value={fg}
          onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && put(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="h-6 w-20 rounded border bg-background/60 px-1.5 font-mono text-xs uppercase outline-none"
        />
      </div>
      {row(
        "H",
        h * 360,
        360,
        (v) => put(rgbToHex(...hslToRgb(v / 360, s, l))),
        "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
      )}
      {row(
        "S",
        s * 100,
        100,
        (v) => put(rgbToHex(...hslToRgb(h, v / 100, l))),
        `linear-gradient(to right, ${rgbToHex(...hslToRgb(h, 0, l))}, ${rgbToHex(...hslToRgb(h, 1, l))})`,
      )}
      {row(
        "L",
        l * 100,
        100,
        (v) => put(rgbToHex(...hslToRgb(h, s, v / 100))),
        `linear-gradient(to right, #000, ${rgbToHex(...hslToRgb(h, s, 0.5))}, #fff)`,
      )}
      {row(
        "R",
        r,
        255,
        (v) => put(rgbToHex(v, g, b)),
        `linear-gradient(to right, ${rgbToHex(0, g, b)}, ${rgbToHex(255, g, b)})`,
      )}
      {row(
        "G",
        g,
        255,
        (v) => put(rgbToHex(r, v, b)),
        `linear-gradient(to right, ${rgbToHex(r, 0, b)}, ${rgbToHex(r, 255, b)})`,
      )}
      {row(
        "B",
        b,
        255,
        (v) => put(rgbToHex(r, g, v)),
        `linear-gradient(to right, ${rgbToHex(r, g, 0)}, ${rgbToHex(r, g, 255)})`,
      )}
    </div>
  );
}

export function SwatchesPanel() {
  const t = useTranslations("photo");
  const swatches = usePhoto((s) => s.swatches);
  return (
    <div className="flex flex-wrap gap-1 p-2">
      {swatches.map((c, i) => (
        <button
          key={`${c}-${i}`}
          type="button"
          title={`${c} — ${t("swatchHint")}`}
          aria-label={c}
          onClick={(e) => set(e.altKey ? { bg: c } : { fg: c })}
          onContextMenu={(e) => {
            e.preventDefault();
            set({ swatches: get().swatches.filter((_, j) => j !== i) });
          }}
          className="size-5 rounded-sm border shadow-sm"
          style={{ background: c }}
        />
      ))}
      <button
        type="button"
        title={t("addSwatch")}
        aria-label={t("addSwatch")}
        onClick={() => set({ swatches: [...get().swatches, get().fg] })}
        className="flex size-5 items-center justify-center rounded-sm border border-dashed text-xs text-muted-foreground hover:text-foreground"
      >
        +
      </button>
    </div>
  );
}

export function NavigatorPanel() {
  const ref = useRef<HTMLCanvasElement>(null);
  const rev = usePhoto((s) => s.rev);
  const doc = usePhoto((s) => s.doc);
  const zoom = usePhoto((s) => s.zoom);
  const pan = usePhoto((s) => s.pan);
  const W = 232;
  const H = 130;
  const k = doc ? Math.min(W / doc.width, H / doc.height) : 1;
  const ox = doc ? (W - doc.width * k) / 2 : 0;
  const oy = doc ? (H - doc.height * k) / 2 : 0;

  useEffect(() => {
    const c = ref.current;
    if (!c || !doc) return;
    const id = window.setTimeout(() => {
      const g = c.getContext("2d")!;
      g.clearRect(0, 0, W, H);
      g.drawImage(flatten(doc, "#FFFFFF"), ox, oy, doc.width * k, doc.height * k);
    }, 200);
    return () => window.clearTimeout(id);
  }, [rev, doc, k, ox, oy]);

  const view = document.querySelector<HTMLElement>("[data-testid=photo-viewport]");
  const vw = view?.clientWidth ?? 0;
  const vh = view?.clientHeight ?? 0;
  const rect =
    doc && zoom > 0 && vw > 0
      ? {
          x: ox + (-pan.x / zoom) * k,
          y: oy + (-pan.y / zoom) * k,
          w: (vw / zoom) * k,
          h: (vh / zoom) * k,
        }
      : null;

  const jump = (e: React.PointerEvent) => {
    if (!doc || e.buttons !== 1) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = (e.clientX - r.left - ox) / k;
    const dy = (e.clientY - r.top - oy) / k;
    set({ pan: { x: vw / 2 - dx * zoom, y: vh / 2 - dy * zoom } });
  };

  return (
    <div className="space-y-2 p-2" dir="ltr">
      <div
        className="relative mx-auto touch-none"
        style={{ width: W, height: H }}
        onPointerDown={jump}
        onPointerMove={jump}
      >
        <canvas ref={ref} width={W} height={H} className="rounded bg-muted" />
        {rect && (
          <span
            className="pointer-events-none absolute border-2 border-[#F72585]"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
        )}
      </div>
      <input
        type="range"
        aria-label="zoom"
        min={-4.6}
        max={3.46}
        step={0.01}
        value={Math.log(zoom || 1)}
        onChange={(e) => {
          const z = Math.exp(Number(e.target.value));
          const cx = (vw / 2 - pan.x) / zoom;
          const cy = (vh / 2 - pan.y) / zoom;
          set({ zoom: z, pan: { x: vw / 2 - cx * z, y: vh / 2 - cy * z } });
        }}
        className="w-full accent-primary"
      />
    </div>
  );
}

export function HistogramPanel() {
  return (
    <div className="space-y-1 p-2">
      <HistogramGraph channel="luma" className="h-20 w-full text-foreground/70" />
      <div className="grid grid-cols-3 gap-1">
        <HistogramGraph channel="r" className="h-10 w-full" />
        <HistogramGraph channel="g" className="h-10 w-full" />
        <HistogramGraph channel="b" className="h-10 w-full" />
      </div>
    </div>
  );
}

export function InfoPanel() {
  const t = useTranslations("photo.info");
  const cursor = usePhoto((s) => s.cursor);
  const doc = usePhoto((s) => s.doc);
  const selection = usePhoto((s) => s.selection);
  const rgba = cursor?.rgba;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 p-3 text-xs tabular-nums" dir="ltr">
      <dt className="text-muted-foreground">X / Y</dt>
      <dd>{cursor ? `${cursor.x}, ${cursor.y}` : "—"}</dd>
      <dt className="text-muted-foreground">R G B</dt>
      <dd>{rgba ? `${rgba[0]} ${rgba[1]} ${rgba[2]}` : "—"}</dd>
      <dt className="text-muted-foreground">{t("alpha")}</dt>
      <dd>{rgba ? `${Math.round((rgba[3] / 255) * 100)}%` : "—"}</dd>
      <dt className="text-muted-foreground">HEX</dt>
      <dd className="flex items-center gap-1.5">
        {rgba && (
          <span
            className="size-3 rounded-sm border"
            style={{ background: rgbToHex(rgba[0], rgba[1], rgba[2]) }}
          />
        )}
        {rgba ? rgbToHex(rgba[0], rgba[1], rgba[2]) : "—"}
      </dd>
      <dt className="text-muted-foreground">{t("document")}</dt>
      <dd>{doc ? `${doc.width} × ${doc.height}` : "—"}</dd>
      <dt className="text-muted-foreground">{t("selection")}</dt>
      <dd>{selection ? t("active") : t("none")}</dd>
    </dl>
  );
}

export function CharacterPanel() {
  const layer = usePhoto((s) => s.doc?.layers.find((l) => l.id === s.activeId) ?? null);
  return (
    <div className="p-3">
      <CharacterControls layer={layer?.kind === "text" ? layer : null} />
    </div>
  );
}
