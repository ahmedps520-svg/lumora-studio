import {
  buildFillPrompt,
  PhotoFillRequestSchema,
  PhotoFillResultSchema,
} from "@/lib/ai/photo-fill";
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

/** Photo editor — Generative Fill: Gemini repaints the selected area of a photo. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      throw new AiError("invalid_request", "Cross-site AI requests are not allowed.", 403);
    }
    const input = await readJson(request, PhotoFillRequestSchema, 6_200_000);
    const flags = getFeatureFlags();
    if (
      !allowRequest(`fill:${clientKey(request.headers)}`, Math.max(2, flags.rateLimitPerMinute / 4))
    ) {
      throw new AiError("rate_limited", "Too many requests — please wait a moment.", 429);
    }
    const key = resolveGoogleKey(request.headers);
    const price = IMAGE_PRICES.standard["1K"];
    if (key.source === "owner" && spentToday() + price > flags.dailyBudgetUsd) {
      throw new AiError("budget_exceeded", "Today's AI budget has been used up.", 402);
    }
    const [, mimeType = "image/png", base64 = ""] =
      /^data:(image\/[a-z]+);base64,(.*)$/.exec(input.image) ?? [];
    const raw = await generateImage({
      key,
      prompt: buildFillPrompt(input.prompt),
      aspectRatio: nearestAspectRatio(input.width, input.height),
      size: "1K",
      quality: "standard",
      images: [{ base64, mimeType }],
    });
    if (key.source === "owner") recordSpend(price);
    const result = PhotoFillResultSchema.safeParse(raw);
    if (!result.success) throw new AiError("invalid_output", "The image came back damaged.", 502);
    return json({
      image: `data:${result.data.mimeType};base64,${result.data.base64}`,
      model: result.data.model,
      costUsd: price,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
