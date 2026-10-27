"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  catalog,
  libraryLoaded,
  loadTemplateLibrary,
  subscribeLibrary,
  type TemplateDef,
} from "@/lib/templates";

/**
 * The template catalogue: the built-in designs at once, growing to the full
 * library when its download (started on first use) finishes.
 */
export function useTemplateCatalog(): { all: TemplateDef[]; ready: boolean } {
  const ready = useSyncExternalStore(subscribeLibrary, libraryLoaded, () => false);
  const all = useSyncExternalStore(subscribeLibrary, catalog, catalog);
  useEffect(() => {
    loadTemplateLibrary().catch((error) =>
      console.warn("[templates] the full library could not load", error),
    );
  }, []);
  return { all, ready };
}
