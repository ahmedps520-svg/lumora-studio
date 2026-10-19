// @vitest-environment node
/**
 * AI route handlers with a recorded (fake) Claude client — no tokens spent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import birthday from "../fixtures/ai/design-birthday.json";

const OWNER_KEY = `sk-ant-api03-${"o".repeat(40)}`;
const USER_KEY = `sk-ant-api03-${"u".repeat(40)}`;

type Params = Record<string, unknown> & { model: string };
interface FakeOptions {
  parsed?: unknown;
  stopReason?: string;
  content?: unknown[];
  usage?: Record<string, number>;
  model?: string;
  throws?: unknown;
}

const calls: { apiKey: string; method: string; params: Params }[] = [];

async function setup(
  fake: FakeOptions,
  env: Record<string, string> = { ANTHROPIC_API_KEY: OWNER_KEY },
) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const clientModule = await import("@/lib/ai/server/client");
  clientModule.setAiClientFactory((apiKey) => {
    const respond = async (method: string, params: Params) => {
      calls.push({ apiKey, method, params });
      if (fake.throws) throw fake.throws;
      return {
        model: fake.model ?? params.model,
        stop_reason: fake.stopReason ?? "end_turn",
        content: fake.content ?? [],
        parsed_output: fake.parsed ?? null,
        usage: fake.usage ?? { input_tokens: 1_000, output_tokens: 200 },
      };
    };
    return {
      beta: {
        messages: {
          parse: (params: Params) => respond("parse", params),
          create: (params: Params) => respond("create", params),
          stream: (params: Params) => ({ finalMessage: () => respond("stream", params) }),
        },
      },
    } as never;
  });
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/ai/x", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/ai/write", () => {
  it("returns suggestions and usage, using Haiku on Balanced", async () => {
    await setup({ parsed: { results: [" One ", "Two", "Three", "Four"] } });
    const { POST } = await import("@/app/api/ai/write/route");
    const res = await POST(post({ action: "rewrite", text: "Summer sale", count: 3 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual(["One", "Two", "Three"]);
    expect(body.usage.model).toBe("claude-haiku-5-5");
    expect(body.usage.costUsd).toBeGreaterThan(0);

    const call = calls[0]!;
    expect(call.apiKey).toBe(OWNER_KEY);
    expect(call.params.model).toBe("claude-haiku-5-5");
    expect(call.params).not.toHaveProperty("fallbacks"); // Haiku has no fallback
    expect(call.params).not.toHaveProperty("temperature"); // not accepted by current models
    expect(call.params).not.toHaveProperty("thinking");
    expect((call.params.system as { cache_control?: unknown }[])[0]!.cache_control).toEqual({
      type: "ephemeral",
    });
    expect((call.params.output_config as { effort: string }).effort).toBe("low");
  });

  it("uses Opus with refusal fallbacks on Best quality", async () => {
    await setup({ parsed: { results: ["x"] } });
    const { POST } = await import("@/app/api/ai/write/route");
    await POST(post({ action: "rewrite", text: "Hi", prefs: { quality: "best" } }));
    expect(calls[0]!.params).toMatchObject({
      model: "claude-opus-5-5",
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
    });
  });

  it("uses the visitor's own key when provided", async () => {
    await setup({ parsed: { results: ["x"] } });
    const { POST } = await import("@/app/api/ai/write/route");
    await POST(post({ action: "rewrite", text: "Hi" }, { "x-lumora-api-key": USER_KEY }));
    expect(calls[0]!.apiKey).toBe(USER_KEY);
  });

  it("rejects a malformed personal key without calling Claude", async () => {
    await setup({ parsed: { results: ["x"] } });
    const { POST } = await import("@/app/api/ai/write/route");
    const res = await POST(post({ action: "rewrite", text: "Hi" }, { "x-lumora-api-key": "nope" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("invalid_key");
    expect(calls).toHaveLength(0);
  });

  it("explains when no key is configured", async () => {
    await setup({ parsed: { results: ["x"] } }, { ANTHROPIC_API_KEY: "" });
    const { POST } = await import("@/app/api/ai/write/route");
    const res = await POST(post({ action: "rewrite", text: "Hi" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("no_key");
  });

  it("validates the request body", async () => {
    await setup({ parsed: { results: ["x"] } });
    const { POST } = await import("@/app/api/ai/write/route");
    const res = await POST(post({ action: "hack", text: "Hi" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });

  it("blocks cross-site requests", async () => {
    await setup({ parsed: { results: ["x"] } });
    const { POST } = await import("@/app/api/ai/write/route");
    const res = await POST(
      post({ action: "rewrite", text: "Hi" }, { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("reports refusals in plain language", async () => {
    await setup({ stopReason: "refusal" });
    const { POST } = await import("@/app/api/ai/write/route");
    const res = await POST(post({ action: "rewrite", text: "Hi" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("refused");
  });

  it("stops at the owner's daily budget", async () => {
    // Each request is estimated at ~$0.00016 and actually costs $0.0002; with a
    // $0.0003 budget the first fits and the second (0.0002 + 0.00016) does not.
    await setup(
      { parsed: { results: ["x"] }, usage: { input_tokens: 1_000, output_tokens: 200 } },
      {
        ANTHROPIC_API_KEY: OWNER_KEY,
        AI_DAILY_BUDGET_USD: "0.0003",
      },
    );
    const { POST } = await import("@/app/api/ai/write/route");
    expect((await POST(post({ action: "rewrite", text: "Hi" }))).status).toBe(200);
    const second = await POST(post({ action: "rewrite", text: "Hi" }));
    expect(second.status).toBe(402);
    expect((await second.json()).error.code).toBe("budget_exceeded");
  });

  it("rate-limits a single visitor", async () => {
    await setup(
      { parsed: { results: ["x"] } },
      { ANTHROPIC_API_KEY: OWNER_KEY, AI_RATE_LIMIT_PER_MINUTE: "2" },
    );
    const { POST } = await import("@/app/api/ai/write/route");
    await POST(post({ action: "rewrite", text: "Hi" }));
    await POST(post({ action: "rewrite", text: "Hi" }));
    const third = await POST(post({ action: "rewrite", text: "Hi" }));
    expect(third.status).toBe(429);
  });
});

describe("POST /api/ai/design", () => {
  it("converts and auto-fixes a recorded design", async () => {
    const { AiDesignSchema } = await import("@/lib/ai/design-format");
    await setup({
      content: [{ type: "text", text: JSON.stringify(AiDesignSchema.parse(birthday)) }],
    });
    const { POST } = await import("@/app/api/ai/design/route");
    const res = await POST(
      post({
        prompt: "Birthday invitation, pink and gold",
        format: { width: 1080, height: 1080 },
        style: "elegant",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page.elements).toHaveLength(8);
    expect(body.palette).toContain("#C9A227");
    expect(body.style).toBe("elegant");
    expect(Array.isArray(body.fixes)).toBe(true);
    expect(calls[0]!.params.model).toBe("claude-sonnet-5-5");
    expect(calls[0]!.params.fallbacks).toBe("default");
    expect(JSON.stringify(calls[0]!.params.messages)).toContain("1080 × 1080");
    // Big layouts: schema in the prompt (a compiled grammar would be too large).
    expect(calls[0]!.params.output_config).toEqual({ effort: "medium" });
    expect(JSON.stringify(calls[0]!.params.system)).toContain("JSON Schema");
  });

  it("repairs an answer that doesn't fit the schema once, then succeeds", async () => {
    const { AiDesignSchema } = await import("@/lib/ai/design-format");
    const good = JSON.stringify(AiDesignSchema.parse(birthday));
    let n = 0;
    await setup({});
    const clientModule = await import("@/lib/ai/server/client");
    clientModule.setAiClientFactory(
      () =>
        ({
          beta: {
            messages: {
              stream: (params: Params) => ({
                finalMessage: async () => {
                  calls.push({ apiKey: "", method: "stream", params });
                  n++;
                  return {
                    model: params.model,
                    stop_reason: "end_turn",
                    content: [{ type: "text", text: n === 1 ? '{"concept": 3}' : good }],
                    usage: { input_tokens: 100, output_tokens: 50 },
                  };
                },
              }),
            },
          },
        }) as never,
    );
    const { POST } = await import("@/app/api/ai/design/route");
    const res = await POST(post({ prompt: "Birthday", format: { width: 1080, height: 1080 } }));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(JSON.stringify(calls[1]!.params.messages)).toContain("doesn't match the schema");
  });
});

describe("POST /api/ai/assistant", () => {
  it("returns only valid tool calls, never truncated ones", async () => {
    await setup({
      content: [
        { type: "text", text: "Made the title bigger." },
        {
          type: "tool_use",
          id: "1",
          name: "update_element",
          input: { id: "title", fontSize: 140 },
        },
        { type: "tool_use", id: "2", name: "update_element", input: { fontSize: "huge" } },
        { type: "tool_use", id: "3", name: "format_disk", input: {} },
      ],
    });
    const { POST } = await import("@/app/api/ai/assistant/route");
    const res = await POST(
      post({
        message: "make the title bigger",
        scene: JSON.stringify({ page: {}, elements: [{ id: "title" }] }),
        format: { width: 1080, height: 1080 },
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reply).toBe("Made the title bigger.");
    expect(body.actions).toEqual([
      { tool: "update_element", input: { id: "title", fontSize: 140 } },
    ]);
    expect(body.rejected).toBe(2);
    expect(calls[0]!.params.tool_choice).toEqual({ type: "auto" }); // forced tool use 400s on current models
  });

  it("ignores tool calls when the answer was cut off", async () => {
    await setup({
      stopReason: "max_tokens",
      content: [{ type: "tool_use", id: "1", name: "delete_elements", input: { ids: ["title"] } }],
    });
    const { POST } = await import("@/app/api/ai/assistant/route");
    const body = await (
      await POST(post({ message: "delete", scene: "{}", format: { width: 100, height: 100 } }))
    ).json();
    expect(body.actions).toEqual([]);
  });
});

describe("POST /api/ai/palette", () => {
  it("cleans up colours and fonts", async () => {
    await setup({
      parsed: {
        palettes: [
          {
            name: "Sunset",
            mood: "warm",
            colors: ["#FFFFFF", "ff7a3d", "nope", "#1F1235"],
            headingFont: "Anton",
            bodyFont: "Papyrus",
          },
        ],
      },
    });
    const { POST } = await import("@/app/api/ai/palette/route");
    const body = await (await POST(post({ prompt: "sunset" }))).json();
    expect(body.palettes[0]).toMatchObject({
      colors: ["#1F1235", "#FF7A3D", "#FFFFFF"],
      headingFont: "Anton",
      bodyFont: "Inter",
    });
  });
});
