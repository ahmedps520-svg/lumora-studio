import { LayoutTemplate, Settings } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { CreateDesignDialog } from "@/components/home/create-design-dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export async function SiteHeader({ showCreate = true }: { showCreate?: boolean }) {
  const t = await getTranslations("common");
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-2xl surface-glass ps-3 pe-2">
        <Link href="/" aria-label={t("home")} className="rounded-lg">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/templates" data-testid="nav-templates">
              <LayoutTemplate /> {t("templates")}
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label={t("templates")}
          >
            <Link href="/templates">
              <LayoutTemplate className="size-5" />
            </Link>
          </Button>
          <LanguageSwitcher />
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon" aria-label={t("settings")}>
            <Link href="/settings">
              <Settings className="size-5" />
            </Link>
          </Button>
          {showCreate && (
            <div className="ms-1">
              <CreateDesignDialog compact />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
