"use client";

import { useEffect, useState } from "react";
import type { Page } from "@/lib/schema";

/** Rendered thumbnails, keyed by the (immutable) page object — unchanged pages never re-render. */
const cache = new WeakMap<Page, string>();
let queue: Promise<unknown> = Promise.resolve();

/**
 * A small preview of a page. Edits to the open page re-render after a short
 * pause; renders run one at a time so many pages don't stall the editor.
 */
export function usePageThumbnail(
  page: Page,
  format: { width: number; height: number },
  options: { maxSize?: number; delay?: number } = {},
): string | null {
  const { maxSize = 240, delay = 450 } = options;
  const [rendered, setRendered] = useState<string | null>(null);

  useEffect(() => {
    if (cache.has(page)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      queue = queue
        .then(async () => {
          if (cancelled) return;
          const { renderPageToDataUrl } = await import("@/lib/engine/render");
          const url = await renderPageToDataUrl(page, format, { maxSize, mimeType: "jpeg" });
          cache.set(page, url);
          if (!cancelled) setRendered(url);
        })
        .catch((error: unknown) => console.warn("Page thumbnail failed", error));
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, format, maxSize, delay]);

  // The previous render stays on screen until the new one is ready (no flicker).
  return cache.get(page) ?? rendered;
}
