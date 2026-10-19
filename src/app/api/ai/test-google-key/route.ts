import { AiError, toErrorResponse } from "@/lib/ai/server/errors";
import { checkGoogleKey, resolveGoogleKey } from "@/lib/ai/server/gemini";
import { allowRequest, clientKey } from "@/lib/ai/server/limits";

export const runtime = "nodejs";

/**
 * Validates a user's own Google AI key without spending anything (listing
 * models is free). The key is used for this one call and never stored or logged.
 */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      throw new AiError("invalid_request", "Cross-site requests are not allowed.", 403);
    }
    if (!allowRequest(`test-google:${clientKey(request.headers)}`, 10)) {
      throw new AiError("rate_limited", "Too many attempts — wait a minute.", 429);
    }
    const key = resolveGoogleKey(request.headers);
    if (key.source !== "user") throw new AiError("invalid_request", "No key was provided.", 400);
    await checkGoogleKey(key);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
