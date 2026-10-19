"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { PAGE_TRANSITION_MS as TRANSITION_MS } from "@/lib/engine/animate";
import { PagePlayer } from "@/lib/engine/player";
import type { Design, PageTransition } from "@/lib/schema";
import { useEditorStore } from "@/lib/store/editor-store";
import { useEditorUi, type PresentMode } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { usePageThumbnail } from "../use-page-thumbnail";
import { bubbles, confetti, drumroll } from "./effects";

const EASE = "cubic-bezier(.2,.7,.2,1)";
const AUTOPLAY_MS = 5_000;

/** Animates from the previous slide (a frozen copy) to the new one. */
function playTransition(
  kind: PageTransition,
  previous: HTMLCanvasElement | null,
  incoming: HTMLElement,
  direction: 1 | -1,
) {
  const done = () => previous?.remove();
  if (!previous || kind === "none") return done();
  const timing = { duration: TRANSITION_MS, easing: EASE };
  const fadeOut = () =>
    (previous.animate([{ opacity: 1 }, { opacity: 0 }], timing).onfinish = done);
  switch (kind) {
    case "slide":
      incoming.animate(
        [{ transform: `translateX(${100 * direction}%)` }, { transform: "translateX(0)" }],
        timing,
      );
      previous.animate(
        [{ transform: "translateX(0)" }, { transform: `translateX(${-100 * direction}%)` }],
        timing,
      ).onfinish = done;
      break;
    case "rise":
      incoming.animate(
        [
          { transform: "translateY(6%)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        timing,
      );
      fadeOut();
      break;
    case "zoom":
      incoming.animate(
        [
          { transform: "scale(1.12)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        timing,
      );
      fadeOut();
      break;
    case "dissolve":
      previous.animate(
        [
          { opacity: 1, filter: "blur(0px)" },
          { opacity: 0, filter: "blur(14px)" },
        ],
        { ...timing, duration: TRANSITION_MS * 1.3 },
      ).onfinish = done;
      break;
    default:
      fadeOut();
  }
}

function frozenCopy(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:10";
  copy.getContext("2d")?.drawImage(source, 0, 0);
  return copy;
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

function NextUp({ design, index }: { design: Design; index: number }) {
  const t = useTranslations("editor.present");
  const next = design.pages[index + 1];
  const url = usePageThumbnail(next ?? design.pages[0]!, design.format, { maxSize: 480 });
  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold tracking-[0.12em] text-white/50 uppercase">
        {t("nextUp")}
      </p>
      {next && url ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated preview
        <img
          src={url}
          alt=""
          className="w-full rounded-lg ring-1 ring-white/15"
          style={{ aspectRatio: `${design.format.width} / ${design.format.height}` }}
        />
      ) : (
        <p className="rounded-lg bg-white/5 px-3 py-6 text-center text-sm text-white/50">
          {t("end")}
        </p>
      )}
    </section>
  );
}

function Show({
  design,
  mode,
  startIndex,
}: {
  design: Design;
  mode: PresentMode;
  startIndex: number;
}) {
  const t = useTranslations("editor.present");
  const stop = useEditorUi((s) => s.stopPresenting);
  const pages = design.pages;
  const [index, setIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(mode === "autoplay");
  const [controls, setControls] = useState(true);
  const [help, setHelp] = useState(false);
  const [fx, setFx] = useState({ blur: false, quiet: false, curtain: false });
  const [fullscreen, setFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const player = useRef<PagePlayer | null>(null);
  const shown = useRef(false);
  const direction = useRef<1 | -1>(1);

  const atEnd = index >= pages.length;
  const page = pages[index];

  const go = useCallback(
    (target: number) => {
      direction.current = target >= index ? 1 : -1;
      if (target < 0) return;
      if (target > pages.length) return stop();
      setIndex(target);
    },
    [index, pages.length, stop],
  );

  // The player lives as long as the show.
  useEffect(() => {
    const stage = stageRef.current;
    const slide = slideRef.current;
    if (!stage || !slide) return;
    const element = document.createElement("canvas");
    slide.appendChild(element);
    const p = new PagePlayer(element, design.format);
    player.current = p;
    const fit = () => p.resize(stage.clientWidth, stage.clientHeight);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => {
      observer.disconnect();
      p.dispose();
      player.current = null;
      slide.replaceChildren();
    };
  }, [design.format]);

  // Show the slide (with its transition) whenever the index changes.
  useEffect(() => {
    const p = player.current;
    const slide = slideRef.current;
    const stage = stageRef.current;
    if (!p || !slide || !stage || !page) return;
    let cancelled = false;
    const previous = shown.current ? frozenCopy(p.canvas.getElement()) : null;
    if (previous) stage.appendChild(previous);
    void p.show(page, { animate: true }).then(() => {
      if (cancelled) return previous?.remove();
      shown.current = true;
      playTransition(page.transition, previous, slide, direction.current);
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  // Full screen for the whole show (Esc leaves it, which also ends the show).
  useEffect(() => {
    const root = rootRef.current;
    void root?.requestFullscreen?.().catch(() => undefined);
    let was = false;
    const onChange = () => {
      const now = Boolean(document.fullscreenElement);
      if (was && !now) stop();
      was = now;
      setFullscreen(now);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [stop]);

  // Autoplay: each page for its own duration (default 5 s), looping.
  useEffect(() => {
    if (!playing || !page) return;
    const timer = window.setTimeout(
      () => go(index + 1 >= pages.length ? 0 : index + 1),
      page.durationMs ?? AUTOPLAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [playing, page, index, pages.length, go]);

  // Timer.
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // Controls fade away while you talk; any mouse movement brings them back.
  useEffect(() => {
    if (!controls) return;
    const timer = window.setTimeout(() => setControls(false), 2_600);
    return () => window.clearTimeout(timer);
  }, [controls, index]);

  // Keyboard — captured so editor shortcuts never fire underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Nothing underneath (editor shortcuts) may react while presenting.
      e.stopImmediatePropagation();
      const key = e.key.toLowerCase();
      const handled = () => e.preventDefault();
      if (["arrowright", "arrowdown", " ", "pagedown", "enter", "n"].includes(key))
        return (handled(), go(index + 1));
      if (["arrowleft", "arrowup", "pageup", "backspace", "p"].includes(key))
        return (handled(), go(index - 1));
      if (key === "home") return (handled(), go(0));
      if (key === "end") return (handled(), go(pages.length - 1));
      if (key === "escape") return (handled(), stop());
      if (key === "f") {
        handled();
        return void (document.fullscreenElement
          ? document.exitFullscreen()
          : rootRef.current?.requestFullscreen());
      }
      if (key === "b") return (handled(), setFx((f) => ({ ...f, blur: !f.blur })));
      if (key === "q") return (handled(), setFx((f) => ({ ...f, quiet: !f.quiet })));
      if (key === "u") return (handled(), setFx((f) => ({ ...f, curtain: !f.curtain })));
      if (key === "x") return (handled(), setFx({ blur: false, quiet: false, curtain: false }));
      if (key === "c" && stageRef.current) return (handled(), confetti(stageRef.current));
      if (key === "o" && stageRef.current) return (handled(), bubbles(stageRef.current));
      if (key === "d") return (handled(), drumroll());
      if (key === "a") return (handled(), setPlaying((v) => !v));
      if (key === "?" || key === "h") return (handled(), setHelp((v) => !v));
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [go, index, pages.length, stop]);

  const presenterView = mode === "presenter";
  const counter = t("counter", { current: Math.min(index + 1, pages.length), total: pages.length });

  const stageArea = (
    <div
      ref={stageRef}
      className="relative size-full overflow-hidden"
      onClick={() => go(index + 1)}
      data-testid="present-stage"
    >
      <div
        ref={slideRef}
        className={cn("absolute inset-0 transition-[filter] duration-500", fx.blur && "blur-xl")}
      />
      {atEnd && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black text-white/70">
          <p className="text-lg font-medium">{t("end")}</p>
          <p className="text-sm">{t("endHint")}</p>
        </div>
      )}
      {fx.quiet && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 text-white">
          <span className="text-8xl" aria-hidden>
            🤫
          </span>
          <p className="text-2xl font-semibold">{t("quiet")}</p>
        </div>
      )}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 start-0 z-20 bg-gradient-to-r from-[#5B0A1A] via-[#B3123A] to-[#7A0C22] shadow-2xl transition-[width] duration-700",
          fx.curtain ? "w-1/2" : "w-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 end-0 z-20 bg-gradient-to-l from-[#5B0A1A] via-[#B3123A] to-[#7A0C22] shadow-2xl transition-[width] duration-700",
          fx.curtain ? "w-1/2" : "w-0",
        )}
      />
    </div>
  );

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-[100] flex bg-black text-white"
      onMouseMove={() => setControls(true)}
      data-testid="presenter"
      dir="ltr"
    >
      {presenterView ? (
        <div className="grid size-full grid-cols-[minmax(0,1fr)_340px] gap-4 p-4">
          <div className="min-h-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
            {stageArea}
          </div>
          <aside className="flex min-h-0 flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <span className="font-mono text-2xl tabular-nums">{clock(elapsed)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10"
                aria-label={t("resetTimer")}
                onClick={() => setElapsed(0)}
              >
                <RotateCcw />
              </Button>
            </div>
            <NextUp design={design} index={index} />
            <section className="flex min-h-0 flex-1 flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.12em] text-white/50 uppercase">
                {t("notes")}
              </p>
              <div
                className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-white/5 p-3 text-base leading-relaxed whitespace-pre-wrap"
                dir="auto"
                data-testid="presenter-notes"
              >
                {page?.notes || <span className="text-white/40">{t("noNotes")}</span>}
              </div>
            </section>
            <div className="flex items-center justify-between gap-2">
              <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>
                <ChevronLeft /> {t("previous")}
              </Button>
              <span className="text-sm text-white/60 tabular-nums">{counter}</span>
              <Button variant="secondary" onClick={() => go(index + 1)}>
                {t("next")} <ChevronRight />
              </Button>
            </div>
            <Button variant="ghost" className="text-white/70 hover:bg-white/10" onClick={stop}>
              <X /> {t("exit")}
            </Button>
          </aside>
        </div>
      ) : (
        stageArea
      )}

      {!presenterView && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-4 z-40 flex justify-center transition-opacity duration-300",
            controls ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="flex items-center gap-1 rounded-full bg-neutral-900/85 px-2 py-1 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
            <ControlButton label={t("previous")} onClick={() => go(index - 1)}>
              <ChevronLeft />
            </ControlButton>
            <span className="px-2 text-sm tabular-nums" data-testid="present-counter">
              {counter}
            </span>
            <ControlButton label={t("next")} onClick={() => go(index + 1)}>
              <ChevronRight />
            </ControlButton>
            <span className="mx-1 h-5 w-px bg-white/20" />
            <ControlButton
              label={playing ? t("pause") : t("autoplay")}
              onClick={() => setPlaying((v) => !v)}
            >
              {playing ? <Pause /> : <Play />}
            </ControlButton>
            <span className="px-1 font-mono text-xs text-white/60 tabular-nums">
              {clock(elapsed)}
            </span>
            <ControlButton
              label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
              onClick={() =>
                document.fullscreenElement
                  ? void document.exitFullscreen()
                  : void rootRef.current?.requestFullscreen()
              }
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </ControlButton>
            <ControlButton label={t("shortcuts")} onClick={() => setHelp((v) => !v)}>
              <CircleHelp />
            </ControlButton>
            <ControlButton label={t("exit")} onClick={stop} testId="present-exit">
              <X />
            </ControlButton>
          </div>
        </div>
      )}

      {help && (
        <div
          className="absolute end-6 top-6 z-50 w-72 rounded-2xl bg-neutral-900/95 p-4 text-sm shadow-2xl ring-1 ring-white/10"
          onClick={() => setHelp(false)}
        >
          <p className="mb-2 font-semibold">{t("shortcuts")}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-white/80">
            {(
              [
                ["→ / Space", t("keys.next")],
                ["←", t("keys.previous")],
                ["B", t("keys.blur")],
                ["C", t("keys.confetti")],
                ["O", t("keys.bubbles")],
                ["D", t("keys.drumroll")],
                ["Q", t("keys.quiet")],
                ["U", t("keys.curtain")],
                ["X", t("keys.clear")],
                ["A", t("keys.autoplay")],
                ["F", t("keys.fullscreen")],
                ["Esc", t("keys.exit")],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="contents">
                <dt>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
                </dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-white hover:bg-white/15 hover:text-white"
      data-testid={testId}
    >
      {children}
    </Button>
  );
}

/** Full-screen slideshow, presenter view or autoplay (see the Present button). */
export function Presenter() {
  const presenting = useEditorUi((s) => s.presenting);
  const design = useEditorStore((s) => s.design);
  // The deck is frozen when the show starts.
  const [deck, setDeck] = useState<Design | null>(null);
  const [key, setKey] = useState(0);
  if (presenting && !deck && design) {
    setDeck(design);
    setKey((k) => k + 1);
  }
  if (!presenting && deck) setDeck(null);
  if (!presenting || !deck) return null;
  return createPortal(
    <Show key={key} design={deck} mode={presenting.mode} startIndex={presenting.startIndex} />,
    document.body,
  );
}
