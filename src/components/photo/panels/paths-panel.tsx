"use client";

import { Brush, PaintBucket, Plus, Route, SquareDashed, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import * as A from "@/lib/photo/actions";
import { pathBounds, pathD } from "@/lib/photo/paths";
import { set, usePhoto } from "@/lib/photo/store";
import type { PhotoPath } from "@/lib/photo/types";
import { cn } from "@/lib/utils";

const NO_PATHS: PhotoPath[] = [];

function usePathName() {
  const t = useTranslations("photo.paths");
  return (p: PhotoPath) => {
    if (p.name === "Work Path") return t("workPath");
    const n = /^Path (\d+)$/.exec(p.name);
    return n ? t("pathN", { n: n[1]! }) : p.name;
  };
}

/** A small outline of the path, scaled into the row. */
function PathThumb({ path }: { path: PhotoPath }) {
  const doc = usePhoto((s) => s.doc);
  const b = pathBounds(path);
  const w = doc?.width ?? 1;
  const h = doc?.height ?? 1;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-7 w-9 shrink-0 rounded-sm border bg-white"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {b && (
        <path
          d={pathD(path)}
          fill="rgba(30,144,255,0.25)"
          stroke="#1E90FF"
          strokeWidth={Math.max(w, h) / 60}
        />
      )}
    </svg>
  );
}

function PathRow({ path }: { path: PhotoPath }) {
  const t = useTranslations("photo.paths");
  const nameOf = usePathName();
  const active = usePhoto((s) => s.activePathId === path.id);
  const [editing, setEditing] = useState(false);
  return (
    <li
      data-testid="path-row"
      data-active={active || undefined}
      onClick={() => set({ activePathId: active ? null : path.id })}
      className={cn(
        "flex h-10 cursor-pointer items-center gap-2 border-b px-2 text-xs select-none",
        active ? "bg-primary/15" : "hover:bg-accent/60",
      )}
    >
      <PathThumb path={path} />
      {editing ? (
        <input
          autoFocus
          defaultValue={nameOf(path)}
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
            if (v && v !== nameOf(path)) A.renamePath(path.id, v);
          }}
          className="h-5 w-full rounded border bg-background px-1 text-xs outline-none"
        />
      ) : (
        <span
          className={cn("truncate", path.name === "Work Path" && "italic")}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {nameOf(path)}
        </span>
      )}
    </li>
  );
}

export function PathsPanel() {
  const t = useTranslations("photo");
  const paths = usePhoto((s) => s.doc?.paths ?? NO_PATHS);
  const hasActive = usePhoto((s) => Boolean(s.activePathId));
  const hasSelection = usePhoto((s) => Boolean(s.selection));
  const button =
    "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 [&_svg]:size-4";
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="paths-panel">
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={t("panels.paths")}>
        {paths.map((p) => (
          <PathRow key={p.id} path={p} />
        ))}
        {!paths.length && <li className="p-3 text-xs text-muted-foreground">{t("paths.empty")}</li>}
      </ul>
      <div className="flex items-center justify-end gap-0.5 border-t px-1.5 py-1">
        <button
          type="button"
          className={button}
          title={t("cmd.fillPath")}
          aria-label={t("cmd.fillPath")}
          disabled={!hasActive}
          onClick={() => A.paintPath("fill")}
        >
          <PaintBucket />
        </button>
        <button
          type="button"
          className={button}
          title={t("cmd.strokePath")}
          aria-label={t("cmd.strokePath")}
          disabled={!hasActive}
          onClick={() => A.paintPath("stroke")}
        >
          <Brush />
        </button>
        <button
          type="button"
          className={button}
          title={t("cmd.pathToSelection")}
          aria-label={t("cmd.pathToSelection")}
          disabled={!hasActive}
          data-testid="path-to-selection"
          onClick={() => A.pathToSelection()}
        >
          <SquareDashed />
        </button>
        <button
          type="button"
          className={button}
          title={t("cmd.selectionToPath")}
          aria-label={t("cmd.selectionToPath")}
          disabled={!hasSelection}
          onClick={A.selectionToPath}
        >
          <Route />
        </button>
        <button
          type="button"
          className={button}
          title={t("cmd.newPath")}
          aria-label={t("cmd.newPath")}
          onClick={() => A.newPath()}
        >
          <Plus />
        </button>
        <button
          type="button"
          className={button}
          title={t("cmd.deletePath")}
          aria-label={t("cmd.deletePath")}
          disabled={!hasActive}
          onClick={() => A.deletePath()}
        >
          <Trash />
        </button>
      </div>
    </div>
  );
}
