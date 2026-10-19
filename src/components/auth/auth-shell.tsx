import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-aurora [mask-image:linear-gradient(to_bottom,black_40%,transparent)] opacity-70"
      />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-md px-4 pt-10 pb-20">
        <div className="space-y-6 rounded-3xl surface-card p-6 sm:p-8">
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <p className="mt-4 text-center text-xs text-muted-foreground">{footer}</p>}
      </main>
    </div>
  );
}
