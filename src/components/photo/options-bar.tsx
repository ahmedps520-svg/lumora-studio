"use client";

import {
  ArrowLeftRight,
  ArrowUpDown,
  Check as CheckIcon,
  Maximize,
  RotateCcw,
  RotateCw,
  ScanFace,
  SquareDashed,
  SquareMinus,
  SquarePlus,
  SquaresIntersect,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { STARTER_FONTS } from "@/lib/fonts/catalog";
import * as A from "@/lib/photo/actions";
import {
  activeLayer,
  get,
  set,
  type TransformMode,
  usePhoto,
  type ToolOptions,
} from "@/lib/photo/store";
import { finishCrop, useOverlay } from "@/lib/photo/tools";
import { BLEND_MODES, type GradientKind } from "@/lib/photo/types";
import { Check, ColorField, NumField, Segmented, SelectField, SmallButton } from "./controls";
import { TOOL_ICONS } from "./tool-icons";
import { fitOnScreen } from "./viewport";

const setOpt = (patch: Partial<ToolOptions>) => set({ options: { ...get().options, ...patch } });

function useOpt<K extends keyof ToolOptions>(key: K) {
  return usePhoto((s) => s.options[key]);
}

function SelectionModes() {
  const t = useTranslations("photo.options");
  const mode = useOpt("selectionMode");
  return (
    <Segmented
      label={t("selectionMode")}
      value={mode}
      onChange={(v) => setOpt({ selectionMode: v })}
      options={[
        { value: "new", label: t("modeNew"), icon: <SquareDashed className="size-3.5" /> },
        { value: "add", label: t("modeAdd"), icon: <SquarePlus className="size-3.5" /> },
        { value: "subtract", label: t("modeSubtract"), icon: <SquareMinus className="size-3.5" /> },
        {
          value: "intersect",
          label: t("modeIntersect"),
          icon: <SquaresIntersect className="size-3.5" />,
        },
      ]}
    />
  );
}

function Feather() {
  const t = useTranslations("photo.options");
  return (
    <NumField
      label={t("feather")}
      value={useOpt("feather")}
      min={0}
      max={250}
      unit="px"
      onChange={(v) => setOpt({ feather: v })}
    />
  );
}

function SelectSubjectButton() {
  const t = useTranslations("photo");
  const busy = usePhoto((s) => s.busy);
  return (
    <SmallButton
      onClick={() => void A.selectSubject()}
      disabled={Boolean(busy)}
      testId="select-subject"
    >
      <ScanFace /> {t("cmd.selectSubject")}
    </SmallButton>
  );
}

function BrushBasics({ hardness = true, flow = true, opacity = true, blend = false }) {
  const t = useTranslations("photo.options");
  const tb = useTranslations("photo.blend");
  const size = useOpt("size");
  const hard = useOpt("hardness");
  const op = useOpt("opacity");
  const fl = useOpt("flow");
  const mode = useOpt("brushBlend");
  const spacing = useOpt("spacing");
  return (
    <>
      <NumField
        label={t("size")}
        value={size}
        min={1}
        max={1000}
        unit="px"
        slider
        onChange={(v) => setOpt({ size: Math.round(v) })}
        testId="opt-size"
      />
      {hardness && (
        <NumField
          label={t("hardness")}
          value={hard}
          min={0}
          max={1}
          scale={100}
          unit="%"
          slider
          onChange={(v) => setOpt({ hardness: v })}
        />
      )}
      {blend && (
        <SelectField
          label={t("mode")}
          value={mode}
          onChange={(v) => setOpt({ brushBlend: v })}
          options={BLEND_MODES.filter(
            (m) =>
              ![
                "dissolve",
                "darkerColor",
                "lighterColor",
                "linearBurn",
                "linearDodge",
                "vividLight",
                "linearLight",
                "pinLight",
                "hardMix",
                "subtract",
                "divide",
              ].includes(m),
          ).map((m) => ({ value: m, label: tb(m) }))}
        />
      )}
      {opacity && (
        <NumField
          label={t("opacity")}
          value={op}
          min={0.01}
          max={1}
          scale={100}
          unit="%"
          slider
          onChange={(v) => setOpt({ opacity: v })}
        />
      )}
      {blend && (
        <NumField
          label={t("spacing")}
          value={spacing}
          min={0.01}
          max={2}
          scale={100}
          unit="%"
          onChange={(v) => setOpt({ spacing: v })}
        />
      )}
      {flow && (
        <NumField
          label={t("flow")}
          value={fl}
          min={0.01}
          max={1}
          scale={100}
          unit="%"
          onChange={(v) => setOpt({ flow: v })}
        />
      )}
    </>
  );
}

function ToleranceRow({ sampleAll = true, contiguous = true }) {
  const t = useTranslations("photo.options");
  const tolerance = useOpt("tolerance");
  const isContiguous = useOpt("contiguous");
  const all = useOpt("sampleAll");
  return (
    <>
      <NumField
        label={t("tolerance")}
        value={tolerance}
        min={0}
        max={255}
        onChange={(v) => setOpt({ tolerance: Math.round(v) })}
      />
      {contiguous && (
        <Check
          label={t("contiguous")}
          checked={isContiguous}
          onChange={(v) => setOpt({ contiguous: v })}
        />
      )}
      {sampleAll && (
        <Check label={t("sampleAll")} checked={all} onChange={(v) => setOpt({ sampleAll: v })} />
      )}
    </>
  );
}

function CropOptions() {
  const t = useTranslations("photo.options");
  const ratio = useOpt("cropRatio");
  const del = useOpt("deleteCropped");
  return (
    <>
      <SelectField
        label={t("ratio")}
        value={ratio}
        onChange={(v) => setOpt({ cropRatio: v })}
        options={[
          { value: "free", label: t("ratioFree") },
          { value: "original", label: t("ratioOriginal") },
          { value: "1:1", label: "1 : 1" },
          { value: "4:5", label: "4 : 5" },
          { value: "3:2", label: "3 : 2" },
          { value: "16:9", label: "16 : 9" },
        ]}
      />
      <Check
        label={t("deleteCropped")}
        checked={del}
        onChange={(v) => setOpt({ deleteCropped: v })}
      />
      <span className="ms-auto flex items-center gap-1">
        <SmallButton onClick={() => finishCrop(false)} title={t("cancel")}>
          <X />
        </SmallButton>
        <SmallButton
          variant="primary"
          onClick={() => finishCrop(true)}
          title={t("apply")}
          testId="crop-apply"
        >
          <CheckIcon /> {t("apply")}
        </SmallButton>
      </span>
    </>
  );
}

function RulerOptions() {
  const t = useTranslations("photo.options");
  const line = useOverlay((s) => s.line);
  const length = line ? Math.hypot(line.x2 - line.x1, line.y2 - line.y1) : 0;
  const angle = line ? (-Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180) / Math.PI : 0;
  return (
    <>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("length")}: {length.toFixed(1)} px · {t("angle")}: {angle.toFixed(1)}°
      </span>
      <SmallButton
        disabled={!line || length < 2}
        onClick={() => {
          // Straighten: rotate the layer so the measured line becomes level.
          let a = angle;
          if (a > 45) a -= 90;
          if (a < -45) a += 90;
          A.startTransform();
          const tr = get().transform;
          if (tr) {
            set({ transform: { ...tr, rotation: a } });
            A.commitTransform();
          }
          useOverlay.setState({ line: null });
        }}
      >
        {t("straighten")}
      </SmallButton>
      <SmallButton disabled={!line} onClick={() => useOverlay.setState({ line: null })}>
        {t("clear")}
      </SmallButton>
    </>
  );
}

