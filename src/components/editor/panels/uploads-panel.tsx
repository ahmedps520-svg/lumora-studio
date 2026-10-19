"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ImageUp, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createImage } from "@/lib/document/factory";
import { loadImage } from "@/lib/engine/images";
import type { AssetRecord } from "@/lib/storage/db";
import {
  ACCEPTED_IMAGE_TYPES,
  assetObjectUrl,
  deleteAsset,
  listAssets,
} from "@/lib/storage/assets";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";
import { cn } from "@/lib/utils";
import { imageFiles, useImageImport } from "../use-image-import";

/** Uploading several files at once only adds them to the library. */
const PLACE_LIMIT = 4;

async function placeAsset(asset: AssetRecord) {
  const format = useEditorStore.getState().design?.format;
  if (!format) return;
  const element = createImage(format, asset);
  await loadImage(element.src).catch(() => undefined);
  // With a frame selected, the photo goes into the frame.
  const frame = editorActions.selectedFrame();
  if (frame) editorActions.fillFrame(frame, element.src);
  else editorActions.addElements([element]);
}

export function UploadsPanel() {
  const t = useTranslations("editor.uploads");
  const importFiles = useImageImport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toDelete, setToDelete] = useState<AssetRecord | null>(null);
  const assets = useLiveQuery(() => listAssets(), []);

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      await importFiles(files, { place: files.length <= PLACE_LIMIT });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="uploads-panel">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(imageFiles(e.dataTransfer));
        }}
        disabled={busy}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/50",
        )}
        data-testid="upload-button"
      >
        <span className="flex size-11 items-center justify-center rounded-xl btn-glow">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImageUp className="size-5" />}
        </span>
        <span className="text-sm font-semibold">{t("upload")}</span>
        <span className="text-xs text-muted-foreground">{t("hint")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        hidden
        data-testid="upload-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void upload(files);
        }}
      />
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
        {t("private")}
      </p>

      {assets && assets.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      )}
      {assets && assets.length > 0 && (
        <ul className="grid grid-cols-2 gap-2" aria-label={t("library")}>
          {assets.map((asset) => (
            <li key={asset.id} className="group relative">
              <button
                type="button"
                onClick={() => void placeAsset(asset)}
                className="block aspect-square w-full overflow-hidden rounded-xl border bg-[conic-gradient(#e2e8f0_25%,#fff_0_50%,#e2e8f0_0_75%,#fff_0)] bg-[length:16px_16px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                title={t("add", { name: asset.name })}
                aria-label={t("add", { name: asset.name })}
                data-testid="upload-item"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
                <img
                  src={assetObjectUrl(asset)}
                  alt=""
                  className="size-full object-contain"
                  draggable={false}
                />
              </button>
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute end-1.5 top-1.5 opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={t("delete", { name: asset.name })}
                onClick={() => setToDelete(asset)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (toDelete) void deleteAsset(toDelete.id);
                setToDelete(null);
              }}
            >
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
