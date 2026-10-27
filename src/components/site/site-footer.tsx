import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LightDot } from "@/components/light/spark";

/** The site footer: the mark and tagline, a few links, and a beam of light on top. */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const common = await getTranslations("common");
  const groups = [
    {
      id: "make",
      links: [
        ["/templates", common("templates")],
        ["/photo", t("photoEditor")],
        ["/#sizes", t("blank")],
      ],
    },
    {
      id: "you",
      links: [
        ["/settings", common("settings")],
        ["/account", t("account")],
        ["/health", t("health")],
      ],
    },
  ] as const;

  return (
    <footer className="relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="light-line opacity-70" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Link href="/" aria-label={common("home")} className="inline-block rounded-lg">
            <Logo />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {common("tagline")}
          </p>
        </div>
        {groups.map((group) => (
          <nav key={group.id} aria-labelledby={`footer-${group.id}`}>
            <h2
              id={`footer-${group.id}`}
              className="font-sans text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase"
            >
              {t(group.id)}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {group.links.map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t px-4 py-6 text-xs text-muted-foreground sm:px-6">
        <span>{t("rights", { year: new Date().getFullYear() })}</span>
        <span className="inline-flex items-center gap-2">
          <LightDot />
          {t("made")}
        </span>
      </div>
    </footer>
  );
}
