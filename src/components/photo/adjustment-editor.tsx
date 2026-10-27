"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { curveLut } from "@/lib/photo/adjustments";
import { histogram } from "@/lib/photo/pixels";
import { flatten, readImg } from "@/lib/photo/runtime";
import { get, usePhoto } from "@/lib/photo/store";
import type { Adjustment, Channel, CurvePoint, SelectiveRange } from "@/lib/photo/types";
import { Check, ColorField, NumField, SelectField, SmallButton } from "./controls";

type Props<T extends Adjustment = Adjustment> = {
  value: T;
  /** Live change (preview). */
  onChange: (v: T) => void;
  /** Change finished (one undo step for adjustment layers). */
  onCommit?: (v: T) => void;
};

/** The histogram of the whole picture (recomputed shortly after changes). */
export function useDocHistogram() {
  const rev = usePhoto((s) => s.rev);
  const [h, setH] = useState<ReturnType<typeof histogram> | null>(null);
  const first = useRef(true);
  useEffect(() => {
    const id = window.setTimeout(
      () => {
        first.current = false;
        const d = get().doc;
        if (!d) return;
        const img = readImg(flatten(d));
        setH(histogram(img, Math.max(1, Math.floor((img.width * img.height) / 250_000))));
      },
      first.current ? 0 : 300,
    );
    return () => window.clearTimeout(id);
  }, [rev]);
  return h;
}

export function HistogramGraph({
  channel = "rgb",
  height = 72,
  className,
}: {
  channel?: Channel | "luma";
  height?: number;
  className?: string;
}) {
  const h = useDocHistogram();
  const path = useMemo(() => {
    if (!h) return "";
    const data = channel === "r" ? h.r : channel === "g" ? h.g : channel === "b" ? h.b : h.l;
    let max = 1;
    for (let i = 0; i < 256; i++) max = Math.max(max, data[i]!);
    // Square root keeps small values visible.
    let d = `M0 ${height}`;
    for (let i = 0; i < 256; i++) d += ` L${i} ${height - Math.sqrt(data[i]! / max) * height}`;
    return `${d} L255 ${height} Z`;
  }, [h, channel, height]);
  const color =
    channel === "r"
      ? "#ef4444"
      : channel === "g"
        ? "#22c55e"
        : channel === "b"
          ? "#3b82f6"
          : "currentColor";
  return (
    <svg
      viewBox={`0 0 256 ${height}`}
      preserveAspectRatio="none"
      className={className ?? "h-16 w-full text-muted-foreground"}
      aria-hidden
    >
      <path d={path} fill={color} opacity={0.55} />
    </svg>
  );
}

