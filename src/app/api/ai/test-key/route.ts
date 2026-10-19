import Anthropic from "@anthropic-ai/sdk";
import { MODEL_IDS } from "@/lib/ai/models";
import { resolveKey } from "@/lib/ai/server/client";
import { AiError, toErrorResponse } from "@/lib/ai/server/errors";
import { allowRequest, clientKey } from "@/lib/ai/server/limits";

export const runtime = "nodejs";

/**
 * Validates a user's own key without spending tokens: looking up a model is free.
 * The key is used for this one call and never stored or logged.
 */
export async function POST(request: Request) {
  try {
    if (!allowRequest(`test:${clientKey(request.headers)}`, 10)) {
      throw new AiError("rate_limited", "Too many attempts — wait a minute.", 429);
    }
    const key = resolveKey(request.headers);
    if (key.source !== "user") throw new AiError("invalid_request", "No key was provided.", 400);
    const client = new Anthropic({ apiKey: key.apiKey, maxRetries: 0, timeout: 15_000 });
    await client.models.retrieve(MODEL_IDS.haiku);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
