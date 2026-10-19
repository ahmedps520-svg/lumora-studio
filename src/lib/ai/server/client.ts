import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";
import { BYOK_HEADER } from "../contract";
import { AiError } from "./errors";

const KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

export interface ResolvedKey {
  apiKey: string;
  /** "owner" = the site's key from the environment (budget applies); "user" = bring-your-own-key. */
  source: "owner" | "user";
}

/**
 * Picks the key for this request: a user's own key (sent per request, never
 * stored) wins; otherwise the owner key from the environment.
 */
export function resolveKey(headers: Headers): ResolvedKey {
  const userKey = headers.get(BYOK_HEADER)?.trim();
  if (userKey) {
    if (!KEY_PATTERN.test(userKey))
      throw new AiError("invalid_key", "That API key doesn't look right.", 401);
    return { apiKey: userKey, source: "user" };
  }
  const ownerKey = getServerEnv().ANTHROPIC_API_KEY;
  if (!ownerKey) throw new AiError("no_key", "AI is not set up yet.", 503);
  return { apiKey: ownerKey, source: "owner" };
}

/** Minimal surface the AI runners use — lets tests inject a fake client. */
export type AiClient = Pick<Anthropic, "beta">;

let factory: (apiKey: string) => AiClient = (apiKey) =>
  // The SDK retries 408/409/429/5xx and connection errors with exponential backoff.
  new Anthropic({ apiKey, maxRetries: 3, timeout: 90_000 });

export function createAiClient(apiKey: string): AiClient {
  return factory(apiKey);
}

/** Test helper: replace the client factory (e.g. with recorded responses). */
export function setAiClientFactory(next: ((apiKey: string) => AiClient) | null) {
  factory = next ?? ((apiKey) => new Anthropic({ apiKey, maxRetries: 3, timeout: 90_000 }));
}