function GradientOptions() {
  const t = useTranslations("photo.options");
  const kind = useOpt("gradientKind");
  const fade = useOpt("gradientFade");
  const kinds: GradientKind[] = ["linear", "radial", "angle", "reflected", "diamond"];
  return (
    <>
      <Segmented
        label={t("gradientKind")}
        value={kind}
        onChange={(v) => setOpt({ gradientKind: v })}
        options={kinds.map((k) => ({ value: k, label: t(`gradient.${k}`) }))}
      />
      <SelectField
        value={fade}
        onChange={(v) => setOpt({ gradientFade: v })}
        options={[
          { value: "fgbg", label: t("fgToBg") },
          { value: "fgTransparent", label: t("fgToTransparent") },
        ]}
      />
      <NumField
        label={t("opacity")}
        value={useOpt("opacity")}
        min={0.01}
        max={1}
        scale={100}
        unit="%"
        onChange={(v) => setOpt({ opacity: v })}
      />
    </>
  );
}

function TypeOptions() {
  const t = useTranslations("photo.options");
  const layer = usePhoto((s) => s.doc?.layers.find((l) => l.id === s.activeId));
  const family = useOpt("fontFamily");
  const size = useOpt("fontSize");
  const weight = useOpt("fontWeight");
  const fg = usePhoto((s) => s.fg);
  const text = layer?.kind === "text" ? layer.text : null;
  const update = (patch: Partial<NonNullable<typeof text>>, opt: Partial<ToolOptions>) => {
    setOpt(opt);
    if (layer?.kind === "text")
      A.updateLayer(layer.id, { text: { ...layer.text, ...patch } } as never, "character");
  };
  return (
    <>
      <SelectField
        value={text?.font ?? family}
        onChange={(v) => update({ font: v }, { fontFamily: v })}
        options={STARTER_FONTS.map((f) => ({ value: f.family, label: f.family }))}
      />
      <SelectField
        value={String(text?.weight ?? weight)}
        onChange={(v) => update({ weight: Number(v) }, { fontWeight: Number(v) })}
        options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({
          value: String(w),
          label: t(`weight.${w}` as never),
        }))}
      />
      <NumField
        label={t("fontSize")}
        value={text?.size ?? size}
        min={4}
        max={2000}
        unit="px"
        onChange={(v) => setOpt({ fontSize: v })}
        onCommit={(v) => update({ size: v }, { fontSize: v })}
      />
      <Segmented
        label={t("align")}
        value={text?.align ?? "left"}
        onChange={(v) => update({ align: v }, {})}
        options={[
          { value: "left", label: t("alignLeft") },
          { value: "center", label: t("alignCenter") },
          { value: "right", label: t("alignRight") },
        ]}
      />
      <ColorField
        value={text?.color ?? fg}
        onChange={(v) => {
          if (!v) return;
          set({ fg: v });
          update({ color: v }, {});
        }}
      />
    </>
  );
}

