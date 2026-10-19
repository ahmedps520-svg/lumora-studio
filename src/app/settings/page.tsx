import { Activity, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Card } from "@/components/settings/ai-settings";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { isSettingsTab } from "@/components/settings/tabs";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_VERSION } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("settings");
  const { tab } = await searchParams;
  const version = t("about.version", { version: APP_VERSION });

  const general = (
    <>
      <Card title={t("general.title")}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <span className="flex items-center gap-2">
            {t("general.language")} <LanguageSwitcher />
          </span>
          <span className="flex items-center gap-2">
            {t("general.theme")} <ThemeToggle />
          </span>
        </div>
      </Card>
      <Card title={t("about.title")}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium">
              {APP_NAME}{" "}
              <span className="text-muted-foreground tabular-nums" data-testid="app-version">
                {version}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("about.body")}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/health">
              <Activity /> {t("about.health")}
            </Link>
          </Button>
        </div>
      </Card>
    </>
  );

  return (
    <div className="relative isolate min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-aurora [mask-image:linear-gradient(to_bottom,black_40%,transparent)] opacity-70"
      />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 pt-8 pb-20 sm:px-6">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ms-2">
            <Link href="/">
              <ArrowLeft className="rtl:-scale-x-100" /> {t("back")}
            </Link>
          </Button>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-semibold">{t("title")}</h1>
            <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground tabular-nums">
              {version}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <SettingsTabs initial={isSettingsTab(tab) ? tab : "general"} general={general} />
      </main>
    </div>
  );
}
