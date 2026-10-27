import { cn } from "@/lib/utils";

/**
 * The light behind a hero: a warm glow rising over the design canvas (a dot
 * grid that fades out), with slow rays of light. Purely decorative.
 * `at` is where the light comes from.
 */
export function Dawn({
  className,
  at = "top",
  rays = true,
}: {
  className?: string;
  at?: "top" | "bottom";
  rays?: boolean;
}) {
  const top = at === "top";
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      {/* The canvas */}
      <div
        className={cn(
          "absolute inset-0 bg-dots opacity-70",
          top
            ? "[mask-image:radial-gradient(ellipse_65%_55%_at_50%_28%,black,transparent_75%)]"
            : "[mask-image:radial-gradient(ellipse_70%_70%_at_50%_100%,black,transparent_75%)]",
        )}
      />
      {/* Rays */}
      {rays && (
        <div
          className={cn(
            "absolute inset-x-0 mx-auto aspect-square w-[1500px] animate-rays [mask-image:radial-gradient(circle,black_0%,transparent_58%)] opacity-80 [background:repeating-conic-gradient(var(--lumen-ray)_0deg_1.5deg,transparent_1.5deg_12deg)]",
            top ? "-top-[900px]" : "-bottom-[900px]",
          )}
        />
      )}
      {/* The glow */}
      <div
        className={cn(
          "absolute inset-x-0 mx-auto h-[560px] w-[min(1100px,140vw)] animate-breathe rounded-full blur-3xl [background:radial-gradient(closest-side,var(--lumen-1),var(--lumen-2)_45%,var(--lumen-3)_72%,transparent)]",
          top ? "-top-[300px]" : "-bottom-[320px]",
        )}
      />
    </div>
  );
}

/** A softer dawn at the top of an ordinary page (no rays). */
export function PageLight({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] [mask-image:linear-gradient(to_bottom,black_40%,transparent)]",
        className,
      )}
    >
      <Dawn rays={false} className="opacity-75" />
    </div>
  );
}
