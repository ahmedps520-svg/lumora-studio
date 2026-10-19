import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetTitle") };
}

/** Opened from the reset email: ?token=… (or ?error=INVALID_TOKEN for an old link). */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, error } = await searchParams;
  const t = await getTranslations("auth");
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(token) && !error;
  return (
    <AuthShell title={t("resetTitle")} subtitle={valid ? t("resetSubtitle") : undefined}>
      <ResetForm token={valid ? token : null} />
    </AuthShell>
  );
}
