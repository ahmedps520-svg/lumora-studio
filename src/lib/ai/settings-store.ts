"use client";

/**
 * Everything the user can customise about AI, saved in this browser only.
 * (A user's own API key never leaves the browser except as a header on their
 * own AI requests; the server never stores it.)
 */
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { AiPrefs, Creativity, DesignStyle, Tone } from "./contract";
import type { BackgroundModel } from "@/lib/background/protocol";
import type { AiQuality } from "./models";

export interface AiSettings extends AiPrefs {
  quality: AiQuality;
  /** Bring-your-own Claude API key (optional). */
  apiKey: string;
  /** Daily spending cap enforced in this browser, in US$. */
  dailyBudgetUsd: number;
  showCosts: boolean;
  /** How many Magic Design variations to generate at once. */
  designVariations: 1 | 2 | 3;
  defaultStyle: DesignStyle;
  /** How many Magic Write alternatives to ask for. */
  writeCount: number;
  /** Apply assistant edits immediately (they're always one undo step). */
  assistantAutoApply: boolean;
  /** Free on-device background remover: "quality" (any subject) or "fast" (people). */
  backgroundModel: BackgroundModel;
  /** Bring-your-own Google AI Studio key for Premium artwork (optional). */
  googleKey: string;
  /** Artwork model: "standard" = Nano Banana 2.1, "pro" = Nano Banana Pro. */
  premiumArt: "standard" | "pro";
  /** How many times Claude reviews and polishes its own Premium design. */
  premiumReviews: 0 | 1 | 2 | 3;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  quality: "balanced",
  creativity: "balanced",
  tone: "auto",
  language: "auto",
  brandVoice: "",
  audience: "",
  apiKey: "",
  dailyBudgetUsd: 1,
  showCosts: true,
  designVariations: 3,
  defaultStyle: "auto",
  writeCount: 3,
  assistantAutoApply: true,
  backgroundModel: "quality",
  googleKey: "",
  premiumArt: "standard",
  premiumReviews: 2,
};

interface AiSettingsState extends AiSettings {
  update: (patch: Partial<AiSettings>) => void;
  reset: () => void;
}

/** localStorage that never throws (private windows, blocked storage). */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // ignore — settings just won't persist
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

export const useAiSettings = create<AiSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_AI_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set({ ...DEFAULT_AI_SETTINGS }),
    }),
    {
      name: "lumora-ai-settings",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ update: _u, reset: _r, ...settings }) => settings,
    },
  ),
);

/** The preference subset sent with every AI request. */
export function currentPrefs(): AiPrefs {
  const s = useAiSettings.getState();
  return {
    quality: s.quality,
    creativity: s.creativity as Creativity,
    tone: s.tone as Tone,
    language: s.language,
    brandVoice: s.brandVoice,
    audience: s.audience,
  };
}
