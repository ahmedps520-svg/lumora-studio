"use client";

import dynamic from "next/dynamic";

// Lists photos from IndexedDB and decodes images: browser only.
const PhotoHome = dynamic(() => import("./photo-home").then((m) => m.PhotoHome), { ssr: false });

export function PhotoHomeLoader() {
  return <PhotoHome />;
}
