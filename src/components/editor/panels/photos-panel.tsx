"use client";

import { ImageUp, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  photoUrl,
  searchTopics,
  topicPhotos,
  type PhotoTopic,
  type StockPhoto,
  UNSPLASH_URL,
} from "@/lib/photos";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";
import { useEditorUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { STOCK_PHOTO_DRAG, useStockPhoto } from "../use-stock-photo";

/** Topics shown as chips before searching (the rest are found by search). */
const FEATURED: PhotoTopic[] = [
  "office-team",
  "coffee-shop",
  "tropical-beach",
  "city-skyline",
  "flower-bouquet",
  "wedding-couple",
  "birthday-party",
  "fitness",
  "pizza",
  "workspace-laptop",
  "modern-house",
  "smiling-woman-portrait",
  "man-portrait",
  "mosque",
  "ramadan-lantern",
  "music-festival",
  "puppy",
  "skincare",
  "gaming-setup",
  "christmas-lights",
];

/** A mix to start with: two photos from every featured topic. */
function popular(): StockPhoto[] {
  const seen = new Set<string>();
  const out: StockPhoto[] = [];
  for (let round = 0; round < 2; round++)
    for (const topic of FEATURED) {
      const photo = topicPhotos(topic)[round];
      if (photo && !seen.has(photo.id)) {
        seen.add(photo.id);
        out.push(photo);
      }
    }
  return out;
}

function unique(photos: StockPhoto[]): StockPhoto[] {
  const seen = new Set<string>();
  return photos.filter((p) => !seen.has(p.id) && seen.add(p.id));
}

/** Free stock photos by topic. Clicking one fills the selected frame, replaces the selected photo, or adds it. */
export function PhotosPanel() {
  const t = useTranslations("editor.photos");
  const setPanel = useEditorUi((s) => s.setPanel);
  // Re-render when the selection changes (the hint and what a click does depend on it).
  useEditorStore((s) => s.selection);
  const target = editorActions.selectedPhoto();
  const place = useStockPhoto();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<PhotoTopic | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const label = (id: PhotoTopic) => t(`topics.${id}`);
  const matches = useMemo(
    () => (query.trim() ? searchTopics(query, (id) => t(`topics.${id}`)) : null),
    [query, t],
  );
  const chips = matches ?? FEATURED;
  const shown = useMemo(() => {
    if (topic) return topicPhotos(topic);
    if (matches) return unique(matches.flatMap((id) => topicPhotos(id)));
    return popular();
  }, [topic, matches]);

  const pick = async (photo: StockPhoto) => {
    setBusy(photo.id);
    try {
      await place(photo);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3" data-testid="photos-panel">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setTopic(null);
          }}
          placeholder={t("search")}
          className="ps-8"
          aria-label={t("search")}
          data-testid="photo-search"
        />
      </div>

      {target && (
        <p
          className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
          data-testid="photo-target-hint"
        >
          {target.type === "frame" ? t("fillHint") : t("replaceHint")}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {chips.slice(0, 40).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={topic === id}
            onClick={() => setTopic(topic === id ? null : id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              topic === id
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:bg-surface-2",
            )}
          >
            {label(id)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("none")}
        </p>
      ) : (
        <ul className="columns-2 gap-2 [&>*]:mb-2" aria-label={t("results")}>
          {shown.map((photo) => (
            <li key={photo.id} className="break-inside-avoid">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    STOCK_PHOTO_DRAG,
                    JSON.stringify({ id: photo.id, author: photo.author }),
                  );
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => void pick(photo)}
                disabled={busy !== null}
                title={t("by", { name: photo.author })}
                aria-label={`${label(photo.topic)} — ${t("by", { name: photo.author })}`}
                className="group relative block w-full overflow-hidden rounded-xl bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait"
                data-testid="stock-photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- remote stock photo thumbnail */}
                <img
                  src={photoUrl(photo.id, 400)}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className={cn(
                    "block min-h-16 w-full transition-transform duration-300 group-hover:scale-[1.04]",
                    busy === photo.id && "opacity-50",
                  )}
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1 text-start text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {photo.author}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setPanel("uploads")}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <ImageUp className="size-4" aria-hidden /> {t("useYourOwn")}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        {t.rich("credit", {
          link: (chunks) => (
            <a
              href={UNSPLASH_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}
