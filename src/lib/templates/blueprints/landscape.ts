/**
 * Wide layouts: YouTube thumbnails, Facebook / LinkedIn / X posts and wide
 * banners. `u` is 1% of the height here.
 */
import { PATHS, type Kit } from "../kit";
import { detailLine, statOf } from "./shared";

const pillH = (size: number) => Math.round(size * 2.4);

/** Shared "title with a thick outline and 3D sides" for thumbnails. */
function punchTitle(
  k: Kit,
  text: string,
  x: number,
  y: number,
  w: number,
  maxH: number,
  max: number,
  color: string,
) {
  const { u, p } = k;
  const size = k.fitBox(text, { w, maxH, max, lines: 3 });
  const h = k.text(text, {
    x,
    y,
    w,
    size,
    font: "h",
    color,
    stroke: { color: p.dark ? "#000000" : p.ink, width: Math.max(2, size * 0.09) },
    extrude: {
      depth: Math.max(2, size * 0.12),
      color: p.dark ? "#000000" : k.alpha(p.ink, 0.9),
      angle: 100,
    },
    lh: 1.02,
  });
  return { size, h: h + 2 * u };
}

/** Bold thumbnail: punchy title left, a face/photo circle right. */
export function ytPunch(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  k.bgGradient([p.primary, p.secondary], 120);
  k.glow(W * 0.78, H * 0.5, 70 * u, p.accent, 0.5);
  k.dots(m, H - m - 10 * u, 8, 3, 4 * u, 0.6 * u, k.alpha("#FFFFFF", 0.35));
  const r = 40 * u;
  const cx = W - m - r + 4 * u;
  const cy = H / 2 + 4 * u;
  k.circle(cx + 3 * u, cy + 3 * u, r, { fill: k.alpha(p.ink, 0.35) });
  k.circle(cx, cy, r + 2.5 * u, { fill: p.accent });
  k.frame(cx - r, cy - r, 2 * r, 2 * r, { shape: "ellipse", color: p.bg2 });
  const textW = W - 2 * m - 2 * r - 6 * u;
  k.pill(c.kicker, m, m, {
    size: 4.2 * u,
    fill: p.accent,
    color: k.on(p.accent),
    upper: true,
    ls: 60,
    font: "h",
  });
  punchTitle(k, c.title, m, m + 16 * u, textW, H - m - 32 * u, 26 * u, "#FFFFFF");
  k.path(PATHS.burst, cx - r - 14 * u, cy - r - 4 * u, 24 * u, 24 * u, {
    fill: p.accent,
    rotation: -10,
  });
  k.icon(k.ic(), cx - r - 8 * u, cy - r + 2 * u, 12 * u, k.on(p.accent));
  k.shape("arrow", m + textW * 0.55, H - m - 14 * u, 22 * u, 13 * u, {
    fill: "#FFFFFF",
    rotation: -12,
    shadow: { color: k.alpha("#000000", 0.3), blur: 10, y: 4 },
  });
}

/** Photo on one half, words on a slanted colour panel on the other. */
export function ytSplit(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  k.bgSolid(p.bg);
  const photoW = W * 0.5;
  k.frame(0, 0, photoW + 10 * u, H, { color: p.bg2 });
  k.path("M18 0 L100 0 L100 100 L0 100 Z", photoW - 6 * u, 0, W - photoW + 6 * u, H, {
    fill: k.grad([p.primary, p.secondary], 160),
  });
  const on = k.on(p.primary);
  const x = photoW + 8 * u;
  const w = W - x - m;
  k.text(c.kicker, {
    x,
    y: m,
    w,
    size: 4 * u,
    color: on,
    weight: 800,
    ls: 120,
    upper: true,
    opacity: 0.9,
  });
  const subH = k.heightOf(c.subtitle, 5 * u, w);
  const t = punchTitle(
    k,
    c.title,
    x,
    m + 9 * u,
    w,
    H - 2 * m - 9 * u - subH - 6 * u,
    20 * u,
    "#FFFFFF",
  );
  k.text(c.subtitle, { x, y: m + 9 * u + t.h + 2 * u, w, size: 5 * u, color: on, weight: 700 });
  k.circle(photoW - 2 * u, H - m - 10 * u, 10 * u, {
    fill: p.accent,
    stroke: "#FFFFFF",
    sw: 1.2 * u,
  });
  k.icon(k.ic(), photoW - 8 * u, H - m - 16 * u, 12 * u, k.on(p.accent));
}

