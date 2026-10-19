import { beforeEach, describe, expect, it, vi } from "vitest";

const remover = vi.hoisted(() => ({
  enabled: true,
  remove: vi.fn(async () => ({ png: Buffer.from([137, 80, 78, 71]), device: "cpu" })),
}));

vi.mock("@/lib/background/server-remover", () => ({
  serverRemovalEnabled: () => remover.enabled,
  removerReady: () => true,
  getRemover: vi.fn(async () => remover.remove),
  removeBackgroundOnServer: remover.remove,
}));

const { GET, POST } = await import("@/app/api/image/remove-background/route");

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/image/remove-background", {
      method: "POST",
      body,
      headers: { host: "localhost", "content-type": "image/png", ...headers },
    }),
  );

describe("/api/image/remove-background", () => {
  beforeEach(() => {
    remover.enabled = true;
    remover.remove.mockClear();
  });

  it("reports availability", async () => {
    const res = await GET(new Request("http://localhost/api/image/remove-background"));
    expect(await res.json()).toEqual({ available: true, ready: true });
  });

  it("returns the cut-out as a PNG", async () => {
    const res = await post(new Uint8Array([1, 2, 3]));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-lumora-device")).toBe("cpu");
    expect(remover.remove).toHaveBeenCalledOnce();
  });

  it("says 503 when the server can't run the model (the browser takes over)", async () => {
    remover.enabled = false;
    expect((await post(new Uint8Array([1]))).status).toBe(503);
  });

  it("rejects other sites, non-images and empty bodies", async () => {
    expect((await post(new Uint8Array([1]), { origin: "https://evil.example" })).status).toBe(403);
    expect((await post("hello", { "content-type": "text/plain" })).status).toBe(415);
    expect((await post(new Uint8Array([]))).status).toBe(413);
    expect(remover.remove).not.toHaveBeenCalled();
  });
});
