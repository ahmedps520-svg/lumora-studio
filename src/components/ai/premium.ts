"use client";

/**
 * Premium design, run from the browser so every step can show progress:
 *   1. art direction (Claude)        2. artwork (Gemini → saved as an upload)
 *   3. layout over the art (Claude)  4. render → review → fix (Claude, 0–3×)
 */
import {
  aiArtwork,
  aiPremiumCompose,
  aiPremiumPlan,
  aiPremiumReview,
  AiClientError,
} from "@/lib/ai/api";
import type { DesignStyle } from "@/lib/ai/contract";
import type { AiDesign, ConvertedPage } from "@/lib/ai/design-format";
import type { PremiumPlan } from "@/lib/ai/premium";
import { createImage } from "@/lib/document/factory";
import { loadImage } from "@/lib/engine/images";
import type { Element, ImageElement } from "@/lib/schema";
import { importImage } from "@/lib/storage/assets";

export type PremiumStep = "plan" | "art" | "layout" | "review";

export interface PremiumProgress {
  step: PremiumStep;
  plan?: PremiumPlan;
  /** Object URL of the artwork once it's painted. */
  artUrl?: string;
  round?: number;
  rounds?: number;
  /** The latest render (data URL), for a live preview. */
  previewUrl?: string;
  note?: string;
}

export interface PremiumResult {
  page: ConvertedPage;
  plan: PremiumPlan;
  /** False when the design had to be made without artwork. */
  artwork: boolean;
  /** Why there is no artwork, if a Google key was available but painting failed. */
  artworkError?: string;
  notes: string[];
  costUsd: number;
}

/** Artwork cropped to fill the page exactly ("cover"). */
function coverArtwork(
  asset: { id: string; width: number; height: number; name: string },
  format: { width: number; height: number },
): ImageElement {
  const scale = Math.max(format.width / asset.width, format.height / asset.height);
  const cropW = format.width / scale;
  const cropH = format.height / scale;
  const element = createImage(format, asset, { maxFraction: 10 });
  return {
    ...element,
    name: asset.name,
    x: 0,
    y: 0,
    width: format.width,
    height: format.height,
    crop: {
      x: Math.round((asset.width - cropW) / 2),
      y: Math.round((asset.height - cropH) / 2),
      width: Math.round(cropW),
      height: Math.round(cropH),
    },
    // The artwork is the backdrop: locked so clicks select the text above it.
    locked: true,
  };
}

/** What Claude sees: the page-shaped crop of the artwork, at most 1280 px. */
async function artworkForClaude(element: ImageElement): Promise<string> {
  const img = await loadImage(element.src);
  const crop = element.crop ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
  const k = Math.min(1, 1280 / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width * k);
  canvas.height = Math.round(crop.height * k);
  canvas
    .getContext("2d")
    ?.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header ?? "")?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function render(page: ConvertedPage, format: { width: number; height: number }) {
  const { renderPageToDataUrl } = await import("@/lib/engine/render");
  return renderPageToDataUrl(page, format, { maxSize: 1280, mimeType: "jpeg", quality: 0.85 });
}

export async function generatePremiumDesign(
  args: {
    prompt: string;
    format: { width: number; height: number };
    style: DesignStyle;
    /** True when a Google key is available (owner or the user's own). */
    canPaint: boolean;
    quality: "standard" | "pro";
    reviews: number;
  },
  signal: AbortSignal,
  onProgress: (p: PremiumProgress) => void,
): Promise<PremiumResult> {
  const { prompt, format } = args;
  let costUsd = 0;
  const notes: string[] = [];

  // 1. Art direction.
  onProgress({ step: "plan" });
  const { plan, usage: planUsage } = await aiPremiumPlan(
    { prompt, format, style: args.style, artwork: args.canPaint },
    signal,
  );
  costUsd += planUsage.costUsd;

  // 2. Artwork.
  let art: ImageElement | null = null;
  let artworkError: string | undefined;
  if (args.canPaint) {
    onProgress({ step: "art", plan });
    try {
      const painted = await aiArtwork(
        {
          prompt: plan.artPrompt,
          width: format.width,
          height: format.height,
          quality: args.quality,
          size: "2K",
        },
        signal,
      );
      costUsd += painted.costUsd;
      const asset = await importImage(await dataUrlToBlob(painted.image), {
        name: `${plan.title} — artwork`,
      });
      art = coverArtwork(asset, format);
      const img = await loadImage(art.src);
      onProgress({ step: "art", plan, artUrl: img.src });
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      artworkError = error instanceof AiClientError ? error.message : String(error);
    }
  }

  // 3. Layout over the artwork.
  onProgress({ step: "layout", plan });
  const artForClaude = art ? await artworkForClaude(art) : null;
  const layout = await aiPremiumCompose({ prompt, format, plan, artwork: artForClaude }, signal);
  costUsd += layout.usage.costUsd;

  const assemble = (overlay: ConvertedPage): ConvertedPage => ({
    background: overlay.background,
    elements: art ? [art as Element, ...overlay.elements] : overlay.elements,
  });
  let design: AiDesign = layout.design;
  let page = assemble(layout.page);

  // 4. Look at the real render and polish.
  for (let round = 1; round <= args.reviews; round++) {
    const previewUrl = await render(page, format);
    onProgress({ step: "review", plan, round, rounds: args.reviews, previewUrl });
    const review = await aiPremiumReview(
      { prompt, format, plan, design, render: previewUrl, hasArtwork: Boolean(art), round },
      signal,
    );
    costUsd += review.usage.costUsd;
    if (review.notes) notes.push(review.notes);
    if (review.verdict === "good") break;
    design = review.design;
    page = assemble(review.page);
  }

  return { page, plan, artwork: Boolean(art), artworkError, notes, costUsd };
}
