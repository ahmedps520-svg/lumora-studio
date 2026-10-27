"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAiErrorMessage } from "@/components/ai/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as A from "@/lib/photo/actions";
import { createAdjustment } from "@/lib/photo/adjustments";
import { defaultParams, FILTER_BY_ID, type Params } from "@/lib/photo/filters";
import { generativeFill } from "@/lib/photo/generative";
import { get, set, usePhoto, type DialogState } from "@/lib/photo/store";
import type { Adjustment, AdjustmentType, Layer, LayerStyles } from "@/lib/photo/types";
import { cn } from "@/lib/utils";
import { AdjustmentEditor } from "./adjustment-editor";
import { Check, ColorField, NumField, SelectField } from "./controls";
import { COMMANDS, formatKeys, type Command } from "./commands";
import { NewDocumentForm } from "./new-document";
import { TOOL_GROUPS } from "@/lib/photo/store";

const close = () => set({ dialog: null });

function Shell({
  title,
  description,
  children,
  onOk,
  okLabel,
  onCancel,
  wide,
  busy,
  okDisabled,
  testId,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onOk?: () => void;
  okLabel?: string;
  onCancel?: () => void;
  wide?: boolean;
  busy?: boolean;
  okDisabled?: boolean;
  testId?: string;
}) {
  const t = useTranslations("photo.dialogs");
  const cancel = () => {
    onCancel?.();
    close();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && cancel()}>
      <DialogContent
        data-testid={testId}
        className={cn(
          "max-h-[90dvh] gap-3 overflow-y-auto p-5",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (onOk && !okDisabled && !busy) onOk();
          }}
        >
          {children}
          {onOk && (
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={cancel}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={okDisabled || busy} data-testid="dialog-ok">
                {busy && <Loader2 className="animate-spin" />}
                {okLabel ?? t("ok")}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function FilterDialog({ id }: { id: string }) {
  const t = useTranslations("photo");
  const def = FILTER_BY_ID.get(id)!;
  const [params, setParams] = useState<Params>(() => defaultParams(def));
  const [preview, setPreview] = useState(true);

  useEffect(() => {
    if (!preview) {
      A.clearPreview();
      return;
    }
    const timer = window.setTimeout(() => A.previewFilter(id, params), 180);
    return () => window.clearTimeout(timer);
  }, [id, params, preview]);
  useEffect(() => () => A.clearPreview(), []);

  return (
    <Shell
      title={`${t(`filters.names.${id}` as never)}`}
      testId="filter-dialog"
      onCancel={A.clearPreview}
      onOk={() => {
        A.clearPreview();
        A.applyFilter(id, params);
        close();
      }}
    >
      <div className="space-y-2.5">
        {def.params.map((p) => {
          const label = t(`filters.params.${p.key}` as never);
          if (p.type === "range")
            return (
              <NumField
                key={p.key}
                label={label}
                value={Number(params[p.key])}
                min={p.min}
                max={p.max}
                step={p.step ?? 1}
                unit={p.unit}
                slider
                wide
                onChange={(v) => setParams((s) => ({ ...s, [p.key]: v }))}
              />
            );
          if (p.type === "select")
            return (
              <SelectField
                key={p.key}
                label={label}
                value={String(params[p.key])}
                onChange={(v) => setParams((s) => ({ ...s, [p.key]: v }))}
                options={p.options.map((o) => ({
                  value: o,
                  label: t(`filters.options.${o}` as never),
                }))}
                className="justify-between"
              />
            );
          return (
            <Check
              key={p.key}
              label={label}
              checked={Boolean(params[p.key])}
              onChange={(v) => setParams((s) => ({ ...s, [p.key]: v }))}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t pt-2">
        <Check label={t("dialogs.preview")} checked={preview} onChange={setPreview} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setParams(defaultParams(def))}
        >
          {t("dialogs.reset")}
        </Button>
      </div>
    </Shell>
  );
}

// ─── Image → Adjustments ─────────────────────────────────────────────────────

function AdjustmentDialog({ type }: { type: AdjustmentType }) {
  const t = useTranslations("photo");
  const [value, setValue] = useState<Adjustment>(() => createAdjustment(type));
  const [preview, setPreview] = useState(true);
  useEffect(() => {
    if (!preview) {
      A.clearPreview();
      return;
    }
    const timer = window.setTimeout(() => A.previewAdjustment(value), 120);
    return () => window.clearTimeout(timer);
  }, [value, preview]);
  useEffect(() => () => A.clearPreview(), []);
  return (
    <Shell
      title={t(`adjustments.${type}`)}
      testId="adjustment-dialog"
      wide={type === "develop"}
      onCancel={A.clearPreview}
      onOk={() => {
        A.clearPreview();
        A.applyAdjustmentToPixels(value);
        close();
      }}
    >
      <AdjustmentEditor value={value} onChange={setValue} />
      <div className="flex items-center justify-between border-t pt-2">
        <Check label={t("dialogs.preview")} checked={preview} onChange={setPreview} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setValue(createAdjustment(type))}
        >
          {t("dialogs.reset")}
        </Button>
      </div>
    </Shell>
  );
}

// ─── Image / Canvas size ─────────────────────────────────────────────────────

function ImageSizeDialog() {
  const t = useTranslations("photo.dialogs");
  const doc = get().doc!;
  const [w, setW] = useState(doc.width);
  const [h, setH] = useState(doc.height);
  const [res, setRes] = useState(doc.resolution);
  const [lock, setLock] = useState(true);
  const ratio = doc.width / doc.height;
  const max = 8192;
  return (
    <Shell
      title={t("imageSize")}
      testId="image-size-dialog"
      onOk={() => {
        A.imageSize(Math.round(w), Math.round(h), res);
        close();
      }}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("currentSize")}: {doc.width} × {doc.height} px
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label={t("width")}
          value={w}
          min={1}
          max={max}
          unit="px"
          onChange={(v) => {
            setW(v);
            if (lock) setH(Math.max(1, Math.round(v / ratio)));
          }}
          testId="image-width"
        />
        <NumField
          label={t("height")}
          value={h}
          min={1}
          max={max}
          unit="px"
          onChange={(v) => {
            setH(v);
            if (lock) setW(Math.max(1, Math.round(v * ratio)));
          }}
        />
        <NumField
          label={t("percent")}
          value={(w / doc.width) * 100}
          min={1}
          max={1000}
          unit="%"
          onChange={(p) => {
            setW(Math.max(1, Math.round((doc.width * p) / 100)));
            setH(Math.max(1, Math.round((doc.height * p) / 100)));
          }}
        />
        <NumField
          label={t("resolution")}
          value={res}
          min={1}
          max={2400}
          unit="ppi"
          onChange={setRes}
        />
      </div>
      <Check label={t("constrain")} checked={lock} onChange={setLock} />
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("printSize", { w: (w / res).toFixed(2), h: (h / res).toFixed(2) })}
      </p>
    </Shell>
  );
}

function CanvasSizeDialog() {
  const t = useTranslations("photo.dialogs");
  const doc = get().doc!;
  const fg = usePhoto((s) => s.fg);
  const bg = usePhoto((s) => s.bg);
  const [w, setW] = useState(doc.width);
  const [h, setH] = useState(doc.height);
  const [relative, setRelative] = useState(false);
  const [anchor, setAnchor] = useState<[number, number]>([0.5, 0.5]);
  const [ext, setExt] = useState<"background" | "foreground" | "white" | "black" | "transparent">(
    "background",
  );
  const finalW = relative ? doc.width + w : w;
  const finalH = relative ? doc.height + h : h;
  return (
    <Shell
      title={t("canvasSize")}
      testId="canvas-size-dialog"
      okDisabled={finalW < 1 || finalH < 1 || finalW > 8192 || finalH > 8192}
      onOk={() => {
        const color =
          ext === "background"
            ? bg
            : ext === "foreground"
              ? fg
              : ext === "white"
                ? "#FFFFFF"
                : ext === "black"
                  ? "#000000"
                  : null;
        A.canvasSize(Math.round(finalW), Math.round(finalH), anchor, color);
        close();
      }}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("currentSize")}: {doc.width} × {doc.height} px
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label={t("width")}
          value={w}
          min={relative ? -8192 : 1}
          max={8192}
          unit="px"
          onChange={setW}
        />
        <NumField
          label={t("height")}
          value={h}
          min={relative ? -8192 : 1}
          max={8192}
          unit="px"
          onChange={setH}
        />
      </div>
      <Check
        label={t("relative")}
        checked={relative}
        onChange={(r) => {
          setRelative(r);
          setW(r ? 0 : doc.width);
          setH(r ? 0 : doc.height);
        }}
      />
      <div className="flex items-start gap-6">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("anchor")}</p>
          <div className="grid w-fit grid-cols-3 gap-0.5" dir="ltr">
            {[0, 0.5, 1].flatMap((ay) =>
              [0, 0.5, 1].map((ax) => (
                <button
                  key={`${ax}-${ay}`}
                  type="button"
                  aria-label={`${t("anchor")} ${ax},${ay}`}
                  aria-pressed={anchor[0] === ax && anchor[1] === ay}
                  onClick={() => setAnchor([ax, ay])}
                  className={cn(
                    "size-6 rounded-sm border",
                    anchor[0] === ax && anchor[1] === ay
                      ? "bg-primary"
                      : "bg-muted hover:bg-accent",
                  )}
                />
              )),
            )}
          </div>
        </div>
        <SelectField
          label={t("extension")}
          value={ext}
          onChange={setExt}
          options={(["background", "foreground", "white", "black", "transparent"] as const).map(
            (x) => ({ value: x, label: t(`ext.${x}`) }),
          )}
        />
      </div>
    </Shell>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

function ExportDialog() {
  const t = useTranslations("photo.dialogs");
  const doc = get().doc!;
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [quality, setQuality] = useState(0.9);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      title={t("exportAs")}
      testId="export-dialog"
      okLabel={t("export")}
      busy={busy}
      onOk={async () => {
        setBusy(true);
        try {
          await A.exportImage(format, quality, scale);
          close();
        } finally {
          setBusy(false);
        }
      }}
    >
      <SelectField
        label={t("format")}
        value={format}
        onChange={setFormat}
        options={[
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPG" },
          { value: "webp", label: "WebP" },
        ]}
      />
      {format !== "png" && (
        <NumField
          label={t("quality")}
          value={quality}
          min={0.1}
          max={1}
          scale={100}
          unit="%"
          slider
          onChange={setQuality}
        />
      )}
      <NumField
        label={t("scale")}
        value={scale}
        min={0.1}
        max={4}
        scale={100}
        unit="%"
        slider
        onChange={setScale}
      />
      <p className="text-xs text-muted-foreground tabular-nums">
        {Math.round(doc.width * scale)} × {Math.round(doc.height * scale)} px
      </p>
    </Shell>
  );
}

// ─── Fill / Stroke ───────────────────────────────────────────────────────────

function FillDialog() {
  const t = useTranslations("photo.dialogs");
  const hasSel = Boolean(get().selection);
  const [what, setWhat] = useState<
    "foreground" | "background" | "color" | "contentAware" | "black" | "gray" | "white"
  >(hasSel ? "contentAware" : "foreground");
  const [color, setColor] = useState("#FF7A3D");
  const [opacity, setOpacity] = useState(1);
  return (
    <Shell
      title={t("fill")}
      testId="fill-dialog"
      onOk={() => {
        A.fill(what === "color" ? { color } : what, opacity);
        close();
      }}
    >
      <SelectField
        label={t("contents")}
        value={what}
        onChange={setWhat}
        options={(
          ["contentAware", "foreground", "background", "color", "black", "gray", "white"] as const
        )
          .filter((x) => x !== "contentAware" || hasSel)
          .map((x) => ({ value: x, label: t(`fillWith.${x}`) }))}
      />
      {what === "color" && <ColorField value={color} onChange={(c) => c && setColor(c)} />}
      {what !== "contentAware" && (
        <NumField
          label={t("opacity")}
          value={opacity}
          min={0.01}
          max={1}
          scale={100}
          unit="%"
          slider
          onChange={setOpacity}
        />
      )}
    </Shell>
  );
}

function StrokeDialog() {
  const t = useTranslations("photo.dialogs");
  const fg = get().fg;
  const [width, setWidth] = useState(4);
  const [color, setColor] = useState(fg);
  const [pos, setPos] = useState<"inside" | "center" | "outside">("center");
  return (
    <Shell
      title={t("stroke")}
      testId="stroke-dialog"
      onOk={() => {
        A.strokeSelection(width, color, pos);
        close();
      }}
    >
      <NumField label={t("width")} value={width} min={1} max={250} unit="px" onChange={setWidth} />
      <ColorField label={t("color")} value={color} onChange={(c) => c && setColor(c)} />
      <SelectField
        label={t("location")}
        value={pos}
        onChange={setPos}
        options={(["inside", "center", "outside"] as const).map((x) => ({
          value: x,
          label: t(`locations.${x}`),
        }))}
      />
    </Shell>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────

function ModifyDialog({ op }: { op: "expand" | "contract" | "feather" | "border" | "smooth" }) {
  const t = useTranslations("photo");
  const [amount, setAmount] = useState(op === "feather" ? 10 : 5);
  return (
    <Shell
      title={t(`cmd.${op}`)}
      testId="modify-dialog"
      onOk={() => {
        A.modifySelection(op, amount);
        close();
      }}
    >
      <NumField
        label={t(`dialogs.amount.${op}`)}
        value={amount}
        min={1}
        max={op === "smooth" ? 100 : 500}
        unit="px"
        onChange={setAmount}
      />
    </Shell>
  );
}

function ColorRangeDialog() {
  const t = useTranslations("photo.dialogs");
  const fg = get().fg;
  const [color, setColor] = useState(fg);
  const [fuzz, setFuzz] = useState(40);
  const [mode, setMode] = useState<"new" | "add" | "subtract" | "intersect">("new");
  return (
    <Shell
      title={t("colorRange")}
      testId="color-range-dialog"
      onOk={() => {
        A.colorRange(color, fuzz, mode);
        close();
      }}
    >
      <ColorField label={t("sampledColor")} value={color} onChange={(c) => c && setColor(c)} />
      <NumField label={t("fuzziness")} value={fuzz} min={0} max={200} slider onChange={setFuzz} />
      <SelectField
        label={t("selectionMode")}
        value={mode}
        onChange={setMode}
        options={(["new", "add", "subtract", "intersect"] as const).map((m) => ({
          value: m,
          label: t(`modes.${m}`),
        }))}
      />
      <p className="text-xs text-muted-foreground">{t("colorRangeHint")}</p>
    </Shell>
  );
}

// ─── Generative fill ─────────────────────────────────────────────────────────

function GenerativeFillDialog() {
  const t = useTranslations("photo.dialogs");
  const errorMessage = useAiErrorMessage();
  const hasSel = usePhoto((s) => Boolean(s.selection));
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return (
    <Shell
      title={t("generativeFill")}
      description={hasSel ? t("generativeHint") : t("generativeNoSelection")}
      testId="generative-dialog"
      okLabel={t("generate")}
      busy={busy}
      okDisabled={!hasSel}
      onCancel={() => controller.current?.abort()}
      onOk={async () => {
        controller.current = new AbortController();
        setBusy(true);
        try {
          await generativeFill(prompt.trim(), controller.current.signal);
          close();
        } catch (error) {
          if ((error as Error).name !== "AbortError") toast.error(errorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-[#F72585]" /> {t("prompt")}
        </span>
        <textarea
          value={prompt}
          maxLength={400}
          rows={3}
          placeholder={t("promptPlaceholder")}
          onChange={(e) => setPrompt(e.target.value)}
          data-testid="generative-prompt"
          className="w-full resize-none rounded-md border bg-background p-2 text-sm text-foreground outline-none focus:border-ring"
        />
      </label>
      <p className="text-[11px] text-muted-foreground">{t("generativeCost")}</p>
    </Shell>
  );
}

// ─── Layer style ─────────────────────────────────────────────────────────────

function LayerStyleDialog({ layerId }: { layerId: string }) {
  const t = useTranslations("photo.dialogs");
  const layer = get().doc?.layers.find((l) => l.id === layerId);
  const original = useMemo(() => structuredClone(layer?.styles), [layer]);
  const [styles, setStyles] = useState<LayerStyles | undefined>(original);
  const [tab, setTab] = useState<keyof LayerStyles>("dropShadow");
  useEffect(() => {
    if (styles) A.previewLayer(layerId, { styles } as Partial<Layer>);
  }, [styles, layerId]);
  if (!layer || !styles || !original) return null;
  const put = <K extends keyof LayerStyles>(k: K, patch: Partial<LayerStyles[K]>) =>
    setStyles((st) => (st ? { ...st, [k]: { ...st[k], ...patch } } : st));
  const tabs: (keyof LayerStyles)[] = [
    "bevel",
    "stroke",
    "innerShadow",
    "innerGlow",
    "colorOverlay",
    "gradientOverlay",
    "outerGlow",
    "dropShadow",
  ];
  const range = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
    opts: { unit?: string; scale?: number; step?: number } = {},
  ) => (
    <NumField
      label={label}
      value={value}
      min={min}
      max={max}
      step={opts.step}
      scale={opts.scale}
      unit={opts.unit}
      slider
      wide
      onChange={onChange}
    />
  );
  const opacity = (k: keyof LayerStyles) => {
    const e = styles[k] as { opacity?: number };
    return e.opacity === undefined
      ? null
      : range(t("opacity"), e.opacity, 0, 1, (v) => put(k, { opacity: v } as never), {
          scale: 100,
          unit: "%",
        });
  };
  const color = (k: keyof LayerStyles) => {
    const e = styles[k] as { color?: string };
    return e.color === undefined ? null : (
      <ColorField
        label={t("color")}
        value={e.color}
        onChange={(c) => c && put(k, { color: c } as never)}
      />
    );
  };
  const s0 = styles[tab];

  return (
    <Shell
      title={t("layerStyle")}
      wide
      testId="layer-style-dialog"
      onCancel={() => A.previewLayer(layerId, { styles: original } as Partial<Layer>)}
      onOk={() => {
        A.previewLayer(layerId, { styles: original } as Partial<Layer>);
        A.setStyles(layerId, styles);
        close();
      }}
    >
      <div className="grid grid-cols-[11rem_1fr] gap-4">
        <ul className="space-y-0.5">
          {tabs.map((k) => (
            <li key={k}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm",
                  tab === k && "bg-accent",
                )}
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={styles[k].enabled}
                  data-testid={`style-${k}`}
                  onChange={(e) => {
                    put(k, { enabled: e.target.checked } as never);
                    setTab(k);
                  }}
                />
                <button type="button" className="flex-1 text-start" onClick={() => setTab(k)}>
                  {t(`styles.${k}`)}
                </button>
              </label>
            </li>
          ))}
        </ul>
        <div className="space-y-2.5">
          <Check
            label={t("styles.enabled")}
            checked={s0.enabled}
            onChange={(enabled) => put(tab, { enabled } as never)}
          />
          {tab === "bevel" ? (
            <>
              {range(
                t("styles.depth"),
                styles.bevel.depth,
                0.1,
                5,
                (depth) => put("bevel", { depth }),
                { scale: 100, unit: "%" },
              )}
              {range(
                t("styles.size"),
                styles.bevel.size,
                1,
                100,
                (size) => put("bevel", { size }),
                { unit: "px" },
              )}
              {range(
                t("styles.angle"),
                styles.bevel.angle,
                -180,
                180,
                (angle) => put("bevel", { angle }),
                { unit: "°" },
              )}
              {range(
                t("styles.altitude"),
                styles.bevel.altitude,
                0,
                90,
                (altitude) => put("bevel", { altitude }),
                { unit: "°" },
              )}
              <div className="flex flex-wrap items-center gap-4">
                <ColorField
                  label={t("styles.highlight")}
                  value={styles.bevel.highlight}
                  onChange={(c) => c && put("bevel", { highlight: c })}
                />
                <ColorField
                  label={t("styles.shadow")}
                  value={styles.bevel.shadow}
                  onChange={(c) => c && put("bevel", { shadow: c })}
                />
              </div>
              {range(
                t("styles.highlightOpacity"),
                styles.bevel.highlightOpacity,
                0,
                1,
                (v) => put("bevel", { highlightOpacity: v }),
                { scale: 100, unit: "%" },
              )}
              {range(
                t("styles.shadowOpacity"),
                styles.bevel.shadowOpacity,
                0,
                1,
                (v) => put("bevel", { shadowOpacity: v }),
                { scale: 100, unit: "%" },
              )}
            </>
          ) : tab === "gradientOverlay" ? (
            <>
              <div
                className="h-5 rounded border"
                style={{
                  background: `linear-gradient(to right, ${styles.gradientOverlay.from}, ${styles.gradientOverlay.to})`,
                }}
              />
              <div className="flex items-center gap-4">
                <ColorField
                  label={t("styles.from")}
                  value={styles.gradientOverlay.from}
                  onChange={(c) => c && put("gradientOverlay", { from: c })}
                />
                <ColorField
                  label={t("styles.to")}
                  value={styles.gradientOverlay.to}
                  onChange={(c) => c && put("gradientOverlay", { to: c })}
                />
              </div>
              {opacity("gradientOverlay")}
              {range(
                t("styles.angle"),
                styles.gradientOverlay.angle,
                -180,
                180,
                (angle) => put("gradientOverlay", { angle }),
                { unit: "°" },
              )}
            </>
          ) : (
            <>
              {color(tab)}
              {opacity(tab)}
              {(tab === "dropShadow" || tab === "innerShadow") && (
                <>
                  {range(
                    t("styles.angle"),
                    styles[tab].angle,
                    -180,
                    180,
                    (angle) => put(tab, { angle }),
                    { unit: "°" },
                  )}
                  {range(
                    t("styles.distance"),
                    styles[tab].distance,
                    0,
                    500,
                    (distance) => put(tab, { distance }),
                    { unit: "px" },
                  )}
                  {range(t("styles.size"), styles[tab].size, 0, 250, (size) => put(tab, { size }), {
                    unit: "px",
                  })}
                </>
              )}
              {(tab === "outerGlow" || tab === "innerGlow") &&
                range(t("styles.size"), styles[tab].size, 0, 250, (size) => put(tab, { size }), {
                  unit: "px",
                })}
              {tab === "stroke" && (
                <>
                  {range(
                    t("styles.size"),
                    styles.stroke.size,
                    1,
                    250,
                    (size) => put("stroke", { size }),
                    { unit: "px" },
                  )}
                  <SelectField
                    label={t("location")}
                    value={styles.stroke.position}
                    onChange={(position) => put("stroke", { position })}
                    options={(["outside", "center", "inside"] as const).map((x) => ({
                      value: x,
                      label: t(`locations.${x}`),
                    }))}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

// ─── Guides / shortcuts / new ────────────────────────────────────────────────

function NewGuideDialog() {
  const t = useTranslations("photo.dialogs");
  const [axis, setAxis] = useState<"horizontal" | "vertical">("vertical");
  const [at, setAt] = useState(() => Math.round((get().doc?.width ?? 0) / 2));
  return (
    <Shell
      title={t("newGuide")}
      onOk={() => {
        A.addGuide(axis, at);
        close();
      }}
    >
      <SelectField
        label={t("orientation")}
        value={axis}
        onChange={setAxis}
        options={(["horizontal", "vertical"] as const).map((x) => ({
          value: x,
          label: t(`axis.${x}`),
        }))}
      />
      <NumField label={t("position")} value={at} min={0} max={8192} unit="px" onChange={setAt} />
    </Shell>
  );
}

function ShortcutsDialog() {
  const t = useTranslations("photo");
  const entries = (Object.entries(COMMANDS) as [keyof typeof COMMANDS, Command][]).filter(
    ([, c]) => c.keys,
  );
  const others: [string, string][] = [
    ["shortcutsList.space", "Space"],
    ["shortcutsList.brushSize", "[  ]"],
    ["shortcutsList.hardness", "Shift+[  ]"],
    ["shortcutsList.opacity", "1 … 0"],
    ["shortcutsList.swap", "X"],
    ["shortcutsList.defaults", "D"],
    ["shortcutsList.nudge", "← ↑ → ↓"],
    ["shortcutsList.commit", "Enter"],
    ["shortcutsList.cancel", "Esc"],
    ["shortcutsList.cycle", "Shift+letter"],
    ["shortcutsList.sample", "Alt+click"],
    ["shortcutsList.zoomWheel", "Ctrl+wheel"],
  ];
  return (
    <Shell title={t("cmd.shortcuts")} wide testId="shortcuts-dialog">
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase">
            {t("dialogs.tools")}
          </h3>
          <ul className="space-y-0.5 text-sm">
            {TOOL_GROUPS.map((g) => (
              <li key={g.id} className="flex justify-between gap-3">
                <span className="truncate">{g.tools.map((x) => t(`tools.${x}`)).join(" · ")}</span>
                <kbd className="text-xs text-muted-foreground">{g.key}</kbd>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 mb-1.5 text-xs font-semibold text-muted-foreground uppercase">
            {t("dialogs.more")}
          </h3>
          <ul className="space-y-0.5 text-sm">
            {others.map(([k, keys]) => (
              <li key={k} className="flex justify-between gap-3">
                <span>{t(k as never)}</span>
                <kbd dir="ltr" className="text-xs text-muted-foreground">
                  {keys}
                </kbd>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase">
            {t("dialogs.commands")}
          </h3>
          <ul className="space-y-0.5 text-sm">
            {entries.map(([id, c]) => (
              <li key={id} className="flex justify-between gap-3">
                <span className="truncate">{t(`cmd.${id}`)}</span>
                <kbd dir="ltr" className="text-xs whitespace-nowrap text-muted-foreground">
                  {formatKeys(c.keys!)}
                </kbd>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function NewDocumentDialog() {
  const t = useTranslations("photo.dialogs");
  return (
    <Shell title={t("newDocument")} testId="new-document-dialog">
      <NewDocumentForm onDone={close} />
    </Shell>
  );
}

export function DialogHost() {
  const dialog = usePhoto((s) => s.dialog);
  if (!dialog) return null;
  return <DialogSwitch dialog={dialog} />;
}

function DialogSwitch({ dialog }: { dialog: DialogState }) {
  switch (dialog.type) {
    case "filter":
      return <FilterDialog key={dialog.id} id={dialog.id} />;
    case "adjustment":
      return (
        <AdjustmentDialog key={dialog.adjustment} type={dialog.adjustment as AdjustmentType} />
      );
    case "imageSize":
      return <ImageSizeDialog />;
    case "canvasSize":
      return <CanvasSizeDialog />;
    case "newDocument":
      return <NewDocumentDialog />;
    case "export":
      return <ExportDialog />;
    case "fill":
      return <FillDialog />;
    case "stroke":
      return <StrokeDialog />;
    case "modify":
      return <ModifyDialog op={dialog.op} />;
    case "colorRange":
      return <ColorRangeDialog />;
    case "generativeFill":
      return <GenerativeFillDialog />;
    case "layerStyle":
      return <LayerStyleDialog layerId={dialog.layerId} />;
    case "newGuide":
      return <NewGuideDialog />;
    case "shortcuts":
      return <ShortcutsDialog />;
  }
}
