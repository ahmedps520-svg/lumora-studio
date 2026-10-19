"use client";

import { useEffect } from "react";
import type { Design } from "@/lib/schema";
import { saveDesign } from "@/lib/storage/designs";
import { useEditorStore } from "@/lib/store/editor-store";
import { useEditorUi } from "@/lib/store/ui-store";

export const AUTOSAVE_DELAY_MS = 1_200;
const THUMBNAIL_EVERY_MS = 5_000;

/**
 * Saves the open design to IndexedDB a moment after every change, when the tab
 * is hidden or closed, and when the editor unmounts. The latest design is kept
 * in a closure so a final save still works after the store is reset.
 */
export function useAutosave() {
  useEffect(() => {
    let latest: { design: Design; revision: number } | null = null;
    let savedRevision = useEditorStore.getState().savedRevision;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: Promise<void> | null = null;
    let lastThumbnailAt = 0;

    const save = async (forceThumbnail = false): Promise<void> => {
      if (inFlight) {
        await inFlight;
      }
      const target = latest;
      if (!target || target.revision === savedRevision) return;

      const store = useEditorStore.getState();
      const isCurrent = store.design?.id === target.design.id;
      if (isCurrent) store.setSaveState("saving");

      const now = Date.now();
      let thumbnail: string | null | undefined;
      // The home-page thumbnail shows the first page, so only snapshot while it's open.
      const onFirstPage = store.pageId === target.design.pages[0]?.id;
      if (onFirstPage && (forceThumbnail || now - lastThumbnailAt > THUMBNAIL_EVERY_MS)) {
        thumbnail = useEditorUi.getState().engine?.snapshot() ?? undefined;
        if (thumbnail) lastThumbnailAt = now;
      }

      inFlight = saveDesign(target.design, thumbnail === undefined ? {} : { thumbnail })
        .then(() => {
          savedRevision = target.revision;
          const after = useEditorStore.getState();
          if (after.design?.id === target.design.id) {
            after.setSaveState(
              after.revision === target.revision ? "saved" : "unsaved",
              target.revision,
            );
          }
        })
        .catch((error: unknown) => {
          console.error("[autosave] failed", error);
          useEditorStore.getState().setSaveState("error");
          // Try again shortly.
          timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS * 4);
        })
        .finally(() => {
          inFlight = null;
        });
      await inFlight;
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    };

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.design && state.revision !== prev.revision) {
        latest = { design: state.design, revision: state.revision };
        schedule();
      }
    });

    const flush = () => {
      clearTimeout(timer);
      void save(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (latest && latest.revision !== savedRevision) {
        flush();
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
    };
  }, []);
}