/** A giant number on the left ("5 tips", "24 hours"). */
export function ytNumber(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  const stat = statOf(k) ?? ["#1", ""];
  k.bgGradient([p.bg, p.bg2], 135);
  k.glow(W * 0.25, H * 0.5, 60 * u, p.primary, 0.45);
  const numW = W * 0.4;
  const size = Math.min(k.fit(stat[0], { w: numW, max: 80 * u, lines: 1 }), 78 * u);
  const ny = (H - size * 1.05) / 2 - 4 * u;
  k.text(stat[0], {
    x: m + 2 * u,
    y: ny + 2 * u,
    w: numW,
    size,
    font: "h",
    color: k.alpha(p.secondary, 0),
    stroke: { color: p.secondary, width: Math.max(2, 0.8 * u) },
    lh: 1,
    align: "center",
  });
  k.text(stat[0], {
    x: m,
    y: ny,
    w: numW,
    size,
    font: "h",
    color: p.primary,
    lh: 1,
    align: "center",
    shadow: { color: k.alpha(p.ink, 0.25), blur: 0, x: 1.2 * u, y: 1.2 * u },
  });
  k.text(stat[1], {
    x: m,
    y: ny + size * 1.02,
    w: numW,
    size: 7 * u,
    font: "h",
    align: "center",
    color: p.ink,
  });
  const x = m + numW + 6 * u;
  const w = W - x - m;
  k.text(c.kicker, {
    x,
    y: m + 4 * u,
    w,
    size: 4 * u,
    color: p.primary,
    weight: 800,
    upper: true,
    ls: 120,
  });
  const sub = c.subtitle;
  const subH = k.heightOf(sub, 5 * u, w);
  const size2 = k.fitBox(c.title, { w, maxH: H - 2 * m - 14 * u - subH, max: 18 * u, lines: 3 });
  const th = k.text(c.title, {
    x,
    y: m + 13 * u,
    w,
    size: size2,
    font: "h",
    color: p.ink,
    lh: 1.02,
  });
  k.rect(x, m + 15 * u + th, 18 * u, 1.6 * u, { fill: p.accent, r: 0.8 * u });
  k.text(sub, { x, y: m + 20 * u + th, w, size: 5 * u, color: p.soft, weight: 700 });
}

/** Two options face to face with a VS badge. */
export function ytVersus(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 5 * u;
  k.bgSolid(p.bg);
  const [left, right] = [c.items[0] ?? "A", c.items[1] ?? "B"];
  const fw = (W - 3 * m) / 2;
  const fy = m + 24 * u;
  const fh = H - fy - m;
  k.frame(m, fy, fw, fh, { r: 3 * u, color: p.primary, stroke: p.primary, sw: 1 * u });
  k.frame(2 * m + fw, fy, fw, fh, { r: 3 * u, color: p.secondary, stroke: p.secondary, sw: 1 * u });
  k.pill(left, m + 3 * u, H - m - 14 * u, {
    size: 4.6 * u,
    fill: p.primary,
    font: "h",
    upper: true,
  });
  k.pill(right, W - m - 3 * u, H - m - 14 * u, {
    size: 4.6 * u,
    fill: p.secondary,
    font: "h",
    upper: true,
    anchor: "end",
  });
  k.circle(W / 2, fy + fh / 2, 15 * u, {
    fill: p.accent,
    stroke: "#FFFFFF",
    sw: 1.4 * u,
    shadow: { color: k.alpha("#000000", 0.35), blur: 20, y: 6 },
  });
  k.text("VS", {
    x: W / 2 - 15 * u,
    y: fy + fh / 2 - 8.5 * u,
    w: 30 * u,
    size: 15 * u,
    font: "h",
    align: "center",
    color: k.on(p.accent),
    lh: 1.1,
  });
  punchTitle(
    k,
    c.title.replace(/\n/g, " "),
    m,
    m,
    W - 2 * m,
    20 * u,
    16 * u,
    p.dark ? "#FFFFFF" : p.primary,
  );
}

