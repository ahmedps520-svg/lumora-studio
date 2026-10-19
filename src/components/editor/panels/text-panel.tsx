"use client";

import { useTranslations } from "next-intl";
import { createText, type TextPreset } from "@/lib/document/factory";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";
import { cn } from "@/lib/utils";

const PRESETS: {
  preset: TextPreset;
  key: "addHeading" | "addSubheading" | "addBody";
  className: string;
}[] = [
  { preset: "heading", key: "addHeading", className: "font-heading text-2xl font-bold" },
  { preset: "subheading", key: "addSubheading", className: "font-heading text-lg font-semibold" },
  { preset: "body", key: "addBody", className: "text-sm" },
];

export function TextPanel() {
  const t = useTranslations("editor.text");
  const format = useEditorStore((s) => s.design?.format);
  if (!format) return null;

  return (
    <div className="space-y-3">
      {PRESETS.map(({ preset, key, className }) => (
        <button
          key={preset}
          type="button"
          data-testid={`add-text-${preset}`}
          onClick={() => {
            const text = createText(preset, format, { runs: [{ text: t(key), style: {} }] });
            editorActions.addElements([text]);
          }}
          className={cn(
            "w-full rounded-xl surface-card px-4 py-3.5 text-start transition-all hover:-translate-y-0.5 hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {t(key)}
        </button>
      ))}
      <p className="pt-2 text-sm text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
