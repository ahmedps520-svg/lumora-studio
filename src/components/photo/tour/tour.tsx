"use client";

import { Check, GraduationCap, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useState } from "react";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { get, usePhoto } from "@/lib/photo/store";
import { cn } from "@/lib/utils";
import { TOUR_CHAPTERS, TOUR_STEPS } from "./steps";

const STORAGE_KEY = "lumora-photo-tour";

interface Saved {
  step: number;
  done: boolean;
  prompted: boolean;
}

function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw)
      return { step: 0, done: false, prompted: false, ...(JSON.parse(raw) as Partial<Saved>) };
  } catch {
    // Private mode / blocked storage: start fresh.
  }
  return { step: 0, done: false, prompted: false };
}

function writeSaved(patch: Partial<Saved>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSaved(), ...patch }));
  } catch {
    // Not saved; the tour still works.
  }
}

interface TourState {
  active: boolean;
  step: number;
  /** What the editor looked like when the step began (to notice the user trying the tool). */
  mark: string;
}

export const useTour = create<TourState>(() => ({ active: false, step: 0, mark: "" }));

/** Changes when the user paints, selects, zooms, scrolls or picks a colour. */
const activity = (s: ReturnType<typeof get>) =>
  `${s.rev}|${s.zoom}|${s.pan.x}|${s.pan.y}|${s.fg}|${s.bg}`;

export function goToStep(step: number) {
  const i = Math.max(0, Math.min(TOUR_STEPS.length - 1, step));
  TOUR_STEPS[i]!.prepare?.();
  useTour.setState({ active: true, step: i, mark: activity(get()) });
  writeSaved({ step: i, prompted: true });
}

/** Starts the tour (where it was left, unless finished or `fromStart`). */
export function startTour(fromStart = false) {
  const saved = readSaved();
  goToStep(fromStart || saved.done ? 0 : saved.step);
}

export function endTour(finished = false) {
  useTour.setState({ active: false });
  writeSaved(finished ? { done: true, step: 0, prompted: true } : { prompted: true });
}

type Rect = { x: number; y: number; w: number; h: number };

function measure(selectors: string[]): Rect[] {
  const out: Rect[] = [];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.height)
      out.push({ x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 });
  }
  return out;
}

