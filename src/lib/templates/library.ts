/**
 * The full template library. The hand-written themes and layouts ship with
 * the app; the generated ones — most of the catalogue — are a separate
 * download, fetched the first time the gallery, the editor's Templates panel
 * or a template build needs them.
 */
import { addBlueprints } from "./blueprints";
import { resetCatalog } from "./catalog";
import { addThemes } from "./content";

/** How many templates the full library has, at least (shown as "N+"; a test keeps it honest). */
export const LIBRARY_SIZE = 50_000;

let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export const libraryLoaded = () => loaded;

/** Calls `listener` once the full library has loaded. */
export function subscribeLibrary(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Loads the generated themes and layouts (once; later calls share the same download). */
export function loadTemplateLibrary(): Promise<void> {
  loading ??= Promise.all([import("./content/gen"), import("./blueprints/gen")]).then(
    ([content, layouts]) => {
      addThemes(content.GENERATED_THEMES);
      addBlueprints(layouts.GENERATED_BLUEPRINTS);
      resetCatalog();
      loaded = true;
      for (const listener of listeners) listener();
    },
    (error: unknown) => {
      // Let the next caller try again (a dropped connection, say).
      loading = null;
      throw error;
    },
  );
  return loading;
}
