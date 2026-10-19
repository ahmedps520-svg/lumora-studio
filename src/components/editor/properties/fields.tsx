"use client";

import { useId, useState, type ReactNode } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b px-4 py-4 last:border-b-0">
      {title && (
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const roundTo = (v: number, step: number) => {
  const decimals = step < 1 ? (String(step).split(".")[1]?.length ?? 2) : 0;
  return Number(v.toFixed(decimals));
};

/**
 * Compact number input. Commits on Enter/blur; ArrowUp/Down nudge by `step`
 * (Shift = ×10) and commit immediately.
 */
export function NumberField({
  label,
  value,
  onCommit,
  min = -100_000,
  max = 100_000,
  step = 1,
  suffix,
  disabled,
  ariaLabel,
  testId,
}: {
  label: string;
  value: number;
  onCommit: (value: number, mergeKey?: string) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
}) {
  const id = useId();
  const display = String(roundTo(value, step));
  // Only holds text while the user is typing; otherwise the live value shows.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || raw.trim() === "") return;
    const next = clamp(roundTo(parsed, step), min, max);
    if (next !== value) onCommit(next);
  };

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex h-9 min-w-0 items-center gap-1.5 rounded-lg border border-transparent bg-surface-2 px-2.5 text-sm transition-colors focus-within:border-ring focus-within:bg-card hover:border-border",
        disabled && "opacity-50",
      )}
    >
      <span className="shrink-0 text-xs font-medium text-muted-foreground" aria-hidden>
        {label}
      </span>
      <input
        id={id}
        data-testid={testId}
        aria-label={ariaLabel ?? label}
        inputMode="decimal"
        disabled={disabled}
        value={draft ?? display}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => draft !== null && commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "Escape") setDraft(null);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(null);
            const delta = (e.key === "ArrowUp" ? step : -step) * (e.shiftKey ? 10 : 1);
            const next = clamp(roundTo(value + delta, step), min, max);
            onCommit(next, `${label}-arrow`);
          }
        }}
        className="w-full min-w-0 bg-transparent tabular-nums outline-none"
      />
      {suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}
    </label>
  );
}

/** Slider + value readout. Live updates are merged into one undo step per drag. */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(v),
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-2", disabled && "opacity-50")}>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{format(value)}</span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => v !== undefined && onChange(v)}
      />
    </div>
  );
}

/** Colour swatch + hex input. Uses the browser's colour picker. */
export function ColorField({
  label,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: string | null;
  onChange: (hex: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const id = useId();
  const hex6 = (value ?? "#000000").slice(0, 7);
  const [draft, setDraft] = useState<string | null>(null);

  const commitHex = (raw: string) => {
    setDraft(null);
    const v = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`;
    if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3})$/.test(v)) onChange(v.toUpperCase());
  };

  return (
    <div className={cn("flex items-center gap-2", disabled && "opacity-50")}>
      <label
        htmlFor={id}
        className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border shadow-xs focus-within:ring-2 focus-within:ring-ring"
        style={{
          background:
            value === null
              ? "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 0 0 / 10px 10px"
              : value,
        }}
      >
        <span className="sr-only">{label}</span>
        <input
          id={id}
          type="color"
          data-testid={testId}
          disabled={disabled}
          value={hex6}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <input
        aria-label={`${label} (hex)`}
        value={draft ?? value ?? ""}
        disabled={disabled}
        spellCheck={false}
        maxLength={9}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => draft !== null && commitHex(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commitHex(e.currentTarget.value)}
        className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-surface-2 px-2.5 font-mono text-sm uppercase transition-colors outline-none hover:border-border focus-visible:border-ring focus-visible:bg-card"
        dir="ltr"
      />
    </div>
  );
}