/** Centred title with glows — thumbnails, banners and announcements. */
export function wideCenter(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  k.bgGradient([p.bg, p.bg2], 160);
  k.glow(W * 0.12, H * 0.2, 50 * u, p.primary, 0.45);
  k.glow(W * 0.88, H * 0.85, 55 * u, p.secondary, 0.4);
  k.path(PATHS.sparkle, W * 0.12, H * 0.62, 8 * u, 8 * u, { fill: p.accent });
  k.path(PATHS.sparkle, W * 0.83, H * 0.16, 6 * u, 6 * u, { fill: p.primary });
  const w = W * 0.72;
  const x = (W - w) / 2;
  const subH = k.heightOf(c.subtitle, 5 * u, w);
  const ctaH = c.cta ? pillH(4.4 * u) + 5 * u : 0;
  const size = k.fitBox(c.title, {
    w,
    maxH: H - 2 * m - 22 * u - subH - ctaH,
    max: 22 * u,
    lines: 2,
  });
  const th = k.heightOf(c.title, size, w, "h");
  let y = (H - (22 * u + th + subH + ctaH + 4 * u)) / 2;
  k.circle(W / 2, y + 6 * u, 6 * u, { fill: p.primary });
  k.icon(k.ic(), W / 2 - 3.5 * u, y + 2.5 * u, 7 * u, k.on(p.primary));
  y += 15 * u;
  k.text(c.kicker, {
    x,
    y,
    w,
    size: 3.8 * u,
    align: "center",
    color: p.primary,
    weight: 800,
    ls: 200,
    upper: true,
  });
  y += 7 * u;
  k.text(c.title, { x, y, w, size, font: "h", align: "center", color: p.ink });
  y += th + 4 * u;
  k.text(c.subtitle, { x, y, w, size: 5 * u, align: "center", color: p.soft, weight: 600 });
  y += subH + 5 * u;
  if (c.cta) k.pill(c.cta, W / 2, y, { size: 4.4 * u, anchor: "center", fill: p.primary });
}

/** Words on the left, a rounded photo on the right — promos and posts. */
export function promoWide(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  k.bgSolid(p.bg);
  k.circle(W * 0.62, -10 * u, 40 * u, { fill: p.bg2 });
  const fw = W * 0.38;
  const fx = W - m - fw;
  k.rect(fx + 3 * u, m + 3 * u, fw, H - 2 * m, { fill: p.secondary, r: 4 * u });
  k.frame(fx, m, fw, H - 2 * m, { r: 4 * u, color: p.bg2 });
  k.circle(fx, m + 14 * u, 9 * u, { fill: p.primary, stroke: p.bg, sw: 1 * u });
  k.icon(k.ic(), fx - 5 * u, m + 9 * u, 10 * u, k.on(p.primary));
  const x = m;
  const w = fx - m - 14 * u;
  let y = m + 2 * u;
  k.text(c.kicker, { x, y, w, size: 3.6 * u, color: p.primary, weight: 800, ls: 180, upper: true });
  y += 8 * u;
  const bodyH = k.heightOf(c.body || c.subtitle, 4.2 * u, w);
  const ctaY = H - m - pillH(4 * u);
  const size = k.fitBox(c.title, { w, maxH: ctaY - y - bodyH - 10 * u, max: 17 * u, lines: 3 });
  y += k.text(c.title, { x, y, w, size, font: "h", color: p.ink }) + 4 * u;
  k.text(c.body || c.subtitle, { x, y, w, size: 4.2 * u, color: p.soft });
  const ctaW = k.pill(c.cta, x, ctaY, { size: 4 * u, fill: p.primary });
  const info = c.handle || detailLine(k);
  const infoW = w - ctaW - 4 * u;
  if (info && infoW > 12 * u)
    k.text(info, {
      x: x + ctaW + 4 * u,
      y: ctaY + 2.8 * u,
      w: infoW,
      // One line beside the button, whatever the font.
      size: k.fit(info, { w: infoW, max: 3.4 * u, min: 2.2 * u, lines: 1, font: "b" }),
      color: p.soft,
      weight: 700,
    });
}

/** A speaker photo and the event details — webinars, podcasts, talks. */
export function speakerWide(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  k.bgGradient([p.bg, p.bg2], 135);
  k.dots(W - m - 22 * u, m, 7, 4, 3.6 * u, 0.6 * u, k.alpha(p.primary, 0.4));
  const r = 30 * u;
  const cx = m + r + 4 * u;
  const cy = H / 2 - 2 * u;
  k.circle(cx, cy, r + 5 * u, { fill: k.grad([p.primary, p.secondary], 135) });
  k.frame(cx - r, cy - r, 2 * r, 2 * r, { shape: "ellipse", color: p.bg2, photo: "people" });
  k.pill(c.name, cx, cy + r + 1 * u, { size: 3.6 * u, anchor: "center", fill: p.ink, color: p.bg });
  const x = cx + r + 14 * u;
  const w = W - x - m;
  let y = m + 2 * u;
  k.pill(c.kicker, x, y, { size: 3.4 * u, fill: p.primary, upper: true, ls: 80 });
  y += 13 * u;
  const subH = k.heightOf(c.subtitle, 4.4 * u, w);
  const info = [c.date, c.time].filter(Boolean).join("  ·  ");
  const size = k.fitBox(c.title, { w, maxH: H - y - m - subH - 26 * u, max: 15 * u, lines: 3 });
  y += k.text(c.title, { x, y, w, size, font: "h", color: p.ink }) + 3 * u;
  y += k.text(c.subtitle, { x, y, w, size: 4.4 * u, color: p.soft, weight: 500 }) + 5 * u;
  if (info) {
    k.icon("calendar", x, y + 0.4 * u, 5 * u, p.primary);
    k.text(info, { x: x + 7 * u, y, w: w - 7 * u, size: 4 * u, color: p.ink, weight: 700 });
  }
  k.pill(c.cta, x, H - m - pillH(3.8 * u), {
    size: 3.8 * u,
    fill: p.accent,
    color: k.on(p.accent),
  });
}