function CurveEditor({
  points,
  onChange,
  onCommit,
  channel,
}: {
  points: CurvePoint[];
  onChange: (p: CurvePoint[]) => void;
  onCommit: (p: CurvePoint[]) => void;
  channel: Channel;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const table = useMemo(() => curveLut(points), [points]);
  const line = useMemo(() => {
    let d = "";
    for (let i = 0; i < 256; i += 3) d += `${i ? "L" : "M"}${i} ${255 - table[i]!} `;
    return `${d}L255 ${255 - table[255]!}`;
  }, [table]);
  const toPoint = (e: React.PointerEvent): CurvePoint => {
    const r = ref.current!.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 255);
    const y = Math.round(255 - ((e.clientY - r.top) / r.height) * 255);
    return [Math.min(255, Math.max(0, x)), Math.min(255, Math.max(0, y))];
  };
  const stroke =
    channel === "r"
      ? "#ef4444"
      : channel === "g"
        ? "#22c55e"
        : channel === "b"
          ? "#3b82f6"
          : "currentColor";
  return (
    <div className="relative" dir="ltr">
      <HistogramGraph
        channel={channel}
        height={256}
        className="absolute inset-0 h-full w-full text-muted-foreground/60"
      />
      <svg
        ref={ref}
        viewBox="0 0 255 255"
        className="relative aspect-square w-full touch-none rounded-md border text-foreground"
        onPointerDown={(e) => {
          const p = toPoint(e);
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          const hit = points.findIndex(([x, y]) => Math.hypot(x - p[0], y - p[1]) < 10);
          if (hit >= 0) return setDrag(hit);
          const next = [...points, p].sort((a, b) => a[0] - b[0]);
          setDrag(next.findIndex((q) => q === p));
          onChange(next);
        }}
        onPointerMove={(e) => {
          if (drag === null) return;
          const p = toPoint(e);
          const next = points.map((q, i) => (i === drag ? p : q));
          // Dragged far outside: remove the point (not the end points).
          const r = ref.current!.getBoundingClientRect();
          const outside = e.clientY < r.top - 30 || e.clientY > r.bottom + 30;
          if (outside && points.length > 2 && drag !== 0 && drag !== points.length - 1) {
            onChange(points.filter((_, i) => i !== drag));
            setDrag(null);
            return;
          }
          // Keep points in order and the ends at the edges.
          const prev = next[drag - 1];
          const after = next[drag + 1];
          if (prev && p[0] <= prev[0]) p[0] = prev[0] + 1;
          if (after && p[0] >= after[0]) p[0] = after[0] - 1;
          onChange(next);
        }}
        onPointerUp={() => {
          if (drag !== null) onCommit(points);
          setDrag(null);
        }}
      >
        {[64, 128, 192].map((v) => (
          <g key={v} stroke="currentColor" opacity={0.15}>
            <line x1={v} y1={0} x2={v} y2={255} />
            <line x1={0} y1={v} x2={255} y2={v} />
          </g>
        ))}
        <line
          x1={0}
          y1={255}
          x2={255}
          y2={0}
          stroke="currentColor"
          opacity={0.2}
          strokeDasharray="3 3"
        />
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.6} />
        {points.map(([x, y], i) => (
          <rect
            key={i}
            x={x - 4}
            y={255 - y - 4}
            width={8}
            height={8}
            fill={drag === i ? stroke : "var(--background)"}
            stroke={stroke}
          />
        ))}
      </svg>
    </div>
  );
}

const CHANNELS: Channel[] = ["rgb", "r", "g", "b"];

