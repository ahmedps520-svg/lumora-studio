"use client";

import dynamic from "next/dynamic";
import { useEditorUi } from "@/lib/store/ui-store";
import { BottomBar } from "./bottom-bar";
import { LeftPanel } from "./left-panel";
import { LeftRail } from "./left-rail";
import { Presenter } from "./present/presenter";
import { PropertiesPanel } from "./properties/properties-panel";
import { TopBar } from "./top-bar";
import { useEditorShortcuts } from "./use-shortcuts";

// Fabric is loaded only in the browser, and only once the editor opens.
const CanvasArea = dynamic(() => import("./canvas-area").then((m) => m.CanvasArea), {
  ssr: false,
});

export function EditorShell() {
  useEditorShortcuts();
  const panel = useEditorUi((s) => s.panel);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        <LeftRail />
        {panel && <LeftPanel panel={panel} />}
        <main id="main" className="relative min-w-0 flex-1">
          <CanvasArea />
          <BottomBar />
        </main>
        <PropertiesPanel />
      </div>
      <Presenter />
    </div>
  );
}
