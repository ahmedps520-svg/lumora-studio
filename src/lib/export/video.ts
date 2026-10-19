/**
 * Video download: every page plays its entrance animations, holds for its
 * duration, then hands over with its page transition. Frames are rendered and
 * encoded one by one (WebCodecs via mediabunny), so the result is smooth and
 * exact no matter how fast the computer is — and usually faster than real time.
 */
import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  type VideoCodec,
} from "mediabunny";
import { PAGE_TRANSITION_MS } from "@/lib/engine/animate";
import { PagePlayer } from "@/lib/engine/player";
import type { Page, PageTransition } from "@/lib/schema";

export const VIDEO_FPS = 30;
const DEFAULT_PAGE_MS = 5_000;
/** Pages stay on screen at least this long after their animations end. */
const HOLD_MS = 800;

export interface VideoPlan {
  container: "mp4" | "webm";
  codec: VideoCodec;
  width: number;
  height: number;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Output size (long side ≤ `maxSide`, even numbers) and the best codec this browser has. */
export async function planVideo(
  format: { width: number; height: number },
  maxSide: number,
): Promise<VideoPlan | null> {
  const scale = maxSide / Math.max(format.width, format.height);
  const width = even(format.width * scale);
  const height = even(format.height * scale);
  if (typeof VideoEncoder === "undefined") return null;
  const avc = await getFirstEncodableVideoCodec(["avc"], { width, height });
  if (avc) return { container: "mp4", codec: avc, width, height };
  const open = await getFirstEncodableVideoCodec(["vp9", "vp8", "av1"], { width, height });
  return open ? { container: "webm", codec: open, width, height } : null;
}

/** How long a page plays in the video (ms). */
export function pageLength(page: Pick<Page, "durationMs">, animationMs: number): number {
  return Math.max(page.durationMs ?? DEFAULT_PAGE_MS, animationMs + HOLD_MS);
}

const ease = (t: number) => 1 - (1 - t) ** 3;

/** Draws one frame: the current page, blended with the previous one during a transition. */
function composite(
  ctx: CanvasRenderingContext2D,
  current: CanvasImageSource,
  previous: CanvasImageSource | null,
  kind: PageTransition,
  ms: number,
) {
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const length = kind === "dissolve" ? PAGE_TRANSITION_MS * 1.3 : PAGE_TRANSITION_MS;
  if (!previous || kind === "none" || ms >= length) {
    ctx.drawImage(current, 0, 0, W, H);
    ctx.restore();
    return;
  }
  const e = ease(ms / length);
  const fadeOutPrevious = () => {
    ctx.globalAlpha = 1 - e;
    ctx.drawImage(previous, 0, 0, W, H);
  };
  switch (kind) {
    case "slide":
      ctx.drawImage(previous, -W * e, 0, W, H);
      ctx.drawImage(current, W * (1 - e), 0, W, H);
      break;
    case "rise":
      ctx.globalAlpha = e;
      ctx.drawImage(current, 0, H * 0.06 * (1 - e), W, H);
      fadeOutPrevious();
      break;
    case "zoom": {
      const s = 1.12 - 0.12 * e;
      ctx.globalAlpha = e;
      ctx.drawImage(current, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s);
      fadeOutPrevious();
      break;
    }
    case "dissolve":
      ctx.drawImage(current, 0, 0, W, H);
      ctx.filter = `blur(${Math.round(14 * e * (W / 960))}px)`;
      fadeOutPrevious();
      break;
    default:
      ctx.drawImage(current, 0, 0, W, H);
      fadeOutPrevious();
  }
  ctx.restore();
}

function copyOf(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d")!.drawImage(source, 0, 0);
  return copy;
}

export async function renderVideo(
  pages: Page[],
  format: { width: number; height: number },
  plan: VideoPlan,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<Blob> {
  const { width, height } = plan;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  const player = new PagePlayer(document.createElement("canvas"), format, { retina: false });
  player.resize(width, height);

  const output = new Output({
    format:
      plan.container === "mp4"
        ? new Mp4OutputFormat({ fastStart: "in-memory" })
        : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(out, { codec: plan.codec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: VIDEO_FPS });

  try {
    await output.start();
    let frame = 0;
    let previous: HTMLCanvasElement | null = null;
    for (const [index, page] of pages.entries()) {
      await player.show(page, { animate: true, manual: true });
      const playback = player.animation;
      const frames = Math.round((pageLength(page, playback?.duration ?? 0) / 1_000) * VIDEO_FPS);
      for (let f = 0; f < frames; f++) {
        if (options.signal?.aborted) throw new DOMException("Download cancelled", "AbortError");
        const ms = (f * 1_000) / VIDEO_FPS;
        playback?.seek(ms);
        player.canvas.renderAll();
        composite(
          ctx,
          player.canvas.getElement(),
          previous,
          index > 0 ? page.transition : "none",
          ms,
        );
        await source.add(frame / VIDEO_FPS, 1 / VIDEO_FPS);
        frame++;
        options.onProgress?.((index + (f + 1) / frames) / pages.length);
      }
      previous = copyOf(player.canvas.getElement());
    }
    source.close();
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("The video could not be finished.");
    return new Blob([buffer], { type: plan.container === "mp4" ? "video/mp4" : "video/webm" });
  } catch (error) {
    if (output.state !== "finalized") await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    player.dispose();
  }
}
