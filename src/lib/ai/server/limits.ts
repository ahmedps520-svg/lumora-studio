import "server-only";

/**
 * In-memory protections for the owner's key. Good enough for a single server
 * (and a free host): each serverless instance keeps its own counters, so the
 * real cap may be slightly higher under heavy traffic. The browser keeps its
 * own daily ledger too (Settings → AI → daily budget).
 */

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** Sliding-window limiter. Returns true when the request may proceed. */
export function allowRequest(key: string, perMinute: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= perMinute) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map small.
  if (hits.size > 5_000) {
    for (const [k, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return true;
}

const spend = new Map<string, number>();

const today = (now = new Date()) => now.toISOString().slice(0, 10);

export function spentToday(now?: Date): number {
  return spend.get(today(now)) ?? 0;
}

export function recordSpend(usd: number, now?: Date) {
  const key = today(now);
  spend.set(key, Math.round(((spend.get(key) ?? 0) + usd) * 1e6) / 1e6);
  // Forget old days.
  for (const day of spend.keys()) if (day < key) spend.delete(day);
}

/** Test helper. */
export function resetLimits() {
  hits.clear();
  spend.clear();
}

/** Best-effort client IP (behind Vercel/Cloudflare or local). */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || headers.get("cf-connecting-ip") || "local";
}
