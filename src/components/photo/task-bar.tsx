"use client";

import { Eraser, PaintBucket, ScanFace, Sparkles, SquareDashed, SquareX, Wand } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import * as A from "@/lib/photo/actions";
import { set, usePhoto } from "@/lib/photo/store";
import { cn } from "@/lib/utils";

function Action({
  onClick,
  children,
  testId,
  accent,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  testId?: string;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap hover:bg-accent disabled:opacity-40 [&_svg]:size-3.5",
        accent && "btn-glow hover:opacity-90",
      )}
    >
      {children}
    </button>
  );
}

/** Floating next-step actions under the photo (changes with the selection). */
export function TaskBar() {
  const t = useTranslations("photo");
  const hasSelection = usePhoto((s) => Boolean(s.selection));
  const busy = usePhoto((s) => s.busy);
  const transform = usePhoto((s) => Boolean(s.transform));
  const canMask = usePhoto((s) => {
    const l = s.doc?.layers.find((x) => x.id === s.activeId);
    return Boolean(l && l.kind !== "adjustment" && !l.mask);
  });
  if (transform) return null;
  return (
    <div
      role="toolbar"
      aria-label={t("taskBar")}
      data-testid="task-bar"
      className="pointer-events-auto absolute inset-x-0 bottom-4 z-10 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-0.5 overflow-x-auto rounded-full border bg-popover/95 p-1 shadow-lg backdrop-blur"
    >
      {hasSelection ? (
        <>
          <Action
            accent
            onClick={() => set({ dialog: { type: "generativeFill" } })}
            testId="task-generative"
          >
            <Sparkles /> {t("cmd.generativeFill").replace("…", "")}
          </Action>
          <Action onClick={A.contentAwareFillSelection} testId="task-remove">
            <Eraser /> {t("taskRemove")}
          </Action>
          <Action onClick={() => set({ dialog: { type: "fill" } })}>
            <PaintBucket /> {t("cmd.fill").replace("…", "")}
          </Action>
          {canMask && (
            <Action onClick={() => A.addMask("selection")}>
              <SquareDashed /> {t("taskMask")}
            </Action>
          )}
          <Action onClick={A.inverseSelection}>
            <Wand /> {t("cmd.inverse")}
          </Action>
          <Action onClick={A.deselect} testId="task-deselect">
            <SquareX /> {t("cmd.deselect")}
          </Action>
        </>
      ) : (
        <>
          <Action
            onClick={() => void A.selectSubject()}
            disabled={Boolean(busy)}
            testId="task-subject"
          >
            <ScanFace /> {t("cmd.selectSubject")}
          </Action>
          <Action
            onClick={() => void A.removeBackgroundToMask()}
            disabled={Boolean(busy) || !canMask}
          >
            <Eraser /> {t("cmd.removeBackground")}
          </Action>
        </>
      )}
    </div>
  );
}
