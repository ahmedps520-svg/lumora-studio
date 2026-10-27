import type { ReactNode } from "react";
import { Spark } from "@/components/light/spark";
import { SiteHeader } from "@/components/site-header";
import { PageLight } from "@/components/light/dawn";

/** The frame around the log-in, sign-up and password pages: one centred card. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative isolate min-h-dvh">
      <PageLight />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-md px-4 pt-14 pb-20">
        <div className="space-y-6 rounded-[1.75rem] surface-lit p-6 sm:p-8">
          <div className="space-y-2 text-center">
            <Spark twinkle className="mx-auto mb-4 size-7" />
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <p className="mt-4 text-center text-xs text-muted-foreground">{footer}</p>}
      </main>
    </div>
  );
}
