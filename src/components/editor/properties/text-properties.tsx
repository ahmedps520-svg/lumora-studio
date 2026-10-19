"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Pilcrow,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { withTextStyle } from "@/lib/document/text";
import { STARTER_FONTS } from "@/lib/fonts/catalog";
import type { TextElement } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { ColorField, NumberField, Section, SliderField } from "./fields";

export function TextProperties({ element }: { element: TextElement }) {
  const t = useTranslations("editor.properties");
  const disabled = element.locked;
  /** Applies a box-level style and clears matching per-word overrides. */
  const style = (patch: Partial<TextElement>, mergeKey?: string) =>
    editorActions.updateElement(element.id, withTextStyle(element, patch), mergeKey);
  const update = (patch: Partial<TextElement>, mergeKey?: string) =>
    editorActions.updateElement(element.id, patch, mergeKey);

  const color = element.fill.type === "solid" ? element.fill.color : null;
  const fonts = STARTER_FONTS.some((f) => f.family === element.fontFamily)
    ? STARTER_FONTS
    : [{ family: element.fontFamily, category: "sans" as const }, ...STARTER_FONTS];

  return (
    <Section title={t("font")}>
      <Select
        value={element.fontFamily}
        disabled={disabled}
        onValueChange={(fontFamily) => style({ fontFamily })}
      >
        <SelectTrigger aria-label={t("font")} className="w-full" data-testid="prop-font">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {fonts.map((f) => (
            <SelectItem key={f.family} value={f.family}>
              {f.family}
              {f.arabic ? " · عربي" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <div className="w-24">
          <NumberField
            label="Aa"
            ariaLabel={t("fontSize")}
            testId="prop-font-size"
            value={element.fontSize}
            min={1}
            max={2000}
            step={0.5}
            disabled={disabled}
            onCommit={(fontSize, k) => style({ fontSize }, k)}
          />
        </div>
        <div className="flex flex-1 justify-end gap-0.5">
          <Toggle
            size="sm"
            aria-label={t("bold")}
            disabled={disabled}
            pressed={element.fontWeight >= 600}
            onPressedChange={(on) => style({ fontWeight: on ? 700 : 400 })}
          >
            <Bold />
          </Toggle>
          <Toggle
            size="sm"
            aria-label={t("italic")}
            disabled={disabled}
            pressed={element.italic}
            onPressedChange={(italic) => style({ italic })}
          >
            <Italic />
          </Toggle>
          <Toggle
            size="sm"
            aria-label={t("underline")}
            disabled={disabled}
            pressed={element.underline}
            onPressedChange={(underline) => style({ underline })}
          >
            <Underline />
          </Toggle>
          <Toggle
            size="sm"
            aria-label={t("strike")}
            disabled={disabled}
            pressed={element.strike}
            onPressedChange={(strike) => style({ strike })}
          >
            <Strikethrough />
          </Toggle>
        </div>
      </div>

      <ColorField
        label={t("color")}
        value={color}
        disabled={disabled}
        testId="prop-text-color"
        onChange={(hex) =>
          style({ fill: { type: "solid", color: hex } }, `textColor:${element.id}`)
        }
      />

      <div className="flex items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          aria-label={t("align")}
          disabled={disabled}
          value={element.align}
          onValueChange={(align) => align && update({ align: align as TextElement["align"] })}
        >
          <ToggleGroupItem value="left" aria-label={t("alignLeft")}>
            <AlignLeft />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label={t("alignCenter")}>
            <AlignCenter />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label={t("alignRight")}>
            <AlignRight />
          </ToggleGroupItem>
          <ToggleGroupItem value="justify" aria-label={t("alignJustify")}>
            <AlignJustify />
          </ToggleGroupItem>
        </ToggleGroup>
        <Toggle
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label={`${t("direction")}: ${element.direction === "rtl" ? t("rtl") : t("ltr")}`}
          title={element.direction === "rtl" ? t("rtl") : t("ltr")}
          pressed={element.direction === "rtl"}
          onPressedChange={(rtl) =>
            update({ direction: rtl ? "rtl" : "ltr", align: rtl ? "right" : "left" })
          }
        >
          <Pilcrow className={element.direction === "rtl" ? "-scale-x-100" : undefined} />
          {element.direction === "rtl" ? "RTL" : "LTR"}
        </Toggle>
      </div>

      <SliderField
        label={t("lineHeight")}
        value={element.lineHeight}
        min={0.5}
        max={3}
        step={0.05}
        disabled={disabled}
        format={(v) => v.toFixed(2)}
        onChange={(lineHeight) => update({ lineHeight }, `lineHeight:${element.id}`)}
      />
      <SliderField
        label={t("letterSpacing")}
        value={element.letterSpacing}
        min={-200}
        max={800}
        step={10}
        disabled={disabled}
        onChange={(letterSpacing) => update({ letterSpacing }, `letterSpacing:${element.id}`)}
      />
    </Section>
  );
}
