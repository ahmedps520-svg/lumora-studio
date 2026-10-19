import { create } from "zustand";
import type { CanvasEngine } from "@/lib/engine/engine";

export type PresentMode = "fullscreen" | "presenter" | "autoplay";

export type EditorPanel =
  "ai" | "templates" | "elements" | "photos" | "text" | "uploads" | "draw" | "layers";

export type DrawToolChoice = "pen" | "marker" | "highlighter" | "eraser";

export interface DrawSettings {
  tool: DrawToolChoice;
  color: string;
  /** Thickness per tool (pen, marker, highlighter remember their own). */
  widths: Record<Exclude<DrawToolChoice, "eraser">, number>;
  opacity: number;
}

interface EditorUiState {
  panel: EditorPanel | null;
  /** The live canvas engine, once mounted (browser only). */
  engine: CanvasEngine | null;
  /** Page rectangle on screen — used for overlays like the page shadow. */
  pageRect: { x: number; y: number; width: number; height: number } | null;
  /** The page thumbnails strip above the bottom bar. */
  pagesOpen: boolean;
  setPagesOpen: (open: boolean) => void;
  /** Set while presenting (rendered by <Presenter />). */
  presenting: { mode: PresentMode; startIndex: number } | null;
  draw: DrawSettings;
  setDraw: (patch: Partial<DrawSettings>) => void;
  present: (mode: PresentMode, startIndex: number) => void;
  stopPresenting: () => void;
  setPanel: (panel: EditorPanel | null) => void;
  togglePanel: (panel: EditorPanel) => void;
}

export const useEditorUi = create<EditorUiState>()((set, get) => ({
  // The AI studio opens by default on wide screens; on small ones the canvas gets the space.
  panel: typeof window !== "undefined" && window.innerWidth < 1024 ? null : "ai",
  engine: null,
  pageRect: null,
  pagesOpen: false,
  setPagesOpen: (pagesOpen) => set({ pagesOpen }),
  presenting: null,
  draw: {
    tool: "pen",
    color: "#1F1235",
    widths: { pen: 6, marker: 16, highlighter: 28 },
    opacity: 1,
  },
  setDraw: (patch) => set((s) => ({ draw: { ...s.draw, ...patch } })),
  present: (mode, startIndex) => set({ presenting: { mode, startIndex } }),
  stopPresenting: () => set({ presenting: null }),
  setPanel: (panel) => set({ panel }),
  togglePanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
}));
