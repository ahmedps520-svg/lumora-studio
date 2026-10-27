"use client";

import { useMemo } from "react";
import { getTemplateDef, type TemplateDef } from "@/lib/templates";
import { TemplateCard } from "./template-card";
import { useTemplateCatalog } from "./use-template-library";

/** A plain grid of template thumbnails (for the development review page). */
export function ReviewGrid({
  ids,
  blueprint,
  theme,
  kind,
  limit,
  offset,
}: {
  ids: string;
  blueprint: string;
  theme: string;
  kind: string;
  limit: number;
  offset: number;
}) {
  const { all, ready } = useTemplateCatalog();
  const defs = useMemo(() => {
    if (!ready) return [];
    if (ids)
      return ids
        .split(",")
        .map((id) => getTemplateDef(id.trim()))
        .filter((d): d is TemplateDef => Boolean(d));
    return all
      .filter(
        (d) =>
          (!blueprint || d.blueprint === blueprint) &&
          (!theme || d.theme === theme) &&
          (!kind || d.kind === kind),
      )
      .slice(offset, offset + limit);
  }, [all, ready, ids, blueprint, theme, kind, limit, offset]);

  return (
    <div data-testid="review-grid" data-count={defs.length} data-ready={ready}>
      <p className="mb-3 text-xs text-muted-foreground">{defs.length} templates</p>
      <div className="grid grid-cols-4 gap-3 lg:grid-cols-6">
        {defs.map((def) => (
          <div key={def.id} data-review-id={def.id}>
            <TemplateCard def={def} onPick={() => undefined} compact />
            <p className="mt-1 truncate text-[10px] text-muted-foreground">{def.id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
