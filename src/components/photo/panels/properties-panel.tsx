"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { STARTER_FONTS } from "@/lib/fonts/catalog";
import * as A from "@/lib/photo/actions";
import { createAdjustment } from "@/lib/photo/adjustments";
import { getPixels } from "@/lib/photo/runtime";
import { get, set, usePhoto } from "@/lib/photo/store";
import * as tree from "@/lib/photo/tree";
import type { Adjustment, FillProps, GradientKind, Layer, TextProps } from "@/lib/photo/types";
import { AdjustmentEditor } from "../adjustment-editor";
import { Check, ColorField, NumField, Segmented, SelectField, SmallButton } from "../controls";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-b px-3 py-2.5 last:border-b-0">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

type Of<K extends Layer["kind"]> = Extract<Layer, { kind: K }>;

/** Font, size and spacing for a text layer (or the type tool's defaults). */
export function CharacterControls({ layer }: { layer: Of<"text"> | null }) {
  const t = useTranslations("photo.options");
  const opts = usePhoto((s) => s.options);
  const fg = usePhoto((s) => s.fg);
  const text: TextProps = layer?.text ?? {
    text: "",
    font: opts.fontFamily,
    size: opts.fontSize,
    weight: opts.fontWeight,
    italic: false,
    color: fg,
    align: "left",
    lineHeight: 1.2,
    tracking: 0,
    width: 0,
  };
  const put = (patch: Partial<TextProps>) => {
    if (layer)
      A.updateLayer(layer.id, { text: { ...layer.text, ...patch } } as Partial<Layer>, "character");
    set({
      options: {
        ...get().options,
        ...(patch.font ? { fontFamily: patch.font } : {}),
        ...(patch.size ? { fontSize: patch.size } : {}),
        ...(patch.weight ? { fontWeight: patch.weight } : {}),
      },
      ...(patch.color ? { fg: patch.color } : {}),
    });
  };
  return (
    <div className="space-y-2">
      <SelectField
        label={t("font")}
        value={text.font}
        onChange={(font) => put({ font })}
        options={STARTER_FONTS.map((f) => ({ value: f.family, label: f.family }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          value={String(text.weight)}
          onChange={(w) => put({ weight: Number(w) })}
          options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({
            value: String(w),
            label: t(`weight.${w}` as never),
          }))}
        />
        <Check label={t("italic")} checked={text.italic} onChange={(italic) => put({ italic })} />
        <ColorField value={text.color} onChange={(c) => c && put({ color: c })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label={t("fontSize")}
          value={text.size}
          min={4}
          max={2000}
          unit="px"
          onChange={() => undefined}
          onCommit={(size) => put({ size })}
        />
        <NumField
          label={t("leading")}
          value={text.lineHeight}
          min={0.5}
          max={4}
          step={0.05}
          onChange={() => undefined}
          onCommit={(lineHeight) => put({ lineHeight })}
        />
        <NumField
          label={t("tracking")}
          value={text.tracking}
          min={-200}
          max={1000}
          step={10}
          onChange={() => undefined}
          onCommit={(tracking) => put({ tracking })}
        />
        <NumField
          label={t("boxWidth")}
          value={text.width}
          min={0}
          max={8192}
          unit="px"
          onChange={() => undefined}
          onCommit={(width) => put({ width })}
        />
      </div>
      <Segmented
        label={t("align")}
        value={text.align}
        onChange={(align) => put({ align })}
        options={[
          { value: "left", label: t("alignLeft") },
          { value: "center", label: t("alignCenter") },
          { value: "right", label: t("alignRight") },
        ]}
      />
    </div>
  );
}

function AdjustmentProps({ layer }: { layer: Of<"adjustment"> }) {
  const t = useTranslations("photo");
  const [draft, setDraft] = useState<{ id: string; value: Adjustment } | null>(null);
  const value = draft?.id === layer.id ? draft.value : layer.adjustment;
  return (
    <Section title={t(`adjustments.${layer.adjustment.type}`)}>
      <AdjustmentEditor
        value={value}
        onChange={(v) => {
          setDraft({ id: layer.id, value: v });
          set({ adjustmentOverride: { layerId: layer.id, adjustment: v } });
        }}
        onCommit={(v) => {
          setDraft(null);
          set({ adjustmentOverride: null });
          A.setAdjustment(layer.id, v);
        }}
      />
      <SmallButton
        onClick={() => {
          setDraft(null);
          set({ adjustmentOverride: null });
          A.setAdjustment(layer.id, createAdjustment(layer.adjustment.type));
        }}
      >
        {t("dialogs.reset")}
      </SmallButton>
    </Section>
  );
}

function ShapeProps({ layer }: { layer: Of<"shape"> }) {
  const t = useTranslations("photo.options");
  const s = layer.shape;
  const put = (patch: Partial<typeof s>) =>
    A.updateLayer(layer.id, { shape: { ...s, ...patch } } as Partial<Layer>, "shapeProps");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label={t("width")}
          value={s.width}
          min={1}
          max={16384}
          unit="px"
          onChange={() => undefined}
          onCommit={(width) => put({ width })}
        />
        <NumField
          label={t("height")}
          value={s.height}
          min={1}
          max={16384}
          unit="px"
          onChange={() => undefined}
          onCommit={(height) => put({ height })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ColorField
          label={t("fill")}
          value={s.fill}
          allowNone
          noneLabel={t("none")}
          onChange={(fill) => put({ fill })}
        />
        <ColorField
          label={t("stroke")}
          value={s.stroke}
          allowNone
          noneLabel={t("none")}
          onChange={(stroke) => put({ stroke })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label={t("strokeWidth")}
          value={s.strokeWidth}
          min={0}
          max={200}
          unit="px"
          onChange={() => undefined}
          onCommit={(strokeWidth) => put({ strokeWidth })}
        />
        {s.shape === "rectangle" && (
          <NumField
            label={t("radius")}
            value={s.radius}
            min={0}
            max={4096}
            unit="px"
            onChange={() => undefined}
            onCommit={(radius) => put({ radius })}
          />
        )}
        {s.shape === "polygon" && (
          <NumField
            label={t("sides")}
            value={s.sides}
            min={3}
            max={64}
            onChange={() => undefined}
            onCommit={(sides) => put({ sides: Math.round(sides) })}
          />
        )}
      </div>
    </div>
  );
}

function FillPropsEditor({ layer }: { layer: Of<"fill"> }) {
  const t = useTranslations("photo.options");
  const f = layer.fill;
  const put = (fill: FillProps) => A.updateLayer(layer.id, { fill } as Partial<Layer>, "fillProps");
  if (f.type === "solid")
    return (
      <ColorField
        label={t("color")}
        value={f.color}
        onChange={(c) => c && put({ type: "solid", color: c })}
      />
    );
  const kinds: GradientKind[] = ["linear", "radial", "angle", "reflected", "diamond"];
  return (
    <div className="space-y-2">
      <div
        className="h-5 rounded border"
        style={{
          background: `linear-gradient(to right, ${f.stops.map((s) => s.color).join(", ")})`,
        }}
      />
      <div className="flex items-center gap-3">
        {f.stops.map((s, i) => (
          <ColorField
            key={i}
            value={s.color}
            onChange={(c) =>
              c && put({ ...f, stops: f.stops.map((x, j) => (j === i ? { ...x, color: c } : x)) })
            }
          />
        ))}
      </div>
      <SelectField
        label={t("gradientKind")}
        value={f.kind}
        onChange={(kind) => put({ ...f, kind })}
        options={kinds.map((k) => ({ value: k, label: t(`gradient.${k}`) }))}
      />
      <NumField
        label={t("angle")}
        value={f.angle}
        min={-360}
        max={360}
        unit="°"
        onChange={() => undefined}
        onCommit={(angle) => put({ ...f, angle })}
      />
    </div>
  );
}

function MaskProps({ layer }: { layer: Layer }) {
  const t = useTranslations("photo");
  const [feather, setFeather] = useState(8);
  return (
    <Section title={t("layers.mask")}>
      <Check
        label={t("layers.maskEnabled")}
        checked={layer.mask?.enabled ?? false}
        onChange={() => A.toggleMask()}
      />
      <div className="flex items-center gap-2">
        <NumField
          label={t("options.feather")}
          value={feather}
          min={1}
          max={250}
          unit="px"
          onChange={setFeather}
        />
        <SmallButton onClick={() => A.editMask("feather", feather)}>
          {t("dialogs.apply")}
        </SmallButton>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <SmallButton onClick={() => A.editMask("invert")}>{t("layers.invertMask")}</SmallButton>
        <SmallButton onClick={A.maskToSelection}>{t("cmd.maskToSelection")}</SmallButton>
        {layer.kind !== "adjustment" && (
          <SmallButton onClick={() => A.deleteMask(true)}>{t("cmd.maskApply")}</SmallButton>
        )}
        <SmallButton onClick={() => A.deleteMask(false)}>{t("cmd.maskDelete")}</SmallButton>
      </div>
    </Section>
  );
}

export function PropertiesPanel() {
  const t = useTranslations("photo");
  const layer = usePhoto((s) => s.doc?.layers.find((l) => l.id === s.activeId) ?? null);
  const doc = usePhoto((s) => s.doc);
  const maskEdit = usePhoto((s) => s.maskEdit);
  usePhoto((s) => s.rev);
  if (!doc) return null;

  if (!layer)
    return (
      <Section title={t("properties.document")}>
        <p className="text-xs text-muted-foreground tabular-nums">
          {doc.width} × {doc.height} px · {doc.resolution} ppi
        </p>
      </Section>
    );

  const size = layer.kind === "adjustment" ? null : getPixels(layer.id).canvas;
  return (
    <div data-testid="properties-panel">
      {layer.kind === "adjustment" && <AdjustmentProps layer={layer} />}
      {layer.kind === "group" && (
        <Section title={t("properties.group")}>
          <p className="text-xs text-muted-foreground">
            {t("home.layers", { count: tree.descendantsOf(doc.layers, layer.id).length })}
          </p>
        </Section>
      )}
      {layer.kind !== "adjustment" && layer.kind !== "group" && (
        <Section title={t("properties.transform")}>
          <div className="grid grid-cols-2 gap-2">
            <NumField
              label="X"
              value={layer.x}
              min={-100000}
              max={100000}
              unit="px"
              onChange={() => undefined}
              onCommit={(x) => A.updateLayer(layer.id, { x: Math.round(x) }, "move")}
            />
            <NumField
              label="Y"
              value={layer.y}
              min={-100000}
              max={100000}
              unit="px"
              onChange={() => undefined}
              onCommit={(y) => A.updateLayer(layer.id, { y: Math.round(y) }, "move")}
            />
          </div>
          {size && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("options.width")}: {size.width} px · {t("options.height")}: {size.height} px
            </p>
          )}
        </Section>
      )}
      {layer.kind === "text" && (
        <Section title={t("panels.character")}>
          <CharacterControls layer={layer} />
        </Section>
      )}
      {layer.kind === "shape" && (
        <Section title={t("properties.shape")}>
          <ShapeProps layer={layer} />
        </Section>
      )}
      {layer.kind === "fill" && (
        <Section title={t("properties.fill")}>
          <FillPropsEditor layer={layer} />
        </Section>
      )}
      {layer.mask && (maskEdit || layer.kind === "adjustment") && <MaskProps layer={layer} />}
      {layer.kind === "pixel" && (
        <Section title={t("properties.quickActions")}>
          <div className="flex flex-wrap gap-1.5">
            <SmallButton
              onClick={() => void A.removeBackgroundToMask()}
              disabled={Boolean(layer.mask)}
              testId="qa-remove-bg"
            >
              {t("cmd.removeBackground")}
            </SmallButton>
            <SmallButton onClick={() => void A.selectSubject()}>
              {t("cmd.selectSubject")}
            </SmallButton>
            <SmallButton onClick={() => A.auto("tone")}>{t("cmd.autoTone")}</SmallButton>
          </div>
        </Section>
      )}
    </div>
  );
}
