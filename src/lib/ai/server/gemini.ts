import "server-only";
/**
 * AI artwork with Google's Gemini image models ("Nano Banana"), via the
 * Interactions API (https://ai.google.dev/gemini-api/docs/image-generation).
 * Server-side only: the key never reaches the browser. `store: false` keeps
 * Google from saving the request.
 */
import { getServerEnv } from "@/lib/env";
import { GOOGLE_BYOK_HEADER } from "../contract";
import { AiError } from "./errors";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

import { IMAGE_PRICES, type ImageQuality, type ImageSize } from "../premium";

export { IMAGE_PRICES, type ImageQuality, type ImageSize };

export const IMAGE_MODELS: Record<ImageQuality, string> = {
  standard: "gemini-nano-banana-2.1",
  pro: "gemini-3-pro-image",
};

export const ASPECT_RATIOS = [
  "1:1",
  "3:2",
  "2:3",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** The supported aspect ratio closest to a page size. */
export function nearestAspectRatio(width: number, height: number): AspectRatio {
  const target = Math.log(width / height);
  let best: AspectRatio = "1:1";
  let bestDiff = Infinity;
  for (const ratio of ASPECT_RATIOS) {
    const [w, h] = ratio.split(":").map(Number) as [number, number];
    const diff = Math.abs(Math.log(w / h) - target);
    if (diff < bestDiff) {
      best = ratio;
      bestDiff = diff;
    }
  }
  return best;
}

export interface GoogleKey {
  apiKey: string;
  source: "owner" | "user";
}

const KEY_PATTERN = /^[A-Za-z0-9_-]{30,}$/;

/** A user's own Google key (per request, never stored) wins; else the owner key. */
export function resolveGoogleKey(headers: Headers): GoogleKey {
  const userKey = headers.get(GOOGLE_BYOK_HEADER)?.trim();
  if (userKey) {
    if (!KEY_PATTERN.test(userKey)) {
      throw new AiError("invalid_key", "That Google AI key doesn't look right.", 401);
    }
    return { apiKey: userKey, source: "user" };
  }
  const ownerKey = getServerEnv().GEMINI_API_KEY;
  if (!ownerKey) throw new AiError("no_key", "AI artwork is not set up yet.", 503);
  return { apiKey: ownerKey, source: "owner" };
}

export function imageModel(quality: ImageQuality): string {
  return quality === "standard"
    ? (getServerEnv().GEMINI_IMAGE_MODEL ?? IMAGE_MODELS.standard)
    : IMAGE_MODELS.pro;
}

let fetchImpl: typeof fetch = (...args) => fetch(...args);
/** Test helper: replace the HTTP client. */
export function setGeminiFetch(next: typeof fetch | null) {
  fetchImpl = next ?? ((...args) => fetch(...args));
}

/**
 * Checks that a Google AI key works, without spending anything: listing the
 * available models is free. Throws an AiError when the key is refused.
 */
export async function checkGoogleKey(key: GoogleKey): Promise<void> {
  let response: Response;
  try {
    response = await fetchImpl(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      { headers: { "x-goog-api-key": key.apiKey }, signal: AbortSignal.timeout(15_000) },
    );
  } catch {
    throw new AiError("overloaded", "Couldn't reach Google. Try again.", 503);
  }
  if (response.ok) return;
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new AiError("invalid_key", "Google didn't accept that key.", 401);
  }
  if (response.status === 429) {
    throw new AiError("rate_limited", "Google's quota is used up for now.", 429);
  }
  throw new AiError("overloaded", "Google is busy. Try again.", 503);
}

interface Block {
  type?: string;
  data?: string;
  mime_type?: string;
  text?: string;
}

/** Finds the generated image (and any text) in an Interaction response. */
export function readInteraction(body: unknown): { image: Block | null; text: string } {
  const json = (body ?? {}) as {
    steps?: { type?: string; content?: Block[] }[];
    output_image?: Block;
    output_text?: string;
  };
  const blocks = (json.steps ?? [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? []);
  const image =
    blocks.find((b) => b.type === "image" && typeof b.data === "string" && b.data) ??
    (json.output_image?.data ? json.output_image : null);
  const text = [json.output_text, ...blocks.filter((b) => b.type === "text").map((b) => b.text)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return { image, text };
}

export async function generateImage(opts: {
  key: GoogleKey;
  prompt: string;
  aspectRatio: AspectRatio;
  size: ImageSize;
  quality: ImageQuality;
}): Promise<{ base64: string; mimeType: string; model: string }> {
  const model = imageModel(opts.quality);
  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.key.apiKey },
      body: JSON.stringify({
        model,
        input: [{ type: "text", text: opts.prompt }],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: opts.aspectRatio,
          image_size: opts.size,
        },
        store: false,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new AiError("overloaded", "Couldn't reach Google's image service. Try again.", 503);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message?.slice(0, 200) ?? "";
    if (response.status === 401 || response.status === 403) {
      throw new AiError("invalid_key", "Google rejected the AI key (check billing is on).", 401);
    }
    if (response.status === 429) {
      throw new AiError("rate_limited", "Google's image quota is used up for now.", 429);
    }
    if (response.status === 400) {
      throw new AiError("invalid_request", `Google couldn't make this image. ${message}`, 400);
    }
    throw new AiError("overloaded", "Google's image service is busy. Try again.", 503);
  }

  const { image, text } = readInteraction(body);
  if (!image?.data) {
    // Usually a safety block; the model explains in text.
    throw new AiError(
      "refused",
      text ? `No image was made: ${text.slice(0, 200)}` : "No image was made.",
      422,
    );
  }
  return { base64: image.data, mimeType: image.mime_type ?? "image/jpeg", model };
}
