import "server-only";
/**
 * Account emails in English and Arabic: a plain-text part and an HTML part
 * built with tables and inline styles, so it looks the same in Gmail, Apple
 * Mail and Outlook. The logo travels with the email as an inline image
 * (cid:), so it shows without loading anything from the site. The words
 * live in messages/*.json under "email".
 */
import { createTranslator } from "next-intl";
import { getDirection, isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "@/i18n/config";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { EMAIL_LOGO_PNG_BASE64 } from "./logo.generated";

const MESSAGES = { en, ar } as const;

export type EmailKind = "verify" | "reset" | "welcome" | "passwordChanged" | "test";

export interface EmailData {
  name?: string | null;
  /** The button's link. */
  url?: string;
  /** The site's home page (footer link). */
  siteUrl?: string;
  /** The account's address (security emails). */
  email?: string;
  /** When it happened (security emails). */
  when?: Date;
}

export interface EmailAttachment {
  filename: string;
  /** Base64 file content. */
  content: string;
  /** Referenced from the HTML as cid:<contentId>. */
  contentId: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

export const LOGO_CID = "lumora-logo";

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

// Brand colours (see globals.css): the "strong" pair keeps white text readable.
const C = {
  page: "#F4F1EC",
  card: "#FFFFFF",
  border: "#ECE6DE",
  ink: "#0B0B12",
  body: "#3E3B4A",
  muted: "#8A8693",
  soft: "#F8F6F3",
  accent: "#D4145A",
  accentSoft: "#FFF0F4",
  brandFrom: "#FF7A3D",
  brandVia: "#FB4D6D",
  brandTo: "#F72585",
  buttonFrom: "#C2410C",
  buttonTo: "#D4145A",
};

/** Words for one kind of email (missing parts are null). */
function words(kind: EmailKind, locale: Locale, data: EmailData) {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "email" });
  const name = (data.name ?? "").trim().slice(0, 80);
  const common = {
    greeting: name ? t("hello", { name }) : t("helloThere"),
    linkHint: t("linkHint"),
    signature: t("signature"),
    footerWhy: t("footerWhy"),
    footerTagline: t("footerTagline"),
    openSite: t("openSite"),
  };
  switch (kind) {
    case "verify":
      return {
        ...common,
        subject: t("verify.subject"),
        preheader: t("verify.preheader"),
        eyebrow: t("verify.eyebrow"),
        title: t("verify.title"),
        body: t("verify.body"),
        action: t("verify.action"),
        note: t("verify.note"),
        features: null,
        details: null,
      };
    case "reset":
      return {
        ...common,
        subject: t("reset.subject"),
        preheader: t("reset.preheader"),
        eyebrow: t("reset.eyebrow"),
        title: t("reset.title"),
        body: t("reset.body"),
        action: t("reset.action"),
        note: t("reset.note"),
        features: null,
        details: null,
      };
    case "welcome":
      return {
        ...common,
        subject: t("welcome.subject"),
        preheader: t("welcome.preheader"),
        eyebrow: t("welcome.eyebrow"),
        title: t("welcome.title"),
        body: t("welcome.body"),
        action: t("welcome.action"),
        note: null,
        features: (["templates", "ai", "photos"] as const).map((f) => ({
          title: t(`welcome.features.${f}.title`),
          body: t(`welcome.features.${f}.body`),
        })),
        details: null,
      };
    case "passwordChanged": {
      const when = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(data.when ?? new Date());
      return {
        ...common,
        subject: t("passwordChanged.subject"),
        preheader: t("passwordChanged.preheader"),
        eyebrow: t("passwordChanged.eyebrow"),
        title: t("passwordChanged.title"),
        body: t("passwordChanged.body"),
        action: t("passwordChanged.action"),
        note: t("passwordChanged.note"),
        features: null,
        details: [
          ...(data.email ? [[t("passwordChanged.account"), data.email] as const] : []),
          [t("passwordChanged.when"), `${when} UTC`] as const,
        ],
      };
    }
    case "test":
      return {
        ...common,
        subject: t("test.subject"),
        preheader: t("test.preheader"),
        eyebrow: t("test.eyebrow"),
        title: t("test.title"),
        body: t("test.body"),
        action: null,
        note: null,
        features: null,
        details: null,
      };
  }
}

