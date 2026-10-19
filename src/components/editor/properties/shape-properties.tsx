"use client";

import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/toggle";
import type { LineElement, ShapeElement } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { ColorField, Section, SliderField } from "./fields";

export function ShapeProperties({ element }: { element: ShapeElement }) {
  const t = useTranslations("editor.properties");
  const update = (patch: Partial<ShapeElement>, mergeKey?: string) =>
    editorActions.updateElement(element.id, patch, mergeKey);
  const disabled = element.locked;
  const fillColor =
    element.fill.type === "solid"
      ? element.fill.color
      : element.fill.type === "gradient"
        ? (element.fill.gradient.stops[0]?.color ?? null)
        : null;
  const maxRadius = Math.round(Math.min(element.width, element.height) / 2);

  return (
    <>
      <Section title={t("fill")}>
        <ColorField
          label={t("fill")}
          value={fillColor}
          disabled={disabled}
          testId="prop-fill"
          onChange={(color) => update({ fill: { type: "solid", color } }, `fill:${element.id}`)}
        />
        <Toggle
          size="sm"
          variant="outline"
          disabled={disabled}
          pressed={element.fill.type === "none"}
          onPressedChange={(none) =>
            update({
              fill: none ? { type: "none" } : { type: "solid", color: fillColor ?? "#7C6CF2" },
            })
          }
        >
          {t("noFill")}
        </Toggle>
      </Section>

      <Section title={t("stroke")}>
        <ColorField
          label={t("stroke")}
          value={element.stroke?.color ?? null}
          disabled={disabled}
          onChange={(color) =>
            update(
              {
                stroke: {
                  color,
                  width: element.stroke?.width || 4,
                  dash: element.stroke?.dash ?? [],
                },
              },
              `stroke:${element.id}`,
            )
          }
        />
        <SliderField
          label={t("strokeWidth")}
          value={element.stroke?.width ?? 0}
          min={0}
          max={50}
          disabled={disabled}
          format={(v) => `${v}px`}
          onChange={(width) =>
            update(
              {
                stroke:
                  width === 0
                    ? null
                    : {
                        color: element.stroke?.color ?? "#0F172A",
                        width,
                        dash: element.stroke?.dash ?? [],
                      },
              },
              `strokeWidth:${element.id}`,
            )
          }
        />
      </Section>

      {element.kind === "rect" && (
        <Section>
          <SliderField
            label={t("cornerRadius")}
            value={Math.min(element.cornerRadius, maxRadius)}
            min={0}
            max={maxRadius}
            disabled={disabled}
            format={(v) => `${v}px`}
            onChange={(cornerRadius) => update({ cornerRadius }, `radius:${element.id}`)}
          />
        </Section>
      )}

      {(element.kind === "polygon" || element.kind === "star") && (
        <Section>
          <SliderField
            label={t("sides")}
            value={element.sides}
            min={3}
            max={16}
            disabled={disabled}
            onChange={(sides) => update({ sides }, `sides:${element.id}`)}
          />
        </Section>
      )}
    </>
  );
}

export function LineProperties({ element }: { element: LineElement }) {
  const t = useTranslations("editor.properties");
  const update = (patch: Partial<LineElement>, mergeKey?: string) =>
    editorActions.updateElement(element.id, patch, mergeKey);
  const disabled = element.locked;
  const dashed = element.stroke.dash.length > 0;

  return (
    <Section title={t("stroke")}>
      <ColorField
        label={t("color")}
        value={element.stroke.color}
        disabled={disabled}
        onChange={(color) =>
          update({ stroke: { ...element.stroke, color } }, `stroke:${element.id}`)
        }
      />
      <SliderField
        label={t("lineThickness")}
        value={element.stroke.width}
        min={1}
        max={60}
        disabled={disabled}
        format={(v) => `${v}px`}
        onChange={(width) =>
          update(
            {
              // The element's height is the line thickness; keep the line centred.
              stroke: {
                ...element.stroke,
                width,
                dash: dashed ? [width * 3, width * 2] : [],
              },
              height: width,
              y: element.y + element.height / 2 - width / 2,
            },
            `thickness:${element.id}`,
          )
        }
      />
      <Toggle
        size="sm"
        variant="outline"
        disabled={disabled}
        pressed={dashed}
        onPressedChange={(on) =>
          update({
            stroke: {
              ...element.stroke,
              dash: on ? [element.stroke.width * 3, element.stroke.width * 2] : [],
            },
            lineCap: on ? "butt" : "round",
          })
        }
      >
        {t("dashed")}
      </Toggle>
    </Section>
  );
}