/** Sliders and editors for every adjustment type. */
export function AdjustmentEditor({ value, onChange, onCommit }: Props) {
  const t = useTranslations("photo.adj");
  const commit = (v: Adjustment) => onCommit?.(v);
  const slider = <K extends string>(
    key: K,
    min: number,
    max: number,
    opts: { step?: number; scale?: number; unit?: string; label?: string } = {},
  ) => {
    const v = value as unknown as Record<string, number>;
    return (
      <NumField
        key={key}
        label={opts.label ?? t(key as never)}
        value={v[key] ?? 0}
        min={min}
        max={max}
        step={opts.step}
        scale={opts.scale}
        unit={opts.unit}
        slider
        wide
        onChange={(n) => onChange({ ...value, [key]: n } as Adjustment)}
        onCommit={(n) => commit({ ...value, [key]: n } as Adjustment)}
      />
    );
  };

  switch (value.type) {
    case "brightnessContrast":
      return (
        <div className="space-y-2">
          {slider("brightness", -150, 150)}
          {slider("contrast", -50, 100)}
        </div>
      );
    case "levels": {
      const ch = value.channel;
      const lv = value.levels[ch];
      const set = (patch: Partial<typeof lv>, done = false) => {
        const next = { ...value, levels: { ...value.levels, [ch]: { ...lv, ...patch } } };
        onChange(next);
        if (done) commit(next);
      };
      const num = (key: keyof typeof lv, min: number, max: number, step = 1) => (
        <NumField
          label={t(`levels.${key}`)}
          value={lv[key]}
          min={min}
          max={max}
          step={step}
          slider
          wide
          onChange={(n) => set({ [key]: n })}
          onCommit={(n) => set({ [key]: n }, true)}
        />
      );
      return (
        <div className="space-y-2">
          <SelectField
            label={t("channel")}
            value={ch}
            onChange={(c) => onChange({ ...value, channel: c })}
            options={CHANNELS.map((c) => ({ value: c, label: t(`channels.${c}`) }))}
          />
          <HistogramGraph channel={ch} />
          {num("inBlack", 0, 253)}
          {num("gamma", 0.1, 9.99, 0.01)}
          {num("inWhite", 2, 255)}
          {num("outBlack", 0, 255)}
          {num("outWhite", 0, 255)}
        </div>
      );
    }
    case "curves":
      return <CurvesBlock value={value} onChange={onChange} onCommit={commit} />;
    case "exposure":
      return (
        <div className="space-y-2">
          {slider("exposure", -20, 20, { step: 0.01 })}
          {slider("offset", -0.5, 0.5, { step: 0.001 })}
          {slider("gamma", 0.01, 9.99, { step: 0.01, label: t("gammaCorrection") })}
        </div>
      );
    case "vibrance":
      return (
        <div className="space-y-2">
          {slider("vibrance", -100, 100)}
          {slider("saturation", -100, 100)}
        </div>
      );
    case "hueSaturation":
      return (
        <div className="space-y-2">
          {slider("hue", -180, 180, { unit: "°" })}
          {slider("saturation", -100, 100)}
          {slider("lightness", -100, 100)}
          <Check
            label={t("colorize")}
            checked={value.colorize}
            onChange={(c) => commit(emit(onChange, { ...value, colorize: c }))}
          />
        </div>
      );
    case "colorBalance":
      return <ColorBalanceBlock value={value} onChange={onChange} onCommit={commit} />;
    case "blackWhite":
      return (
        <div className="space-y-2">
          {(["reds", "yellows", "greens", "cyans", "blues", "magentas"] as const).map((k) =>
            slider(k, -200, 300, { unit: "%", label: t(`colors.${k}`) }),
          )}
          <div className="flex items-center gap-2">
            <Check
              label={t("tint")}
              checked={value.tint !== null}
              onChange={(c) => commit(emit(onChange, { ...value, tint: c ? "#E1C38E" : null }))}
            />
            {value.tint && (
              <ColorField
                value={value.tint}
                onChange={(c) => c && commit(emit(onChange, { ...value, tint: c }))}
              />
            )}
          </div>
        </div>
      );
    case "photoFilter":
      return (
        <div className="space-y-2">
          <ColorField
            label={t("color")}
            value={value.color}
            onChange={(c) => c && commit(emit(onChange, { ...value, color: c }))}
          />
          {slider("density", 0, 1, { scale: 100, unit: "%" })}
          <Check
            label={t("preserveLuminosity")}
            checked={value.preserveLuminosity}
            onChange={(c) => commit(emit(onChange, { ...value, preserveLuminosity: c }))}
          />
        </div>
      );
    case "channelMixer":
      return <ChannelMixerBlock value={value} onChange={onChange} onCommit={commit} />;
    case "posterize":
      return (
        <div className="space-y-2">{slider("levels", 2, 255, { label: t("posterizeLevels") })}</div>
      );
    case "threshold":
      return (
        <div className="space-y-2">
          <HistogramGraph channel="luma" />
          {slider("level", 1, 255)}
        </div>
      );
    case "gradientMap":
      return (
        <div className="space-y-2">
          <div
            className="h-5 rounded border"
            style={{
              background: `linear-gradient(to right, ${(value.reverse ? [...value.stops].reverse() : value.stops).map((s) => s.color).join(", ")})`,
            }}
          />
          <div className="flex items-center gap-3">
            {value.stops.map((s, i) => (
              <ColorField
                key={i}
                label={i === 0 ? t("shadowsColor") : t("highlightsColor")}
                value={s.color}
                onChange={(c) =>
                  c &&
                  commit(
                    emit(onChange, {
                      ...value,
                      stops: value.stops.map((x, j) => (j === i ? { ...x, color: c } : x)),
                    }),
                  )
                }
              />
            ))}
          </div>
          <Check
            label={t("reverse")}
            checked={value.reverse}
            onChange={(c) => commit(emit(onChange, { ...value, reverse: c }))}
          />
        </div>
      );
    case "selectiveColor":
      return <SelectiveBlock value={value} onChange={onChange} onCommit={commit} />;
    case "shadowsHighlights":
      return (
        <div className="space-y-2">
          {slider("shadows", 0, 100, { unit: "%" })}
          {slider("highlights", 0, 100, { unit: "%" })}
        </div>
      );
    case "replaceColor":
      return (
        <div className="space-y-2">
          <ColorField
            label={t("color")}
            value={value.color}
            onChange={(c) => c && commit(emit(onChange, { ...value, color: c }))}
          />
          {slider("fuzziness", 0, 200)}
          {slider("hue", -180, 180, { unit: "°" })}
          {slider("saturation", -100, 100)}
          {slider("lightness", -100, 100)}
        </div>
      );
    case "develop":
      return (
        <div className="space-y-3">
          <Group title={t("groups.whiteBalance")}>
            {slider("temperature", -100, 100)}
            {slider("tint", -100, 100, { label: t("tintAmount") })}
          </Group>
          <Group title={t("groups.tone")}>
            {slider("exposure", -5, 5, { step: 0.05 })}
            {slider("contrast", -100, 100)}
            {slider("highlights", -100, 100)}
            {slider("shadows", -100, 100)}
            {slider("whites", -100, 100)}
            {slider("blacks", -100, 100)}
          </Group>
          <Group title={t("groups.presence")}>
            {slider("texture", -100, 100)}
            {slider("clarity", -100, 100)}
            {slider("dehaze", -100, 100)}
            {slider("vibrance", -100, 100)}
            {slider("saturation", -100, 100)}
          </Group>
          <Group title={t("groups.effects")}>
            {slider("vignette", -100, 100)}
            {slider("grain", 0, 100)}
          </Group>
        </div>
      );
    default:
      return <p className="text-xs text-muted-foreground">{t("noSettings")}</p>;
  }
}

