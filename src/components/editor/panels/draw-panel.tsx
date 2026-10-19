"use client";

import { Eraser, Highlighter, PenLine, PenTool, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useEditorUi, type DrawToolChoice } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { SliderField } from "../properties/fields";

const TOOLS: { id: DrawToolChoice; icon: LucideIcon }[] = [
  { id: "pen", icon: PenLine },
  { id: "marker", icon: PenTool },
  { id: "highlighter", icon: Highlighter },
  { id: "eraser", icon: Eraser },
];

const COLORS = [
  "#1F1235",
  "#FFFFFF",
  "#F72585",
  "#FF7A3D",
  "#FFD166",
  "#06D6A0",
  "#4CC9F0",
  "#3A86FF",
  "#7C6CF2",
  "#8D6E63",
];

/** Highlighters are see-through by nature. */
const HIGHLIGHTER_OPACITY = 0.4;

/** Draw panel: while it's open the canvas is in drawing mode. */
export function DrawPanel() {
  const t = useTranslations("editor.draw");
  const engine = useEditorUi((s) => s.engine);
  const draw = useEditorUi((s) => s.draw);
  const setDraw = useEditorUi((s) => s.setDraw);
  const eraser = draw.tool === "eraser";
  const width = eraser ? 0 : draw.widths[draw.tool as Exclude<DrawToolChoice, "eraser">];
  const opacity = draw.tool === "highlighter" ? HIGHLIGHTER_OPACITY : draw.opacity;

  useEffect(() => {
    if (!engine) return;
    engine.setDrawMode(
      eraser ? { tool: "eraser" } : { tool: draw.tool as "pen", color: draw.color, width, opacity },
    );
  }, [engine, eraser, draw.tool, draw.color, width, opacity]);

  // Leaving the panel goes back to selecting.
  useEffect(() => () => engine?.setDrawMode(null), [engine]);

  return (
    <div className="space-y-5" data-testid="draw-panel">
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("tools")}>
        {TOOLS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={draw.tool === id}
            onClick={() => setDraw({ tool: id })}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-xs font-medium transition-colors",
              draw.tool === id
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-testid={`draw-${id}`}
          >
            <Icon className="size-5" style={id !== "eraser" ? { color: draw.color } : undefined} />
            {t(id)}
          </button>
        ))}
      </div>

      {eraser ? (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          {t("eraserHint")}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {t("color")}
            </p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={draw.color === color}
                  onClick={() => setDraw({ color })}
                  className={cn(
                    "size-8 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110",
                    draw.color === color && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label
                className="relative size-8 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] ring-1 ring-black/10"
                title={t("custom")}
              >
                <input
                  type="color"
                  value={draw.color}
                  onChange={(e) => setDraw({ color: e.target.value.toUpperCase() })}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  aria-label={t("custom")}
                />
              </label>
            </div>
          </div>
          <SliderField
            label={t("thickness")}
            value={width}
            min={1}
            max={draw.tool === "pen" ? 40 : 100}
            format={(v) => `${v}px`}
            onChange={(v) => setDraw({ widths: { ...draw.widths, [draw.tool]: Math.round(v) } })}
          />
          {draw.tool !== "highlighter" && (
            <SliderField
              label={t("transparency")}
              value={Math.round(draw.opacity * 100)}
              min={10}
              max={100}
              format={(v) => `${v}%`}
              onChange={(v) => setDraw({ opacity: v / 100 })}
            />
          )}
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </>
      )}
    </div>
  );
}
