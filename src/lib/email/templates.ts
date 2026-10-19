import "server-only";
/**
 * Account emails in English and Arabic: a plain-text part and a simple HTML
 * part that renders well in every mail app (tables, inline styles, no images).
 * The words live in messages/*.json under "email".
 */
import { createTranslator } from "next-intl";
import { getDirection, isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "@/i18n/config";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";

const MESSAGES = { en, ar } as const;

export type EmailKind = "verify" | "reset" | "welcome" | "test";

/** Button label and small print, for the kinds that have them. */
const ACTIONS = {
  verify: "verify.action",
  reset: "reset.action",
  welcome: "welcome.action",
} as const;
const NOTES = { verify: "verify.note", reset: "reset.note" } as const;

/** The language to write in: the site language cookie, else the browser's language. */
export function emailLocale(request?: Request | null): Locale {
  const cookie = request?.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`).exec(cookie)?.[1];
  if (isLocale(match)) return match;
  return negotiateLocale(request?.headers.get("accept-language"));
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export function renderEmail(
  kind: EmailKind,
  locale: Locale,
  data: { name?: string; url?: string },
): { subject: string; html: string; text: string } {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "email" });
  const name = (data.name ?? "").trim().slice(0, 80);
  const greeting = name ? t("hello", { name }) : t("helloThere");
  const subject = t(`${kind}.subject`);
  const lines = [t(`${kind}.body`)];
  const actionKey = kind in ACTIONS ? ACTIONS[kind as keyof typeof ACTIONS] : null;
  const action = data.url && actionKey ? t(actionKey) : null;
  const noteKey = kind in NOTES ? NOTES[kind as keyof typeof NOTES] : null;
  const note = noteKey ? t(noteKey) : null;

  const text = [
    greeting,
    "",
    ...lines,
    ...(data.url && action ? ["", `${action}: ${data.url}`] : []),
    ...(note ? ["", note] : []),
    "",
    t("signature"),
  ].join("\n");

  const dir = getDirection(locale);
  const align = dir === "rtl" ? "right" : "left";
  const font =
    locale === "ar"
      ? "'IBM Plex Sans Arabic', Tahoma, Arial, sans-serif"
      : "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
  const button =
    data.url && action
      ? `<tr><td style="padding:8px 0 24px"><a href="${escapeHtml(data.url)}" style="display:inline-block;background:#6D4AFF;background-image:linear-gradient(135deg,#FF5E8A,#6D4AFF);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px">${escapeHtml(action)}</a></td></tr>
<tr><td style="font-size:12px;color:#6B6880;padding-bottom:16px">${escapeHtml(t("linkHint"))}<br><a href="${escapeHtml(data.url)}" style="color:#6D4AFF;word-break:break-all">${escapeHtml(data.url)}</a></td></tr>`
      : "";
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F2FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2FA;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px;font-family:${font};color:#17142B;text-align:${align}">
<tr><td style="font-size:20px;font-weight:700;padding-bottom:20px"><span style="color:#6D4AFF">&#9670;</span> Lumora Studio</td></tr>
<tr><td style="font-size:16px;font-weight:600;padding-bottom:12px">${escapeHtml(greeting)}</td></tr>
${lines.map((l) => `<tr><td style="font-size:15px;line-height:1.6;padding-bottom:16px">${escapeHtml(l)}</td></tr>`).join("\n")}
${button}
${note ? `<tr><td style="font-size:13px;line-height:1.5;color:#6B6880;padding-bottom:16px">${escapeHtml(note)}</td></tr>` : ""}
<tr><td style="font-size:13px;color:#6B6880;border-top:1px solid #ECE9F5;padding-top:16px">${escapeHtml(t("signature"))}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, html, text };
}