function ShapeOptions({ tool }: { tool: string }) {
  const t = useTranslations("photo.options");
  const fill = useOpt("shapeFill");
  const stroke = useOpt("shapeStroke");
  const strokeWidth = useOpt("strokeWidth");
  const radius = useOpt("radius");
  const sides = useOpt("sides");
  return (
    <>
      <ColorField
        label={t("fill")}
        value={fill}
        allowNone
        noneLabel={t("none")}
        onChange={(v) => setOpt({ shapeFill: v })}
      />
      <ColorField
        label={t("stroke")}
        value={stroke}
        allowNone
        noneLabel={t("none")}
        onChange={(v) => setOpt({ shapeStroke: v })}
      />
      <NumField
        label={t("strokeWidth")}
        value={strokeWidth}
        min={0}
        max={200}
        unit="px"
        onChange={(v) => setOpt({ strokeWidth: v })}
      />
      {tool === "rectangle" && (
        <NumField
          label={t("radius")}
          value={radius}
          min={0}
          max={2000}
          unit="px"
          onChange={(v) => setOpt({ radius: v })}
        />
      )}
      {tool === "polygon" && (
        <NumField
          label={t("sides")}
          value={sides}
          min={3}
          max={64}
          onChange={(v) => setOpt({ sides: Math.round(v) })}
        />
      )}
    </>
  );
}

