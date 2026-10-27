"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePhoto } from "@/lib/photo/store";
import { setNavigator } from "./commands";
import { DialogHost } from "./dialogs";
import { PhotoMenuBar } from "./menu-bar";
import { OptionsBar } from "./options-bar";
import { PanelDock } from "./panel-dock";
import { StatusBar } from "./status-bar";
import { TaskBar } from "./task-bar";
import { Toolbar } from "./toolbar";
import { Tour, TourPrompt } from "./tour/tour";
import { usePhotoShortcuts } from "./use-photo-shortcuts";
import { Viewport } from "./viewport";

export function PhotoShell() {
  const router = useRouter();
  const hidePanels = usePhoto((s) => s.hidePanels);
  usePhotoShortcuts();
  useEffect(() => setNavigator((href) => router.push(href)), [router]);

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground select-none"
      data-testid="photo-editor"
    >
      <PhotoMenuBar />
      <OptionsBar />
      <div className="relative flex min-h-0 flex-1">
        {!hidePanels && <Toolbar />}
        <main id="main" className="relative min-w-0 flex-1">
          <Viewport />
          <TaskBar />
        </main>
        {!hidePanels && <PanelDock />}
      </div>
      <StatusBar />
      <DialogHost />
      <Tour />
      <TourPrompt />
    </div>
  );
}
