"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ban, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ANIMATION_KINDS,
  type Animation,
  type AnimationKind,
  type Element,
  type Page,
} from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { pageActions } from "@/lib/store/page-actions";
import { cn } from "@/lib/utils";
import { AnimationPreview } from "./animation-preview";
import { Section } from "./fields";

const SPEEDS = ["slow", "medium", "fast"] as const;
const DIRECTIONS = [
  { id: "up", icon: ArrowUp },
  { id: "down", icon: ArrowDown },
  { id: "left", icon: ArrowLeft },
  { id: "right", icon: ArrowRight },
] as const;
/** Kinds whose direction you can choose. */
const DIRECTIONAL = new Set<AnimationKind>(["pan", "drift", "wipe"]);

/** A tiny CSS version of each animation, played on the tile's swatch. */
function previewFrames(kind: AnimationKind, direction: Animation["direction"]): Keyframe[] {
  const dx = direction === "left" ? 14 : direction === "right" ? -14 : 0;
  const dy = direction === "up" ? 14 : direction === "down" ? -14 : 0;
  switch (kind) {
    case "fade":
      return [{ opacity: 0 }, { opacity: 1 }];
    case "rise":
      return [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "none" },
      ];
    case "pan":
      return [
        { opacity: 0, transform: `translate(${dx || 0}px, ${dy || 0}px)` },
        { opacity: 1, transform: "none" },
      ];
    case "drift":
      return [
        { opacity: 0, transform: `translate(${dx / 2}px, ${dy / 2}px)` },
        { opacity: 1, transform: "none" },
      ];
    case "pop":
      return [
        { opacity: 0, transform: "scale(.5)" },
        { opacity: 1, transform: "scale(1.12)", offset: 0.7 },
        { transform: "scale(1)" },
      ];
    case "zoom":
      return [
        { opacity: 0, transform: "scale(1.5)" },
        { opacity: 1, transform: "none" },
      ];
    case "breathe":
      return [
        { opacity: 0, transform: "scale(.88)" },
        { opacity: 1, transform: "none" },
      ];
    case "stomp":
      return [
        { transform: "scale(1.7)", opacity: 0 },
        { transform: "scale(.94)", opacity: 1, offset: 0.6 },
        { transform: "scale(1)" },
      ];
    case "tumble":
      return [
        { opacity: 0, transform: "rotate(-30deg) scale(.6)" },
        { opacity: 1, transform: "none" },
      ];
    case "bounce":
      return [
        { transform: "translateY(-16px)", opacity: 0 },
        { transform: "translateY(0)", opacity: 1, offset: 0.45 },
        { transform: "translateY(-6px)", offset: 0.65 },
        { transform: "translateY(0)", offset: 0.82 },
        { transform: "translateY(-2px)", offset: 0.92 },
        { transform: "translateY(0)" },
      ];
    case "wipe": {
      const from =
        direction === "left"
          ? "inset(0 0 0 100%)"
          : direction === "right"
            ? "inset(0 100% 0 0)"
            : direction === "up"
              ? "inset(100% 0 0 0)"
              : "inset(0 0 100% 0)";
      return [{ clipPath: from }, { clipPath: "inset(0 0 0 0)" }];
    }
    case "typewriter":
      return [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }];
  }
}

function Tile({
  kind,
  label,
  active,
  direction,
  onClick,
}: {
  kind: AnimationKind | null;
  label: string;
  active: boolean;
  direction: Animation["direction"];
  onClick: () => void;
}) {
  const swatch = useRef<HTMLSpanElement>(null);
  const play = () => {
    if (!kind || !swatch.current) return;
    swatch.current.animate(previewFrames(kind, direction), {
      duration: kind === "typewriter" ? 900 : 650,
      easing: kind === "typewriter" ? "steps(6, end)" : "cubic-bezier(.2,.7,.2,1)",
    });
  };
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => {
        onClick();
        play();
      }}
      onMouseEnter={play}
      onFocus={play}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border px-1 pt-2.5 pb-2 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      data-testid={`animation-${kind ?? "none"}`}
    >
      <span className="flex size-8 items-center justify-center overflow-hidden">
        {kind ? (
          <span
            ref={swatch}
            className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-fuchsia-500 text-[11px] font-bold text-white"
          >
            {kind === "typewriter" ? "Ab|" : "Aa"}
          </span>
        ) : (
          <Ban className="size-5" />
        )}
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

