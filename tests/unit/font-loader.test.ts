import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFont } from "@/lib/fonts/loader";

afterEach(() => {
  document.head.querySelectorAll("link[data-test-font]").forEach((l) => l.remove());
});

describe("loadFont", () => {
  it("loads the Latin and Arabic parts of a family", async () => {
    const load = vi.fn(async () => [{}] as unknown as FontFace[]);
    Object.defineProperty(document, "fonts", { value: { load }, configurable: true });
    // The stylesheet <link> never fires load in jsdom; fake it.
    const append = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      queueMicrotask(() => (node as HTMLLinkElement).onload?.(new Event("load")));
      return node;
    });
    await expect(loadFont("Cairo", 800)).resolves.toBe(true);
    expect(append).toHaveBeenCalled();
    const [font, text] = load.mock.calls[0] as unknown as [string, string];
    expect(font).toBe('800 32px "Cairo"');
    expect(text).toMatch(/[A-Za-z]/);
    expect(text).toMatch(/[؀-ۿ]/);
  });
});
