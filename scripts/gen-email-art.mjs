/**
 * Writes src/lib/email/art.generated.ts: the header picture of each account
 * email — Lumora's light (a warm dawn rising over the canvas dot grid, soft
 * rays and sparks) around a glass badge with the email's icon. Email clients
 * can't draw glows, so the light travels as an inline JPEG.
 *   node scripts/gen-email-art.mjs
 */
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as lucide from "lucide-react";
import sharp from "sharp";

const W = 1120;
const H = 360;

/** The icon of each kind of email. */
const ICONS = {
  verify: "MailCheck",
  welcome: "Sparkles",
  reset: "KeyRound",
  passwordChanged: "ShieldCheck",
  signIn: "MonitorSmartphone",
  test: "Send",
};

/** The inside of a Lucide icon (24 × 24, white strokes). */
function iconPaths(name) {
  const svg = renderToStaticMarkup(
    createElement(lucide[name], { color: "#FFFFFF", strokeWidth: 1.6, size: 24 }),
  );
  return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

/** A four-point spark (the one in the logo), centred on (x, y). */
function spark(x, y, r, opacity) {
  const k = r * 0.22;
  return `<path d="M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z" fill="url(#spark)" opacity="${opacity}" filter="url(#soft)"/>`;
}

/** Thin rays fanning up from below the badge. */
function rays() {
  const cx = W / 2;
  const cy = H + 120;
  const len = 900;
  let out = "";
  for (let a = -84; a <= 84; a += 7) {
    const t1 = ((a - 0.6) * Math.PI) / 180;
    const t2 = ((a + 0.6) * Math.PI) / 180;
    const p = (t) => `${cx + Math.sin(t) * len},${cy - Math.cos(t) * len}`;
    out += `<polygon points="${cx},${cy} ${p(t1)} ${p(t2)}"/>`;
  }
  return out;
}

function art(icon) {
  const bx = W / 2;
  const by = 168;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0C0A13"/><stop offset="1" stop-color="#1A1024"/>
  </linearGradient>
  <radialGradient id="dawn" gradientUnits="userSpaceOnUse" cx="${W / 2}" cy="${H + 40}" r="560"
    gradientTransform="translate(${W / 2} ${H + 40}) scale(1 0.62) translate(${-W / 2} ${-(H + 40)})">
    <stop offset="0" stop-color="#FF7A3D" stop-opacity="0.95"/>
    <stop offset="0.32" stop-color="#F72585" stop-opacity="0.72"/>
    <stop offset="0.62" stop-color="#7C6CF2" stop-opacity="0.32"/>
    <stop offset="1" stop-color="#7C6CF2" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="dotsFade" cx="0.5" cy="0.45" r="0.6">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#000000"/>
  </radialGradient>
  <mask id="dotsMask"><rect width="${W}" height="${H}" fill="url(#dotsFade)"/></mask>
  <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r="1.5" fill="#FFFFFF" fill-opacity="0.13"/>
  </pattern>
  <linearGradient id="raysFade" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.85" stop-color="#000000"/>
  </linearGradient>
  <mask id="raysMask"><rect width="${W}" height="${H}" fill="url(#raysFade)"/></mask>
  <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.06"/>
  </linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.7"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.12"/>
    <stop offset="1" stop-color="#FFB088" stop-opacity="0.55"/>
  </linearGradient>
  <linearGradient id="spark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFD2B8"/><stop offset="0.5" stop-color="#FF7A3D"/><stop offset="1" stop-color="#F72585"/>
  </linearGradient>
  <filter id="halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26"/></filter>
  <filter id="soft" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="2.2" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#dotsMask)"/>
<g fill="#FFB088" fill-opacity="0.09" mask="url(#raysMask)">${rays()}</g>
<rect width="${W}" height="${H}" fill="url(#dawn)"/>
<circle cx="${bx}" cy="${by}" r="80" fill="#F72585" fill-opacity="0.55" filter="url(#halo)"/>
<circle cx="${bx}" cy="${by}" r="66" fill="url(#glass)" stroke="url(#rim)" stroke-width="2.5"/>
<g transform="translate(${bx - 36} ${by - 36}) scale(3)" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconPaths(icon)}</g>
${spark(bx + 92, by - 58, 13, 1)}
${spark(bx - 128, by - 34, 8, 0.85)}
${spark(bx + 168, by + 22, 6, 0.7)}
${spark(bx - 196, by + 48, 5, 0.55)}
</svg>`;
}

const out = {};
let total = 0;
for (const [kind, icon] of Object.entries(ICONS)) {
  const jpg = await sharp(Buffer.from(art(icon)))
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
  out[kind] = jpg.toString("base64");
  total += jpg.length;
  if (process.argv.includes("--preview")) writeFileSync(`.lumora-cache/email-art-${kind}.jpg`, jpg);
}
writeFileSync(
  "src/lib/email/art.generated.ts",
  `/* Generated by scripts/gen-email-art.mjs. Do not edit. */\n` +
    `/** The header picture of each account email (JPEG, base64, ${W} × ${H}). */\n` +
    `export const EMAIL_ART_JPG_BASE64 = ${JSON.stringify(out, null, 2)} as const;\n`,
);
// eslint-disable-next-line no-console -- command-line output
console.log(`Wrote ${Object.keys(out).length} email headers (${Math.round(total / 1024)} KB).`);
