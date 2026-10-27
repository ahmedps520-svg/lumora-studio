import { BadgeCheck, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ChangePasswordForm,
  EmailResetLink,
  SignOutButton,
  TestEmailButton,
} from "@/components/auth/account";
import { Notice } from "@/components/auth/fields";
import { Card } from "@/components/settings/ai-settings";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/auth/session";
import { getFeatureFlags } from "@/lib/env";
import { PageLight } from "@/components/light/dawn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("account") };
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const { welcome } = await searchParams;
  const t = await getTranslations("auth");
  const { email: emailOn } = getFeatureFlags();

  return (
    <div className="relative isolate min-h-dvh">
      <PageLight />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-2xl space-y-4 px-4 pt-8 pb-20 sm:px-6">
        <h1 className="text-3xl font-semibold">{t("accountTitle")}</h1>
        {welcome && user.emailVerified && <Notice tone="success">{t("welcome")}</Notice>}
        <Card title={user.name} aside={<SignOutButton />}>
          <div className="space-y-2 text-sm">
            <p dir="ltr" className="text-start" data-testid="account-email">
              {user.email}
            </p>
            <p
              className={
                user.emailVerified
                  ? "flex items-center gap-1.5 text-success"
                  : "flex items-center gap-1.5 text-muted-foreground"
              }
            >
              {user.emailVerified ? (
                <BadgeCheck className="size-4" />
              ) : (
                <CircleAlert className="size-4" />
              )}
              {user.emailVerified ? t("verified") : t("unverified")}
            </p>
            <p className="text-xs text-muted-foreground">{t("designsLocal")}</p>
          </div>
        </Card>
        <Card title={t("changePassword")}>
          <p className="-mt-2 text-xs text-muted-foreground">{t("changeNotice")}</p>
          <ChangePasswordForm />
          <EmailResetLink email={user.email} />
        </Card>
        <Card title={t("emails")}>
          <p className="text-sm text-muted-foreground">{emailOn ? t("emailOn") : t("emailOff")}</p>
          <TestEmailButton email={user.email} />
        </Card>
      </main>
    </div>
  );
}
