"use client";

import { useEffect } from "react";
import * as A from "@/lib/photo/actions";
import { get, set } from "@/lib/photo/store";
import {
  cancelTool,
  commitText,
  deletePickedAnchor,
  endPenPath,
  finishCrop,
  finishPolygon,
  nudge,
  toolShortcut,
  useOverlay,
} from "@/lib/photo/tools";
import { commandForCombo, comboOf, runCommand } from "./commands";

const isTyping = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  return Boolean(
    node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)),
  );
};

/** Keyboard shortcuts of the photo editor. */
export function usePhotoShortcuts() {
  useEffect(() => {
    let pasteInPlace = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector("[role=dialog][data-state=open]")) return;
      const s = get();
      if (!s.doc) return;
      const mod = e.ctrlKey || e.metaKey;

      // Enter / Escape finish whatever is in progress.
      if (e.key === "Enter" && !mod) {
        if (s.tool === "pen") return void (e.preventDefault(), endPenPath());
        if (s.transform) return void (e.preventDefault(), A.commitTransform());
        if (useOverlay.getState().crop) return void (e.preventDefault(), finishCrop(true));
        const pts = useOverlay.getState().points;
        if (s.tool === "polyLasso" && pts && pts.length > 2)
          return void (e.preventDefault(), finishPolygon(pts, s.options.selectionMode));
        if (useOverlay.getState().text) return void commitText();
      }
      if (e.key === "Escape") {
        if (s.transform) return void A.cancelTransform();
        if (useOverlay.getState().crop) return void finishCrop(false);
        cancelTool();
        return;
      }

      const combo = comboOf(e);
      // Pasting goes through the paste event, which can read images from the system clipboard.
      if (combo === "Mod+V" || combo === "Mod+Shift+V") {
        pasteInPlace = combo === "Mod+Shift+V";
        return;
      }
      // Delete with the path selection tool removes the picked anchor.
      if (combo === "Delete" && s.tool === "pathSelect" && deletePickedAnchor()) {
        e.preventDefault();
        return;
      }
      const id = commandForCombo(combo);
      if (id) {
        e.preventDefault();
        runCommand(id);
        return;
      }
      // Ctrl+Plus on keyboards that report "+".
      if (mod && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        runCommand("zoomIn");
        return;
      }
      if (mod || e.altKey) return;

      // Arrow keys nudge the layer with the move tool.
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (arrows[e.key] && s.tool === "move") {
        e.preventDefault();
        const k = e.shiftKey ? 10 : 1;
        nudge(arrows[e.key]![0] * k, arrows[e.key]![1] * k);
        return;
      }

      const key = e.key;
      if (key === "[" || key === "]" || key === "{" || key === "}") {
        e.preventDefault();
        const o = s.options;
        const up = key === "]" || key === "}";
        if (e.shiftKey)
          set({
            options: { ...o, hardness: Math.min(1, Math.max(0, o.hardness + (up ? 0.25 : -0.25))) },
          });
        else {
          const step = o.size < 10 ? 1 : o.size < 50 ? 5 : o.size < 100 ? 10 : 25;
          set({
            options: { ...o, size: Math.min(1000, Math.max(1, o.size + (up ? step : -step))) },
          });
        }
        return;
      }
      if (/^[0-9]$/.test(key)) {
        const v = key === "0" ? 1 : Number(key) / 10;
        set({ options: { ...s.options, opacity: v } });
        return;
      }
      if (key.toLowerCase() === "x") return set({ fg: s.bg, bg: s.fg });
      if (key.toLowerCase() === "d") return set({ fg: "#000000", bg: "#FFFFFF" });
      if (key.length === 1 && toolShortcut(key, e.shiftKey)) e.preventDefault();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (
        isTyping(e.target) ||
        !get().doc ||
        document.querySelector("[role=dialog][data-state=open]")
      )
        return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      e.preventDefault();
      void A.paste(pasteInPlace, file);
      pasteInPlace = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, []);
}
