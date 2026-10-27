"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { EditorSplash } from "@/components/editor/editor-splash";
import { loadFont, onFontLoaded } from "@/lib/fonts/loader";
import { refreshLayer } from "@/lib/photo/runtime";
import { closeDocument, openDocument, saveNow } from "@/lib/photo/session";
import { loadPhoto } from "@/lib/photo/storage";
import { get, set, usePhoto } from "@/lib/photo/store";
import { isPainting } from "@/lib/photo/tools";
import { PhotoShell } from "./photo-shell";
import { startTour } from "./tour/tour";

type Status = "loading" | "ready" | "missing" | "error";

/** Saves a moment after the last change, and before the page goes away. */
function usePhotoAutosave() {
  useEffect(() => {
    let timer = 0;
    const unsub = usePhoto.subscribe((s, prev) => {
      if (!s.doc || !s.dirty) return;
      if (
        s.historyIndex === prev.historyIndex &&
        s.history === prev.history &&
        s.doc === prev.doc &&
        s.dirty === prev.dirty
      )
        return;
      window.clearTimeout(timer);
      const later = () => {
        // Never encode in the middle of a brush stroke.
        if (isPainting()) timer = window.setTimeout(later, 400);
        else void saveNow();
      };
      timer = window.setTimeout(later, 800);
    });
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (get().dirty) {
        void saveNow({ final: true });
        e.preventDefault();
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden" && get().dirty) void saveNow({ final: true });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      unsub();
      window.clearTimeout(timer);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
}

/** Loads the fonts text layers use and redraws them when a font arrives. */
function useTextFonts() {
  useEffect(() => {
    const ensure = () => {
      for (const l of get().doc?.layers ?? [])
        if (l.kind === "text") void loadFont(l.text.font, l.text.weight, l.text.italic);
    };
    ensure();
    const unsubDoc = usePhoto.subscribe((s, prev) => {
      if (s.doc !== prev.doc) ensure();
    });
    const unsubFont = onFontLoaded((family) => {
      const d = get().doc;
      if (!d) return;
      let changed = false;
      for (const l of d.layers)
        if (l.kind === "text" && l.text.font === family) {
          refreshLayer(l, d);
          changed = true;
        }
      if (changed) set({ rev: get().rev + 1 });
    });
    return () => {
      unsubDoc();
      unsubFont();
    };
  }, []);
}

export function PhotoApp({ id }: { id: string }) {
  const t = useTranslations("photo");
  const [status, setStatus] = useState<Status>("loading");
  usePhotoAutosave();
  useTextFonts();

  useEffect(() => {
    let cancelled = false;
    loadPhoto(id)
      .then((doc) => {
        if (cancelled) return;
        if (!doc) return setStatus("missing");
        openDocument(doc);
        document.title = `${doc.name} · Lumora Photo`;
        setStatus("ready");
        const url = new URL(window.location.href);
        if (url.searchParams.get("tour") === "1") {
          url.searchParams.delete("tour");
          window.history.replaceState(null, "", url);
          window.setTimeout(() => startTour(true), 400);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[photo] could not open", error);
        setStatus("error");
      });
    return () => {
      cancelled = true;
      if (get().dirty) void saveNow({ final: true });
      closeDocument();
    };
  }, [id]);

  if (status === "loading") return <EditorSplash message={t("loading")} />;
  if (status === "missing") return <EditorSplash error message={t("notFound")} />;
  if (status === "error") return <EditorSplash error message={t("loadError")} />;
  return <PhotoShell />;
}
