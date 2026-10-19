import type { CSSProperties, ReactNode } from "react";
import type { FormatCategory } from "@/lib/document/formats";
import { cn } from "@/lib/utils";

/** Colourways for the decorative mini artboards. */
const SKINS = [
  { bg: "linear-gradient(135deg,#FF7A3D 0%,#FB4D6D 50%,#F72585 100%)", ink: "#FFFFFF" },
  { bg: "linear-gradient(135deg,#2B2370 0%,#5B4BD8 60%,#8C7CFF 100%)", ink: "#FFFFFF" },
  { bg: "linear-gradient(140deg,#0EA5E9 0%,#6366F1 100%)", ink: "#FFFFFF" },
  { bg: "linear-gradient(150deg,#FFF7ED 0%,#FFE4E6 100%)", ink: "#BE123C" },
  { bg: "linear-gradient(135deg,#10B981 0%,#0EA5E9 100%)", ink: "#FFFFFF" },
  { bg: "linear-gradient(160deg,#111827 0%,#312E81 100%)", ink: "#F9A8D4" },
  { bg: "linear-gradient(135deg,#F59E0B 0%,#EF4444 100%)", ink: "#FFFFFF" },
  { bg: "linear-gradient(160deg,#FFFFFF 0%,#EEF2FF 100%)", ink: "#3A2E8F" },
] as const;

/** An absolutely positioned block; all numbers are percentages of the artboard. */
function Block({
  x,
  y,
  w,
  h,
  ink,
  opacity = 0.9,
  round = "9999px",
  style,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  ink: string;
  opacity?: number;
  round?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
        background: ink,
        opacity,
        borderRadius: round,
        ...style,
      }}
    />
  );
}

/** Abstract layout hints so each format "looks like" what it is. */
function Composition({ category, ink }: { category: FormatCategory; ink: string }) {
  switch (category) {
    case "video":
      return (
        <>
          <Block x={10} y={22} w={36} h={56} ink={ink} opacity={0.18} round="12%" />
          <svg
            className="absolute top-[37%] left-[22%] h-[26%] w-[12%]"
            viewBox="0 0 10 12"
            aria-hidden
          >
            <path d="M0 0 L10 6 L0 12 Z" fill={ink} />
          </svg>
          <Block x={54} y={28} w={36} h={12} ink={ink} />
          <Block x={54} y={48} w={28} h={7} ink={ink} opacity={0.55} />
          <Block x={54} y={60} w={20} h={7} ink={ink} opacity={0.55} />
        </>
      );
    case "presentation":
      return (
        <>
          <Block x={8} y={16} w={44} h={10} ink={ink} />
          <Block x={8} y={32} w={30} h={6} ink={ink} opacity={0.55} />
          {[38, 58, 46, 72].map((h, i) => (
            <Block
              key={i}
              x={56 + i * 10}
              y={86 - h}
              w={8}
              h={h}
              ink={ink}
              opacity={0.35 + i * 0.15}
              round="3px 3px 0 0"
            />
          ))}
        </>
      );
    case "document":
      return (
        <>
          <Block x={0} y={0} w={100} h={16} ink={ink} round="0" />
          {[26, 33, 40, 47, 54, 61, 68, 75, 82].map((top, i) => (
            <Block
              key={top}
              x={12}
              y={top}
              w={i % 3 === 2 ? 52 : 76}
              h={3}
              ink={ink}
              opacity={0.3}
            />
          ))}
        </>
      );
    case "other":
      return (
        <>
          <Block x={27} y={27} w={46} h={46} ink={ink} round="22%" />
          <Block
            x={40}
            y={40}
            w={20}
            h={20}
            ink="#F72585"
            round="18%"
            style={{ rotate: "45deg" }}
          />
        </>
      );
    case "print":
      return (
        <>
          <Block x={10} y={10} w={80} h={42} ink={ink} opacity={0.22} round="6%" />
          <Block x={10} y={60} w={66} h={8} ink={ink} />
          <Block x={10} y={73} w={48} h={5} ink={ink} opacity={0.6} />
          <Block x={10} y={82} w={36} h={5} ink={ink} opacity={0.6} />
        </>
      );
    default:
      return (
        <>
          <Block
            x={52}
            y={-12}
            w={62}
            h={62}
            ink={ink}
            opacity={0.2}
            style={{ aspectRatio: "1" }}
          />
          <Block
            x={10}
            y={64}
            w={22}
            h={22}
            ink={ink}
            opacity={0.85}
            style={{ aspectRatio: "1" }}
          />
          <Block x={10} y={22} w={58} h={10} ink={ink} />
          <Block x={10} y={40} w={42} h={6} ink={ink} opacity={0.6} />
        </>
      );
  }
}

/** A box that previews size themselves against (CSS size container). */
export function PreviewStage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn("relative flex size-full items-center justify-center", className)}
      style={{ containerType: "size" }}
    >
      {children}
    </span>
  );
}

/**
 * A miniature artboard with the format's real aspect ratio, filled with a
 * colourful abstract layout. Purely decorative. Place inside a PreviewStage.
 */
export function PresetPreview({
  width,
  height,
  category,
  skin = 0,
  className,
}: {
  width: number;
  height: number;
  category: FormatCategory;
  skin?: number;
  className?: string;
}) {
  const ratio = width / height;
  const { bg, ink } = SKINS[skin % SKINS.length]!;
  const style: CSSProperties = {
    aspectRatio: `${width} / ${height}`,
    background: bg,
    // Contain-fit inside the nearest size container (see PreviewStage).
    width: `min(100cqw, calc(100cqh * ${ratio.toFixed(4)}))`,
  };
  return (
    <span
      aria-hidden
      className={cn(
        "relative block max-h-full max-w-full overflow-hidden rounded-[6px] shadow-[0_12px_28px_-12px_rgb(10_10_20/0.5)] ring-1 ring-black/5",
        className,
      )}
      style={style}
    >
      <Composition category={category} ink={ink} />
    </span>
  );
}
