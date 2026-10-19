"use client";

/**
 * Browser-side AI calls: adds the user's own key (if any), enforces the
 * daily budget set in Settings, records spending, and turns failures into
 * friendly, typed errors.
 */
import type { z } from "zod";
import type { AssistantAction } from "./assistant-tools";
import {
  BYOK_HEADER,
  GOOGLE_BYOK_HEADER,
  type AiErrorCode,
  type AiPalette,
  type AssistantRequest,
  type DesignRequest,
  type PaletteRequest,
  type WriteRequest,
} from "./contract";
import type { UsageReport } from "./cost";
import type { AiDesign, ConvertedPage, FixKind } from "./design-format";
import type {
  ComposeRequestSchema,
  ImageRequestSchema,
  PremiumPlan,
  PremiumPlanRequestSchema,
  ReviewRequestSchema,
} from "./premium";
import { useAiLedger } from "./ledger";
import type { AiTask } from "./models";
import { currentPrefs, useAiSettings } from "./settings-store";

export class AiClientError extends Error {
  constructor(
    readonly code: AiErrorCode | "network" | "client_budget",
    message: string,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

async function post<T extends { usage: UsageReport }>(
  path: string,
  task: AiTask,
  body: object,
  signal?: AbortSignal,
): Promise<T> {
  const settings = useAiSettings.getState();
  const ledger = useAiLedger.getState();
  ledger.refresh();
  if (useAiLedger.getState().spentUsd >= settings.dailyBudgetUsd) {
    throw new AiClientError("client_budget", "client_budget");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.apiKey.trim()) headers[BYOK_HEADER] = settings.apiKey.trim();

  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, prefs: currentPrefs() }),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new AiClientError("network", "network");
  }

  const data = (await response.json().catch(() => null)) as
    (T & { error?: undefined }) | { error: { code: AiErrorCode; message: string } } | null;
  if (!response.ok || !data || ("error" in data && data.error)) {
    const err = data && "error" in data && data.error ? data.error : null;
    throw new AiClientError(err?.code ?? "server_error", err?.message ?? "server_error");
  }
  const result = data as T;
  useAiLedger.getState().record(task, result.usage);
  return result;
}

export function aiWrite(body: Omit<WriteRequest, "prefs">, signal?: AbortSignal) {
  return post<{ results: string[]; usage: UsageReport }>("/api/ai/write", "write", body, signal);
}

export function aiPalettes(body: Omit<PaletteRequest, "prefs">, signal?: AbortSignal) {
  return post<{ palettes: AiPalette[]; usage: UsageReport }>(
    "/api/ai/palette",
    "palette",
    body,
    signal,
  );
}

export interface DesignResult {
  page: ConvertedPage;
  concept: string;
  palette: string[];
  headingFont: string;
  bodyFont: string;
  style: string;
  fixes: FixKind[];
  usage: UsageReport;
}

export function aiDesign(body: Omit<DesignRequest, "prefs">, signal?: AbortSignal) {
  return post<DesignResult>("/api/ai/design", "design", body, signal);
}

export interface AssistantResult {
  reply: string;
  actions: AssistantAction[];
  rejected: number;
  usage: UsageReport;
}

export function aiAssistant(body: Omit<AssistantRequest, "prefs">, signal?: AbortSignal) {
  return post<AssistantResult>("/api/ai/assistant", "assistant", body, signal);
}

// ─── Premium design ──────────────────────────────────────────────────────────

export interface PremiumPlanResult {
  plan: PremiumPlan;
  usage: UsageReport;
}

export function aiPremiumPlan(
  body: Omit<z.input<typeof PremiumPlanRequestSchema>, "prefs">,
  signal?: AbortSignal,
) {
  return post<PremiumPlanResult>("/api/ai/premium/plan", "artDirect", body, signal);
}

export interface PremiumLayoutResult {
  design: AiDesign;
  page: ConvertedPage;
  fixes: FixKind[];
  palette: string[];
  usage: UsageReport;
}

export function aiPremiumCompose(
  body: Omit<z.input<typeof ComposeRequestSchema>, "prefs">,
  signal?: AbortSignal,
) {
  return post<PremiumLayoutResult>("/api/ai/premium/compose", "compose", body, signal);
}

export function aiPremiumReview(
  body: Omit<z.input<typeof ReviewRequestSchema>, "prefs">,
  signal?: AbortSignal,
) {
  return post<PremiumLayoutResult & { verdict: "good" | "improve"; notes: string }>(
    "/api/ai/premium/review",
    "review",
    body,
    signal,
  );
}

/** AI artwork (Gemini). Uses the user's own Google key when set in Settings. */
export async function aiArtwork(
  body: z.input<typeof ImageRequestSchema>,
  signal?: AbortSignal,
): Promise<{ image: string; model: string; costUsd: number }> {
  const settings = useAiSettings.getState();
  useAiLedger.getState().refresh();
  if (useAiLedger.getState().spentUsd >= settings.dailyBudgetUsd) {
    throw new AiClientError("client_budget", "client_budget");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.googleKey.trim()) headers[GOOGLE_BYOK_HEADER] = settings.googleKey.trim();
  let response: Response;
  try {
    response = await fetch("/api/ai/image", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new AiClientError("network", "network");
  }
  const data = (await response.json().catch(() => null)) as
    | { image: string; model: string; costUsd: number; error?: undefined }
    | { error: { code: AiErrorCode; message: string } }
    | null;
  if (!response.ok || !data || ("error" in data && data.error)) {
    const err = data && "error" in data && data.error ? data.error : null;
    throw new AiClientError(err?.code ?? "server_error", err?.message ?? "server_error");
  }
  const result = data as { image: string; model: string; costUsd: number };
  useAiLedger.getState().record("artwork", { model: result.model, costUsd: result.costUsd });
  return result;
}

export interface AiStatus {
  ownerKey: boolean;
  imageOwnerKey: boolean;
  acceptsUserKey: boolean;
  dailyBudgetUsd: number;
  spentTodayUsd: number;
}

export async function fetchAiStatus(): Promise<AiStatus | null> {
  try {
    const response = await fetch("/api/ai/status", { cache: "no-store" });
    return response.ok ? ((await response.json()) as AiStatus) : null;
  } catch {
    return null;
  }
}

/** Checks a user's own key for free (looks up a model; no tokens are spent). */
export async function testApiKey(apiKey: string): Promise<{ ok: boolean; code?: AiErrorCode }> {
  try {
    const response = await fetch("/api/ai/test-key", {
      method: "POST",
      headers: { [BYOK_HEADER]: apiKey.trim() },
    });
    if (response.ok) return { ok: true };
    const data = (await response.json().catch(() => null)) as {
      error?: { code: AiErrorCode };
    } | null;
    return { ok: false, code: data?.error?.code ?? "server_error" };
  } catch {
    return { ok: false, code: "server_error" };
  }
}
