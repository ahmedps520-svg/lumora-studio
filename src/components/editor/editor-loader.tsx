"use client";

import dynamic from "next/dynamic";
import { EditorSplash } from "./editor-splash";

// The editor uses browser-only APIs (IndexedDB, canvas), so it never renders on the server.
const EditorApp = dynamic(() => import("./editor-app").then((m) => m.EditorApp), {
  ssr: false,
  loading: () => <EditorSplash />,
});

export function EditorLoader({ id }: { id: string }) {
  return <EditorApp id={id} />;
}
