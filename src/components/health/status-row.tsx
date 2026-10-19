import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Status = "ok" | "off" | "fail" | "pending";

const ICONS: Record<Status, ReactNode> = {
  ok: <CheckCircle2 className="size-5 text-success" aria-hidden />,
  off: <CircleDashed className="size-5 text-muted-foreground" aria-hidden />,
  fail: <XCircle className="size-5 text-destructive" aria-hidden />,
  pending: <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />,
};

/** One line of the health report. Status is shown as icon AND text, never colour alone. */
export function StatusRow({
  label,
  value,
  status,
  hint,
  testId,
}: {
  label: string;
  value: ReactNode;
  status: Status;
  hint?: string;
  testId?: string;
}) {
  return (
    <li className="flex items-start gap-3 py-3" data-testid={testId} data-status={status}>
      <span className="mt-0.5">{ICONS[status]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-medium">{label}</span>
          <span
            className={cn(
              "text-sm tabular-nums",
              status === "fail" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {value}
          </span>
        </div>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </li>
  );
}
