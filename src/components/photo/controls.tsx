"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Compact controls for the photo editor's option bar, panels and dialogs. */

export function Field({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * A number box with an optional slider. `scale` shows values ×scale
 * (e.g. 0–1 opacity as 0–100 %).
 */
export function NumField({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  scale = 1,
  unit,
  slider = false,
  wide = false,
  className,
  testId,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  /** Called when a drag ends or the box loses focus (for one undo step). */
  onCommit?: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  scale?: number;
  unit?: string;
  slider?: boolean;
  /** Full-width row: label column, stretching slider, number box. */
  wide?: boolean;
  className?: string;
  testId?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = Math.round(value * scale * 100) / 100;
  const clampV = (v: number) => Math.min(max, Math.max(min, v));
  const commitDraft = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (Number.isFinite(n)) {
      const v = clampV(n / scale);
      onChange(v);
      onCommit?.(v);
    }
  };
  return (
    <label
      className={cn(
        "flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground",
        wide && "w-full gap-2.5",
        className,
      )}
    >
      <span className={cn(wide && "w-32 shrink-0 truncate")}>{label}</span>
      {slider && (
        <input
          type="range"
          min={min * scale}
          max={max * scale}
          step={step}
          value={shown}
          onChange={(e) => onChange(clampV(Number(e.target.value) / scale))}
          onPointerUp={(e) =>
            onCommit?.(clampV(Number((e.target as HTMLInputElement).value) / scale))
          }
          onKeyUp={(e) => onCommit?.(clampV(Number((e.target as HTMLInputElement).value) / scale))}
          className={cn("h-1 cursor-pointer accent-primary", wide ? "min-w-16 flex-1" : "w-20")}
        />
      )}
      <span className="flex items-center rounded-md border bg-background/60 focus-within:border-ring">
        <input
          type="number"
          inputMode="decimal"
          data-testid={testId}
          min={min * scale}
          max={max * scale}
          step={step}
          value={draft ?? String(shown)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitDraft();
            if (e.key === "Escape") setDraft(null);
          }}
          className="h-6 w-12 [appearance:textfield] bg-transparent px-1.5 text-end text-xs text-foreground tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && <span className="pe-1.5 text-[10px] text-muted-foreground">{unit}</span>}
      </span>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label?: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      onKeyDown={(e) => e.stopPropagation()}
      className="h-6 rounded-md border bg-background/60 px-1.5 text-xs text-foreground outline-none focus:border-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  if (!label) return select;
  return (
    <label
      className={cn(
        "flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span>{label}</span>
      {select}
    </label>
  );
}

export function Check({
  label,
  checked,
  onChange,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  allowNone = false,
  noneLabel,
}: {
  label?: ReactNode;
  value: string | null;
  onChange: (v: string | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
      {label && <span>{label}</span>}
      <label
        className="relative size-6 cursor-pointer overflow-hidden rounded-md border shadow-sm"
        style={{
          background:
            value ??
            "linear-gradient(to top right, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px)), #fff",
        }}
      >
        <input
          type="color"
          value={(value ?? "#ffffff").toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="sr-only"
        />
      </label>
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "rounded px-1 text-[11px] hover:bg-accent",
            value === null && "text-foreground underline",
          )}
        >
          {noneLabel}
        </button>
      )}
    </span>
  );
}

/** A row of icon/text buttons where one is chosen. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center rounded-md border bg-background/60 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.label}
          aria-label={o.label}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-5 min-w-6 items-center justify-center rounded px-1 text-[11px] text-muted-foreground hover:text-foreground",
            value === o.value && "bg-primary/15 text-primary",
          )}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  );
}

export function SmallButton({
  children,
  onClick,
  disabled,
  title,
  variant = "default",
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "default" | "primary";
  testId?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "flex h-6 items-center gap-1 rounded-md border px-2 text-xs whitespace-nowrap hover:bg-accent disabled:opacity-40 [&_svg]:size-3.5",
        variant === "primary" &&
          "border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {children}
    </button>
  );
}
