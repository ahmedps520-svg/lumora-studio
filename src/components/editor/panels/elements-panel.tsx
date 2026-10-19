"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { createLine, createShape } from "@/lib/document/factory";
import { shapePath } from "@/lib/engine/shapes";
import type { Element, Format, ShapeKind } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";
import { RichElements } from "./rich-elements";

type ShapeKey =
  | "rect"
  | "roundedRect"
  | "ellipse"
  | "triangle"
  | "polygon"
  | "hexagon"
  | "star"
  | "arrow"
  | "diamond"
  | "heart"
  | "speechBubble"
  | "blob";

interface ShapeItem {
  key: ShapeKey;
  kind: ShapeKind;
  extra?: { sides?: number; cornerRadiusRatio?: number };
}

const SHAPES: ShapeItem[] = [
  { key: "rect", kind: "rect" },
  { key: "roundedRect", kind: "rect", extra: { cornerRadiusRatio: 0.15 } },
  { key: "ellipse", kind: "ellipse" },
  { key: "triangle", kind: "triangle" },
  { key: "polygon", kind: "polygon", extra: { sides: 5 } },
  { key: "hexagon", kind: "polygon", extra: { sides: 6 } },
  { key: "star", kind: "star", extra: { sides: 5 } },
  { key: "arrow", kind: "arrow" },
  { key: "diamond", kind: "diamond" },
  { key: "heart", kind: "heart" },
  { key: "speechBubble", kind: "speechBubble" },
  { key: "blob", kind: "blob" },
];

function makeShape(item: ShapeItem, format: Format): Element {
  const shape = createShape(item.kind, format, { sides: item.extra?.sides ?? 5 });
  if (item.extra?.cornerRadiusRatio) {
    shape.cornerRadius = Math.round(shape.width * item.extra.cornerRadiusRatio);
  }
  if (item.kind === "arrow") shape.height = Math.round(shape.width * 0.6);
  return shape;
}

function ShapePreview({ item }: { item: ShapeItem }) {
  const fill = "url(#lumora-tile-gradient)";
  if (item.kind === "rect") {
    return (
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx={item.extra?.cornerRadiusRatio ? 16 : 0}
        fill={fill}
      />
    );
  }
  if (item.kind === "ellipse") return <circle cx="50" cy="50" r="42" fill={fill} />;
  if (item.kind === "triangle") return <path d="M50 8 L92 92 L8 92 Z" fill={fill} />;
  const d = shapePath({
    kind: item.kind,
    sides: item.extra?.sides ?? 5,
    innerRadius: 0.5,
    pathData: null,
  });
  return d ? <path d={d} fill={fill} transform="translate(8 8) scale(0.84)" /> : null;
}

function Tile({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group flex aspect-square items-center justify-center rounded-xl border border-transparent bg-surface-2 p-3.5 transition-all hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg
        viewBox="0 0 100 100"
        className="size-full transition-transform group-hover:scale-105"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

export function ElementsPanel() {
  const t = useTranslations("editor");
  const format = useEditorStore((s) => s.design?.format);
  if (!format) return null;

  return (
    <div className="space-y-6">
      {/* Shared gradient for every tile preview */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="lumora-tile-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF7A3D" />
            <stop offset="0.5" stopColor="#F72585" />
            <stop offset="1" stopColor="#7C6CF2" />
          </linearGradient>
        </defs>
      </svg>
      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t("elements.shapes")}
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {SHAPES.map((item) => (
            <Tile
              key={item.key}
              label={t("elements.add", { name: t(`shapes.${item.key}`) })}
              onClick={() => editorActions.addElements([makeShape(item, format)])}
            >
              <ShapePreview item={item} />
            </Tile>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t("elements.lines")}
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <Tile
            label={t("elements.add", { name: t("shapes.line") })}
            onClick={() => editorActions.addElements([createLine(format)])}
          >
            <line
              x1="10"
              y1="50"
              x2="90"
              y2="50"
              stroke="#F72585"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </Tile>
          <Tile
            label={t("elements.add", { name: t("shapes.dashedLine") })}
            onClick={() => {
              const line = createLine(format);
              line.stroke = {
                ...line.stroke,
                dash: [line.stroke.width * 3, line.stroke.width * 2],
              };
              line.lineCap = "butt";
              editorActions.addElements([line]);
            }}
          >
            <line
              x1="10"
              y1="50"
              x2="90"
              y2="50"
              stroke="#F72585"
              strokeWidth="8"
              strokeDasharray="16 10"
            />
          </Tile>
        </div>
      </section>

      <RichElements format={format} />
    </div>
  );
}
