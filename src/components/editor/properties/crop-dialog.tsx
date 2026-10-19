"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clampCrop, coverCrop, cropPatch, type Crop } from "@/lib/document/photo";
import { loadImage } from "@/lib/engine/images";
import type { ImageElement } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { cn } from "@/lib/utils";

const RATIOS = [
  { id: "free", value: null },
  { id: "original", value: 0 },
  { id: "1:1", value: 1 },
  { id: "4:5", value: 4 / 5 },
  { id: "3:4", value: 3 / 4 },
  { id: "3:2", value: 3 / 2 },
  { id: "16:9", value: 16 / 9 },
  { id: "9:16", value: 9 / 16 },
] as const;
type RatioId = (typeof RATIOS)[number]["id"];

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: Exclude<Handle, "move">[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_POS: Record<Exclude<Handle, "move">, string> = {
  nw: "-start-1.5 -top-1.5 cursor-nwse-resize",
  n: "start-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize",
  ne: "-end-1.5 -top-1.5 cursor-nesw-resize",
  e: "-end-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "-end-1.5 -bottom-1.5 cursor-nwse-resize",
  s: "start-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize",
  sw: "-start-1.5 -bottom-1.5 cursor-nesw-resize",
  w: "-start-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
};

/** Applies a drag of (dx, dy) source pixels on one handle, keeping `ratio` if set. */
function dragCrop(start: Crop, handle: Handle, dx: number, dy: number, ratio: number | null): Crop {
  if (handle === "move") return { ...start, x: start.x + dx, y: start.y + dy };
  let { x, y, width, height } = start;
  if (handle.includes("e")) width = start.width + dx;
  if (handle.includes("w")) {
    width = start.width - dx;
    x = start.x + dx;
  }
  if (handle.includes("s")) height = start.height + dy;
  if (handle.includes("n")) {
    height = start.height - dy;
    y = start.y + dy;
  }
  if (ratio) {
    // Width leads for side handles and corners; top/bottom handles lead with height.
    if (handle === "n" || handle === "s") width = height * ratio;
    else height = width / ratio;
    if (handle.includes("w")) x = start.x + start.width - width;
    if (handle.includes("n")) y = start.y + start.height - height;
    if (handle === "n" || handle === "s") x = start.x + (start.width - width) / 2;
    if (handle === "e" || handle === "w") y = start.y + (start.height - height) / 2;
  }
  return { x, y, width: Math.max(8, width), height: Math.max(8, height) };
}

export function CropDialog({
  element,
  open,
  onOpenChange,
}: {
  element: ImageElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("editor.photo");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [ratio, setRatio] = useState<RatioId>("free");
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Crop } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadImage(element.src).then((img) => {
      if (cancelled) return;
      setImage(img);
      const natural = { width: img.naturalWidth, height: img.naturalHeight };
      setCrop(element.crop ?? { x: 0, y: 0, ...natural });
      // Fit the photo in the dialog.
      const scale = Math.min(1, 640 / natural.width, 420 / natural.height);
      setBox({ width: natural.width * scale, height: natural.height * scale });
      setRatio("free");
    });
    return () => {
      cancelled = true;
    };
  }, [open, element.src, element.crop]);

  if (!image || !crop || !box) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cropTitle")}</DialogTitle>
          </DialogHeader>
          <p className="py-12 text-center text-sm text-muted-foreground">{t("loading")}</p>
        </DialogContent>
      </Dialog>
    );
  }

  const natural = { width: image.naturalWidth, height: image.naturalHeight };
  const ds = box.width / natural.width;
  const ratioValue = (() => {
    const r = RATIOS.find((x) => x.id === ratio)!.value;
    return r === 0 ? natural.width / natural.height : r;
  })();

  const choose = (id: RatioId) => {
    setRatio(id);
    const r = RATIOS.find((x) => x.id === id)!.value;
    if (r === null) return;
    const value = r === 0 ? natural.width / natural.height : r;
    setCrop(coverCrop(natural, { width: value, height: 1 }));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const handle = (e.currentTarget.dataset.handle ?? "move") as Handle;
    drag.current = { handle, x: e.clientX, y: e.clientY, start: crop };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const next = dragCrop(
      d.start,
      d.handle,
      (e.clientX - d.x) / ds,
      (e.clientY - d.y) / ds,
      ratioValue,
    );
    // Moving keeps the size; resizing must stay inside the photo.
    if (d.handle === "move") setCrop(clampCrop(next, natural));
    else if (
      next.x >= -0.5 &&
      next.y >= -0.5 &&
      next.x + next.width <= natural.width + 0.5 &&
      next.y + next.height <= natural.height + 0.5
    ) {
      setCrop(clampCrop(next, natural));
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const apply = () => {
    editorActions.updateElement(element.id, cropPatch(element, clampCrop(crop, natural), natural));
    onOpenChange(false);
  };
  const reset = () => {
    setRatio("free");
    setCrop({ x: 0, y: 0, ...natural });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="crop-dialog">
        <DialogHeader>
          <DialogTitle>{t("cropTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("ratio")}>
          {RATIOS.map(({ id }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={ratio === id}
              onClick={() => choose(id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                ratio === id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {id === "free" || id === "original" ? t(`ratios.${id}`) : id}
            </button>
          ))}
        </div>
        <div className="flex justify-center py-2" dir="ltr">
          <div
            className="relative touch-none overflow-hidden rounded-md select-none"
            style={{ width: box.width, height: box.height }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the user's own photo */}
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none size-full"
            />
            <div
              className="absolute cursor-move outline outline-2 outline-white"
              style={{
                left: crop.x * ds,
                top: crop.y * ds,
                width: crop.width * ds,
                height: crop.height * ds,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
              onPointerDown={onPointerDown}
              data-handle="move"
              data-testid="crop-box"
            >
              {/* Rule-of-thirds grid */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border border-white/25" />
                ))}
              </div>
              {HANDLES.map((h) => (
                <span
                  key={h}
                  className={cn(
                    "absolute size-3 rounded-full border-2 border-primary bg-white shadow",
                    HANDLE_POS[h],
                  )}
                  onPointerDown={onPointerDown}
                  data-handle={h}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground tabular-nums" dir="ltr">
          {Math.round(crop.width)} × {Math.round(crop.height)} px
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={reset}>
            {t("resetCrop")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={apply} data-testid="crop-apply">
            {t("applyCrop")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
