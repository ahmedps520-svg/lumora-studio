"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows a long list a batch at a time: the next batch loads when the end of
 * the list scrolls into view (or when `more` is called). Starts again from the
 * first batch whenever `items` changes.
 */
export function useBatches<T>(items: readonly T[], size: number) {
  const [state, setState] = useState({ items, limit: size });
  const limit = state.items === items ? state.limit : size;
  const sentinel = useRef<HTMLDivElement | null>(null);
  const hasMore = limit < items.length;

  const more = () => setState({ items, limit: limit + size });

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setState((s) => ({ items, limit: (s.items === items ? s.limit : size) + size }));
      },
      { rootMargin: "800px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [items, size, hasMore, limit]);

  return { visible: items.slice(0, limit), hasMore, more, sentinel };
}
