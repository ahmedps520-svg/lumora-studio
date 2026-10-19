import { Sparkles } from "lucide-react";

export interface HeroArtCopy {
  eyebrow: string;
  headline: string;
  badge: string;
  slide: string;
  story: string;
}

function Handle({ className }: { className: string }) {
  return (
    <span
      className={`absolute size-2.5 rounded-full border-2 border-[#6D5DF6] bg-white ${className}`}
    />
  );
}

/**
 * Decorative hero composition: a few floating "designs" in the making,
 * hinting at what Lumora does. Pure markup — no images, no network.
 */
export function HeroArt({ copy }: { copy: HeroArtCopy }) {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[420px] w-full max-w-[560px] select-none sm:h-[480px]"
    >
      {/* Glow */}
      <div className="absolute inset-[12%] rounded-full bg-brand-gradient opacity-25 blur-3xl dark:opacity-30" />

      {/* Story (9:16) */}
      <div className="absolute end-[2%] top-[2%] w-[31%] animate-float-slow">
        <div
          className="relative aspect-[9/16] rotate-[7deg] overflow-hidden rounded-2xl shadow-lifted ring-1 ring-white/10"
          style={{ background: "linear-gradient(165deg,#1E1B4B 0%,#4338CA 55%,#A78BFA 100%)" }}
        >
          <svg viewBox="0 0 100 100" className="absolute -end-[18%] top-[8%] w-[80%] opacity-90">
            <path
              d="M50 2 L61.8 36 L98 36 L68.6 57.6 L79.4 92 L50 71 L20.6 92 L31.4 57.6 L2 36 L38.2 36 Z"
              fill="#FFB27D"
            />
          </svg>
          <div className="absolute inset-x-[10%] bottom-[12%] space-y-1.5">
            <div className="font-heading text-[13px] leading-tight font-semibold text-white">
              {copy.story}
            </div>
            <div className="h-1.5 w-[70%] rounded-full bg-white/50" />
            <div className="h-1.5 w-[45%] rounded-full bg-white/35" />
          </div>
        </div>
      </div>

      {/* Main post (1:1) with a live-looking selection */}
      <div className="absolute start-[4%] top-[9%] w-[60%] animate-float">
        <div
          className="relative aspect-square -rotate-[4deg] overflow-hidden rounded-[22px] shadow-lifted ring-1 ring-black/5"
          style={{ background: "linear-gradient(140deg,#FF8A4C 0%,#FB4D6D 48%,#E0218A 100%)" }}
        >
          <div className="absolute -end-[22%] -top-[22%] size-[70%] rounded-full bg-white/15" />
          <div className="absolute -start-[18%] -bottom-[30%] size-[62%] rounded-full bg-[#3A2E8F]/35" />
          <div className="absolute inset-x-[10%] top-[16%]">
            <div className="text-[10px] font-semibold tracking-[0.25em] text-white/80 uppercase">
              {copy.eyebrow}
            </div>
            <div className="relative mt-2 inline-block">
              <div className="font-heading text-[clamp(28px,4.2vw,46px)] leading-[0.95] font-bold tracking-[-0.03em] text-white">
                {copy.headline}
              </div>
              {/* Selection box */}
              <div className="absolute -inset-2 rounded-[4px] border-2 border-[#6D5DF6]">
                <Handle className="-start-1.5 -top-1.5" />
                <Handle className="-end-1.5 -top-1.5" />
                <Handle className="-start-1.5 -bottom-1.5" />
                <Handle className="-end-1.5 -bottom-1.5" />
              </div>
            </div>
          </div>
          <div className="absolute start-[10%] bottom-[12%] rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#D4145A] shadow-soft">
            {copy.badge}
          </div>
        </div>
      </div>

      {/* Slide (16:9) with a chart */}
      <div className="absolute end-[6%] bottom-[3%] w-[50%] animate-float-slow [animation-delay:-3s]">
        <div className="relative aspect-video rotate-[2deg] overflow-hidden rounded-xl bg-white p-[6%] shadow-lifted ring-1 ring-black/5 dark:bg-[#F5F4F0]">
          <div className="font-heading text-[11px] font-semibold text-[#0B0B12]">{copy.slide}</div>
          <div className="mt-1 h-1 w-[40%] rounded-full bg-[#0B0B12]/15" />
          <div className="absolute inset-x-[6%] bottom-[10%] flex h-[52%] items-end gap-[6%]">
            {[42, 64, 50, 86, 70].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[3px]"
                style={{
                  height: `${h}%`,
                  background: i === 3 ? "linear-gradient(180deg,#FF7A3D,#F72585)" : "#C7C2F5",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating style toolbar */}
      <div className="absolute start-[0%] bottom-[16%] flex animate-float items-center gap-2 rounded-full surface-glass px-3 py-2 [animation-delay:-2s]">
        {["#FF7A3D", "#F72585", "#7C6CF2", "#0EA5E9", "#0B0B12"].map((c) => (
          <span
            key={c}
            className="size-4 rounded-full ring-2 ring-white/70"
            style={{ background: c }}
          />
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" />
        <span className="font-heading text-xs font-bold text-foreground">Aa</span>
      </div>

      {/* AI chip */}
      <div className="absolute end-[30%] top-[50%] flex animate-float items-center gap-1.5 rounded-full btn-glow px-3 py-1.5 text-xs font-semibold [animation-delay:-4s]">
        <Sparkles className="size-3.5" /> AI
      </div>
    </div>
  );
}