const emit = <T,>(onChange: (v: T) => void, v: T) => {
  onChange(v);
  return v;
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function CurvesBlock({
  value,
  onChange,
  onCommit,
}: Props<Extract<Adjustment, { type: "curves" }>>) {
  const t = useTranslations("photo.adj");
  const [ch, setCh] = useState<Channel>("rgb");
  const points = value.curves[ch];
  const put = (p: CurvePoint[]) => ({ ...value, curves: { ...value.curves, [ch]: p } });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SelectField
          label={t("channel")}
          value={ch}
          onChange={setCh}
          options={CHANNELS.map((c) => ({ value: c, label: t(`channels.${c}`) }))}
        />
        <SmallButton
          onClick={() => {
            const next = put([
              [0, 0],
              [255, 255],
            ]);
            onChange(next);
            onCommit?.(next);
          }}
        >
          {t("resetCurve")}
        </SmallButton>
      </div>
      <CurveEditor
        channel={ch}
        points={points}
        onChange={(p) => onChange(put(p))}
        onCommit={(p) => onCommit?.(put(p))}
      />
      <p className="text-[11px] text-muted-foreground">{t("curveHint")}</p>
    </div>
  );
}

function ColorBalanceBlock({
  value,
  onChange,
  onCommit,
}: Props<Extract<Adjustment, { type: "colorBalance" }>>) {
  const t = useTranslations("photo.adj");
  const [tone, setTone] = useState<"shadows" | "midtones" | "highlights">("midtones");
  const v = value[tone];
  const pairs = [
    ["cyan", "red"],
    ["magenta", "green"],
    ["yellow", "blue"],
  ] as const;
  return (
    <div className="space-y-2">
      <SelectField
        label={t("tone")}
        value={tone}
        onChange={setTone}
        options={(["shadows", "midtones", "highlights"] as const).map((x) => ({
          value: x,
          label: t(`tones.${x}`),
        }))}
      />
      {pairs.map(([a, b], i) => (
        <NumField
          key={a}
          label={`${t(`colors.${a}`)} ↔ ${t(`colors.${b}`)}`}
          value={v[i]!}
          min={-100}
          max={100}
          slider
          wide
          onChange={(n) =>
            onChange({
              ...value,
              [tone]: v.map((x, j) => (j === i ? n : x)) as [number, number, number],
            })
          }
          onCommit={(n) =>
            onCommit?.({
              ...value,
              [tone]: v.map((x, j) => (j === i ? n : x)) as [number, number, number],
            })
          }
        />
      ))}
      <Check
        label={t("preserveLuminosity")}
        checked={value.preserveLuminosity}
        onChange={(c) => onCommit?.(emit(onChange, { ...value, preserveLuminosity: c }))}
      />
    </div>
  );
}

