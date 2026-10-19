import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { BrowserChecks } from "@/components/health/browser-checks";
import { StatusRow } from "@/components/health/status-row";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_VERSION } from "@/lib/config";
import { getFeatureFlags } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("health");
  return { title: t("title") };
}

export default async function HealthPage() {
  await connection(); // always render fresh — this page reports live status
  const t = await getTranslations("health");
  const format = await getFormatter();
  const flags = getFeatureFlags();
  const onOff = (on: boolean) => (on ? t("on") : t("off"));
  const allOn = flags.aiOwnerKey && (flags.unsplash || flags.pexels || flags.pixabay);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{t("title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Badge
            data-testid="overall-status"
            className="bg-success px-3 py-1 text-sm text-white dark:text-slate-950"
          >
            {allOn ? t("allGood") : t("someOff")}
          </Badge>
        </div>

        <div className="mt-8 grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("server")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y" data-testid="server-checks">
                <StatusRow label={t("version")} value={APP_VERSION} status="ok" />
                <StatusRow label={t("node")} value={process.versions.node} status="ok" />
                <StatusRow
                  label={t("serverTime")}
                  value={format.dateTime(new Date(), { dateStyle: "medium", timeStyle: "medium" })}
                  status="ok"
                />
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("browser")}</CardTitle>
            </CardHeader>
            <CardContent>
              <BrowserChecks />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("features")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y" data-testid="feature-checks">
                <StatusRow
                  label={t("aiKey")}
                  value={onOff(flags.aiOwnerKey)}
                  status={flags.aiOwnerKey ? "ok" : "off"}
                  hint={flags.aiOwnerKey ? undefined : t("aiOffHint")}
                  testId="feature-ai"
                />
                <StatusRow
                  label={t("budget")}
                  value={format.number(flags.dailyBudgetUsd, {
                    style: "currency",
                    currency: "USD",
                  })}
                  status="ok"
                />
                <StatusRow
                  label={t("unsplash")}
                  value={onOff(flags.unsplash)}
                  status={flags.unsplash ? "ok" : "off"}
                />
                <StatusRow
                  label={t("pexels")}
                  value={onOff(flags.pexels)}
                  status={flags.pexels ? "ok" : "off"}
                />
                <StatusRow
                  label={t("pixabay")}
                  value={onOff(flags.pixabay)}
                  status={flags.pixabay ? "ok" : "off"}
                />
                <StatusRow
                  label={t("cloudSync")}
                  value={onOff(flags.cloudSync)}
                  status={flags.cloudSync ? "ok" : "off"}
                />
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
