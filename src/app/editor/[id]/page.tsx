import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorLoader } from "@/components/editor/editor-loader";

export const metadata: Metadata = { title: "Editor" };

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  return <EditorLoader id={id} />;
}
