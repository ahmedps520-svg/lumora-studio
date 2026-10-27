import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The Lumora mark: a stylised "L" with a spark of light, on the sunset gradient.
 * Original artwork — the same geometry is used for the favicon and PWA icons
 * (see scripts/generate-icons.ts).
 */
export function LogoMark({
  className,
  decorative = false,
}: {
  className?: string;
  /** Hide from screen readers when a visible name sits next to the mark. */
  decorative?: boolean;
}) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "Lumora" })}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FF7A3D" />
          <stop offset="1" stopColor="#F72585" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <g transform="translate(-6 1.5)" fill="#fff">
        <path d="M20 14h9v27h17v9H24a4 4 0 0 1-4-4z" />
        <path d="M45 11c1.2 7.2 3.8 9.8 11 11-7.2 1.2-9.8 3.8-11 11-1.2-7.2-3.8-9.8-11-11 7.2-1.2 9.8-3.8 11-11z" />
        <circle cx="54" cy="35" r="2" opacity="0.85" />
      </g>
    </svg>
  );
}

/** Mark + "Lumora Studio" wordmark ("Studio" only from small screens up with `collapse`). */
export function Logo({
  className,
  compact = false,
  collapse = false,
}: {
  className?: string;
  compact?: boolean;
  collapse?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-8" decorative />
      <span className="font-heading text-lg leading-none font-semibold tracking-tight" dir="ltr">
        Lumora
        {!compact && (
          <span className={cn("font-normal text-muted-foreground", collapse && "hidden sm:inline")}>
            {" "}
            Studio
          </span>
        )}
      </span>
    </span>
  );
}
