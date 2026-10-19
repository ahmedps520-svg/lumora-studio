import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/test-google-key/route";
import { setGeminiFetch } from "@/lib/ai/server/gemini";

const KEY = "fake-google-key-for-tests-0000000000000";

const call = (headers: Record<string, string>) =>
  POST(
    new Request("http://localhost:3000/api/ai/test-google-key", {
      method: "POST",
      headers: { host: "localhost:3000", ...headers },
    }),
  );

afterEach(() => setGeminiFetch(null));

describe("Google AI key test", () => {
  it("checks the key with a free model listing, sent only in a header", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    setGeminiFetch(fetchMock as unknown as typeof fetch);
    const res = await call({ "x-lumora-google-key": KEY, "x-forwarded-for": "10.0.0.1" });
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1beta/models");
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
  });

  it("says when Google refuses the key", async () => {
    setGeminiFetch((async () => new Response("{}", { status: 400 })) as typeof fetch);
    const res = await call({ "x-lumora-google-key": KEY, "x-forwarded-for": "10.0.0.2" });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("invalid_key");
  });

  it("needs a key and a same-site caller", async () => {
    const fetchMock = vi.fn();
    setGeminiFetch(fetchMock as unknown as typeof fetch);
    expect((await call({ "x-forwarded-for": "10.0.0.3" })).status).toBeGreaterThanOrEqual(400);
    const cross = await call({
      "x-lumora-google-key": KEY,
      origin: "https://evil.example",
      "x-forwarded-for": "10.0.0.4",
    });
    expect(cross.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
