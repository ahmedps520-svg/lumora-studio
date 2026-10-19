import { ArrowDown, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/brand/logo";
import { CreateDesignDialog } from "@/components/home/create-design-dialog";
import { HeroArt } from "@/components/home/hero-art";
import { MagicDesignBox } from "@/components/home/magic-design-box";
import { QuickCreate } from "@/components/home/quick-create";
import { RecentDesigns } from "@/components/home/recent-designs";
import { FeaturedTemplates } from "@/components/templates/template-gallery";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations("home");
  const common = await getTranslations("common");

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      {/* Ambient background: glow + faint grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1100px] bg-aurora [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grain opacity-[0.035] mix-blend-overlay"
      />

      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full surface-glass py-1 ps-1 pe-3.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 rounded-full btn-glow px-2 py-0.5 text-xs font-semibold">
                <Sparkles className="size-3" /> {t("eyebrowBadge")}
              </span>
              {t("eyebrow")}
            </span>
            <h1 className="mt-6 text-[clamp(2.6rem,6.5vw,4.6rem)] leading-[1.02] font-semibold tracking-[-0.045em]">
              {t("heroTitle1")}
              <br />
              <span className="text-brand-gradient">{t("heroTitle2")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {t("heroSubtitle")}
            </p>
            <div className="mt-8 max-w-xl">
              <MagicDesignBox />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <CreateDesignDialog />
              <Button asChild variant="glass" size="xl">
                <Link href="#sizes">
                  {t("browseSizes")} <ArrowDown />
                </Link>
              </Button>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {(["free", "local", "bilingual"] as const).map((perk) => (
                <li key={perk} className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {t(`perks.${perk}`)}
                </li>
              ))}
            </ul>
          </div>
          <HeroArt
            copy={{
              eyebrow: t("art.eyebrow"),
              headline: t("art.headline"),
              badge: t("art.badge"),
              slide: t("art.slide"),
              story: t("art.story"),
            }}
          />
        </section>

        <div className="mx-auto max-w-6xl space-y-20 px-4 pb-24 sm:px-6">
          <QuickCreate />
          <FeaturedTemplates />
          <RecentDesigns />
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark className="size-5" decorative />
            {common("tagline")}
          </span>
          <Link href="/health" className="hover:text-foreground">
            {t("healthLink")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