/** Keeps the spotlight on its targets while the layout changes. */
function useTargetRects(selectors: string[]) {
  const [rects, setRects] = useState<Rect[]>([]);
  const key = selectors.join("|");
  useLayoutEffect(() => {
    let frame = 0;
    let last = "";
    const tick = () => {
      const next = measure(key ? key.split("|") : []);
      const sig = JSON.stringify(next);
      if (sig !== last) {
        last = sig;
        setRects(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key]);
  return rects;
}

export function Tour() {
  const t = useTranslations("photo.tour");
  const tp = useTranslations("photo");
  const { active, step, mark } = useTour();
  const now = usePhoto(activity);
  const current = TOUR_STEPS[step]!;
  const rects = useTargetRects(active ? current.targets : []);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  useEffect(() => {
    const size = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog][data-state=open]")) {
        e.stopPropagation();
        endTour();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active]);

  if (!active) return null;

  const total = TOUR_STEPS.length;
  const last = step === total - 1;
  const tried = Boolean(current.tool) && now !== mark;
  const centred = !rects.length;
  const title = current.tool ? tp(`tools.${current.tool}`) : t(`steps.${current.area!}.title`);
  const body = current.tool ? t(`tools.${current.tool}`) : t(`steps.${current.area!}.body`);
  const tryIt = current.tool ? tp(`hints.${current.tool}`) : null;

  // Card placement: centred, or in a bottom corner of the photo area, away
  // from what's highlighted.
  const cardW = Math.min(360, vw - 32);
  const focus = rects[0];
  const stage = document
    .querySelector<HTMLElement>('[data-testid="photo-viewport"]')
    ?.getBoundingClientRect();
  const areaLeft = stage?.left ?? 16;
  const areaRight = stage?.right ?? vw - 16;
  const onRight = focus ? focus.x + focus.w / 2 > (areaLeft + areaRight) / 2 : false;
  const cardStyle: React.CSSProperties = centred
    ? { left: (vw - cardW) / 2, top: Math.max(16, vh / 2 - 180), width: cardW }
    : {
        left: Math.max(
          16,
          Math.min(vw - cardW - 16, onRight ? areaLeft + 16 : areaRight - cardW - 16),
        ),
        bottom: Math.max(16, vh - (stage?.bottom ?? vh) + 72),
        width: cardW,
      };

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" data-testid="photo-tour">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-cutouts">
            <rect width="100%" height="100%" fill="white" />
            {rects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={10} fill="black" />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(8,8,16,0.5)" mask="url(#tour-cutouts)" />
        {rects.slice(0, 1).map((r, i) => (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={10}
            fill="none"
            stroke="#F72585"
            strokeWidth={2.5}
            className="animate-pulse"
          />
        ))}
      </svg>
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        data-testid="tour-card"
        className="pointer-events-auto absolute rounded-2xl border bg-popover p-4 text-popover-foreground shadow-2xl"
        style={cardStyle}
      >
        <header className="flex items-center gap-2">
          <GraduationCap className="size-4 text-primary" />
          <select
            aria-label={t("chapter")}
            value={current.chapter}
            onChange={(e) => goToStep(TOUR_STEPS.findIndex((s) => s.chapter === e.target.value))}
            onKeyDown={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 truncate rounded-md bg-transparent text-xs font-semibold text-muted-foreground outline-none hover:text-foreground"
          >
            {TOUR_CHAPTERS.map((c) => (
              <option key={c} value={c}>
                {t(`chapters.${c}`)}
              </option>
            ))}
          </select>
          <span
            className="text-[11px] text-muted-foreground tabular-nums"
            data-testid="tour-progress"
          >
            {t("progress", { n: step + 1, total })}
          </span>
          <button
            type="button"
            aria-label={t("close")}
            title={t("close")}
            onClick={() => endTour()}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-brand-gradient transition-all"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
        <h2 id="tour-title" className="mt-3 text-base font-semibold" data-testid="tour-title">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {tryIt && (
          <p className="mt-2 rounded-lg bg-primary/10 px-2.5 py-2 text-xs leading-relaxed">
            <span className="font-semibold">{t("tryIt")}</span> {tryIt}
          </p>
        )}
        {tried && (
          <p
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success"
            data-testid="tour-tried"
          >
            <Check className="size-3.5" /> {t("tried")}
          </p>
        )}
        <footer className="mt-4 flex items-center gap-2">
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goToStep(step - 1)}
              data-testid="tour-back"
            >
              {t("back")}
            </Button>
          )}
          <span className="flex-1" />
          {!last && step > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => endTour()}>
              {t("later")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            data-testid="tour-next"
            onClick={() => (last ? endTour(true) : goToStep(step + 1))}
          >
            {step === 0 ? t("start") : last ? t("finish") : t("next")}
          </Button>
        </footer>
      </section>
    </div>
  );
}

/** A small card the first time someone opens the editor. */
export function TourPrompt() {
  const t = useTranslations("photo.tour");
  const active = useTour((s) => s.active);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(!readSaved().prompted), 900);
    // Starting to work on the photo answers the question too.
    const busy = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-testid="photo-viewport"]')) {
        setShow(false);
        writeSaved({ prompted: true });
      }
    };
    window.addEventListener("pointerdown", busy, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", busy, true);
    };
  }, []);
  if (!show || active) return null;
  const close = () => {
    setShow(false);
    writeSaved({ prompted: true });
  };
  return (
    <div
      role="dialog"
      aria-labelledby="tour-prompt-title"
      data-testid="tour-prompt"
      className={cn(
        "fixed start-16 bottom-10 z-[65] w-80 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-2xl",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl btn-glow">
          <GraduationCap className="size-5" />
        </span>
        <div>
          <h2 id="tour-prompt-title" className="text-sm font-semibold">
            {t("promptTitle")}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("promptBody")}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={close}>
          {t("notNow")}
        </Button>
        <Button
          type="button"
          size="sm"
          data-testid="tour-prompt-start"
          onClick={() => {
            close();
            startTour(true);
          }}
        >
          {t("startTour")}
        </Button>
      </div>
    </div>
  );
}
