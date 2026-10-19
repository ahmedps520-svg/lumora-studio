import { beforeEach, describe, expect, it, vi } from "vitest";
import { findLeakedSecrets, serverEnvSchema } from "@/lib/env-schema";

describe("serverEnvSchema", () => {
  it("accepts an empty environment (every feature is optional)", () => {
    expect(serverEnvSchema.parse({})).toEqual({});
  });

  it("treats blank values as not set", () => {
    const env = serverEnvSchema.parse({ ANTHROPIC_API_KEY: "  ", UNSPLASH_ACCESS_KEY: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.UNSPLASH_ACCESS_KEY).toBeUndefined();
  });

  it("accepts a well-formed Claude key", () => {
    const key = `sk-ant-api03-${"a".repeat(40)}`;
    expect(serverEnvSchema.parse({ ANTHROPIC_API_KEY: key }).ANTHROPIC_API_KEY).toBe(key);
  });

  it("rejects a malformed Claude key", () => {
    expect(serverEnvSchema.safeParse({ ANTHROPIC_API_KEY: "hello" }).success).toBe(false);
  });

  it("coerces numeric settings", () => {
    const env = serverEnvSchema.parse({
      AI_DAILY_BUDGET_USD: "2.5",
      AI_RATE_LIMIT_PER_MINUTE: "30",
    });
    expect(env.AI_DAILY_BUDGET_USD).toBe(2.5);
    expect(env.AI_RATE_LIMIT_PER_MINUTE).toBe(30);
  });

  it("rejects a negative budget", () => {
    expect(serverEnvSchema.safeParse({ AI_DAILY_BUDGET_USD: "-1" }).success).toBe(false);
  });
});

describe("findLeakedSecrets", () => {
  it("flags secrets exposed with NEXT_PUBLIC_", () => {
    expect(
      findLeakedSecrets({
        NEXT_PUBLIC_ANTHROPIC_API_KEY: "sk-ant-x",
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        ANTHROPIC_API_KEY: "sk-ant-y",
      }),
    ).toEqual(["NEXT_PUBLIC_ANTHROPIC_API_KEY"]);
  });

  it("allows the Supabase anon key, which is public by design", () => {
    expect(findLeakedSecrets({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJ..." })).toEqual([]);
  });

  it("ignores empty values", () => {
    expect(findLeakedSecrets({ NEXT_PUBLIC_SECRET_TOKEN: "" })).toEqual([]);
  });
});

describe("getFeatureFlags", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("reports features as booleans and applies defaults", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", `sk-ant-api03-${"b".repeat(40)}`);
    vi.stubEnv("PEXELS_API_KEY", "p".repeat(30));
    vi.stubEnv("AI_DAILY_BUDGET_USD", "");
    const { getFeatureFlags } = await import("@/lib/env");
    const flags = getFeatureFlags();
    expect(flags.aiOwnerKey).toBe(true);
    expect(flags.pexels).toBe(true);
    expect(flags.unsplash).toBe(false);
    expect(flags.cloudSync).toBe(false);
    expect(flags.dailyBudgetUsd).toBe(1);
    // No key values anywhere in the output.
    expect(JSON.stringify(flags)).not.toContain("sk-ant");
  });

  it("ignores an invalid variable instead of crashing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "not-a-key");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getFeatureFlags } = await import("@/lib/env");
    expect(getFeatureFlags().aiOwnerKey).toBe(false);
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0]?.[0])).not.toContain("not-a-key");
  });
});
