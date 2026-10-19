"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { aiDesign, AiClientError, fetchAiStatus, type DesignResult } from "@/lib/ai/api";
import type { DesignStyle } from "@/lib/ai/contract";
import { useAiLedger } from "@/lib/ai/ledger";
import { useAiSettings } from "@/lib/ai/settings-store";

const noop = () => () => {};

/** False during server render / hydration, true once running in the browser. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

let statusPromise: ReturnType<typeof fetchAiStatus> | null = null;

/** Whether AI can be used: the site has a key, or the user added their own. */
export function useAiReady(): { ready: boolean | null; source: "owner" | "user" | null } {
  const mounted = useMounted();
  const apiKey = useAiSettings((s) => s.apiKey);
  const [ownerKey, setOwnerKey] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    statusPromise ??= fetchAiStatus();
    void statusPromise.then((status) => {
      if (!cancelled) setOwnerKey(Boolean(status?.ownerKey));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted) return { ready: null, source: null };
  if (apiKey.trim()) return { ready: true, source: "user" };
  if (ownerKey === null) return { ready: null, source: null };
  return { ready: ownerKey, source: ownerKey ? "owner" : null };
}

/** Whether Premium designs can get AI artwork: the site has a Google key, or the user added one. */
export function useCanPaint(): boolean | null {
  const mounted = useMounted();
  const googleKey = useAiSettings((s) => s.googleKey);
  const [ownerKey, setOwnerKey] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    statusPromise ??= fetchAiStatus();
    void statusPromise.then((status) => {
      if (!cancelled) setOwnerKey(Boolean(status?.imageOwnerKey));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!mounted) return null;
  if (googleKey.trim()) return true;
  return ownerKey;
}

/** Friendly, translated message for any AI failure. */
export function useAiErrorMessage() {
  const t = useTranslations("ai.errors");
  return useCallback(
    (error: unknown): string => {
      if (error instanceof AiClientError) {
        const code = error.code;
        return t.has(code as never) ? t(code as never) : t("server_error");
      }
      return t("server_error");
    },
    [t],
  );
}

/** Loads today's spending into the ledger store on mount. */
export function useLedger() {
  const refresh = useAiLedger((s) => s.refresh);
  useEffect(() => refresh(), [refresh]);
  return useAiLedger();
}

/**
 * Runs an AI request with loading + error state. Starting a new run cancels
 * the previous one; unmounting cancels too.
 */
export function useAiRun<TArgs extends unknown[], TResult>(
  fn: (signal: AbortSignal, ...args: TArgs) => Promise<TResult>,
) {
  const errorMessage = useAiErrorMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setLoading(true);
      setError(null);
      try {
        return await fn(current.signal, ...args);
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        setError(errorMessage(err));
        return null;
      } finally {
        if (controller.current === current) setLoading(false);
      }
    },
    [fn, errorMessage],
  );

  return { run, loading, error, setError };
}

export type VariationResult =
  { ok: true; result: DesignResult } | { ok: false; style: DesignStyle; message: string };

/** Styles for N variations: "auto" fans out into Minimal / Bold / Playful. */
export function variationStyles(style: DesignStyle, count: number): DesignStyle[] {
  if (style !== "auto") return Array.from({ length: count }, () => style);
  return (["minimal", "bold", "playful"] as DesignStyle[]).slice(0, count);
}

/** Generates several Magic Design variations in parallel; failures don't sink the others. */
export async function generateVariations(
  args: {
    prompt: string;
    format: { width: number; height: number; presetId?: string | null };
    style: DesignStyle;
    count: number;
    palette?: string[];
  },
  signal: AbortSignal,
  errorMessage: (e: unknown) => string,
): Promise<VariationResult[]> {
  const styles = variationStyles(args.style, Math.max(1, Math.min(3, args.count)));
  const settled = await Promise.allSettled(
    styles.map((style) =>
      aiDesign(
        {
          prompt: args.prompt,
          format: {
            width: args.format.width,
            height: args.format.height,
            presetId: args.format.presetId ?? null,
          },
          style,
          palette: args.palette ?? [],
        },
        signal,
      ),
    ),
  );
  if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? { ok: true, result: s.value }
      : { ok: false, style: styles[i]!, message: errorMessage(s.reason) },
  );
}
