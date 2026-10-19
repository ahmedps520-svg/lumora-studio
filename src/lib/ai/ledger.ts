"use client";

/** Today's AI spending in this browser — shown in the AI panel and enforced against the daily cap. */
import { create } from "zustand";
import type { UsageReport } from "./cost";
import type { AiTask } from "./models";

/** "artwork" = a Gemini image (not a Claude task). */
export type LedgerTask = AiTask | "artwork";

export interface LedgerEntry {
  task: LedgerTask;
  model: string;
  costUsd: number;
  at: string;
}

interface LedgerState {
  date: string;
  spentUsd: number;
  requests: number;
  recent: LedgerEntry[];
  record: (task: LedgerTask, usage: Pick<UsageReport, "costUsd"> & { model: string }) => void;
  refresh: () => void;
}

const KEY = "lumora-ai-ledger";
const today = () => new Date().toISOString().slice(0, 10);

function load(): Pick<LedgerState, "date" | "spentUsd" | "requests" | "recent"> {
  const empty = { date: today(), spentUsd: 0, requests: 0, recent: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    if (data?.date !== today()) return empty;
    return {
      date: data.date,
      spentUsd: Number(data.spentUsd) || 0,
      requests: Number(data.requests) || 0,
      recent: Array.isArray(data.recent) ? data.recent.slice(0, 20) : [],
    };
  } catch {
    return empty;
  }
}

function save(state: Pick<LedgerState, "date" | "spentUsd" | "requests" | "recent">) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export const useAiLedger = create<LedgerState>()((set, get) => ({
  // Starts empty so server and browser render the same; components call refresh() on mount.
  date: today(),
  spentUsd: 0,
  requests: 0,
  recent: [],
  record: (task, usage) => {
    const base =
      get().date === today() ? get() : { date: today(), spentUsd: 0, requests: 0, recent: [] };
    const next = {
      date: base.date,
      spentUsd: Math.round((base.spentUsd + usage.costUsd) * 1e6) / 1e6,
      requests: base.requests + 1,
      recent: [
        { task, model: usage.model, costUsd: usage.costUsd, at: new Date().toISOString() },
        ...base.recent,
      ].slice(0, 20),
    };
    save(next);
    set(next);
  },
  refresh: () => set(load()),
}));
