// @vitest-environment node
/**
 * Premium design server pieces with fake Google/Claude clients — nothing is spent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GOOGLE_KEY = `AIza${"g".repeat(35)}`;

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/ai/image", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: JSON.stringify(body),
  });
}

const imageBody = { prompt: "A blocky forest arena at sunset, no text", width: 1280, height: 720 };

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("Gemini artwork", () => {
  it("picks the closest supported aspect ratio", async () => {
    const { nearestAspectRatio } = await import("@/lib/ai/server/gemini");
    expect(nearestAspectRatio(1280, 720)).toBe("16:9");
    expect(nearestAspectRatio(1080, 1920)).toBe("9:16");
    expect(nearestAspectRatio(1080, 1350)).toBe("4:5");
    expect(nearestAspectRatio(1000, 1000)).toBe("1:1");
    expect(nearestAspectRatio(2480, 3508)).toBe("2:3"); // A4 portrait (0.707) is just closer to 2:3
  });

  it("reads the image from an Interaction (steps or output_image)", async () => {
    const { readInteraction } = await import("@/lib/ai/server/gemini");
    const fromSteps = readInteraction({
      steps: [
        { type: "thought", content: [] },
        {
          type: "model_output",
          content: [
            { type: "text", text: "Here you go" },
            { type: "image", data: "AAAA", mime_type: "image/jpeg" },
          ],
        },
      ],
    });
    expect(fromSteps.image?.data).toBe("AAAA");
    expect(fromSteps.text).toBe("Here you go");
    expect(readInteraction({ output_image: { data: "BBBB" } }).image?.data).toBe("BBBB");
    expect(readInteraction({ steps: [] }).image).toBeNull();
  });

  it("generates with the owner key, sends no-store, and charges the budget", async () => {
    vi.stubEnv("GEMINI_API_KEY", GOOGLE_KEY);
    const gemini = await import("@/lib/ai/server/gemini");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            steps: [
              {
                type: "model_output",
                content: [{ type: "image", data: "QUJD", mime_type: "image/jpeg" }],
              },
            ],
          }),
          { status: 200 },
        ),
    );
    gemini.setGeminiFetch(fetchMock as unknown as typeof fetch);
    const { POST } = await import("@/app/api/ai/image/route");
    const res = await POST(post(imageBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.image).toBe("data:image/jpeg;base64,QUJD");
    expect(body.costUsd).toBeCloseTo(0.0504);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1beta/interactions");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(GOOGLE_KEY);
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({
      model: "gemini-nano-banana-2.1",
      store: false,
      response_format: { type: "image", aspect_ratio: "16:9", image_size: "2K" },
    });
    const { spentToday } = await import("@/lib/ai/server/limits");
    expect(spentToday()).toBeCloseTo(0.0504);
  });

  it("uses the visitor's own key when sent, and explains a missing key", async () => {
    const gemini = await import("@/lib/ai/server/gemini");
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ output_image: { data: "QQ==" } })),
    );
    gemini.setGeminiFetch(fetchMock as unknown as typeof fetch);
    const { POST } = await import("@/app/api/ai/image/route");

    const missing = await POST(post(imageBody));
    expect(missing.status).toBe(503);
    expect((await missing.json()).error.code).toBe("no_key");

    const ok = await POST(
      post({ ...imageBody, quality: "pro" }, { "x-lumora-google-key": GOOGLE_KEY }),
    );
    expect(ok.status).toBe(200);
    const sent = JSON.parse(
      String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(sent.model).toBe("gemini-3-pro-image");
  });

  it("turns Google errors and safety blocks into friendly errors", async () => {
    vi.stubEnv("GEMINI_API_KEY", GOOGLE_KEY);
    const gemini = await import("@/lib/ai/server/gemini");
    const { POST } = await import("@/app/api/ai/image/route");

    gemini.setGeminiFetch(
      (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch,
    );
    expect((await (await POST(post(imageBody))).json()).error.code).toBe("invalid_key");

    gemini.setGeminiFetch(
      (async () =>
        new Response(
          JSON.stringify({
            steps: [
              { type: "model_output", content: [{ type: "text", text: "I can't make that." }] },
            ],
          }),
        )) as unknown as typeof fetch,
    );
    const blocked = await POST(post(imageBody));
    expect(blocked.status).toBe(422);
    expect((await blocked.json()).error.code).toBe("refused");
  });
});

describe("plan sanitising", () => {
  it("keeps fonts/colours valid and always forbids text in the artwork", async () => {
    const { sanitizePlan } = await import("@/lib/ai/server/premium-finish");
    const plan = sanitizePlan({
      concept: "Epic arena",
      title: "HUNGER GAMES",
      subtitle: "",
      extras: ["HARDCORE", "", "EP 1", "x", "y"],
      artPrompt: "A blocky forest arena with three heroes.",
      textArea: "top",
      palette: ["#ff0000", "nope", "00FF00"],
      headingFont: "Comic Sans MS",
      bodyFont: "poppins",
    });
    expect(plan.artPrompt).toMatch(/No text, letters, numbers, logos/);
    expect(plan.extras).toEqual(["HARDCORE", "EP 1", "x"]);
    expect(plan.palette).toEqual(["#FF0000", "#00FF00"]);
    expect(plan.headingFont).toBe("Luckiest Guy");
    expect(plan.bodyFont).toBe("Poppins");
  });
});