function ChannelMixerBlock({
  value,
  onChange,
  onCommit,
}: Props<Extract<Adjustment, { type: "channelMixer" }>>) {
  const t = useTranslations("photo.adj");
  const [out, setOut] = useState<"red" | "green" | "blue">("red");
  const v = value[out];
  return (
    <div className="space-y-2">
      <SelectField
        label={t("outputChannel")}
        value={out}
        onChange={setOut}
        options={(["red", "green", "blue"] as const).map((x) => ({
          value: x,
          label: t(`colors.${x}`),
        }))}
      />
      {(["red", "green", "blue"] as const).map((c, i) => (
        <NumField
          key={c}
          label={t(`colors.${c}`)}
          value={v[i]!}
          min={-200}
          max={200}
          unit="%"
          slider
          wide
          onChange={(n) =>
            onChange({
              ...value,
              [out]: v.map((x, j) => (j === i ? n : x)) as [number, number, number],
            })
          }
          onCommit={(n) =>
            onCommit?.({
              ...value,
              [out]: v.map((x, j) => (j === i ? n : x)) as [number, number, number],
            })
          }
        />
      ))}
      <Check
        label={t("monochrome")}
        checked={value.monochrome}
        onChange={(c) => onCommit?.(emit(onChange, { ...value, monochrome: c }))}
      />
    </div>
  );
}

function SelectiveBlock({
  value,
  onChange,
  onCommit,
}: Props<Extract<Adjustment, { type: "selectiveColor" }>>) {
  const t = useTranslations("photo.adj");
  const ranges: SelectiveRange[] = [
    "reds",
    "yellows",
    "greens",
    "cyans",
    "blues",
    "magentas",
    "whites",
    "neutrals",
    "blacks",
  ];
  const v = value.values[value.range];
  const inks = ["cyan", "magenta", "yellow", "black"] as const;
  const put = (i: number, n: number) => ({
    ...value,
    values: {
      ...value.values,
      [value.range]: v.map((x, j) => (j === i ? n : x)) as [number, number, number, number],
    },
  });
  return (
    <div className="space-y-2">
      <SelectField
        label={t("colorsLabel")}
        value={value.range}
        onChange={(r) => onChange({ ...value, range: r })}
        options={ranges.map((r) => ({ value: r, label: t(`colors.${r}`) }))}
      />
      {inks.map((ink, i) => (
        <NumField
          key={ink}
          label={t(`colors.${ink}`)}
          value={v[i]!}
          min={-100}
          max={100}
          unit="%"
          slider
          wide
          onChange={(n) => onChange(put(i, n))}
          onCommit={(n) => onCommit?.(put(i, n))}
        />
      ))}
      <SelectField
        label={t("method")}
        value={value.absolute ? "absolute" : "relative"}
        onChange={(m) => onCommit?.(emit(onChange, { ...value, absolute: m === "absolute" }))}
        options={[
          { value: "relative", label: t("relative") },
          { value: "absolute", label: t("absolute") },
        ]}
      />
    </div>
  );
}