/** Picks an animation kind, speed and (for some kinds) direction. */
function AnimationPicker({
  value,
  onChange,
  textOnly,
  noneLabel,
}: {
  value: Animation | null;
  onChange: (next: Animation | null) => void;
  /** Whether typewriter makes sense (text, or a whole page). */
  textOnly: boolean;
  noneLabel: string;
}) {
  const t = useTranslations("editor.animate");
  const direction = value?.direction ?? "up";
  const kinds = ANIMATION_KINDS.filter((k) => k !== "typewriter" || textOnly);
  const pick = (kind: AnimationKind) =>
    onChange({
      kind,
      speed: value?.speed ?? "medium",
      direction: DIRECTIONAL.has(kind) ? (value?.direction ?? "left") : "up",
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t("kinds")}>
        <Tile
          kind={null}
          label={noneLabel}
          active={!value}
          direction={direction}
          onClick={() => onChange(null)}
        />
        {kinds.map((kind) => (
          <Tile
            key={kind}
            kind={kind}
            label={t(`kind.${kind}`)}
            active={value?.kind === kind}
            direction={DIRECTIONAL.has(kind) ? (value?.direction ?? "left") : "up"}
            onClick={() => pick(kind)}
          />
        ))}
      </div>
      {value && (
        <>
          <div className="space-y-1.5">
            <p className="text-sm">{t("speed")}</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
              {SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  role="radio"
                  aria-checked={value.speed === speed}
                  onClick={() => onChange({ ...value, speed })}
                  className={cn(
                    "rounded-md py-1 text-xs font-medium transition-colors",
                    value.speed === speed
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`animation-speed-${speed}`}
                >
                  {t(`speeds.${speed}`)}
                </button>
              ))}
            </div>
          </div>
          {DIRECTIONAL.has(value.kind) && (
            <div className="space-y-1.5">
              <p className="text-sm">{t("direction")}</p>
              {/* Arrows mean screen directions, so they don't flip in RTL. */}
              <div className="grid grid-cols-4 gap-1" role="radiogroup" dir="ltr">
                {DIRECTIONS.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={value.direction === id}
                    aria-label={t(`directions.${id}`)}
                    title={t(`directions.${id}`)}
                    onClick={() => onChange({ ...value, direction: id })}
                    className={cn(
                      "flex items-center justify-center rounded-md border py-1.5 transition-colors",
                      value.direction === id
                        ? "border-primary bg-primary/10"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PreviewButton() {
  const t = useTranslations("editor.animate");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
        data-testid="animation-preview"
      >
        <Play /> {t("preview")}
      </Button>
      <AnimationPreview open={open} onOpenChange={setOpen} />
    </>
  );
}

/** "Animate" for one element (or the same choice for several). */
export function ElementAnimation({ elements }: { elements: Element[] }) {
  const t = useTranslations("editor.animate");
  const first = elements[0];
  if (!first) return null;
  const same = elements.every(
    (e) => JSON.stringify(e.animation) === JSON.stringify(first.animation),
  );
  const value = same ? first.animation : null;
  const allText = elements.every((e) => e.type === "text");
  return (
    <Section title={t("title")}>
      <AnimationPicker
        value={value}
        textOnly={allText}
        noneLabel={t("pageDefault")}
        onChange={(animation) =>
          editorActions.updateElements(
            elements.map((e) => ({ id: e.id, patch: { animation } })),
            { label: "animate" },
          )
        }
      />
      <p className="text-xs text-muted-foreground">{t("elementHint")}</p>
      <PreviewButton />
    </Section>
  );
}

/** Whole-page animation: used by every element without its own. */
export function PageAnimation({ page }: { page: Page }) {
  const t = useTranslations("editor.animate");
  return (
    <Section title={t("pageTitle")}>
      <AnimationPicker
        value={page.animation}
        textOnly
        noneLabel={t("none")}
        onChange={(animation) => pageActions.setAnimation(page.id, animation)}
      />
      <p className="text-xs text-muted-foreground">{t("pageHint")}</p>
      <PreviewButton />
    </Section>
  );
}
