import { ArrowRight, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CreateDesignDialog } from "@/components/home/create-design-dialog";
import { HeroArt } from "@/components/home/hero-art";
import { MagicDesignBox } from "@/components/home/magic-design-box";
import { QuickCreate } from "@/components/home/quick-create";
import { RecentDesigns } from "@/components/home/recent-designs";
import { WorkspaceChooser } from "@/components/home/workspace-chooser";
import { Dawn } from "@/components/light/dawn";
import { LightDot, Spark } from "@/components/light/spark";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteFooter } from "@/components/site/site-footer";
import { FeaturedTemplates } from "@/components/templates/template-gallery";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grain opacity-[0.035] mix-blend-overlay"
      />

      <SiteHeader />

      <main id="main">
        {/* Hero: Lumora's light rising behind the choice of studio */}
        <section className="relative isolate -mt-[4.25rem] px-4 pt-[4.25rem] sm:px-6">
          <Dawn />
          <div className="mx-auto max-w-6xl pt-16 pb-20 text-center lg:pt-24 lg:pb-24">
            <span className="inline-flex animate-fade-up items-center gap-2 rounded-full surface-glass py-1 ps-1 pe-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
                <Spark className="size-3" /> {t("eyebrowBadge")}
              </span>
              {t("eyebrow")}
            </span>
            <h1 className="mx-auto mt-7 max-w-6xl animate-fade-up text-[clamp(2.75rem,6.6vw,5.25rem)] leading-[1] font-semibold tracking-[-0.05em] text-balance [animation-delay:80ms]">
              <span className="block">{t("heroTitle1")}</span>
              <span className="text-glow">{t("heroTitle2")}</span>
              {/* The spark from the logo, caught on the last word */}
              <Spark
                twinkle
                className="ms-[0.06em] inline-block size-[0.3em] -translate-y-[0.55em] align-baseline"
              />
            </h1>
            <p className="mx-auto mt-7 max-w-2xl animate-fade-up text-lg leading-relaxed text-pretty text-muted-foreground [animation-delay:160ms] sm:text-xl">
              {t("heroSubtitle")}
            </p>
            <div className="animate-fade-up [animation-delay:240ms]">
              <WorkspaceChooser />
            </div>
            <ul className="mt-10 flex animate-fade-up flex-wrap justify-center gap-x-7 gap-y-2 text-sm text-muted-foreground [animation-delay:320ms]">
              {(["free", "local", "bilingual"] as const).map((perk) => (
                <li key={perk} className="flex items-center gap-2.5">
                  <LightDot />
                  {t(`perks.${perk}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="light-line" />
        </div>

        {/* AI: describe it, and it's designed */}
        <section
          aria-labelledby="ai-heading"
          className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-28"
        >
          <div>
            <SectionHeading
              id="ai-heading"
              eyebrow={t("ai.eyebrow")}
              title={t("ai.title")}
              lead={t("ai.lead")}
              className="mb-7"
            />
            <MagicDesignBox />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <CreateDesignDialog />
              <Button asChild variant="glass" size="xl" className="rounded-full">
                <Link href="/templates">
                  {t("browseTemplates")} <ArrowRight className="rtl:-scale-x-100" />
                </Link>
              </Button>
            </div>
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

        <div className="mx-auto max-w-6xl space-y-28 px-4 pb-28 sm:px-6">
          <QuickCreate />
          <FeaturedTemplates />
          <RecentDesigns />
        </div>

        {/* Closing: one more invitation, under the same light */}
        <section aria-labelledby="closing-heading" className="px-4 pb-24 sm:px-6">
          <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] surface-lit px-6 py-16 text-center sm:py-24">
            <Dawn at="bottom" />
            <Spark twinkle className="mx-auto size-9" />
            <h2
              id="closing-heading"
              className="mx-auto mt-6 max-w-3xl text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance"
            >
              {t("closing.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
              {t("closing.lead")}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <CreateDesignDialog />
              <Button asChild variant="glass" size="xl" className="rounded-full">
                <Link href="/photo">
                  <ImageIcon /> {t("closing.photo")}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
