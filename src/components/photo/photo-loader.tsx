"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { EditorSplash } from "@/components/editor/editor-splash";

function PhotoSplash() {
  const t = useTranslations("photo");
  return <EditorSplash message={t("loading")} />;
}

// The photo editor works on canvases in the browser only.
const PhotoApp = dynamic(() => import("./photo-app").then((m) => m.PhotoApp), {
  ssr: false,
  loading: () => <PhotoSplash />,
});

export function PhotoLoader({ id }: { id: string }) {
  return <PhotoApp id={id} />;
}
