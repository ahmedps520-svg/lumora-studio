"use client";

import {
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  CircleDashed,
  QrCode,
  ScanBarcode,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHART_TYPES,
  createChart,
  createCode,
  createFrame,
  createIcon,
  createTable,
  FRAME_SHAPES,
  framePath,
  type ChartType,
  type FrameShape,
} from "@/lib/document/elements";
import { shapePath } from "@/lib/engine/shapes";
import type { Format } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { ICON_CATEGORIES, ICON_CATEGORY_IDS, type IconEntry } from "./icon-catalog";

/** The SVG markup of an icon component (rendered once, off screen). */
function iconMarkup(Icon: LucideIcon): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(<Icon size={24} strokeWidth={2} />));
  const markup = host.innerHTML;
  root.unmount();
  return markup;
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

const tileClass =
  "flex aspect-square items-center justify-center rounded-xl border border-transparent bg-surface-2 transition-all hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring";

const pathFor = (shape: FrameShape) =>
  framePath(shape, {
    heart: shapePath({ kind: "heart", sides: 5, innerRadius: 0.5, pathData: null })!,
    blob: shapePath({ kind: "blob", sides: 5, innerRadius: 0.5, pathData: null })!,
    star: shapePath({ kind: "star", sides: 5, innerRadius: 0.5, pathData: null })!,
    hexagon: shapePath({ kind: "polygon", sides: 6, innerRadius: 0.5, pathData: null })!,
  });

function FramePreview({ shape }: { shape: FrameShape }) {
  const fill = "url(#lumora-frame-fill)";
  const d = pathFor(shape);
  return (
    <svg viewBox="0 0 100 100" className="size-3/4" aria-hidden>
      <defs>
        <linearGradient id="lumora-frame-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CBD5E1" />
          <stop offset="1" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      {shape === "circle" ? (
        <circle cx="50" cy="50" r="48" fill={fill} />
      ) : d ? (
        <path
          d={d}
          fill={fill}
          transform={shape === "arch" ? "translate(10 0) scale(0.8 1)" : undefined}
        />
      ) : (
        <rect x="2" y="2" width="96" height="96" rx={shape === "rounded" ? 14 : 0} fill={fill} />
      )}
      {/* Little landscape: "a photo goes here". */}
      <path d="M30 66 L44 50 L54 60 L62 52 L72 66 Z" fill="#fff" opacity="0.85" />
      <circle cx="62" cy="40" r="5" fill="#fff" opacity="0.85" />
    </svg>
  );
}

const CHART_ICONS: Record<ChartType, LucideIcon> = {
  bar: ChartColumn,
  horizontalBar: ChartBar,
  line: ChartLine,
  area: ChartArea,
  pie: ChartPie,
  donut: CircleDashed,
};

const TABLE_SIZES = [
  [2, 2],
  [3, 3],
  [4, 3],
  [5, 4],
] as const;

