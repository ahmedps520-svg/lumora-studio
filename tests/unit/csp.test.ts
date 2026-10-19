import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@/lib/security/csp";

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));

describe("buildCsp", () => {
  it("locks scripts to the nonce in production", () => {
    const csp = buildCsp({ nonce: "abc123", isDev: false, https: true });
    const scripts = directive(csp, "script-src");
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).not.toContain("'unsafe-inline'");
  });

  it("allows eval only in development", () => {
    const csp = buildCsp({ nonce: "n", isDev: true, https: false });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
  });

  it("blocks plugins, framing and foreign form posts", () => {
    const csp = buildCsp({ nonce: "n", isDev: false, https: true });
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
  });

  it("only upgrades insecure requests when served over https", () => {
    expect(buildCsp({ nonce: "n", isDev: false, https: true })).toContain(
      "upgrade-insecure-requests",
    );
    expect(buildCsp({ nonce: "n", isDev: false, https: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("createNonce", () => {
  it("produces unique base64 values", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(atob(a)).toHaveLength(16);
  });
});
