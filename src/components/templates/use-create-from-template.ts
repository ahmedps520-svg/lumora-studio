"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { createDesign } from "@/lib/document/factory";
import type { TemplateDef, TemplateLocale } from "@/lib/templates";
import { saveDesign } from "@/lib/storage/designs";

/** Makes a new design from a template (all its pages) and opens it. */
export function useCreateFromTemplate() {
  const router = useRouter();
  const t = useTranslations("home");
  const locale = (useLocale() === "ar" ? "ar" : "en") as TemplateLocale;
  const [creating, setCreating] = useState<string | null>(null);

  const create = useCallback(
    async (def: TemplateDef) => {
      if (creating) return;
      setCreating(def.id);
      try {
        const { buildTemplate, loadTemplateLibrary } = await import("@/lib/templates");
        await loadTemplateLibrary();
        const built = buildTemplate(def, locale);
        const design = createDesign({ name: built.name, format: built.format, pages: built.pages });
        await saveDesign(design);
        router.push(`/editor/${design.id}`);
      } catch (error) {
        console.error("[templates] could not create design", error);
        toast.error(t("storageError"));
        setCreating(null);
      }
    },
    [creating, locale, router, t],
  );

  return { create, creating };
}
