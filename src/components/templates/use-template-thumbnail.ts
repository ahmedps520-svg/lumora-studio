"use client";

import { useEffect, useRef, useState } from "react";
import type { TemplateDef, TemplateLocale } from "@/lib/templates";

const cache = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();

/** Renders one thumbnail at a time so scrolling a big gallery stays smooth. */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * A picture of a template's first page, rendered once it scrolls into view
 * (and cached for the session).
 */
export function useTemplateThumbnail(def: TemplateDef, locale: TemplateLocale, maxSize = 360) {
  const key = `${def.id}:${locale}:${maxSize}`;
  const ref = useRef<HTMLElement | null>(null);
  // Rendered pictures, by key (the session cache covers everything rendered before).
  const [rendered, setRendered] = useState<{ key: string; url: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const url = cache.get(key) ?? (rendered?.key === key ? rendered.url : null);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || cache.has(key)) return;
    let cancelled = false;
    void enqueue(async () => {
      if (cancelled) return;
      const [{ buildTemplate, loadTemplateLibrary }, { renderPageToDataUrl }, { scalePhotos }] =
        await Promise.all([
          import("@/lib/templates"),
          import("@/lib/engine/render"),
          import("@/lib/photos"),
        ]);
      await loadTemplateLibrary();
      const built = buildTemplate(def, locale);
      const page = built.pages[0]!;
      // Small photos for a small picture (×2 keeps them sharp on high-DPI screens).
      const scale = (2 * maxSize) / Math.max(built.format.width, built.format.height);
      const small = { ...page, elements: scalePhotos(page.elements, scale) };
      const data = await renderPageToDataUrl(small, built.format, {
        maxSize,
        mimeType: "jpeg",
        quality: 0.85,
      });
      cache.set(key, data);
      if (!cancelled) setRendered({ key, url: data });
    }).catch((error) => console.warn("[templates] thumbnail failed", def.id, error));
    return () => {
      cancelled = true;
    };
  }, [visible, key, def, locale, maxSize]);

  return { ref, url };
}
