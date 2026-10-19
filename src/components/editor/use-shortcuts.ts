"use client";

import { useEffect } from "react";
import { parseClipboardText } from "@/lib/document/clipboard";
import { createLine, createShape, createText } from "@/lib/document/factory";
import { editorActions } from "@/lib/store/actions";
import { pageActions } from "@/lib/store/page-actions";
import { startPresenting } from "./present/present-button";
import { useEditorStore } from "@/lib/store/editor-store";
import { useEditorUi } from "@/lib/store/ui-store";
import { imageFiles, useImageImport } from "./use-image-import";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const el = target;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable ||
    // Fabric's hidden textarea used for inline text editing.
    el.getAttribute("data-fabric") === "textarea"
  );
}

/** True when editor shortcuts should stay out of the way of this event. */
function ignoreEvent(e: Event) {
  const store = useEditorStore.getState();
  if (!store.design || store.editingTextId || isTypingTarget(e.target)) return true;
  // Don't hijack keys inside open menus/dialogs.
  return Boolean(
    e.target instanceof Element && e.target.closest("[role=dialog],[role=menu],[role=listbox]"),
  );
}

/** Global editor keyboard shortcuts. Ignored while typing in a field or editing text. */
export function useEditorShortcuts() {
  const importImages = useImageImport();

  useEffect(() => {
    /** Set by Ctrl+C / Ctrl+X so the native copy/cut event that follows marks the clipboard. */
    let markClipboard = false;
    /** Ctrl+V pastes our elements here unless a real paste event arrives first. */
    let pasteFallback: number | undefined;

    const onClipboardWrite = (e: ClipboardEvent) => {
      if (!markClipboard || ignoreEvent(e)) return;
      markClipboard = false;
      const text = editorActions.clipboardText();
      if (!text) return;
      // The elements go on the system clipboard, so they paste into other tabs and designs too.
      e.clipboardData?.setData("text/plain", text);
      e.preventDefault();
    };

    const onPaste = (e: ClipboardEvent) => {
      if (ignoreEvent(e)) return;
      window.clearTimeout(pasteFallback);
      const files = imageFiles(e.clipboardData);
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const copied = parseClipboardText(text);
      // Whatever was copied most recently wins: our elements, an image, or text.
      if (copied) {
        e.preventDefault();
        editorActions.pasteFromSystem(copied, text);
      } else if (files.length > 0) {
        e.preventDefault();
        void importImages(files);
      } else if (text.trim()) {
        e.preventDefault();
        editorActions.pasteText(text);
      } else if (editorActions.hasClipboard()) {
        e.preventDefault();
        editorActions.paste();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const store = useEditorStore.getState();
      if (!store.design || ignoreEvent(e)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const engine = useEditorUi.getState().engine;
      const handled = () => e.preventDefault();

      if (mod && key === "z" && !e.shiftKey) return (handled(), store.undo());
      if ((mod && key === "z" && e.shiftKey) || (mod && key === "y"))
        return (handled(), store.redo());
      if (mod && key === "d") return (handled(), editorActions.duplicateSelection());
      if (mod && key === "enter") return (handled(), void pageActions.addPage());
      if (mod && e.altKey && key === "p") return (handled(), startPresenting("fullscreen"));
      if (key === "pagedown") return (handled(), pageActions.step(1));
      if (key === "pageup") return (handled(), pageActions.step(-1));
      if (mod && key === "g" && e.shiftKey) return (handled(), editorActions.ungroupSelection());
      if (mod && key === "g") return (handled(), editorActions.groupSelection());
      if (mod && key === "a") return (handled(), editorActions.selectAll());
      if (mod && e.altKey && key === "c") return void (editorActions.copyStyle() && handled());
      if (mod && e.altKey && key === "v") return (handled(), editorActions.pasteStyle());
      if (mod && e.altKey && (key === "]" || key === "}"))
        return (handled(), editorActions.reorderSelection("front"));
      if (mod && e.altKey && (key === "[" || key === "{"))
        return (handled(), editorActions.reorderSelection("back"));
      if (e.altKey && e.shiftKey && key === "l")
        return (handled(), editorActions.toggleLockSelection());
      // Copy/cut/paste let the browser's own clipboard events follow (see above).
      if (mod && key === "c") return void (markClipboard = editorActions.copySelection());
      if (mod && key === "x") {
        markClipboard = editorActions.copySelection();
        return editorActions.deleteSelection();
      }
      if (mod && key === "v") {
        window.clearTimeout(pasteFallback);
        pasteFallback = window.setTimeout(() => {
          if (editorActions.hasClipboard()) editorActions.paste();
        }, 100);
        return;
      }
      if (mod && (key === "]" || key === "}")) {
        return (handled(), editorActions.reorderSelection(e.shiftKey ? "front" : "forward"));
      }
      if (mod && (key === "[" || key === "{")) {
        return (handled(), editorActions.reorderSelection(e.shiftKey ? "back" : "backward"));
      }
      if (mod && (key === "=" || key === "+")) return (handled(), engine?.zoomIn());
      if (mod && key === "-") return (handled(), engine?.zoomOut());
      if (mod && key === "0") return (handled(), engine?.fit());

      if (key === "delete" || key === "backspace")
        return (handled(), editorActions.deleteSelection());
      if (key === "escape") return store.select([]);

      const arrows: Record<string, [number, number]> = {
        arrowleft: [-1, 0],
        arrowright: [1, 0],
        arrowup: [0, -1],
        arrowdown: [0, 1],
      };
      const arrow = arrows[key];
      if (arrow && store.selection.length > 0) {
        const step = e.shiftKey ? 10 : 1;
        return (handled(), editorActions.nudgeSelection(arrow[0] * step, arrow[1] * step));
      }

      // Quick-add keys (no modifiers).
      if (!mod && !e.altKey && !e.shiftKey) {
        const format = store.design.format;
        if (key === "t")
          return (handled(), editorActions.addElements([createText("body", format)]));
        if (key === "r")
          return (handled(), editorActions.addElements([createShape("rect", format)]));
        if (key === "c")
          return (handled(), editorActions.addElements([createShape("ellipse", format)]));
        if (key === "l") return (handled(), editorActions.addElements([createLine(format)]));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("copy", onClipboardWrite);
    window.addEventListener("cut", onClipboardWrite);
    window.addEventListener("paste", onPaste);
    return () => {
      window.clearTimeout(pasteFallback);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("copy", onClipboardWrite);
      window.removeEventListener("cut", onClipboardWrite);
      window.removeEventListener("paste", onPaste);
    };
  }, [importImages]);
}
