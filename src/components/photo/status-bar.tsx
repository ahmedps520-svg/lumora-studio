"use client";

import { GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { get, set, usePhoto } from "@/lib/photo/store";
import { zoomAt } from "@/lib/photo/tools";
import { startTour } from "./tour/tour";

function ZoomBox() {
  const zoom = usePhoto((s) => s.zoom);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const n = Number(draft);
    setDraft(null);
    if (!Number.isFinite(n) || n <= 0) return;
    const el = document.querySelector<HTMLElement>("[data-testid=photo-viewport]");
    const s = get();
    const c = {
      x: ((el?.clientWidth ?? 0) / 2 - s.pan.x) / s.zoom,
      y: ((el?.clientHeight ?? 0) / 2 - s.pan.y) / s.zoom,
    };
    zoomAt(c, n / 100 / s.zoom);
  };
  return (
    <span className="flex items-center">
      <input
        aria-label="zoom"
        data-testid="zoom-input"
        value={draft ?? String(Math.round(zoom * 1000) / 10)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
        }}
        className="h-5 w-12 rounded bg-transparent text-end tabular-nums outline-none hover:bg-accent focus:bg-accent"
      />
      %
    </span>
  );
}

export function StatusBar() {
  const t = useTranslations("photo");
  const doc = usePhoto((s) => s.doc);
  const cursor = usePhoto((s) => s.cursor);
  const tool = usePhoto((s) => s.tool);
  const selection = usePhoto((s) => s.selection);
  const quickMask = usePhoto((s) => s.quickMask);
  const maskEdit = usePhoto((s) => s.maskEdit);
  return (
    <footer
      className="flex h-6 shrink-0 items-center gap-4 border-t bg-card px-3 text-[11px] text-muted-foreground"
      data-testid="photo-status"
    >
      <ZoomBox />
      {doc && (
        <span className="tabular-nums" dir="ltr">
          {doc.width} × {doc.height} px · {doc.resolution} ppi
        </span>
      )}
      {cursor && (
        <span className="tabular-nums" dir="ltr">
          X {cursor.x} · Y {cursor.y}
        </span>
      )}
      {selection && <span>{t("status.selection")}</span>}
      {quickMask && <span className="text-destructive">{t("quickMask")}</span>}
      {maskEdit && <span className="text-primary">{t("status.maskEdit")}</span>}
      <span className="ms-auto truncate">{t(`hints.${tool}`)}</span>
      <button
        type="button"
        data-testid="status-tutorial"
        className="flex items-center gap-1 font-medium text-primary hover:underline"
        onClick={() => startTour()}
      >
        <GraduationCap className="size-3.5" /> {t("cmd.tutorial")}
      </button>
      <button
        type="button"
        className="hover:text-foreground"
        onClick={() => set({ dialog: { type: "shortcuts" } })}
      >
        {t("cmd.shortcuts")}
      </button>
    </footer>
  );
}
