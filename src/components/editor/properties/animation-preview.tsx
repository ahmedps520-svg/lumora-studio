"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PagePlayer } from "@/lib/engine/player";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";

/** Plays the current page's animations in a dialog (nothing is changed). */
export function AnimationPreview({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("editor.animate");
  const page = useEditorStore(selectCurrentPage);
  const format = useEditorStore((s) => s.design?.format);
  // A state ref: the dialog content mounts a moment after `open` flips.
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!open || !host || !page || !format) return;
    const element = document.createElement("canvas");
    host.appendChild(element);
    const player = new PagePlayer(element, format);
    const fit = () => player.resize(host.clientWidth, host.clientHeight);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    void player.show(page, { animate: true });
    return () => {
      observer.disconnect();
      player.dispose();
      host.replaceChildren();
    };
  }, [open, host, page, format, run]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="animation-preview-dialog">
        <DialogHeader>
          <DialogTitle>{t("previewTitle")}</DialogTitle>
        </DialogHeader>
        {format && (
          <div
            ref={setHost}
            className="mx-auto max-h-[65vh] w-full overflow-hidden rounded-lg bg-[repeating-conic-gradient(#0000000d_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
            style={{ aspectRatio: `${format.width} / ${format.height}` }}
          />
        )}
        <Button
          variant="secondary"
          className="justify-self-center"
          onClick={() => setRun((r) => r + 1)}
        >
          <RotateCcw /> {t("replay")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