function MoveOptions() {
  const t = useTranslations("photo");
  return (
    <>
      <SmallButton onClick={A.startTransform} testId="free-transform">
        <Maximize /> {t("cmd.freeTransform")}
      </SmallButton>
      <SmallButton title={t("cmd.flipLayerH")} onClick={() => A.transformLayer("flipH")}>
        <ArrowLeftRight />
      </SmallButton>
      <SmallButton title={t("cmd.flipLayerV")} onClick={() => A.transformLayer("flipV")}>
        <ArrowUpDown />
      </SmallButton>
      <SmallButton title={t("cmd.rotateLayerCcw")} onClick={() => A.transformLayer("rotate-90")}>
        <RotateCcw />
      </SmallButton>
      <SmallButton title={t("cmd.rotateLayerCw")} onClick={() => A.transformLayer("rotate90")}>
        <RotateCw />
      </SmallButton>
    </>
  );
}

function TransformOptions() {
  const t = useTranslations("photo.options");
  const tr = usePhoto((s) => s.transform)!;
  const w = Math.round(tr.original.canvas.width * Math.abs(tr.scaleX));
  const h = Math.round(tr.original.canvas.height * Math.abs(tr.scaleY));
  const patch = (p: Partial<typeof tr>) => set({ transform: { ...tr, ...p } });
  const modes: TransformMode[] = ["free", "skew", "distort", "perspective", "warp"];
  const switcher = (
    <Segmented
      label={t("transformMode")}
      value={tr.mode}
      onChange={(m) => A.setTransformMode(m)}
      options={modes.map((m) => ({ value: m, label: t(`transformModes.${m}`) }))}
    />
  );
  const actions = (
    <span className="ms-auto flex items-center gap-1">
      <SmallButton title={t("cancel")} onClick={A.cancelTransform}>
        <X />
      </SmallButton>
      <SmallButton variant="primary" onClick={A.commitTransform} testId="transform-apply">
        <CheckIcon /> {t("apply")}
      </SmallButton>
    </span>
  );
  if (tr.mode !== "free")
    return (
      <>
        {switcher}
        <span className="text-xs text-muted-foreground">{t(`transformHints.${tr.mode}`)}</span>
        {actions}
      </>
    );
  return (
    <>
      {switcher}
      <NumField
        label="X"
        value={tr.x}
        min={-100000}
        max={100000}
        unit="px"
        onChange={(v) => patch({ x: v })}
      />
      <NumField
        label="Y"
        value={tr.y}
        min={-100000}
        max={100000}
        unit="px"
        onChange={(v) => patch({ y: v })}
      />
      <NumField
        label={t("width")}
        value={Math.abs(tr.scaleX)}
        min={0.01}
        max={50}
        scale={100}
        unit="%"
        onChange={(v) => patch({ scaleX: Math.sign(tr.scaleX) * v })}
      />
      <NumField
        label={t("height")}
        value={Math.abs(tr.scaleY)}
        min={0.01}
        max={50}
        scale={100}
        unit="%"
        onChange={(v) => patch({ scaleY: Math.sign(tr.scaleY) * v })}
      />
      <NumField
        label={t("angle")}
        value={tr.rotation}
        min={-360}
        max={360}
        step={0.1}
        unit="°"
        onChange={(v) => patch({ rotation: v })}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {w} × {h}
      </span>
      {actions}
    </>
  );
}

/** Pen tools: what to do with the active path. */
function PathOptions() {
  const t = useTranslations("photo.cmd");
  const hasPath = usePhoto((s) => Boolean(s.doc?.paths?.some((x) => x.id === s.activePathId)));
  return (
    <>
      <SmallButton
        disabled={!hasPath}
        onClick={() => A.pathToSelection()}
        testId="opt-path-selection"
      >
        {t("pathToSelection")}
      </SmallButton>
      <SmallButton disabled={!hasPath} onClick={() => A.paintPath("fill")}>
        {t("fillPath")}
      </SmallButton>
      <SmallButton disabled={!hasPath} onClick={() => A.paintPath("stroke")}>
        {t("strokePath")}
      </SmallButton>
      <SmallButton onClick={() => A.newPath()}>{t("newPath")}</SmallButton>
    </>
  );
}

