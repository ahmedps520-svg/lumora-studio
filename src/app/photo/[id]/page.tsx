import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoLoader } from "@/components/photo/photo-loader";

export const metadata: Metadata = { title: "Lumora Photo" };

export default async function PhotoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  return <PhotoLoader id={id} />;
}
