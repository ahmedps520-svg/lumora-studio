import { ImageRequestSchema } from "@/lib/ai/premium";
import { AiError, toErrorResponse } from "@/lib/ai/server/errors";
import {
  generateImage,
  IMAGE_PRICES,
  nearestAspectRatio,
  resolveGoogleKey,
} from "@/lib/ai/server/gemini";
import { allowRequest, clientKey, recordSpend, spentToday } from "@/lib/ai/server/limits";
import { json, readJson } from "@/lib/ai/server/run";
import { getFeatureFlags } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Premium step 2 — AI artwork from Google's Gemini image models. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      throw new AiError("invalid_request", "Cross-site AI requests are not allowed.", 403);
    }
    const input = await readJson(request, ImageRequestSchema);
    const flags = getFeatureFlags();
    if (
      !allowRequest(`img:${clientKey(request.headers)}`, Math.max(2, flags.rateLimitPerMinute / 4))
    ) {
      throw new AiError("rate_limited", "Too many artwork requests — please wait a moment.", 429);
    }
    const key = resolveGoogleKey(request.headers);
    const price = IMAGE_PRICES[input.quality][input.size];
    if (key.source === "owner" && spentToday() + price > flags.dailyBudgetUsd) {
      throw new AiError("budget_exceeded", "Today's AI budget has been used up.", 402);
    }

    const image = await generateImage({
      key,
      prompt: input.prompt,
      aspectRatio: nearestAspectRatio(input.width, input.height),
      size: input.size,
      quality: input.quality,
    });
    if (key.source === "owner") recordSpend(price);
    return json({
      image: `data:${image.mimeType};base64,${image.base64}`,
      model: image.model,
      costUsd: price,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
