"use client";

import { useEffect } from "react";

/**
 * Lets `.lumen` surfaces light up where the mouse is: sets `--mx` / `--my` on
 * the one under the pointer, at most once a frame.
 */
export function LumenTracker() {
  useEffect(() => {
    let frame = 0;
    let last: PointerEvent | null = null;
    const update = () => {
      frame = 0;
      const target = last?.target;
      if (!last || !(target instanceof Element)) return;
      const el = target.closest<HTMLElement>(".lumen");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${last.clientX - r.left}px`);
      el.style.setProperty("--my", `${last.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      frame ||= requestAnimationFrame(update);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
