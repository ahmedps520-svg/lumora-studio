import { renderEmail, type EmailKind } from "@/lib/email/templates";

export const runtime = "nodejs";

const KINDS: EmailKind[] = ["verify", "welcome", "reset", "passwordChanged", "signIn", "test"];

/**
 * Development only: shows each account email as it will arrive, with sample
 * data — /api/email/preview lists them. Nothing is sent. 404 in production.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as EmailKind | null;
  const locale = url.searchParams.get("lang") === "ar" ? "ar" : "en";
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

  if (!kind || !KINDS.includes(kind)) {
    const links = KINDS.flatMap((k) =>
      (["en", "ar"] as const).map((l) => `<li><a href="?kind=${k}&lang=${l}">${k} (${l})</a></li>`),
    ).join("");
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font-family:system-ui;padding:24px"><h1>Account emails</h1><ul>${links}</ul></body>`,
      { headers },
    );
  }

  const sample = renderEmail(kind, locale, {
    name: locale === "ar" ? "دينا" : "Dina",
    url: `${url.origin}/api/auth/verify-email?token=sample-token&callbackURL=%2Faccount`,
    siteUrl: url.origin,
    email: "dina@example.com",
    when: new Date(),
    userAgent: request.headers.get("user-agent"),
  });
  // Inline images as data: URLs, since a browser can't read cid: links.
  let html = sample.html;
  for (const a of sample.attachments)
    html = html.replaceAll(
      `cid:${a.contentId}`,
      `data:image/${a.filename.endsWith(".jpg") ? "jpeg" : "png"};base64,${a.content}`,
    );
  return new Response(html, { headers });
}
