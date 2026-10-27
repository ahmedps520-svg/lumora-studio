"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  GraduationCap,
  ImagePlus,
  ImageUp,
  Images,
  MoreHorizontal,
  Plus,
  Trash,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { createPracticePhoto } from "@/lib/photo/practice";
import { docFromFile, listPhotos, restorePhoto, savePhoto, trashPhoto } from "@/lib/photo/storage";
import type { PhotoRecord } from "@/lib/storage/db";
import { cn } from "@/lib/utils";
import { NewDocumentForm } from "./new-document";

function PhotoCard({ photo }: { photo: PhotoRecord }) {
  const t = useTranslations("photo.home");
  const tc = useTranslations("common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const trash = async () => {
    await trashPhoto(photo.id);
    toast(t("movedToTrash", { name: photo.name }), {
      action: { label: t("undo"), onClick: () => void restorePhoto(photo.id) },
    });
  };
  return (
    <li className="group relative" data-testid="photo-card">
      <Link
        href={`/photo/${photo.id}`}
        aria-label={t("open", { name: photo.name })}
        className="lumen block rounded-2xl surface-lit p-2 transition-transform duration-300 group-hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-surface-2 p-4">
          <div className="absolute inset-0 bg-dots opacity-70" />
          {photo.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL
            <img
              src={photo.thumbnail}
              alt=""
              className="relative max-h-full max-w-full rounded-[6px] object-contain shadow-[0_12px_28px_-12px_rgb(10_10_20/0.5)]"
            />
          )}
        </div>
        <div className="px-2 pt-3 pb-1.5">
          <div className="truncate pe-8 text-sm font-semibold">{photo.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {photo.width} × {photo.height} · {t("layers", { count: photo.layerCount })} ·{" "}
            {format.relativeTime(new Date(photo.updatedAt), now)}
          </div>
        </div>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="glass"
            size="icon-sm"
            aria-label={tc("more")}
            className="absolute end-4 top-4 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void trash()} variant="destructive">
            <Trash /> {t("moveToTrash")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function PhotoHome() {
  const t = useTranslations("photo.home");
  const tn = useTranslations("photo.dialogs");
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState(false);
  const [learning, setLearning] = useState(false);
  const [failed, setFailed] = useState(false);
  const photos = useLiveQuery(
    () =>
      listPhotos().catch((error: unknown) => {
        console.error("[photo] could not list photos", error);
        setFailed(true);
        return [];
      }),
    [],
  );

  const open = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      if (file) toast.error(t("notImage"));
      return;
    }
    setOpening(true);
    try {
      const doc = await docFromFile(file);
      await savePhoto(doc);
      router.push(`/photo/${doc.id}`);
    } catch (error) {
      console.error("[photo] could not open file", error);
      toast.error(t("openFailed"));
      setOpening(false);
    }
  };

  const pick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => void open(input.files?.[0]);
    input.click();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 pt-10 pb-24 sm:px-6">
      <section className="grid items-stretch gap-4 md:grid-cols-[1.4fr_1fr]">
        <div
          role="button"
          tabIndex={0}
          aria-label={t("dropTitle")}
          data-testid="photo-drop"
          onClick={pick}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pick()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void open(e.dataTransfer.files[0]);
          }}
          className={cn(
            "lumen flex min-h-64 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed bg-card/60 p-8 text-center transition-colors hover:border-primary/60 hover:bg-card",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <span className="flex size-16 items-center justify-center rounded-2xl btn-glow">
            <ImageUp className="size-8" />
          </span>
          <div>
            <p className="text-xl font-semibold">{opening ? t("opening") : t("dropTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("dropHint")}</p>
          </div>
          <Button
            type="button"
            size="lg"
            disabled={opening}
            onClick={(e) => (e.stopPropagation(), pick())}
            data-testid="photo-open"
          >
            <ImagePlus /> {t("openButton")}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          data-testid="photo-new"
          className="lumen flex min-h-64 flex-col items-center justify-center gap-4 rounded-3xl surface-lit p-8 text-center transition-transform duration-300 hover:-translate-y-1"
        >
          <span className="flex size-16 items-center justify-center rounded-2xl bg-surface-2">
            <Plus className="size-8" />
          </span>
          <div>
            <p className="text-xl font-semibold">{t("newTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("newHint")}</p>
          </div>
        </button>
      </section>

      <section
        aria-labelledby="learn-heading"
        className="lumen flex flex-col items-start gap-4 rounded-3xl surface-lit p-5 sm:flex-row sm:items-center"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl btn-glow">
          <GraduationCap className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="learn-heading" className="text-lg font-semibold">
            {t("learnTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("learnBody")}</p>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={learning}
          data-testid="photo-learn"
          onClick={async () => {
            setLearning(true);
            try {
              const id = await createPracticePhoto(t("practiceName"));
              router.push(`/photo/${id}?tour=1`);
            } catch (error) {
              console.error("[photo] could not make the practice photo", error);
              setLearning(false);
            }
          }}
        >
          <GraduationCap /> {t("learnButton")}
        </Button>
      </section>

      <section aria-labelledby="recent-photos">
        <h2 id="recent-photos" className="mb-6 text-2xl font-semibold">
          {t("recent")}
        </h2>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {t("storageError")}
          </p>
        ) : photos === undefined ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3.6] rounded-2xl" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-2">
              <Images className="size-6 text-muted-foreground" />
            </span>
            <p className="max-w-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <PhotoCard key={p.id} photo={p} />
            ))}
          </ul>
        )}
      </section>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tn("newDocument")}</DialogTitle>
          </DialogHeader>
          <NewDocumentForm onDone={() => setNewOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
