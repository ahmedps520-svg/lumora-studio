import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiErrorBody, AiErrorCode } from "../contract";

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AiError";
  }
}

const MESSAGES: Record<AiErrorCode, string> = {
  no_key: "AI is not set up yet. Add a Claude API key in .env.local or in Settings → AI.",
  invalid_key: "The Claude API key was rejected. Check it in Settings → AI (or .env.local).",
  budget_exceeded:
    "Today's AI budget has been used up. It resets tomorrow — or raise it in Settings.",
  rate_limited: "Lots of requests right now. Please wait a few seconds and try again.",
  refused: "Claude couldn't help with that request. Try rephrasing it.",
  invalid_request: "That request wasn't valid.",
  invalid_output: "The AI answer came back incomplete. Please try again.",
  overloaded: "Claude is very busy at the moment. Please try again in a minute.",
  server_error: "Something went wrong talking to Claude. Please try again.",
};

export function aiErrorMessage(code: AiErrorCode) {
  return MESSAGES[code];
}

/** Turns any thrown value into a safe JSON error response (never leaks keys). */
export function toErrorResponse(error: unknown): Response {
  let code: AiErrorCode = "server_error";
  let status = 500;
  let message: string | undefined;

  if (error instanceof AiError) {
    code = error.code;
    status = error.status;
    message = error.message;
  } else if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    code = "invalid_key";
    status = 401;
  } else if (error instanceof Anthropic.RateLimitError) {
    code = "rate_limited";
    status = 429;
  } else if (error instanceof Anthropic.BadRequestError) {
    code = "invalid_request";
    status = 400;
    console.error("[ai] bad request", error.message);
  } else if (error instanceof Anthropic.APIError) {
    code = error.status === 529 || (error.status ?? 0) >= 500 ? "overloaded" : "server_error";
    status = 503;
    console.error("[ai] api error", error.status, error.message);
  } else if (error instanceof Anthropic.APIConnectionError) {
    code = "overloaded";
    status = 503;
  } else {
    console.error("[ai] unexpected", error);
  }

  const body: AiErrorBody = { error: { code, message: message ?? MESSAGES[code] } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
