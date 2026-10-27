import "server-only";
/**
 * Account emails in English and Arabic: a plain-text part and an HTML part
 * built with tables and inline styles, so it looks the same in Gmail, Apple
 * Mail and Outlook. The logo and a header picture (Lumora's light around the
 * email's icon — email clients can't draw glows) travel with the email as
 * inline images (cid:), so they show without loading anything from the site.
 * The words live in messages/*.json under "email".
 */
import { createTranslator } from "next-intl";
import { getDirection, isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "@/i18n/config";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { EMAIL_ART_JPG_BASE64 } from "./art.generated";
import { describeDevice } from "./device";
import { EMAIL_LOGO_PNG_BASE64 } from "./logo.generated";

const MESSAGES = { en, ar } as const;

export type EmailKind = "verify" | "reset" | "welcome" | "passwordChanged" | "signIn" | "test";

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
  /** The browser's User-Agent (sign-in emails name the device). */
  userAgent?: string | null;
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
export const ART_CID = "lumora-art";

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
  night: "#140E1E",
  accent: "#D4145A",
  accentSoft: "#FFF0F4",
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
  const when = () =>
    `${new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(data.when ?? new Date())} UTC`;
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
    case "passwordChanged":
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
          [t("passwordChanged.when"), when()] as const,
        ],
      };
    case "signIn": {
      const device = describeDevice(data.userAgent);
      const deviceName = !device
        ? t("signIn.unknownDevice")
        : device.browser && device.os
          ? t("signIn.deviceOn", { browser: device.browser, os: device.os })
          : (device.browser ?? device.os)!;
      return {
        ...common,
        subject: t("signIn.subject"),
        preheader: t("signIn.preheader"),
        eyebrow: t("signIn.eyebrow"),
        title: t("signIn.title"),
        body: t("signIn.body"),
        action: t("signIn.action"),
        note: t("signIn.note"),
        features: null,
        details: [
          ...(data.email ? [[t("signIn.account"), data.email] as const] : []),
          [t("signIn.when"), when()] as const,
          [t("signIn.device"), deviceName] as const,
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
    : "font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase";

  const p = (content: string, style: string) =>
    `<p style="margin:0;font-family:${font};${style}">${content}</p>`;

  const features = w.features
    ? `<tr><td style="padding:2px 0 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${w.features
  .map(
    (f, i) => `<tr>
<td width="44" valign="top" style="padding:0 0 18px"><div style="width:34px;height:34px;border-radius:999px;background:${C.accentSoft};color:${C.accent};font-family:${font};font-size:14px;font-weight:700;line-height:34px;text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:0 0 18px;padding-${start}:10px">${p(e(f.title), `font-size:15px;line-height:1.4;font-weight:700;color:${C.ink};padding-top:1px`)}${p(e(f.body), `font-size:14px;line-height:1.6;color:${C.body};padding-top:3px`)}</td>
</tr>`,
  )
  .join("\n")}
</table></td></tr>`
    : "";

  const details = w.details
    ? `<tr><td style="padding:2px 0 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${C.soft};border:1px solid ${C.border};border-radius:16px">
<tr><td style="padding:8px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${w.details
  .map(
    ([k, v], i) => `<tr>
<td style="padding:11px 0;${i ? `border-top:1px solid ${C.border};` : ""}font-family:${font};font-size:13px;color:${C.muted};text-align:${start}">${e(k)}</td>
<td style="padding:11px 0;${i ? `border-top:1px solid ${C.border};` : ""}padding-${start}:16px;font-family:${font};font-size:14px;font-weight:600;color:${C.ink};text-align:${end}" dir="auto">${e(v)}</td>
</tr>`,
  )
  .join("\n")}
</table></td></tr></table></td></tr>`
    : "";

  const button =
    action && url
      ? `<tr><td style="padding:4px 0 28px" align="${start}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${C.buttonTo}" style="border-radius:999px;background:${C.buttonTo};background-image:linear-gradient(135deg,${C.buttonFrom},${C.buttonTo});box-shadow:0 10px 24px -10px rgba(212,20,90,0.6)">
<a href="${e(url)}" target="_blank" style="display:inline-block;padding:16px 34px;font-family:${font};font-size:16px;font-weight:700;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:999px">${e(action)}</a>
</td></tr></table></td></tr>`
      : "";

  const note = w.note
    ? `<tr><td style="padding:0 0 24px">${p(e(w.note), `font-size:14px;line-height:1.65;color:${C.muted}`)}</td></tr>`
    : "";

  const fallback =
    action && url
      ? `<tr><td style="padding:22px 0 0;border-top:1px solid ${C.border}">
${p(e(w.linkHint), `font-size:13px;line-height:1.5;color:${C.muted};padding-bottom:8px`)}
<div style="font-family:${font};font-size:13px;line-height:1.5;background:${C.soft};border-radius:12px;padding:12px 14px;word-break:break-all;text-align:left" dir="ltr"><a href="${e(url)}" target="_blank" style="color:${C.accent};text-decoration:none">${e(url)}</a></div>
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
@media (max-width:600px){.card{padding:30px 22px 28px !important}.title{font-size:25px !important}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${e(w.preheader)}${"&#8203;&zwnj;&nbsp;".repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}">
<tr><td align="center" style="padding:36px 14px 48px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="max-width:560px">
<tr><td align="center" style="padding:0 0 22px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="ltr"><tr>
<td style="padding-right:10px"><img src="cid:${LOGO_CID}" width="36" height="36" alt="" style="display:block;border-radius:10px"></td>
<td style="font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${C.ink}">Lumora <span style="font-weight:400;color:${C.muted}">Studio</span></td>
</tr></table>
</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="border-collapse:separate;background:${C.card};border:1px solid ${C.border};border-radius:24px;overflow:hidden;box-shadow:0 24px 48px -28px rgba(40,20,60,0.35)">
<tr><td bgcolor="${C.night}" style="padding:0;line-height:0;font-size:0;background:${C.night};border-radius:23px 23px 0 0"><img src="cid:${ART_CID}" width="560" height="180" alt="" style="display:block;width:100%;max-width:560px;height:auto;border-radius:23px 23px 0 0"></td></tr>
<tr><td class="card" style="padding:36px 44px 34px;text-align:${start}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 12px">${p(`<span style="color:#FF7A3D">&#10022;</span>&nbsp; ${e(w.eyebrow)}`, `${eyebrowStyle};color:${C.accent}`)}</td></tr>
<tr><td style="padding:0 0 18px"><h1 class="title" style="margin:0;font-family:${font};font-size:30px;line-height:1.2;font-weight:700;letter-spacing:${rtl ? "0" : "-0.025em"};color:${C.ink}">${e(w.title)}</h1></td></tr>
<tr><td style="padding:0 0 8px">${p(e(w.greeting), `font-size:16px;line-height:1.65;color:${C.ink};font-weight:600`)}</td></tr>
<tr><td style="padding:0 0 26px">${p(e(w.body), `font-size:16px;line-height:1.7;color:${C.body}`)}</td></tr>
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
<tr><td align="center" style="padding:28px 24px 0">${p(`${e(w.footerWhy)}<br><span style="color:#FF7A3D">&#10022;</span> ${e(w.footerTagline)}${siteLink}`, `font-size:12px;line-height:1.8;color:${C.muted};text-align:center`)}</td></tr>
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
      { filename: "lumora-light.jpg", content: EMAIL_ART_JPG_BASE64[kind], contentId: ART_CID },
    ],
  };
}
