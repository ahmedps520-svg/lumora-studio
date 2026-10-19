"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { loadImage } from "@/lib/engine/images";
import { photoAttribution, photoUrl, type StockPhoto } from "@/lib/photos";
import { editorActions, type PhotoTarget } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";

/** Drag-and-drop type for built-in photos dragged from the Photos panel. */
export const STOCK_PHOTO_DRAG = "application/x-lumora-photo";

/** The built-in photo in a drag payload, if any. */
export function stockPhotoFromDrag(
  data: DataTransfer | null,
): Pick<StockPhoto, "id" | "author"> | null {
  const raw = data?.getData(STOCK_PHOTO_DRAG);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { id?: unknown; author?: unknown };
    if (typeof value.id !== "string" || typeof value.author !== "string") return null;
    if (!/^[A-Za-z0-9-]{4,80}$/.test(value.id)) return null;
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(value.author)) return null; // also safe in the credit URL
    return { id: value.id, author: value.author };
  } catch {
    return null;
  }
}

/**
 * Places a built-in photo: into the selected (or given) frame, over the
 * selected (or given) photo, or onto the page. Loads it first, at a size that
 * suits the design, so it appears sharp and at once.
 */
export function useStockPhoto() {
  const t = useTranslations("editor.photos");
  return useCallback(
    async (
      photo: Pick<StockPhoto, "id" | "author">,
      options: { target?: PhotoTarget | null; at?: { x: number; y: number } } = {},
    ) => {
      const format = useEditorStore.getState().design?.format;
      if (!format) return null;
      const src = photoUrl(photo.id, Math.max(format.width, format.height));
      try {
        const img = await loadImage(src);
        return editorActions.placePhoto(
          {
            src,
            width: img.naturalWidth,
            height: img.naturalHeight,
            attribution: photoAttribution(photo),
          },
          options,
        );
      } catch {
        toast.error(t("loadFailed"));
        return null;
      }
    },
    [t],
  );
}
