"use client";

import { useTranslations } from "next-intl";

/** Names a history step: its own label, else the tool, filter or adjustment it came from. */
export function useHistoryLabel() {
  const t = useTranslations("photo");
  return (label: string) => {
    for (const key of [
      `history.${label}`,
      `tools.${label}`,
      `filters.names.${label}`,
      `adjustments.${label}`,
    ])
      if (t.has(key as never)) return t(key as never);
    return label;
  };
}