function ViewOptions() {
  const t = useTranslations("photo.cmd");
  return (
    <>
      <SmallButton onClick={() => set({ zoom: 1, pan: { x: 40, y: 40 } })}>
        {t("actualPixels")}
      </SmallButton>
      <SmallButton onClick={fitOnScreen}>{t("fitOnScreen")}</SmallButton>
    </>
  );
}

export function OptionsBar() {
  const tt = useTranslations("photo.tools");
  const t = useTranslations("photo.options");
  const tool = usePhoto((s) => s.tool);
  const o = usePhoto((s) => s.options);
  const snapOn = usePhoto((s) => s.view.snap);
  const transform = usePhoto((s) => Boolean(s.transform));
  const hasLayer = usePhoto((s) => Boolean(activeLayer()) && Boolean(s.doc));
  const tc = useTranslations("photo.cmd");
  const Icon = transform ? Maximize : TOOL_ICONS[tool];

  let body: React.ReactNode = null;
  if (transform) body = <TransformOptions />;
  else
    switch (tool) {
      case "move":
        body = hasLayer ? (
          <>
            <MoveOptions />
            <Check
              label={tc("snap")}
              checked={snapOn}
              onChange={(v) => set({ view: { ...get().view, snap: v } })}
            />
          </>
        ) : null;
        break;
      case "marqueeRect":
      case "marqueeEllipse":
      case "lasso":
      case "polyLasso":
        body = (
          <>
            <SelectionModes />
            <Feather />
            <SelectSubjectButton />
          </>
        );
        break;
      case "magicWand":
        body = (
          <>
            <SelectionModes />
            <ToleranceRow />
            <SelectSubjectButton />
          </>
        );
        break;
      case "crop":
        body = <CropOptions />;
        break;
      case "eyedropper":
        body = (
          <>
            <SelectField
              label={t("sampleSize")}
              value={String(o.sampleSize) as "1" | "3" | "5"}
              onChange={(v) => setOpt({ sampleSize: Number(v) as 1 | 3 | 5 })}
              options={[
                { value: "1", label: t("pointSample") },
                { value: "3", label: t("average3") },
                { value: "5", label: t("average5") },
              ]}
            />
            <Check
              label={t("sampleAll")}
              checked={o.sampleAll}
              onChange={(v) => setOpt({ sampleAll: v })}
            />
          </>
        );
        break;
      case "ruler":
        body = <RulerOptions />;
        break;
      case "spotHeal":
        body = (
          <>
            <BrushBasics hardness={false} opacity={false} flow={false} />
            <span className="text-xs text-muted-foreground">{t("contentAware")}</span>
          </>
        );
        break;
      case "heal":
      case "clone":
        body = (
          <>
            <BrushBasics flow={tool === "clone"} opacity />
            <Check
              label={t("aligned")}
              checked={o.aligned}
              onChange={(v) => setOpt({ aligned: v })}
            />
            <Check
              label={t("sampleAll")}
              checked={o.sampleAll}
              onChange={(v) => setOpt({ sampleAll: v })}
            />
            <span className="text-xs text-muted-foreground">{t("altToSample")}</span>
          </>
        );
        break;
      case "redEye":
        body = <span className="text-xs text-muted-foreground">{t("redEyeHint")}</span>;
        break;
      case "brush":
        body = <BrushBasics blend />;
        break;
      case "pencil":
        body = <BrushBasics hardness={false} flow={false} blend />;
        break;
      case "colorReplace":
      case "historyBrush":
      case "eraser":
        body = <BrushBasics flow={tool !== "colorReplace"} />;
        break;
      case "magicEraser":
        body = (
          <>
            <ToleranceRow sampleAll={false} />
            <NumField
              label={t("opacity")}
              value={o.opacity}
              min={0.01}
              max={1}
              scale={100}
              unit="%"
              onChange={(v) => setOpt({ opacity: v })}
            />
          </>
        );
        break;
      case "gradient":
        body = <GradientOptions />;
        break;
      case "bucket":
        body = (
          <>
            <ToleranceRow />
            <NumField
              label={t("opacity")}
              value={o.opacity}
              min={0.01}
              max={1}
              scale={100}
              unit="%"
              onChange={(v) => setOpt({ opacity: v })}
            />
          </>
        );
        break;
      case "blur":
      case "sharpen":
      case "smudge":
        body = (
          <>
            <BrushBasics opacity={false} flow={false} />
            <NumField
              label={t("strength")}
              value={o.strength}
              min={0.01}
              max={1}
              scale={100}
              unit="%"
              slider
              onChange={(v) => setOpt({ strength: v })}
            />
          </>
        );
        break;
      case "liquify":
        body = (
          <>
            <Segmented
              label={t("liquifyMode")}
              value={o.liquifyMode}
              onChange={(v) => setOpt({ liquifyMode: v })}
              options={(["push", "pinch", "bloat", "restore"] as const).map((m) => ({
                value: m,
                label: t(`liquify.${m}`),
              }))}
            />
            <BrushBasics hardness={false} opacity={false} flow={false} />
            <NumField
              label={t("strength")}
              value={o.strength}
              min={0.01}
              max={1}
              scale={100}
              unit="%"
              slider
              onChange={(v) => setOpt({ strength: v })}
            />
          </>
        );
        break;
      case "dodge":
      case "burn":
        body = (
          <>
            <BrushBasics opacity={false} flow={false} />
            <SelectField
              label={t("range")}
              value={o.range}
              onChange={(v) => setOpt({ range: v })}
              options={(["shadows", "midtones", "highlights"] as const).map((r) => ({
                value: r,
                label: t(`ranges.${r}`),
              }))}
            />
            <NumField
              label={t("exposure")}
              value={o.exposure}
              min={0.01}
              max={1}
              scale={100}
              unit="%"
              slider
              onChange={(v) => setOpt({ exposure: v })}
            />
          </>
        );
        break;
      case "sponge":
        body = (
          <>
            <BrushBasics opacity={false} flow={false} />
            <SelectField
              label={t("mode")}
              value={o.spongeMode}
              onChange={(v) => setOpt({ spongeMode: v })}
              options={[
                { value: "desaturate", label: t("desaturate") },
                { value: "saturate", label: t("saturate") },
              ]}
            />
            <NumField
              label={t("flow")}
              value={o.exposure}
              min={0.01}
              max={1}
              scale={100}
              unit="%"
              slider
              onChange={(v) => setOpt({ exposure: v })}
            />
          </>
        );
        break;
      case "type":
        body = <TypeOptions />;
        break;
      case "rectangle":
      case "ellipse":
      case "triangle":
      case "polygon":
      case "line":
        body = <ShapeOptions tool={tool} />;
        break;
      case "hand":
      case "zoom":
        body = <ViewOptions />;
        break;
      case "pen":
      case "freeformPen":
      case "pathSelect":
        body = (
          <>
            <PathOptions />
            <span className="text-xs text-muted-foreground">{t(`pathHints.${tool}`)}</span>
          </>
        );
        break;
    }

  return (
    <div
      role="toolbar"
      aria-label={t("label")}
      data-testid="photo-options"
      className="flex h-10 shrink-0 items-center gap-3 overflow-x-auto border-b bg-card/70 px-3"
    >
      <span className="flex items-center gap-1.5 pe-1 text-xs font-medium">
        <Icon className="size-4 text-primary" />
        {transform ? tc("freeTransform") : tt(tool)}
      </span>
      <span className="h-5 w-px bg-border" />
      {body}
    </div>
  );
}
