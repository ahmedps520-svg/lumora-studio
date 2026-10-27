// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

// A throwaway in-memory database and a fixed site address, before any module reads the env.
vi.hoisted(() => {
  process.env.AUTH_DATABASE_PATH = ":memory:";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
});

const { getAuth } = await import("@/lib/auth/server");
const { setEmailTransport } = await import("@/lib/email/send");
const { emailLocale, renderEmail } = await import("@/lib/email/templates");
type EmailMessage = Parameters<Parameters<typeof setEmailTransport>[0] & object>[0];

const inbox: EmailMessage[] = [];
const lastLink = (kind: string) => {
  const mail = inbox.filter((m) => m.kind === kind).at(-1);
  const url = mail?.text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error(`No ${kind} link`);
  return url;
};

beforeAll(() => {
  setEmailTransport(async (message) => {
    inbox.push(message);
    return { sent: true };
  });
});

const signIn = async (email: string, password: string) => {
  const auth = await getAuth();
  return auth.api.signInEmail({ body: { email, password }, asResponse: true });
};

describe("accounts", () => {
  const email = "dina@example.com";
  const password = "a long pass phrase";

  it("signs up and sends a confirmation email in the visitor's language", async () => {
    const auth = await getAuth();
    // Through the HTTP handler, as the browser does (the email language comes from the request).
    const res = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "accept-language": "ar,en;q=0.5",
        },
        body: JSON.stringify({ name: "Dina", email, password }),
      }),
    );
    expect(res.status).toBe(200);
    const mail = inbox.find((m) => m.kind === "verify")!;
    expect(mail.to).toBe(email);
    expect(mail.subject).toContain("أكّد");
    expect(mail.html).toContain('dir="rtl"');
    expect(lastLink("verify")).toMatch(/^http:\/\/localhost:3000\/api\/auth\/verify-email\?token=/);
  });

  it("refuses to log in before the email is confirmed", async () => {
    const res = await signIn(email, password);
    expect(res.status).toBe(403);
  });

  it("confirms the email, sends a welcome email, then logs in", async () => {
    const auth = await getAuth();
    const res = await auth.handler(new Request(lastLink("verify")));
    expect(res.status).toBeLessThan(400);
    expect(inbox.some((m) => m.kind === "welcome")).toBe(true);
    expect((await signIn(email, password)).status).toBe(200);
    expect((await signIn(email, "wrong password")).status).toBe(401);
  });

  it("resets a forgotten password with the emailed link", async () => {
    const auth = await getAuth();
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
    const link = new URL(lastLink("reset"));
    const token = link.pathname.split("/").at(-1)!;
    await auth.api.resetPassword({ body: { newPassword: "a brand new phrase", token } });
    expect((await signIn(email, "a brand new phrase")).status).toBe(200);
    expect((await signIn(email, password)).status).toBe(401);
    // …and confirms the change by email, with a way back in if it wasn't them.
    const notice = inbox.filter((m) => m.kind === "passwordChanged").at(-1)!;
    expect(notice.to).toBe(email);
    expect(notice.text).toContain(email);
    expect(lastLink("passwordChanged")).toBe("http://localhost:3000/forgot-password");
  });

  it("emails a notice when the password is changed from the Account page", async () => {
    const auth = await getAuth();
    const login = await signIn(email, "a brand new phrase");
    const cookie = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const before = inbox.filter((m) => m.kind === "passwordChanged").length;
    const res = await auth.handler(
      new Request("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie,
        },
        body: JSON.stringify({
          currentPassword: "a brand new phrase",
          newPassword: "another fresh phrase",
          revokeOtherSessions: true,
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(inbox.filter((m) => m.kind === "passwordChanged").length).toBe(before + 1);

    // A wrong current password changes nothing and sends nothing.
    const wrong = await auth.handler(
      new Request("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie },
        body: JSON.stringify({ currentPassword: "nope nope nope", newPassword: "whatever123" }),
      }),
    );
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    expect(inbox.filter((m) => m.kind === "passwordChanged").length).toBe(before + 1);
  });

  it("doesn't reveal whether an address has an account", async () => {
    const auth = await getAuth();
    const before = inbox.length;
    const res = await auth.api.requestPasswordReset({
      body: { email: "nobody@example.com", redirectTo: "/reset-password" },
    });
    expect(res.status).toBe(true);
    expect(inbox.length).toBe(before);
  });
});

describe("account emails", () => {
  it("escape names and work without a link", () => {
    const { html, text } = renderEmail("test", "en", { name: "<b>Sam</b>" });
    expect(html).toContain("&lt;b&gt;Sam&lt;/b&gt;");
    expect(html).not.toContain("<b>Sam</b>");
    expect(text).toContain("Emails are working");
  });

  it("carry the logo inline and show the account details on security emails", () => {
    const mail = renderEmail("passwordChanged", "ar", {
      email: "dina@example.com",
      url: "https://lumora.example/forgot-password",
      when: new Date("2026-10-19T08:30:00Z"),
    });
    expect(mail.attachments[0]!.contentId).toBe("lumora-logo");
    expect(mail.html).toContain("cid:lumora-logo");
    expect(mail.html).toContain("dina@example.com");
    expect(mail.html).toContain('dir="rtl"');
    // Western digits, like the rest of the app.
    expect(mail.text).toMatch(/19 .*2026/);
    expect(mail.text).toContain("https://lumora.example/forgot-password");
  });

  it("list what's waiting in the welcome email", () => {
    const { text, html } = renderEmail("welcome", "en", { name: "Sam", url: "https://x.example" });
    expect(text).toContain("50,000+ templates");
    expect(html).toContain("Start designing");
  });

  it("pick the language from the site cookie first", () => {
    const req = (cookie: string, lang: string) =>
      new Request("http://x", { headers: { cookie, "accept-language": lang } });
    expect(emailLocale(req("lumora-locale=ar", "en"))).toBe("ar");
    expect(emailLocale(req("", "ar-EG"))).toBe("ar");
    expect(emailLocale(null)).toBe("en");
  });
});
