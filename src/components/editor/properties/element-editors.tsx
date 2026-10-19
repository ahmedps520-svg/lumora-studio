"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { normalizeEan13 } from "@/lib/document/codes";
import {
  addTableColumn,
  addTableRow,
  CHART_TYPES,
  removeTableColumn,
  removeTableRow,
  setCellText,
} from "@/lib/document/elements";
import { svgColors } from "@/lib/document/svg";
import { CHART_PALETTE } from "@/lib/engine/composites";
import type { Element } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { cn } from "@/lib/utils";
import { ColorField, Section, SliderField } from "./fields";
import { PhotoCredit, ReplacePhotoButton } from "./replace-photo";

type Of<T extends Element["type"]> = Extract<Element, { type: T }>;

const cellInput =
  "h-8 w-full min-w-16 rounded-md border border-transparent bg-surface-2 px-2 text-xs outline-none hover:border-border focus-visible:border-ring focus-visible:bg-card";

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm">{label}</p>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function PlusMinus({
  label,
  onAdd,
  onRemove,
  canRemove,
}: {
  label: string;
  onAdd: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`− ${label}`}
        >
          <Minus />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={onAdd} aria-label={`+ ${label}`}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}

// ─── Tables ──────────────────────────────────────────────────────────────────

export function TableProperties({ element }: { element: Of<"table"> }) {
  const t = useTranslations("editor.editors");
  const update = (patch: Partial<Of<"table">>, mergeKey?: string) =>
    editorActions.updateElement(element.id, patch, mergeKey);
  const rows = element.rows;
  const cols = Math.max(...rows.map((r) => r.length));
  const resizeRows = (next: Of<"table">["rows"]) => {
    // Keep each row about as tall as before.
    const perRow = element.height / rows.length;
    update({ rows: next, height: Math.round(perRow * next.length) });
  };

  return (
    <Section title={t("table")}>
      <div className="max-h-72 overflow-auto rounded-lg border p-1.5" data-testid="table-cells">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(4rem, 1fr))` }}
        >
          {rows.map((row, r) =>
            Array.from({ length: cols }, (_, c) => (
              <input
                key={`${r}:${c}`}
                className={cn(cellInput, element.headerRow && r === 0 && "font-semibold")}
                value={row[c]?.text ?? ""}
                dir="auto"
                aria-label={t("cell", { row: r + 1, column: c + 1 })}
                onChange={(e) =>
                  update(
                    { rows: setCellText(rows, r, c, e.target.value) },
                    `cell:${element.id}:${r}:${c}`,
                  )
                }
              />
            )),
          )}
        </div>
      </div>
      <PlusMinus
        label={t("rows", { count: rows.length })}
        onAdd={() => resizeRows(addTableRow(rows))}
        onRemove={() => resizeRows(removeTableRow(rows))}
        canRemove={rows.length > 1}
      />
      <PlusMinus
        label={t("columns", { count: cols })}
        onAdd={() => update({ rows: addTableColumn(rows) })}
        onRemove={() => update({ rows: removeTableColumn(rows) })}
        canRemove={cols > 1}
      />
      <Toggle
        label={t("headerRow")}
        checked={element.headerRow}
        onChange={(headerRow) => update({ headerRow })}
      />
      <Toggle
        label={t("stripes")}
        checked={element.stripeFill !== null}
        onChange={(on) => update({ stripeFill: on ? "#F1F5F9" : null })}
      />
      <SliderField
        label={t("fontSize")}
        value={element.fontSize}
        min={8}
        max={96}
        onChange={(fontSize) =>
          update({ fontSize: Math.round(fontSize) }, `table-font:${element.id}`)
        }
      />
      <Labelled label={t("textColor")}>
        <ColorField
          label={t("textColor")}
          value={element.textColor}
          onChange={(textColor) => update({ textColor }, `table-text:${element.id}`)}
        />
      </Labelled>
      {element.headerRow && (
        <Labelled label={t("headerFill")}>
          <ColorField
            label={t("headerFill")}
            value={element.headerFill}
            onChange={(headerFill) => update({ headerFill }, `table-header:${element.id}`)}
          />
        </Labelled>
      )}
      <Labelled label={t("borderColor")}>
        <ColorField
          label={t("borderColor")}
          value={element.borderColor}
          onChange={(borderColor) => update({ borderColor }, `table-border:${element.id}`)}
        />
      </Labelled>
      <SliderField
        label={t("borderWidth")}
        value={element.borderWidth}
        min={0}
        max={12}
        format={(v) => `${v}px`}
        onChange={(borderWidth) => update({ borderWidth }, `table-border-w:${element.id}`)}
      />
    </Section>
  );
}

// ─── Charts ──────────────────────────────────────────────────────────────────

export function ChartProperties({ element }: { element: Of<"chart"> }) {
  const t = useTranslations("editor.editors");
  const tc = useTranslations("editor.elements.chartTypes");
  const update = (patch: Partial<Of<"chart">>, mergeKey?: string) =>
    editorActions.updateElement(element.id, patch, mergeKey);
  const round = element.chartType === "pie" || element.chartType === "donut";
  const series = round ? element.series.slice(0, 1) : element.series;
  const n = Math.max(element.labels.length, ...series.map((s) => s.values.length));

  const setLabel = (i: number, value: string) => {
    const labels = Array.from({ length: n }, (_, k) => element.labels[k] ?? "");
    labels[i] = value;
    update({ labels }, `chart-label:${element.id}:${i}`);
  };
  const setValue = (k: number, i: number, raw: string) => {
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) return;
    const next = element.series.map((s, j) =>
      j === k
        ? {
            ...s,
            values: Array.from({ length: n }, (_, x) => (x === i ? value : (s.values[x] ?? 0))),
          }
        : s,
    );
    update({ series: next }, `chart-value:${element.id}:${k}:${i}`);
  };
  const addRow = () =>
    update({
      labels: [...Array.from({ length: n }, (_, k) => element.labels[k] ?? ""), String(n + 1)],
      series: element.series.map((s) => ({
        ...s,
        values: [...Array.from({ length: n }, (_, x) => s.values[x] ?? 0), 0],
      })),
    });
  const removeRow = () =>
    update({
      labels: element.labels.slice(0, n - 1),
      series: element.series.map((s) => ({ ...s, values: s.values.slice(0, n - 1) })),
    });
  const addSeries = () =>
    update({
      series: [
        ...element.series,
        {
          name: t("seriesName", { number: element.series.length + 1 }),
          values: Array(n).fill(0),
          color: null,
        },
      ],
    });
  const removeSeries = () => update({ series: element.series.slice(0, -1) });
  const colorAt = (i: number) =>
    round
      ? (element.colors[i] ?? CHART_PALETTE[i % CHART_PALETTE.length]!)
      : (element.series[i]?.color ?? element.colors[i] ?? CHART_PALETTE[i % CHART_PALETTE.length]!);
  const setColor = (i: number, color: string) => {
    if (round) {
      const colors = Array.from({ length: Math.max(n, element.colors.length) }, (_, k) =>
        colorAt(k),
      );
      colors[i] = color;
      update({ colors: colors.slice(0, 20) }, `chart-color:${element.id}:${i}`);
    } else {
      update(
        { series: element.series.map((s, k) => (k === i ? { ...s, color } : s)) },
        `chart-color:${element.id}:${i}`,
      );
    }
  };

  return (
    <Section title={t("chart")}>
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={t("chartType")}>
        {CHART_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={element.chartType === type}
            onClick={() => update({ chartType: type })}
            className={cn(
              "rounded-md border px-1 py-1.5 text-xs font-medium transition-colors",
              element.chartType === type
                ? "border-primary bg-primary/10"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {tc(type)}
          </button>
        ))}
      </div>
      <Labelled label={t("chartTitle")}>
        <input
          className={cn(cellInput, "h-9 text-sm")}
          value={element.title}
          dir="auto"
          onChange={(e) => update({ title: e.target.value }, `chart-title:${element.id}`)}
        />
      </Labelled>
      <div className="max-h-80 overflow-auto rounded-lg border p-1.5" data-testid="chart-data">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `minmax(5rem, 1.4fr) repeat(${series.length}, minmax(4rem, 1fr))`,
          }}
        >
          <span className="px-1 py-1 text-xs text-muted-foreground">{t("label")}</span>
          {series.map((s, k) => (
            <input
              key={k}
              className={cn(cellInput, "font-semibold")}
              value={s.name}
              dir="auto"
              aria-label={t("seriesLabel", { number: k + 1 })}
              onChange={(e) =>
                update(
                  {
                    series: element.series.map((x, j) =>
                      j === k ? { ...x, name: e.target.value } : x,
                    ),
                  },
                  `chart-series:${element.id}:${k}`,
                )
              }
            />
          ))}
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="contents">
              <input
                className={cellInput}
                value={element.labels[i] ?? ""}
                dir="auto"
                aria-label={t("rowLabel", { number: i + 1 })}
                onChange={(e) => setLabel(i, e.target.value)}
              />
              {series.map((s, k) => (
                <input
                  key={k}
                  className={cn(cellInput, "tabular-nums")}
                  inputMode="decimal"
                  dir="ltr"
                  defaultValue={s.values[i] ?? 0}
                  aria-label={t("valueLabel", { row: i + 1, series: k + 1 })}
                  onChange={(e) => setValue(k, i, e.target.value)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <PlusMinus
        label={t("dataRows", { count: n })}
        onAdd={addRow}
        onRemove={removeRow}
        canRemove={n > 1}
      />
      {!round && (
        <PlusMinus
          label={t("seriesCount", { count: element.series.length })}
          onAdd={addSeries}
          onRemove={removeSeries}
          canRemove={element.series.length > 1}
        />
      )}
      <Labelled label={t("colors")}>
        <div className="space-y-1.5">
          {Array.from({ length: round ? n : element.series.length }, (_, i) => (
            <ColorField
              key={i}
              label={round ? (element.labels[i] ?? "") : (element.series[i]?.name ?? "")}
              value={colorAt(i)}
              onChange={(color) => setColor(i, color)}
            />
          ))}
        </div>
      </Labelled>
      <Toggle
        label={t("legend")}
        checked={element.showLegend}
        onChange={(showLegend) => update({ showLegend })}
      />
      {!round && (
        <Toggle
          label={t("grid")}
          checked={element.showGrid}
          onChange={(showGrid) => update({ showGrid })}
        />
      )}
      <Toggle
        label={t("values")}
        checked={element.showValues}
        onChange={(showValues) => update({ showValues })}
      />
      <Labelled label={t("textColor")}>
        <ColorField
          label={t("textColor")}
          value={element.textColor}
          onChange={(textColor) => update({ textColor }, `chart-text:${element.id}`)}
        />
      </Labelled>
    </Section>
  );
}

// ─── QR codes and barcodes ───────────────────────────────────────────────────

export function CodeProperties({ element }: { element: Of<"qr"> }) {
  const t = useTranslations("editor.editors");
  const update = (patch: Partial<Of<"qr">>, mergeKey?: string) =>
    editorActions.updateElement(element.id, patch, mergeKey);
  const ean = element.codeType === "ean13";
  const invalid = ean && normalizeEan13(element.value) === null;
  return (
    <Section title={ean ? t("barcode") : t("qr")}>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
        {(["qr", "ean13"] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={element.codeType === type}
            onClick={() => update({ codeType: type })}
            className={cn(
              "rounded-md py-1 text-xs font-medium",
              element.codeType === type ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {type === "qr" ? t("qr") : t("barcode")}
          </button>
        ))}
      </div>
      <Labelled label={ean ? t("barcodeNumber") : t("qrContent")}>
        <Textarea
          value={element.value}
          dir="ltr"
          rows={3}
          onChange={(e) =>
            e.target.value && update({ value: e.target.value }, `code:${element.id}`)
          }
          data-testid="code-value"
        />
      </Labelled>
      {invalid && <p className="text-xs text-destructive">{t("barcodeInvalid")}</p>}
      {!ean && (
        <Labelled label={t("errorCorrection")}>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
            {(["L", "M", "Q", "H"] as const).map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={element.errorCorrection === level}
                title={t(`levels.${level}`)}
                onClick={() => update({ errorCorrection: level })}
                className={cn(
                  "rounded-md py-1 text-xs font-medium",
                  element.errorCorrection === level ? "bg-card shadow-sm" : "text-muted-foreground",
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </Labelled>
      )}
      <Labelled label={t("foreground")}>
        <ColorField
          label={t("foreground")}
          value={element.foreground}
          onChange={(foreground) => update({ foreground }, `code-fg:${element.id}`)}
        />
      </Labelled>
      <Toggle
        label={t("codeBackground")}
        checked={element.background !== null}
        onChange={(on) => update({ background: on ? "#FFFFFF" : null })}
      />
      {element.background && (
        <ColorField
          label={t("codeBackground")}
          value={element.background}
          onChange={(background) => update({ background }, `code-bg:${element.id}`)}
        />
      )}
      <p className="text-xs text-muted-foreground">{t("codeHint")}</p>
    </Section>
  );
}

// ─── Icons and graphics ──────────────────────────────────────────────────────

export function SvgProperties({ element }: { element: Of<"svg"> }) {
  const t = useTranslations("editor.editors");
  const colors = svgColors(element.svg);
  return (
    <Section title={t("graphicColors")}>
      {colors.length === 0 && <p className="text-sm text-muted-foreground">{t("noColors")}</p>}
      {colors.map((original) => (
        <ColorField
          key={original}
          label={original}
          value={element.colorMap[original] ?? (original === "currentColor" ? "#000000" : original)}
          onChange={(color) =>
            editorActions.updateElement(
              element.id,
              { colorMap: { ...element.colorMap, [original]: color } },
              `svg-color:${element.id}:${original}`,
            )
          }
        />
      ))}
    </Section>
  );
}

// ─── Frames ──────────────────────────────────────────────────────────────────

export function FrameProperties({ element }: { element: Of<"frame"> }) {
  const t = useTranslations("editor.editors");
  const update = (patch: Partial<Of<"frame">>, mergeKey?: string) =>
    editorActions.updateElement(element.id, patch, mergeKey);
  const image = element.image;

  return (
    <Section title={t("frame")}>
      <ReplacePhotoButton
        target={{ id: element.id, type: "frame" }}
        empty={!image}
        disabled={element.locked}
      />
      {image && <PhotoCredit attribution={image.attribution} />}
      {!image && <p className="text-xs text-muted-foreground">{t("frameHint")}</p>}
      {image ? (
        <>
          <SliderField
            label={t("zoom")}
            value={Math.round(image.scale * 100)}
            min={100}
            max={400}
            format={(v) => `${v}%`}
            onChange={(v) =>
              update({ image: { ...image, scale: v / 100 } }, `frame-zoom:${element.id}`)
            }
          />
          <SliderField
            label={t("moveX")}
            value={Math.round(image.offsetX)}
            min={-Math.round(element.width)}
            max={Math.round(element.width)}
            onChange={(offsetX) =>
              update({ image: { ...image, offsetX } }, `frame-x:${element.id}`)
            }
          />
          <SliderField
            label={t("moveY")}
            value={Math.round(image.offsetY)}
            min={-Math.round(element.height)}
            max={Math.round(element.height)}
            onChange={(offsetY) =>
              update({ image: { ...image, offsetY } }, `frame-y:${element.id}`)
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => update({ image: null })}
          >
            <Trash2 /> {t("removePhoto")}
          </Button>
        </>
      ) : (
        <Labelled label={t("placeholderColor")}>
          <ColorField
            label={t("placeholderColor")}
            value={element.placeholderColor}
            onChange={(placeholderColor) =>
              update({ placeholderColor }, `frame-color:${element.id}`)
            }
          />
        </Labelled>
      )}
    </Section>
  );
}
