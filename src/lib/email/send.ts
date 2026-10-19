import "server-only";
/**
 * Sends account emails through Resend (https://resend.com). Without a
 * RESEND_API_KEY the email is not sent: in development it's printed in the
 * dev server's terminal instead (so sign-up works locally), in production a
 * warning is logged without the message (it contains one-time links).
 */
import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Short name for logs ("verify", "reset"…). Never the content. */
  kind: string;
}

/** Resend's shared test sender: works only for the address you signed up to Resend with. */
export const DEFAULT_FROM = "Lumora Studio <onboarding@resend.dev>";

export type EmailTransport = (message: EmailMessage) => Promise<{ sent: boolean }>;

let override: EmailTransport | null = null;
/** Test helper: capture emails instead of sending them. */
export function setEmailTransport(next: EmailTransport | null) {
  override = next;
}

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailError";
  }
}

export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean }> {
  if (override) return override(message);
  const env = getServerEnv();
  if (!env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- local stand-in for the inbox
      console.info(
        `\n[email] Not sent (no RESEND_API_KEY) — ${message.kind} email to ${message.to}\n` +
          `Subject: ${message.subject}\n\n${message.text}\n`,
      );
    } else {
      console.warn(`[email] Not sent: RESEND_API_KEY is not set (${message.kind} email).`);
    }
    return { sent: false };
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM ?? DEFAULT_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) {
    // The error name/code only — never the key or the email body.
    console.error(`[email] Resend refused the ${message.kind} email: ${error.name}`);
    throw new EmailError(error.message);
  }
  return { sent: true };
}
