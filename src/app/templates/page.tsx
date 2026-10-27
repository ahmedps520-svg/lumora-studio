import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/site/section-heading";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { PageLight } from "@/components/light/dawn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("templates");
  return { title: t("title") };
}

export default async function TemplatesPage() {
  const t = await getTranslations("templates");
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <PageLight />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-7xl px-4 pt-14 pb-24 sm:px-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="mt-3 text-[clamp(2.4rem,5.4vw,4rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">
          {t("title")}
        </h1>
        <p className="mt-4 mb-10 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          {t("subtitle")}
        </p>
        <TemplateGallery />
      </main>
      <SiteFooter />
    </div>
  );
}
