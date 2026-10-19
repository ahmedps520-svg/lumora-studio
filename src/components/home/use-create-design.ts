"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { createDesign } from "@/lib/document/factory";
import type { Format } from "@/lib/schema";
import { saveDesign } from "@/lib/storage/designs";

/** Creates a blank design in local storage and opens it in the editor. */
export function useCreateDesign() {
  const router = useRouter();
  const t = useTranslations();
  const [creating, setCreating] = useState(false);

  const create = useCallback(
    async (format: Format) => {
      if (creating) return;
      setCreating(true);
      try {
        const name =
          format.presetId && t.has(`formats.${format.presetId}` as never)
            ? t(`formats.${format.presetId}` as never)
            : t("home.untitled");
        const design = createDesign({ name, format });
        await saveDesign(design);
        router.push(`/editor/${design.id}`);
      } catch (error) {
        console.error("[home] could not create design", error);
        toast.error(t("home.storageError"));
        setCreating(false);
      }
    },
    [creating, router, t],
  );

  return { create, creating };
}
