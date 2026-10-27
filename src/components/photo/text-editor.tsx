"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePhoto } from "@/lib/photo/store";
import { cancelTool, commitText, useOverlay } from "@/lib/photo/tools";

/** The on-canvas box for typing a new text layer or editing one. */
export function TextEditor() {
  const t = useTranslations("photo");
  const text = useOverlay((s) => s.text);
  const zoom = usePhoto((s) => s.zoom);
  const pan = usePhoto((s) => s.pan);
  const fg = usePhoto((s) => s.fg);
  const options = usePhoto((s) => s.options);
  const layer = usePhoto((s) =>
    text?.layerId ? s.doc?.layers.find((l) => l.id === text.layerId) : undefined,
  );
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (text) requestAnimationFrame(() => ref.current?.focus());
  }, [text]);

  if (!text) return null;
  const props = layer?.kind === "text" ? layer.text : null;
  const size = (props?.size ?? options.fontSize) * zoom;
  const lines = text.value.split("\n");
  const longest = Math.max(4, ...lines.map((l) => l.length));

  return (
    <textarea
      ref={ref}
      aria-label={t("typeHere")}
      placeholder={t("typeHere")}
      value={text.value}
      dir="auto"
      spellCheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => useOverlay.setState({ text: { ...text, value: e.target.value } })}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          useOverlay.setState({ text: null });
          cancelTool();
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitText();
      }}
      onBlur={() => commitText()}
      className="absolute resize-none overflow-hidden border border-dashed border-[#7C6CF2] bg-transparent p-0 outline-none placeholder:text-current/40"
      style={{
        left: pan.x + text.x * zoom,
        top: pan.y + text.y * zoom,
        font: `${props?.italic ? "italic " : ""}${props?.weight ?? options.fontWeight} ${size}px/${props?.lineHeight ?? 1.2} "${props?.font ?? options.fontFamily}", system-ui, sans-serif`,
        letterSpacing: props ? `${(props.tracking / 1000) * size}px` : undefined,
        color: props?.color ?? fg,
        textAlign: props?.align ?? "left",
        width: props?.width ? props.width * zoom : `${longest * 0.62 * size + size}px`,
        height: `${lines.length * size * (props?.lineHeight ?? 1.2) + 4}px`,
      }}
    />
  );
}
