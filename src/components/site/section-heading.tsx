import { Spark } from "@/components/light/spark";
import { cn } from "@/lib/utils";

/** A small label above a heading, lit by the Lumora spark. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase",
        className,
      )}
    >
      <Spark className="size-3" />
      {children}
    </p>
  );
}

/** A section's eyebrow, heading and lead, with an optional action at the end. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  action,
  className,
}: {
  id?: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4", className)}>
      <div className="max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          id={id}
          className="mt-3 text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.06] font-semibold tracking-[-0.035em] text-balance"
        >
          {title}
        </h2>
        {lead && (
          <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {lead}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
