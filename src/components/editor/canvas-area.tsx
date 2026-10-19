"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { CanvasEngine } from "@/lib/engine/engine";
import type { TextElement } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";
import { useEditorUi } from "@/lib/store/ui-store";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ContextItems } from "./menu-items";
import { useCanvasMenu } from "./use-canvas-menu";
import { imageFiles, useImageImport } from "./use-image-import";
import { STOCK_PHOTO_DRAG, stockPhotoFromDrag, useStockPhoto } from "./use-stock-photo";

/**
 * Hosts the Fabric canvas. Fabric wraps the <canvas> in its own DOM, so we
 * create it imperatively inside a host div React never re-renders into.
 */
export function CanvasArea() {
  const t = useTranslations("editor.canvas");
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pageRect = useEditorUi((s) => s.pageRect);
  const importImages = useImageImport();
  const placeStock = useStockPhoto();
  const menu = useCanvasMenu();
  const [dropping, setDropping] = useState(false);

  const hasFiles = (e: DragEvent) =>
    e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes(STOCK_PHOTO_DRAG);

  /** Drop point in page coordinates. */
  const pagePoint = (e: DragEvent) => {
    const engine = useEditorUi.getState().engine;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!engine || !rect) return undefined;
    const [zoom, , , , panX, panY] = engine.canvas.viewportTransform;
    return {
      x: (e.clientX - rect.left - panX) / zoom,
      y: (e.clientY - rect.top - panY) / zoom,
    };
  };

  useEffect(() => {
    const container = containerRef.current;
    const host = hostRef.current;
    if (!container || !host) return;

    const canvasEl = document.createElement("canvas");
    host.appendChild(canvasEl);

    const engine = new CanvasEngine(canvasEl, container, {
      onSelectionChange: (ids) => useEditorStore.getState().select(ids),
      onTransform: (changes) => editorActions.updateElements(changes, { label: "transform" }),
      onTextCommit: (id, element: TextElement | null) => {
        if (!element) return editorActions.deleteElements([id]);
        const { id: _id, type: _type, ...patch } = element;
        editorActions.updateElement(id, patch);
      },
      onTextEditing: (id) => useEditorStore.getState().setEditingText(id),
      onDerived: (changes) => {
        const { pageId, syncDerived } = useEditorStore.getState();
        if (pageId) syncDerived(pageId, changes);
      },
      onDrawn: (element) => editorActions.addElements([element], { select: false, cascade: false }),
      onErase: (ids) => editorActions.deleteElements(ids),
      onViewport: ({ zoom, pageRect }) => {
        useEditorStore.getState().setZoom(zoom);
        useEditorUi.setState({ pageRect });
      },
    });
    useEditorUi.setState({ engine });
    if (process.env.NODE_ENV !== "production") {
      // Debug/e2e handle (development builds only).
      (window as unknown as Record<string, unknown>).__lumora = { engine, store: useEditorStore };
    }

    const render = () => {
      const state = useEditorStore.getState();
      const page = selectCurrentPage(state);
      if (state.design && page) engine.renderPage(page, state.design.format);
    };
    render();
    engine.setSelection(useEditorStore.getState().selection);

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.design !== prev.design || state.pageId !== prev.pageId) render();
      if (state.selection !== prev.selection) engine.setSelection(state.selection);
    });

    return () => {
      unsubscribe();
      useEditorUi.setState({ engine: null, pageRect: null });
      engine.dispose();
      host.replaceChildren();
    };
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          role="application"
          aria-label={t("label")}
          className="absolute inset-0 overflow-hidden bg-canvas-backdrop bg-dots"
          data-testid="canvas-area"
          onDragOver={(e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDropping(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node))
              setDropping(false);
          }}
          onDrop={(e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            setDropping(false);
            const at = pagePoint(e);
            const stock = stockPhotoFromDrag(e.dataTransfer);
            // A photo from the Photos panel fills the frame / replaces the photo it lands on.
            if (stock)
              void placeStock(stock, { target: at ? editorActions.photoAt(at) : null, at });
            else void importImages(imageFiles(e.dataTransfer), { at });
          }}
        >
          {/* Soft page shadow drawn behind the (transparent) canvas. */}
          {pageRect && (
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-[2px] bg-white shadow-[0_30px_70px_-20px_rgb(10_10_20/0.45),0_0_0_1px_rgb(10_10_20/0.06)]"
              style={{
                left: pageRect.x,
                top: pageRect.y,
                width: pageRect.width,
                height: pageRect.height,
              }}
            />
          )}
          <div ref={hostRef} className="absolute inset-0" dir="ltr" />
          {dropping && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 text-sm font-semibold text-primary backdrop-blur-[1px]"
            >
              {t("dropImages")}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64" data-testid="canvas-menu">
        <ContextItems items={menu} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
