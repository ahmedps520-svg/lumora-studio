import { headers } from "next/headers";
import { allowRequest, clientKey } from "@/lib/ai/server/limits";
import { getAuth } from "@/lib/auth/server";
import { EmailError, sendEmail } from "@/lib/email/send";
import { emailLocale, renderEmail } from "@/lib/email/templates";

export const runtime = "nodejs";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Sends a test email to the signed-in user's own (confirmed) address, so the
 * owner can check that Resend is set up. Never to any other address.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return json({ error: "cross_site" }, 403);
  if (!allowRequest(`email-test:${clientKey(request.headers)}`, 3)) {
    return json({ error: "rate_limited" }, 429);
  }
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) return json({ error: "sign_in" }, 401);
  const { subject, html, text } = renderEmail("test", emailLocale(request), {
    name: session.user.name,
  });
  try {
    const { sent } = await sendEmail({ to: session.user.email, subject, html, text, kind: "test" });
    return json({ sent });
  } catch (error) {
    return json({ error: error instanceof EmailError ? "refused" : "failed" }, 502);
  }
}
