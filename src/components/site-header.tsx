import { Image as ImageIcon, LayoutTemplate, Settings } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AccountButton } from "@/components/auth/account";
import { Logo } from "@/components/brand/logo";
import { CreateDesignDialog } from "@/components/home/create-design-dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LumenTracker } from "@/components/light/lumen-tracker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export async function SiteHeader({ showCreate = true }: { showCreate?: boolean }) {
  const t = await getTranslations("common");
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <LumenTracker />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-full surface-glass ps-3 pe-1.5 sm:gap-3 sm:ps-4 sm:pe-2">
        <Link href="/" aria-label={t("home")} className="rounded-full">
          <Logo collapse />
        </Link>
        <nav className="flex min-w-0 items-center sm:gap-0.5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden rounded-full px-3.5 sm:inline-flex"
          >
            <Link href="/templates" data-testid="nav-templates">
              <LayoutTemplate /> {t("templates")}
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden rounded-full px-3.5 sm:inline-flex"
          >
            <Link href="/photo" data-testid="nav-photo">
              <ImageIcon /> {t("photo")}
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="rounded-full sm:hidden"
            aria-label={t("photo")}
          >
            <Link href="/photo">
              <ImageIcon className="size-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="rounded-full sm:hidden"
            aria-label={t("templates")}
          >
            <Link href="/templates">
              <LayoutTemplate className="size-5" />
            </Link>
          </Button>
          <span aria-hidden className="mx-1.5 hidden h-5 w-px bg-border sm:block" />
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden rounded-full sm:inline-flex"
            aria-label={t("settings")}
          >
            <Link href="/settings">
              <Settings className="size-5" />
            </Link>
          </Button>
          <AccountButton />
          {showCreate && (
            <div className="ms-1 sm:ms-1.5">
              <CreateDesignDialog compact />
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