/** Very wide banners (LinkedIn, X headers, website strips). */
export function bannerWide(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 10 * u;
  k.bgGradient([p.primary, p.secondary], 100);
  const on = k.on(p.primary);
  k.circle(W * 0.82, H * 0.1, 60 * u, { fill: k.alpha("#FFFFFF", 0.12) });
  k.circle(W * 0.95, H * 1.0, 45 * u, { fill: k.alpha(p.accent, 0.55) });
  k.path(PATHS.sparkle, W * 0.7, H * 0.25, 12 * u, 12 * u, { fill: k.alpha("#FFFFFF", 0.8) });
  // Profile photos sit bottom-left on most banners: keep words to the centre-right.
  const x = W * 0.3;
  // Up to the icons on the right (closer on less-wide banners).
  const iconsLeft = W - m - 30 * u - 2 * 34 * u;
  const w = Math.min(W * 0.45, iconsLeft - x - 6 * u);
  const subH = k.heightOf(c.subtitle, 7.5 * u, w);
  const size = k.fitBox(c.title, { w, maxH: H - 2 * m - subH - 6 * u, max: 26 * u, lines: 2 });
  const th = k.heightOf(c.title, size, w, "h");
  const y = (H - th - subH - 5 * u) / 2;
  k.text(c.title, { x, y, w, size, font: "h", color: on });
  k.text(c.subtitle, {
    x,
    y: y + th + 5 * u,
    w,
    size: 7.5 * u,
    color: on,
    weight: 600,
    opacity: 0.92,
  });
  const icons = [k.ic(0), k.ic(1), k.ic(2)];
  icons.forEach((name, i) => {
    const ix = W - m - 30 * u - i * 34 * u;
    k.circle(ix + 13 * u, H / 2, 13 * u, { fill: k.alpha("#FFFFFF", 0.18) });
    k.icon(name, ix + 5 * u, H / 2 - 8 * u, 16 * u, on);
  });
  if (c.handle)
    k.text(c.handle, {
      x,
      y: H - m * 0.7 - 6 * u,
      w,
      size: k.fit(c.handle, { w, max: 6 * u, min: 3 * u, lines: 1, font: "b" }),
      color: on,
      weight: 700,
      opacity: 0.85,
    });
}

/** A quote in wide format. */
export function quoteWide(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 10 * u;
  const quote = c.quote || c.subtitle;
  k.bgSolid(p.bg);
  k.rect(0, 0, W * 0.32, H, { fill: k.grad([p.primary, p.secondary], 160) });
  k.path(PATHS.quote, W * 0.16 - 15 * u, H / 2 - 15 * u, 30 * u, 30 * u, { fill: k.on(p.primary) });
  const x = W * 0.32 + 10 * u;
  const w = W - x - m;
  const size = k.fitBox(quote, {
    w,
    maxH: H - 2 * m - 14 * u,
    max: 10 * u,
    lines: 5,
    font: "h",
    lh: 1.25,
  });
  const qh = k.heightOf(quote, size, w, "h", 1.25);
  const y = (H - qh - 12 * u) / 2;
  k.text(quote, { x, y, w, size, font: "h", color: p.ink, lh: 1.25 });
  k.bar(x, y + qh + 6 * u, 10 * u, 0.8 * u, p.primary);
  k.text(c.author || c.name, {
    x: x + 14 * u,
    y: y + qh + 4 * u,
    w: w - 14 * u,
    size: 4.6 * u,
    color: p.ink,
    weight: 700,
  });
}

export const LANDSCAPE_BLUEPRINTS = {
  ytPunch,
  ytSplit,
  ytNumber,
  ytVersus,
  wideCenter,
  promoWide,
  speakerWide,
  bannerWide,
  quoteWide,
};