export function RichElements({ format }: { format: Format }) {
  const t = useTranslations("editor.elements");
  const [query, setQuery] = useState("");
  const [qr, setQr] = useState("");

  const q = query.trim().toLowerCase();
  const matches: IconEntry[] = q
    ? ICON_CATEGORY_IDS.flatMap((id) => ICON_CATEGORIES[id]).filter((icon) => icon.name.includes(q))
    : [];
  const addIcon = (entry: IconEntry) =>
    editorActions.addElements([
      createIcon(format, iconMarkup(entry.icon), entry.name.split(" ")[0] ?? ""),
    ]);
  const iconGrid = (icons: IconEntry[]) => (
    <div className="grid grid-cols-6 gap-1.5">
      {icons.map((entry) => (
        <button
          key={entry.name}
          type="button"
          className={`${tileClass} p-2`}
          aria-label={t("add", { name: entry.name.split(" ")[0] ?? "" })}
          title={entry.name.split(" ")[0]}
          onClick={() => addIcon(entry)}
          data-testid={`icon-${entry.name.split(" ")[0]}`}
        >
          <entry.icon className="size-5 text-foreground" />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <section>
        <Heading>{t("icons")}</Heading>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchIcons")}
            className="ps-8"
            data-testid="icon-search"
          />
        </div>
        {q ? (
          matches.length > 0 ? (
            iconGrid(matches)
          ) : (
            <p className="text-sm text-muted-foreground">{t("noIcons")}</p>
          )
        ) : (
          <div className="space-y-4">
            {ICON_CATEGORY_IDS.map((id) => (
              <div key={id}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {t(`iconCategories.${id}`)}
                </p>
                {iconGrid(ICON_CATEGORIES[id])}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <Heading>{t("frames")}</Heading>
        <p className="mb-2 text-xs text-muted-foreground">{t("framesHint")}</p>
        <div className="grid grid-cols-4 gap-2">
          {FRAME_SHAPES.map((shape) => (
            <button
              key={shape}
              type="button"
              className={tileClass}
              aria-label={t("add", { name: t(`frameShapes.${shape}`) })}
              title={t(`frameShapes.${shape}`)}
              onClick={() =>
                editorActions.addElements([createFrame(format, shape, pathFor(shape))])
              }
              data-testid={`frame-${shape}`}
            >
              <FramePreview shape={shape} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <Heading>{t("tables")}</Heading>
        <div className="grid grid-cols-4 gap-2">
          {TABLE_SIZES.map(([rows, cols]) => (
            <button
              key={`${rows}x${cols}`}
              type="button"
              className={`${tileClass} flex-col gap-1 p-2 text-[11px] font-medium text-muted-foreground`}
              aria-label={t("add", { name: t("tableSize", { rows, cols }) })}
              onClick={() =>
                editorActions.addElements([
                  createTable(
                    format,
                    rows,
                    cols,
                    Array.from({ length: cols }, (_, i) => t("tableHeader", { number: i + 1 })),
                  ),
                ])
              }
              data-testid={`table-${rows}x${cols}`}
            >
              <span
                className="grid size-9 gap-px overflow-hidden rounded bg-border"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {Array.from({ length: rows * cols }, (_, i) => (
                  <span key={i} className={i < cols ? "bg-primary/40" : "bg-card"} />
                ))}
              </span>
              {rows}×{cols}
            </button>
          ))}
        </div>
      </section>

      <section>
        <Heading>{t("charts")}</Heading>
        <div className="grid grid-cols-3 gap-2">
          {CHART_TYPES.map((type) => {
            const Icon = CHART_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                className={`${tileClass} aspect-auto flex-col gap-1.5 py-3 text-[11px] font-medium text-muted-foreground`}
                onClick={() =>
                  editorActions.addElements([
                    createChart(format, type, {
                      title: t("chartSample.title"),
                      labels:
                        type === "pie" || type === "donut"
                          ? [
                              t("chartSample.a"),
                              t("chartSample.b"),
                              t("chartSample.c"),
                              t("chartSample.d"),
                            ]
                          : ["Q1", "Q2", "Q3", "Q4"],
                      series:
                        type === "pie" || type === "donut"
                          ? [{ name: t("chartSample.share"), values: [40, 25, 20, 15] }]
                          : [
                              { name: t("chartSample.thisYear"), values: [12, 19, 15, 24] },
                              { name: t("chartSample.lastYear"), values: [8, 11, 13, 16] },
                            ],
                    }),
                  ])
                }
                data-testid={`chart-${type}`}
              >
                <Icon className="size-6 text-primary" />
                {t(`chartTypes.${type}`)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <Heading>{t("codes")}</Heading>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = qr.trim();
            if (!value) return;
            editorActions.addElements([createCode(format, value)]);
            setQr("");
          }}
        >
          <Input
            value={qr}
            onChange={(e) => setQr(e.target.value)}
            placeholder={t("qrPlaceholder")}
            dir="ltr"
            data-testid="qr-input"
          />
          <Button type="submit" size="sm" disabled={!qr.trim()} data-testid="qr-add">
            <QrCode /> {t("qrAdd")}
          </Button>
        </form>
        <button
          type="button"
          className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => editorActions.addElements([createCode(format, "590123412345", "ean13")])}
        >
          <ScanBarcode className="size-4" /> {t("addBarcode")}
        </button>
      </section>
    </>
  );
}
