"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { LayoutTemplate, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeading } from "@/components/site/section-heading";
import type { DesignRecord } from "@/lib/storage/db";
import { listDesigns, moveToTrash, restoreFromTrash } from "@/lib/storage/designs";

function DesignCard({ design }: { design: DesignRecord }) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const ratio = design.width / design.height;

  const trash = async () => {
    await moveToTrash(design.id);
    toast(t("movedToTrash", { name: design.name }), {
      action: { label: t("undo"), onClick: () => void restoreFromTrash(design.id) },
    });
  };

  return (
    <li className="group relative" data-testid="design-card">
      <Link
        href={`/editor/${design.id}`}
        aria-label={t("openDesign", { name: design.name })}
        className="lumen block rounded-2xl surface-lit p-2 transition-transform duration-300 group-hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-surface-2 p-5">
          <div className="absolute inset-0 bg-dots opacity-70" />
          {design.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL, nothing to optimise
            <img
              src={design.thumbnail}
              alt=""
              className="relative max-h-full max-w-full rounded-[6px] object-contain shadow-[0_12px_28px_-12px_rgb(10_10_20/0.5)] ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-[1.03]"
              style={{ aspectRatio: ratio }}
            />
          ) : (
            <div
              className="relative max-h-full max-w-full rounded-[6px] bg-white shadow-soft"
              style={{
                aspectRatio: ratio,
                width: ratio >= 1 ? "100%" : "auto",
                height: ratio >= 1 ? "auto" : "100%",
              }}
            />
          )}
        </div>
        <div className="px-2 pt-3 pb-1.5">
          <div className="truncate pe-8 text-sm font-semibold">{design.name}</div>
          <div className="text-xs text-muted-foreground">
            {t("edited", { when: format.relativeTime(new Date(design.updatedAt), now) })}
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
            <Trash2 /> {t("moveToTrash")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function RecentDesigns() {
  const t = useTranslations("home");
  const [failed, setFailed] = useState(false);
  const designs = useLiveQuery(
    () =>
      listDesigns().catch((error: unknown) => {
        console.error("[home] could not list designs", error);
        setFailed(true);
        return [];
      }),
    [],
  );

  return (
    <section aria-labelledby="recent-heading">
      <SectionHeading id="recent-heading" eyebrow={t("recentEyebrow")} title={t("recent")} />
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("storageError")}
        </p>
      ) : designs === undefined ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3.6] rounded-2xl" />
          ))}
        </div>
      ) : designs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card/40 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-2">
            <LayoutTemplate className="size-6 text-muted-foreground" />
          </span>
          <p className="max-w-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {designs.map((design) => (
            <DesignCard key={design.id} design={design} />
          ))}
        </ul>
      )}
    </section>
  );
}
