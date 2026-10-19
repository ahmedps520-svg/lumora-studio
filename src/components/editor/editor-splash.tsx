"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** Full-screen state shown while the editor loads, or when a design can't be opened. */
export function EditorSplash({ message, error = false }: { message?: string; error?: boolean }) {
  const t = useTranslations("editor");
  return (
    <div
      className="flex h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center"
      role={error ? "alert" : "status"}
    >
      <LogoMark className={error ? "size-14" : "size-14 animate-pulse"} />
      <p className="max-w-md text-lg text-muted-foreground">{message ?? t("loading")}</p>
      {error && (
        <Button asChild>
          <Link href="/">{t("backHome")}</Link>
        </Button>
      )}
    </div>
  );
}
