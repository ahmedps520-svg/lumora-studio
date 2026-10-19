"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DocumentError } from "@/lib/document/migrations";
import { loadDesign } from "@/lib/storage/designs";
import { useEditorStore } from "@/lib/store/editor-store";
import { EditorShell } from "./editor-shell";
import { EditorSplash } from "./editor-splash";
import { useAutosave } from "./use-autosave";

type Status = "loading" | "ready" | "missing" | "newer" | "error";

export function EditorApp({ id }: { id: string }) {
  const t = useTranslations("editor");
  const [status, setStatus] = useState<Status>("loading");

  // Declared before the loader effect so its final save runs before the store is reset.
  useAutosave();

  useEffect(() => {
    let cancelled = false;
    loadDesign(id)
      .then((result) => {
        if (cancelled) return;
        if (!result) return setStatus("missing");
        useEditorStore.getState().load(result.design);
        document.title = `${result.design.name} · Lumora Studio`;
        if (result.repaired > 0) toast.warning(t("repaired", { count: result.repaired }));
        if (result.fromSnapshot) toast.info(t("fromSnapshot"));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[editor] could not open design", error);
        setStatus(
          error instanceof DocumentError && error.code === "newer-version" ? "newer" : "error",
        );
      });
    return () => {
      cancelled = true;
      useEditorStore.getState().close();
    };
  }, [id, t]);

  if (status === "loading") return <EditorSplash />;
  if (status === "missing") return <EditorSplash error message={t("notFound")} />;
  if (status === "newer") return <EditorSplash error message={t("newerVersion")} />;
  if (status === "error") return <EditorSplash error message={t("loadError")} />;
  return <EditorShell />;
}
