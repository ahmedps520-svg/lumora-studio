// @vitest-environment node
/**
 * Generative Fill route with a fake Google client — nothing is spent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GOOGLE_KEY = `AIza${"g".repeat(35)}`;
const PNG = `data:image/png;base64,${"iVBORw0KGgo".padEnd(200, "A")}`;
const RESULT = "QUJD".repeat(40);

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/ai/photo-fill", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: JSON.stringify(body),
  });
}

const body = { prompt: "a wooden bench", image: PNG, width: 800, height: 600 };

const okResponse = () =>
  new Response(
    JSON.stringify({
      steps: [
        {
          type: "model_output",
          content: [{ type: "image", data: RESULT, mime_type: "image/png" }],
        },
      ],
    }),
  );

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("photo fill request", () => {
  it("accepts a PNG/JPEG data URL and rejects anything else", async () => {
    const { PhotoFillRequestSchema } = await import("@/lib/ai/photo-fill");
    expect(PhotoFillRequestSchema.safeParse(body).success).toBe(true);
    expect(PhotoFillRequestSchema.safeParse({ ...body, prompt: undefined }).data?.prompt).toBe("");
    for (const image of [
      "https://example.com/a.png",
      "data:image/svg+xml;base64,AAAA",
      "data:image/png;base64,<script>",
    ])
      expect(PhotoFillRequestSchema.safeParse({ ...body, image }).success).toBe(false);
    expect(PhotoFillRequestSchema.safeParse({ ...body, width: 5000 }).success).toBe(false);
  });

  it("tells the model to fill only the magenta hole", async () => {
    const { buildFillPrompt } = await import("@/lib/ai/photo-fill");
    expect(buildFillPrompt("a red kite")).toContain(
      "Replace only the magenta area with: a red kite.",
    );
    expect(buildFillPrompt("  ")).toContain("naturally belongs there");
  });
});

describe("POST /api/ai/photo-fill", () => {
  it("sends the picture before the instructions and returns the result", async () => {
    vi.stubEnv("GEMINI_API_KEY", GOOGLE_KEY);
    const gemini = await import("@/lib/ai/server/gemini");
    const fetchMock = vi.fn(async () => okResponse());
    gemini.setGeminiFetch(fetchMock as unknown as typeof fetch);
    const { POST } = await import("@/app/api/ai/photo-fill/route");
    const res = await POST(post(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.image).toBe(`data:image/png;base64,${RESULT}`);
    expect(json.costUsd).toBeCloseTo(0.0336);

    const sent = JSON.parse(
      String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(sent.input[0]).toMatchObject({ type: "image", mime_type: "image/png" });
    expect(sent.input[0].data).toBe(PNG.split(",")[1]);
    expect(sent.input[1].type).toBe("text");
    expect(sent.input[1].text).toContain("a wooden bench");
    expect(sent).toMatchObject({
      store: false,
      response_format: { aspect_ratio: "4:3", image_size: "1K" },
    });
  });

  it("needs a key, refuses other sites, and checks what comes back", async () => {
    const gemini = await import("@/lib/ai/server/gemini");
    const { POST } = await import("@/app/api/ai/photo-fill/route");

    gemini.setGeminiFetch((async () => okResponse()) as unknown as typeof fetch);
    expect((await (await POST(post(body))).json()).error.code).toBe("no_key");

    const cross = await POST(
      post(body, { origin: "https://evil.example", "x-lumora-google-key": GOOGLE_KEY }),
    );
    expect(cross.status).toBe(403);

    gemini.setGeminiFetch(
      (async () =>
        new Response(
          JSON.stringify({ output_image: { data: "not base64!", mime_type: "image/png" } }),
        )) as unknown as typeof fetch,
    );
    const damaged = await POST(post(body, { "x-lumora-google-key": GOOGLE_KEY }));
    expect(damaged.status).toBe(502);
    expect((await damaged.json()).error.code).toBe("invalid_output");
  });
});
