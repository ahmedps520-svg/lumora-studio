"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { createImage } from "@/lib/document/factory";
import { loadImage } from "@/lib/engine/images";
import type { ImageElement } from "@/lib/schema";
import { AssetError, importImage } from "@/lib/storage/assets";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";

/**
 * Turns image files (picked, dropped or pasted) into image elements on the
 * current page. `at` is a page point to centre the first image on.
 */
export function useImageImport() {
  const t = useTranslations("editor.uploads");

  return useCallback(
    async (
      files: readonly File[],
      options: { at?: { x: number; y: number }; place?: boolean } = {},
    ): Promise<number> => {
      const format = useEditorStore.getState().design?.format;
      if (!format || files.length === 0) return 0;
      const { at, place = true } = options;
      const elements: ImageElement[] = [];
      const sizes: { width: number; height: number }[] = [];
      for (const file of files.slice(0, 20)) {
        try {
          const asset = await importImage(file);
          sizes.push(asset);
          const offset = elements.length * 24;
          elements.push(
            createImage(format, asset, { at: at && { x: at.x + offset, y: at.y + offset } }),
          );
        } catch (error) {
          const code = error instanceof AssetError ? error.code : "decode";
          toast.error(t(`errors.${code}`, { name: file.name || t("defaultName") }));
        }
      }
      if (!place) return elements.length;
      // Load the pixels first so the image appears instantly, not as a grey box.
      await Promise.all(elements.map((el) => loadImage(el.src).catch(() => undefined)));
      // One photo dropped onto a frame fills it; dropped onto a photo, replaces it.
      const target = at && elements.length === 1 ? editorActions.photoAt(at) : null;
      if (target) {
        const { width, height } = sizes[0]!;
        editorActions.placePhoto({ src: elements[0]!.src, width, height }, { target });
        return 1;
      }
      if (elements.length > 0) editorActions.addElements(elements);
      return elements.length;
    },
    [t],
  );
}

/** Image files in a drag/drop or clipboard payload. */
export function imageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  return [...data.files].filter((f) => f.type.startsWith("image/"));
}
