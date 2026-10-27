import { useId } from "react";
import { cn } from "@/lib/utils";

/** The spark of light from the Lumora mark, glowing (decorative). */
export function Spark({ className, twinkle = false }: { className?: string; twinkle?: boolean }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 22 22"
      aria-hidden
      className={cn("shrink-0 glow-spark", twinkle && "animate-twinkle", className)}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FF7A3D" />
          <stop offset="1" stopColor="#F72585" />
        </linearGradient>
      </defs>
      <path
        d="M11 0c1.2 7.2 3.8 9.8 11 11-7.2 1.2-9.8 3.8-11 11-1.2-7.2-3.8-9.8-11-11 7.2-1.2 9.8-3.8 11-11z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}

/** A small glowing point of light (list bullets, separators). */
export function LightDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full bg-brand-gradient shadow-[0_0_10px_2px_rgb(247_37_133/0.45)]",
        className,
      )}
    />
  );
}