export function renderEmail(kind: EmailKind, locale: Locale, data: EmailData = {}): RenderedEmail {
  const w = words(kind, locale, data);
  const url = data.url;
  const action = url ? w.action : null;

  // ─── Plain text ──────────────────────────────────────────────────────────
  const text = [
    w.title,
    "",
    w.greeting,
    "",
    w.body,
    ...(w.features ? ["", ...w.features.map((f) => `• ${f.title} — ${f.body}`)] : []),
    ...(w.details ? ["", ...w.details.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(action && url ? ["", `${action}:`, url] : []),
    ...(w.note ? ["", w.note] : []),
    "",
    w.signature,
    "",
    "—",
    w.footerWhy,
    ...(data.siteUrl ? [data.siteUrl] : []),
  ].join("\n");

  // ─── HTML ────────────────────────────────────────────────────────────────
  const dir = getDirection(locale);
  const rtl = dir === "rtl";
  const start = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  const font = rtl
    ? "'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif"
    : "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const e = escapeHtml;
  // Arabic has no capitals, and spacing letters apart breaks its joins.
  const eyebrowStyle = rtl
    ? "font-size:13px;font-weight:700"
    : "font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase";

  const p = (content: string, style: string) =>
    `<p style="margin:0;font-family:${font};${style}">${content}</p>`;

  const features = w.features
    ? `<tr><td style="padding:4px 0 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${w.features
  .map(
    (f, i) => `<tr>
<td width="40" valign="top" style="padding:0 0 18px"><div style="width:32px;height:32px;border-radius:10px;background:${C.accentSoft};color:${C.accent};font-family:${font};font-size:14px;font-weight:700;line-height:32px;text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:0 0 18px;padding-${start}:12px">${p(e(f.title), `font-size:15px;line-height:1.4;font-weight:700;color:${C.ink}`)}${p(e(f.body), `font-size:14px;line-height:1.55;color:${C.body};padding-top:2px`)}</td>
</tr>`,
  )
  .join("\n")}
</table></td></tr>`
    : "";

  const details = w.details
    ? `<tr><td style="padding:4px 0 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.soft};border-radius:14px">
<tr><td style="padding:14px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${w.details
  .map(
    ([k, v]) => `<tr>
<td style="padding:6px 0;font-family:${font};font-size:13px;color:${C.muted};text-align:${start}">${e(k)}</td>
<td style="padding:6px 0;font-family:${font};font-size:14px;font-weight:600;color:${C.ink};text-align:${end}" dir="auto">${e(v)}</td>
</tr>`,
  )
  .join("\n")}
</table></td></tr></table></td></tr>`
    : "";

  const button =
    action && url
      ? `<tr><td style="padding:4px 0 28px" align="${start}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${C.buttonTo}" style="border-radius:12px;background:${C.buttonTo};background-image:linear-gradient(135deg,${C.buttonFrom},${C.buttonTo})">
<a href="${e(url)}" target="_blank" style="display:inline-block;padding:15px 32px;font-family:${font};font-size:16px;font-weight:600;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:12px">${e(action)}</a>
</td></tr></table></td></tr>`
      : "";

  const note = w.note
    ? `<tr><td style="padding:0 0 24px">${p(e(w.note), `font-size:14px;line-height:1.6;color:${C.muted}`)}</td></tr>`
    : "";

  const fallback =
    action && url
      ? `<tr><td style="padding:24px 0 0;border-top:1px solid ${C.border}">
${p(e(w.linkHint), `font-size:13px;line-height:1.5;color:${C.muted};padding-bottom:8px`)}
<div style="font-family:${font};font-size:13px;line-height:1.5;background:${C.soft};border-radius:10px;padding:12px 14px;word-break:break-all;text-align:left" dir="ltr"><a href="${e(url)}" target="_blank" style="color:${C.accent};text-decoration:none">${e(url)}</a></div>
</td></tr>`
      : "";

  const siteLink = data.siteUrl
    ? ` &middot; <a href="${e(data.siteUrl)}" target="_blank" style="color:${C.muted};text-decoration:underline">${e(w.openSite)}</a>`
    : "";

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(w.subject)}</title>
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:collapse}
img{border:0;outline:none;text-decoration:none}
@media (max-width:600px){.card{padding:32px 24px 28px !important}.title{font-size:24px !important}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${e(w.preheader)}${"&#8203;&zwnj;&nbsp;".repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}">
<tr><td align="center" style="padding:40px 16px 48px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="max-width:560px">
<tr><td align="center" style="padding:0 0 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="ltr"><tr>
<td style="padding-right:10px"><img src="cid:${LOGO_CID}" width="40" height="40" alt="" style="display:block;border-radius:11px"></td>
<td style="font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;letter-spacing:-0.01em;color:${C.ink}">Lumora Studio</td>
</tr></table>
</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="border-collapse:separate;background:${C.card};border:1px solid ${C.border};border-radius:24px;overflow:hidden">
<tr><td height="6" bgcolor="${C.brandTo}" style="height:6px;line-height:6px;font-size:0;border-radius:23px 23px 0 0;background:${C.brandTo};background-image:linear-gradient(90deg,${C.brandFrom},${C.brandVia},${C.brandTo})">&nbsp;</td></tr>
<tr><td class="card" style="padding:40px 44px 36px;text-align:${start}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 12px">${p(e(w.eyebrow), `${eyebrowStyle};color:${C.accent}`)}</td></tr>
<tr><td style="padding:0 0 18px"><h1 class="title" style="margin:0;font-family:${font};font-size:28px;line-height:1.25;font-weight:700;letter-spacing:${rtl ? "0" : "-0.02em"};color:${C.ink}">${e(w.title)}</h1></td></tr>
<tr><td style="padding:0 0 8px">${p(e(w.greeting), `font-size:16px;line-height:1.65;color:${C.ink};font-weight:600`)}</td></tr>
<tr><td style="padding:0 0 26px">${p(e(w.body), `font-size:16px;line-height:1.65;color:${C.body}`)}</td></tr>
${features}
${details}
${button}
${note}
${fallback}
<tr><td style="padding:24px 0 0">${p(e(w.signature), `font-size:14px;line-height:1.6;color:${C.body}`)}</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:28px 24px 0">${p(`${e(w.footerWhy)}<br>${e(w.footerTagline)}${siteLink}`, `font-size:12px;line-height:1.7;color:${C.muted};text-align:center`)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return {
    subject: w.subject,
    html,
    text,
    attachments: [
      { filename: "lumora-studio.png", content: EMAIL_LOGO_PNG_BASE64, contentId: LOGO_CID },
    ],
  };
}
