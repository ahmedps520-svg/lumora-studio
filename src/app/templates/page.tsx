import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { TemplateGallery } from "@/components/templates/template-gallery";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("templates");
  return { title: t("title") };
}

export default async function TemplatesPage() {
  const t = await getTranslations("templates");
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-aurora [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
      />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6">
        <h1 className="text-[clamp(2rem,4.5vw,3.2rem)] leading-tight font-semibold tracking-[-0.03em]">
          {t("title")}
        </h1>
        <p className="mt-3 mb-8 max-w-2xl text-lg text-muted-foreground">{t("subtitle")}</p>
        <TemplateGallery />
      </main>
    </div>
  );
}
