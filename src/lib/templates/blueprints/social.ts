/**
 * Layouts for upright and square designs: posts, stories, posters, flyers,
 * invitations. Written in units of `u` (1% of the shorter side) so each one
 * adapts from 1:1 to 9:16. Every layout measures its words first and gives
 * the headline whatever room is left, so nothing collides.
 */
import { PATHS, type Kit } from "../kit";
import { details, detailLine, itemsOf, sideNote, statOf } from "./shared";

/** Height of a pill/button drawn with `pill(…, { size })`. */
const pillH = (size: number) => Math.round(size * 2.4);

/** Bold centred headline on a soft gradient with glowing lights. */
export function spotlight(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 9 * u;
  k.bgGradient([p.bg, p.bg2], 165);
  k.glow(W * 0.12, H * 0.1, 48 * u, p.primary, 0.42);
  k.glow(W * 0.92, H * 0.88, 58 * u, p.secondary, 0.4);
  k.glow(W * 0.85, H * 0.18, 22 * u, p.accent, 0.3);

  const w = W - 2 * m;
  const footer = 7 * u;
  const iconH = 15 * u + 4 * u;
  const kickerH = 7 * u;
  const subH = k.heightOf(c.subtitle, 4.2 * u, W - 3 * m);
  const ctaH = c.cta ? pillH(3.5 * u) + 6 * u : 0;
  const room = H - 2 * m - footer - iconH - kickerH - subH - 4 * u - ctaH;
  const size = k.fitBox(c.title, { w, maxH: room, max: k.tall ? 18 * u : 16 * u, lines: 3 });
  const th = k.heightOf(c.title, size, w, "h");
  const block = iconH + kickerH + th + 4 * u + subH + ctaH;
  let y = m + Math.max(0, (H - 2 * m - footer - block) / 2);

  k.circle(W / 2, y + 7.5 * u, 7.5 * u, {
    fill: p.primary,
    shadow: { color: k.alpha(p.primary, 0.35), blur: 30, y: 10 },
  });
  k.icon(k.ic(), W / 2 - 4 * u, y + 3.5 * u, 8 * u, k.on(p.primary));
  y += iconH;
  k.text(c.kicker, {
    x: m,
    y,
    w,
    size: 3.2 * u,
    align: "center",
    color: p.primary,
    weight: 700,
    ls: 220,
    upper: true,
  });
  y += kickerH;
  k.text(c.title, { x: m, y, w, size, font: "h", align: "center", color: p.ink });
  y += th + 4 * u;
  k.text(c.subtitle, {
    x: 1.5 * m,
    y,
    w: W - 3 * m,
    size: 4.2 * u,
    align: "center",
    color: p.soft,
    weight: 500,
  });
  y += subH + 6 * u;
  if (c.cta) k.pill(c.cta, W / 2, y, { size: 3.5 * u, anchor: "center", fill: p.primary });
  k.text(c.handle || detailLine(k), {
    x: m,
    y: H - m - 3.5 * u,
    w,
    size: 2.8 * u,
    align: "center",
    color: p.soft,
    weight: 600,
  });
}

/** A coloured band with a slanted edge on top, details underneath. */
export function splitBand(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  const bandH = H * (k.tall ? 0.5 : 0.54);
  k.bgSolid(p.bg);
  k.path(PATHS.slantBottom, 0, 0, W, bandH, {
    fill: k.grad([p.primary, p.secondary], 135),
    name: "band",
  });
  k.circle(W - m - 7 * u, m + 7 * u, 7 * u, { fill: p.bg });
  k.icon(k.ic(), W - m - 11 * u, m + 3 * u, 8 * u, p.primary);
  const on = k.on(p.primary);
  k.text(c.kicker, {
    x: m,
    y: m + 2 * u,
    w: w - 18 * u,
    size: 3.1 * u,
    color: on,
    weight: 700,
    ls: 180,
    upper: true,
    opacity: 0.85,
  });
  const top = m + 17 * u;
  const subH = k.heightOf(c.subtitle, 3.8 * u, w * 0.8);
  const room = bandH * 0.86 - top - subH - 3 * u;
  const size = k.fitBox(c.title, { w, maxH: room, max: k.tall ? 15 * u : 12 * u, lines: 3 });
  const th = k.heightOf(c.title, size, w, "h");
  k.text(c.title, { x: m, y: top, w, size, font: "h", color: on });
  k.text(c.subtitle, {
    x: m,
    y: top + th + 3 * u,
    w: w * 0.8,
    size: 3.8 * u,
    color: on,
    weight: 500,
    opacity: 0.92,
  });

  const ctaY = H - m - pillH(3.3 * u);
  let y = bandH + 3 * u;
  const bodyH = k.heightOf(c.body, 3.4 * u, w);
  if (y + bodyH < ctaY - 16 * u) {
    k.text(c.body, { x: m, y, w, size: 3.4 * u, color: p.soft });
    y += bodyH + 4 * u;
  }
  const rows = [c.date, c.time, c.place].filter(Boolean).length;
  const rowsFit = Math.max(0, Math.floor((ctaY - 4 * u - y) / (3.3 * u * 2.2)));
  if (rows && rowsFit > 0)
    details(k, m, y, w, { size: 3.3 * u, color: p.ink, iconColor: p.primary, max: rowsFit });
  k.pill(c.cta, m, ctaY, { size: 3.3 * u, fill: p.ink });
  k.text(c.handle, {
    x: W / 2,
    y: ctaY + 2.4 * u,
    w: W / 2 - m,
    size: 2.6 * u,
    color: p.soft,
    align: "right",
    weight: 600,
  });
}

/** A big rounded photo up top, words below — drop a photo in the frame. */
export function photoHero(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  const w = W - 2 * m;
  k.bgSolid(p.bg);
  const titleSize = k.fit(c.title, { w, max: k.tall ? 13 * u : 10.5 * u, lines: 2 });
  const th = k.heightOf(c.title, titleSize, w, "h");
  const subH = k.heightOf(c.subtitle, 3.6 * u, w);
  const textH = 5.5 * u + th + 2.5 * u + subH + 5 * u + pillH(3.1 * u);
  const frameH = H - 2 * m - textH - 6 * u;
  k.rect(m + 2.5 * u, m + 2.5 * u, w, frameH, { fill: p.secondary, r: 5 * u, opacity: 0.55 });
  k.frame(m, m, w, frameH, { r: 5 * u, color: p.bg2 });
  k.circle(W - m - 4 * u, m + frameH - 2 * u, 8.5 * u, {
    fill: p.primary,
    shadow: { color: k.alpha(p.ink, 0.25), blur: 24, y: 8 },
  });
  k.icon(k.ic(), W - m - 8.5 * u, m + frameH - 6.5 * u, 9 * u, k.on(p.primary));
  let y = m + frameH + 6 * u;
  k.text(c.kicker, {
    x: m,
    y,
    w: w - 18 * u,
    size: 2.9 * u,
    color: p.primary,
    weight: 700,
    ls: 200,
    upper: true,
  });
  y += 5.5 * u;
  k.text(c.title, { x: m, y, w, size: titleSize, font: "h", color: p.ink });
  y += th + 2.5 * u;
  k.text(c.subtitle, { x: m, y, w, size: 3.6 * u, color: p.soft, weight: 500 });
  const by = H - m - pillH(3.1 * u);
  const ctaW = k.pill(c.cta, m, by, { size: 3.1 * u, fill: p.primary });
  sideNote(k, [detailLine(k), c.handle], m + ctaW + 3 * u, by, w - ctaW - 3 * u, pillH(3.1 * u), {
    size: 2.6 * u,
    color: p.soft,
  });
}

/** Refined serif layout with a fine border — weddings, galas, editorial. */
export function editorial(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 6 * u;
  k.bgSolid(p.bg);
  k.rect(m, m, W - 2 * m, H - 2 * m, {
    fill: null,
    stroke: p.primary,
    sw: Math.max(1.5, 0.35 * u),
  });
  k.rect(m + 1.6 * u, m + 1.6 * u, W - 2 * m - 3.2 * u, H - 2 * m - 3.2 * u, {
    fill: null,
    stroke: k.alpha(p.primary, 0.5),
    sw: Math.max(1, 0.18 * u),
  });
  const w = W - 2 * m - 14 * u;
  const x = m + 7 * u;
  const footer = c.cta || c.handle ? 9 * u : 0;
  const subH = k.heightOf(c.subtitle, 3.5 * u, w);
  const info = detailLine(k);
  const infoH = k.heightOf(info, 3 * u, w, "b", 1.6);
  const fixed = 10 * u + 7 * u + 5 * u + 6 * u + subH + (info ? 5 * u + infoH : 0);
  const room = H - 2 * m - 16 * u - footer - fixed;
  const size = k.fitBox(c.title, { w, maxH: room, max: k.tall ? 15 * u : 12.5 * u, lines: 3 });
  const th = k.heightOf(c.title, size, w, "h");
  let y = m + 8 * u + Math.max(0, (H - 2 * m - 16 * u - footer - fixed - th) / 2);
  k.icon(k.ic(), W / 2 - 3.5 * u, y, 7 * u, p.primary, { stroke: 1.5 });
  y += 10 * u;
  k.text(c.kicker, {
    x,
    y,
    w,
    size: 2.8 * u,
    align: "center",
    color: p.soft,
    weight: 600,
    ls: 300,
    upper: true,
  });
  y += 7 * u;
  k.text(c.title, { x, y, w, size, font: "h", align: "center", color: p.ink });
  y += th + 5 * u;
  k.bar(W / 2 - 12 * u, y, 9 * u, Math.max(1.5, 0.3 * u), p.primary);
  k.shape("diamond", W / 2 - 1.3 * u, y - 1.15 * u, 2.6 * u, 2.6 * u, { fill: p.primary });
  k.bar(W / 2 + 3 * u, y, 9 * u, Math.max(1.5, 0.3 * u), p.primary);
  y += 6 * u;
  k.text(c.subtitle, { x, y, w, size: 3.5 * u, align: "center", color: p.soft, italic: true });
  y += subH + 5 * u;
  if (info)
    k.text(info, { x, y, w, size: 3 * u, align: "center", color: p.ink, weight: 600, lh: 1.6 });
  if (footer)
    k.text(c.cta || c.handle, {
      x,
      y: H - m - 8 * u,
      w,
      size: 2.5 * u,
      align: "center",
      color: p.soft,
      ls: 120,
      upper: true,
    });
}

/** A huge number ("50%") in outline and solid — sales, launches, results. */
export function bigDeal(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  const stat = statOf(k) ?? [c.title.split(/\s+/)[0] ?? "", c.kicker];
  k.bgSolid(p.primary);
  const ink = k.on(p.primary);
  k.glow(W * 0.85, H * 0.15, 45 * u, p.secondary, 0.5);
  k.glow(W * 0.1, H * 0.95, 40 * u, p.accent, 0.3);
  k.text(c.kicker, { x: m, y: m, w, size: 3.2 * u, color: ink, weight: 700, ls: 200, upper: true });
  const titleSize = k.fit(c.title, { w, max: 8.5 * u, lines: 2 });
  const th = k.text(c.title, { x: m, y: m + 6.5 * u, w, size: titleSize, font: "h", color: ink });
  const bottomBlock = pillH(3.3 * u) + 4 * u + k.heightOf(c.subtitle, 3.6 * u, w * 0.58) + 4 * u;
  const top = m + 6.5 * u + th + 5 * u;
  const room = H - m - bottomBlock - top;
  const statSize = Math.min(
    k.fit(stat[0], { w: w * 0.96, max: k.tall ? 46 * u : 38 * u, lines: 1 }),
    room / 1.35,
  );
  const sy = top + Math.max(0, (room - statSize * 1.3) / 2);
  k.text(stat[0], {
    x: m + 1.6 * u,
    y: sy + 1.6 * u,
    w,
    size: statSize,
    font: "h",
    color: k.alpha(ink, 0),
    stroke: { color: p.secondary, width: Math.max(2, 0.5 * u) },
    lh: 1,
  });
  k.text(stat[0], { x: m, y: sy, w, size: statSize, font: "h", color: ink, lh: 1 });
  k.text(stat[1], {
    x: m,
    y: sy + statSize * 1.02,
    w,
    size: Math.min(7 * u, statSize * 0.3),
    font: "h",
    color: p.secondary,
    lh: 1,
  });
  const ctaY = H - m - pillH(3.3 * u);
  k.text(c.subtitle, {
    x: m,
    y: ctaY - 4 * u - k.heightOf(c.subtitle, 3.6 * u, w * 0.58),
    w: w * 0.58,
    size: 3.6 * u,
    color: ink,
    weight: 600,
  });
  k.pill(c.cta, m, ctaY, { size: 3.3 * u, fill: ink });
  const badge = c.date || c.handle;
  if (badge) {
    const s = 25 * u;
    k.path(PATHS.burst, W - m - s, H - m - s, s, s, { fill: p.accent, rotation: 12 });
    k.text(badge, {
      x: W - m - s + 3 * u,
      y: H - m - s / 2 - 3.2 * u,
      w: s - 6 * u,
      size: 2.6 * u,
      align: "center",
      color: k.on(p.accent),
      weight: 800,
      rotation: 12,
      lh: 1.2,
    });
  }
}

export function confettiParty(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  k.bgGradient([p.bg, p.bg2], 180);
  const cardW = W - 2 * m;
  const x = m + 6 * u;
  const w = cardW - 12 * u;
  const rows = [c.date, c.time, c.place].filter(Boolean);
  const subSize = k.tall ? 3.9 * u : 3.4 * u;
  const rowSize = k.tall ? 3.6 * u : 3.2 * u;
  const subH = k.heightOf(c.subtitle, subSize, w);
  const detailsH = rows.length * rowSize * 1.5 + Math.max(0, rows.length - 1) * 0.6 * u;
  const fixed =
    12 * u + 7 * u + 4 * u + subH + 4 * u + 4 * u + detailsH + 6 * u + pillH(3.2 * u) + 7 * u;
  const maxCard = H - (k.tall ? 30 * u : 24 * u);
  const size = k.fitBox(c.title, {
    w,
    maxH: maxCard - fixed,
    max: k.tall ? 15 * u : 12 * u,
    lines: 3,
  });
  const th = k.heightOf(c.title, size, w, "h");
  const cardH = Math.min(maxCard, fixed + th);
  const cardY = (H - cardH) / 2 + 3 * u;
  k.confetti(k.tall ? 40 : 26, [p.primary, p.secondary, p.accent], {
    x: m - 2 * u,
    y: cardY - 10 * u,
    w: cardW + 4 * u,
    h: cardH + 14 * u,
  });
  k.rect(m, cardY, cardW, cardH, {
    fill: p.surface,
    r: 6 * u,
    shadow: { color: k.alpha(p.ink, 0.15), blur: 40, y: 14 },
  });
  k.circle(W / 2, cardY, 8.5 * u, { fill: p.primary, stroke: p.surface, sw: 1.2 * u });
  k.icon(k.ic(), W / 2 - 4.5 * u, cardY - 4.5 * u, 9 * u, k.on(p.primary));
  let y = cardY + 12 * u;
  k.text(c.kicker, {
    x,
    y,
    w,
    size: 4 * u,
    align: "center",
    color: p.primary,
    font: k.f.accent ?? "h",
    weight: 400,
    upper: false,
  });
  y += 7 * u;
  k.text(c.title, {
    x,
    y,
    w,
    size,
    font: "h",
    align: "center",
    color: p.ink,
    shadow: { color: k.alpha(p.secondary, 0.6), x: 0.5 * u, y: 0.6 * u },
  });
  y += th + 4 * u;
  y +=
    k.text(c.subtitle, { x, y, w, size: subSize, align: "center", color: p.soft, weight: 500 }) +
    4 * u;
  k.bar(W / 2 - 8 * u, y, 16 * u, 0.6 * u, p.secondary);
  y += 4 * u;
  details(k, x, y, w, { size: rowSize, color: p.ink, align: "center", gap: 0.6 * u });
  k.pill(c.cta, W / 2, cardY + cardH - pillH(3.2 * u) - 7 * u, {
    size: 3.2 * u,
    anchor: "center",
    fill: p.primary,
  });
}

export function listTips(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  const upright = H > W * 1.15;
  k.bgSolid(p.bg);
  k.rect(0, 0, W, 2 * u, { fill: p.primary });
  k.dots(W - m - 12 * u, m + 2 * u, 5, 4, 3.2 * u, 0.55 * u, k.alpha(p.primary, 0.45));
  let y = m + 2 * u;
  k.pill(c.kicker, m, y, { size: 2.8 * u, fill: p.bg2, color: p.primary, upper: true, ls: 100 });
  y += 11 * u;
  const items = itemsOf(k, 4);
  const footerY = H - m - 7 * u;
  const itemSize = k.tall ? 5 * u : upright ? 4.4 * u : 3.9 * u;
  const listMin = items.length * itemSize * 2.8;
  const size = k.fitBox(c.title, {
    w,
    maxH: footerY - y - listMin - 8 * u,
    max: k.tall ? 15 * u : upright ? 12 * u : 10.5 * u,
    lines: 3,
  });
  y += k.text(c.title, { x: m, y, w, size, font: "h", color: p.ink }) + 7 * u;
  const step = Math.min(
    itemSize * (k.tall ? 5 : upright ? 4.2 : 3.6),
    (footerY - 4 * u - y) / Math.max(1, items.length),
  );
  const r = itemSize * 1.1;
  items.forEach((item, i) => {
    const iy = y + i * step;
    const fill = i % 2 ? p.secondary : p.primary;
    k.circle(m + r, iy + r, r, { fill });
    k.text(String(i + 1), {
      x: m,
      y: iy + r - itemSize * 0.62,
      w: 2 * r,
      size: itemSize * 1.05,
      font: "h",
      align: "center",
      color: k.on(fill),
      upper: false,
      lh: 1.2,
    });
    k.text(item, {
      x: m + 2 * r + 4 * u,
      y: iy + r - itemSize * 0.7,
      w: w - 2 * r - 4 * u,
      size: itemSize,
      color: p.ink,
      weight: 600,
    });
  });
  k.bar(m, footerY, w, Math.max(1, 0.2 * u), k.alpha(p.soft, 0.4));
  k.text(c.name, { x: m, y: footerY + 3 * u, w: w / 2, size: 2.8 * u, color: p.ink, weight: 700 });
  k.text(c.handle, {
    x: W / 2,
    y: footerY + 3 * u,
    w: w / 2,
    size: 2.8 * u,
    color: p.soft,
    align: "right",
    weight: 600,
  });
}

export function quoteCard(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 9 * u;
  const w = W - 2 * m;
  const quote = c.quote || c.body || c.subtitle;
  k.bgGradient([p.bg, p.bg2], 200);
  k.glow(W * 0.9, H * 0.1, 40 * u, p.secondary, 0.35);
  if (H > W * 1.15) k.glow(W * 0.1, H * 0.9, 45 * u, p.primary, 0.25);
  k.path(PATHS.quote, m, m, 20 * u, 20 * u, { fill: p.primary });
  const top = m + 26 * u;
  const bottom = H - m - 16 * u;
  const size = k.fitBox(quote, {
    w,
    maxH: bottom - top,
    max: k.tall ? 10 * u : H > W * 1.15 ? 8.5 * u : 6.8 * u,
    lines: 9,
    font: "h",
    lh: 1.25,
  });
  const qh = k.heightOf(quote, size, w, "h", 1.25);
  const y = top + Math.max(0, (bottom - top - qh) / 2.2);
  k.text(quote, { x: m, y, w, size, font: "h", color: p.ink, lh: 1.25 });
  const ay = y + qh + 5 * u;
  k.bar(m, ay + 2 * u, 8 * u, 0.5 * u, p.primary);
  k.text(c.author || c.name, {
    x: m + 11 * u,
    y: ay,
    w: w - 11 * u,
    size: 3.4 * u,
    color: p.ink,
    weight: 700,
  });
  k.text(c.handle || c.kicker, {
    x: m,
    y: H - m - 3 * u,
    w,
    size: 2.7 * u,
    color: p.soft,
    align: "right",
    weight: 600,
  });
}

/** An arch-shaped photo with a soft glow — boutique, wellness, invitations. */
export function archGlow(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  k.bgSolid(p.bg);
  const info = c.subtitle || detailLine(k);
  const titleSize = k.fit(c.title, { w, max: k.tall ? 13 * u : 10 * u, lines: 2 });
  const th = k.heightOf(c.title, titleSize, w, "h");
  const infoH = k.heightOf(info, 3.1 * u, w);
  const textH = 5.5 * u + th + 2.5 * u + infoH + 8 * u;
  const ah = Math.min(W * 0.62 * 1.25, H - 2 * m - textH - 6 * u);
  const aw = ah / 1.25;
  const ax = (W - aw) / 2;
  const ay = m + Math.max(0, (H - 2 * m - textH - ah - 6 * u) / 2);
  k.glow(W / 2, ay + ah * 0.45, aw * 0.85, p.secondary, 0.45);
  k.path(PATHS.arch, ax - 2 * u, ay - 2 * u, aw + 4 * u, ah + 4 * u, {
    fill: null,
    stroke: p.primary,
    sw: Math.max(1.5, 0.3 * u),
  });
  k.frame(ax, ay, aw, ah, { path: PATHS.arch, color: p.bg2 });
  k.path(PATHS.sparkle, ax - 7 * u, ay + ah * 0.18, 6 * u, 6 * u, { fill: p.accent });
  k.path(PATHS.sparkle, ax + aw + 1.5 * u, ay + ah * 0.7, 4.5 * u, 4.5 * u, { fill: p.primary });
  let y = ay + ah + 6 * u;
  k.text(c.kicker, {
    x: m,
    y,
    w,
    size: 2.8 * u,
    align: "center",
    color: p.primary,
    weight: 700,
    ls: 260,
    upper: true,
  });
  y += 5.5 * u;
  k.text(c.title, { x: m, y, w, size: titleSize, font: "h", align: "center", color: p.ink });
  y += th + 2.5 * u;
  k.text(info, { x: m, y, w, size: 3.1 * u, align: "center", color: p.soft, weight: 500 });
  if (c.handle && y + infoH + 8 * u < H - m)
    k.text(c.handle, {
      x: m,
      y: H - m - 3 * u,
      w,
      size: 2.5 * u,
      align: "center",
      color: p.soft,
      ls: 100,
    });
}

export function retroSun(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  k.bgGradient([p.bg, p.bg2], 180);
  const info = detailLine(k) || c.subtitle;
  const titleSize = k.fit(c.title, { w, max: k.tall ? 14 * u : 10 * u, lines: 2 });
  const th = k.heightOf(c.title, titleSize, w, "h");
  const textH = th + 3 * u + k.heightOf(info, 3.2 * u, w) + 9 * u;
  const horizon = H - m - textH - 4 * u;
  const r = Math.min(W * 0.34, (horizon - m - 8 * u) / 1.05);
  const cy = horizon - r * 0.15;
  // Stars in the sky above the sun.
  for (let i = 0; i < 14; i++) {
    const sx = m + k.rand() * w;
    const sy = m + 8 * u + k.rand() * Math.max(1, cy - r - m - 10 * u);
    if (sy > cy - r - 2 * u) continue;
    if (i % 4 === 0)
      k.path(PATHS.sparkle, sx, sy, 2.6 * u, 2.6 * u, { fill: k.alpha(p.accent, 0.9) });
    else k.circle(sx, sy, (0.3 + k.rand() * 0.4) * u, { fill: k.alpha(p.ink, 0.6) });
  }
  k.circle(W / 2, cy, r, { fill: k.grad([p.accent, p.secondary, p.primary], 180), name: "sun" });
  for (let i = 0; i < 5; i++) {
    const y = cy - r * 0.05 + i * r * 0.17;
    if (y > horizon) break;
    k.rect(W / 2 - r - 2, y, 2 * r + 4, r * 0.035 * (i + 1.3), { fill: p.bg2 });
  }
  k.rect(0, horizon, W, H - horizon, { fill: p.bg2 });
  for (let i = 1; i < 8; i++)
    k.rect((W / 8) * i, horizon, Math.max(1, 0.2 * u), H - horizon, {
      fill: k.alpha(p.primary, 0.35),
    });
  k.rect(0, horizon, W, Math.max(1.5, 0.3 * u), { fill: p.primary });
  k.text(c.kicker, {
    x: m,
    y: m,
    w,
    size: 3 * u,
    align: "center",
    color: p.ink,
    weight: 700,
    ls: 300,
    upper: true,
    opacity: 0.85,
  });
  const ty = horizon + 4 * u;
  k.text(c.title, {
    x: m,
    y: ty,
    w,
    size: titleSize,
    font: "h",
    align: "center",
    color: p.ink,
    shadow: { color: p.primary, blur: 24 },
  });
  k.text(info, {
    x: m,
    y: ty + th + 3 * u,
    w,
    size: 3.2 * u,
    align: "center",
    color: p.soft,
    weight: 600,
  });
}

/** Words on top, a wave at the bottom holding the details. */
export function waveFooter(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  k.bgSolid(p.bg);
  k.circle(W - 10 * u, 10 * u, 26 * u, { fill: p.bg2 });
  const waveY = H * (k.tall ? 0.6 : 0.56);
  let y = m + 2 * u;
  k.rect(m, y, 11 * u, 11 * u, { fill: p.primary, r: 3.5 * u });
  k.icon(k.ic(), m + 2.5 * u, y + 2.5 * u, 6 * u, k.on(p.primary));
  y += 16 * u;
  k.text(c.kicker, {
    x: m,
    y,
    w,
    size: 3 * u,
    color: p.primary,
    weight: 700,
    ls: 180,
    upper: true,
  });
  y += 6 * u;
  const subH = k.heightOf(c.subtitle, 3.6 * u, w);
  const size = k.fitBox(c.title, {
    w,
    maxH: waveY - y - subH - 8 * u,
    max: k.tall ? 14 * u : 12 * u,
    lines: 3,
  });
  y += k.text(c.title, { x: m, y, w, size, font: "h", color: p.ink }) + 3 * u;
  k.text(c.subtitle, { x: m, y, w, size: 3.6 * u, color: p.soft, weight: 500 });
  k.path(PATHS.waveTop, 0, waveY, W, H - waveY + 2, {
    fill: k.grad([p.primary, p.secondary], 110),
  });
  const on = k.on(p.primary);
  const ctaY = H - m - pillH(3.1 * u);
  const dy = waveY + (H - waveY) * 0.3;
  if (detailLine(k)) details(k, m, dy, w * 0.62, { size: 3.2 * u, color: on });
  else k.text(c.body, { x: m, y: dy, w: w * 0.62, size: 3.3 * u, color: on, weight: 500 });
  k.pill(c.cta, W - m, ctaY, { size: 3.1 * u, anchor: "end", fill: p.surface, color: p.ink });
}

export function ticket(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  k.bgGradient([p.bg2, p.bg], 135);
  k.dots(m, m * 0.6, 6, 3, 3 * u, 0.5 * u, k.alpha(p.primary, 0.4));
  const tw = W - 2 * m;
  const tx = m;
  const x = tx + 6 * u;
  const w = tw - 12 * u;
  const info = [c.time, c.place].filter(Boolean).join("  ·  ");
  const infoSize = k.tall ? 3.6 * u : 3 * u;
  const infoH = k.heightOf(info, infoSize, w);
  const stubH = k.tall ? 34 * u : 26 * u;
  const fixed = stubH + 7 * u + 3 * u + infoH + 8 * u + pillH(3.1 * u) + 7 * u;
  const maxT = H - (k.tall ? 34 * u : 18 * u);
  const size = k.fitBox(c.title, {
    w,
    maxH: maxT - fixed,
    max: k.tall ? 14 * u : 10 * u,
    lines: 3,
  });
  const titleH = k.heightOf(c.title, size, w, "h");
  const th = Math.min(maxT, fixed + titleH);
  const ty = (H - th) / 2 + 3 * u;
  k.path(PATHS.ticket, tx, ty, tw, th, { fill: p.surface, name: "ticket" });
  k.rect(tx, ty, tw, stubH, { fill: k.grad([p.primary, p.secondary], 120) });
  const on = k.on(p.primary);
  k.icon(k.ic(), x, ty + 5 * u, 6.5 * u, on);
  k.text(c.kicker, {
    x: x + 9 * u,
    y: ty + 6.3 * u,
    w: w - 9 * u,
    size: 2.8 * u,
    color: on,
    weight: 700,
    ls: 200,
    upper: true,
  });
  const dateSize = k.fit(c.date, { w, max: k.tall ? 9 * u : 7.5 * u, lines: 1 });
  k.text(c.date, {
    x,
    y: ty + stubH - dateSize * 1.2 - 4 * u,
    w,
    size: dateSize,
    font: "h",
    color: on,
  });
  for (let dx = 3 * u; dx < tw - 3 * u; dx += 4 * u)
    k.rect(tx + dx, ty + stubH + 2 * u, 2 * u, Math.max(1, 0.35 * u), {
      fill: k.alpha(p.soft, 0.5),
    });
  let y = ty + stubH + 7 * u;
  y += k.text(c.title, { x, y, w, size, font: "h", color: p.ink }) + 3 * u;
  k.text(info, { x, y, w, size: infoSize, color: p.soft, weight: 600 });
  const ctaY = ty + th - pillH(3.1 * u) - 7 * u;
  const ctaW = k.pill(c.cta, x, ctaY, { size: 3.1 * u, fill: p.ink, color: p.surface });
  if (c.handle)
    k.text(c.handle, {
      x: x + ctaW + 2 * u,
      y: ctaY + 2.2 * u,
      w: w - ctaW - 2 * u,
      size: 2.5 * u,
      color: p.soft,
      align: "right",
      weight: 600,
    });
}

/** Splits a headline into 2–3 balanced lines. */
function balance(text: string, lines: number): string[] {
  const words = text.replace(/\n/g, " ").split(/\s+/).filter(Boolean);
  if (words.length <= lines) return words;
  const total = words.join(" ").length;
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > total / lines + 2 && out.length < lines - 1) {
      out.push(line);
      line = word;
    } else line = next;
  }
  out.push(line);
  return out;
}

/** Massive stacked lines in alternating colours. */
export function stackedType(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  const w = W - 2 * m;
  k.bgSolid(p.bg);
  k.circle(W * 0.95, H * 0.08, 30 * u, { fill: p.secondary, opacity: 0.9 });
  const lines = balance(c.title, k.tall ? 4 : 3);
  k.text(c.kicker, {
    x: m,
    y: m,
    w: W * 0.6,
    size: 3 * u,
    color: p.ink,
    weight: 700,
    ls: 220,
    upper: true,
  });
  const footer = 22 * u;
  const avail = H - 2 * m - 10 * u - footer;
  const size = Math.min(
    ...lines.map((line) => k.fit(line, { w, max: 26 * u, lines: 1 })),
    avail / lines.length,
  );
  let y = m + 10 * u + Math.max(0, (avail - size * lines.length) / 2);
  const colors = [p.ink, p.primary, p.ink, p.accent];
  lines.forEach((line, i) => {
    k.text(line, { x: m, y, w, size, font: "h", color: colors[i % colors.length], lh: 1 });
    y += size;
  });
  y += 4 * u;
  k.bar(m, y, 14 * u, 1.2 * u, p.primary, 0);
  k.text(c.subtitle, { x: m, y: y + 4.5 * u, w, size: 3.6 * u, color: p.soft, weight: 600 });
  k.text(c.handle || detailLine(k), {
    x: m,
    y: H - m - 3 * u,
    w,
    size: 2.7 * u,
    color: p.soft,
    weight: 700,
  });
}

export function cardOnGradient(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const upright = H > W * 1.15;
  k.bgGradient([p.primary, p.secondary], 145);
  k.glow(W * 0.1, H * 0.12, 40 * u, "#FFFFFF", 0.22);
  k.circle(W * 0.92, H * 0.06, 22 * u, { fill: k.alpha(p.accent, 0.6) });
  if (upright) k.circle(W * 0.05, H * 0.95, 28 * u, { fill: k.alpha(p.accent, 0.45) });
  const cw = W - 2 * m;
  const x = m + 7 * u;
  const w = cw - 14 * u;
  const body = c.body || c.subtitle;
  const bodySize = k.tall ? 4 * u : upright ? 3.6 * u : 3.3 * u;
  const bodyH = k.heightOf(body, bodySize, w);
  const fixed = 7 * u + 15 * u + 6 * u + 3.5 * u + bodyH + 9 * u + pillH(3.2 * u) + 7 * u;
  const maxCard = H - (k.tall ? 30 * u : 18 * u);
  const size = k.fitBox(c.title, {
    w,
    maxH: maxCard - fixed,
    max: k.tall ? 15 * u : upright ? 12.5 * u : 11 * u,
    lines: 3,
  });
  const th = k.heightOf(c.title, size, w, "h");
  const ch = Math.min(maxCard, Math.max(fixed + th, H * 0.5));
  const cy = (H - ch) / 2;
  k.rect(m, cy, cw, ch, {
    fill: p.surface,
    r: 5 * u,
    shadow: { color: k.alpha("#000000", 0.25), blur: 50, y: 20 },
  });
  let y = cy + 7 * u;
  k.rect(x, y, 10 * u, 10 * u, { fill: k.alpha(p.primary, 0.12), r: 3 * u });
  k.icon(k.ic(), x + 2.5 * u, y + 2.5 * u, 5 * u, p.primary);
  y += 15 * u;
  k.text(c.kicker, { x, y, w, size: 2.8 * u, color: p.primary, weight: 700, ls: 150, upper: true });
  y += 6 * u;
  y += k.text(c.title, { x, y, w, size, font: "h", color: p.ink }) + 3.5 * u;
  k.text(body, { x, y, w, size: bodySize, color: p.soft });
  const ctaY = cy + ch - pillH(3.2 * u) - 7 * u;
  const ctaW = k.pill(c.cta, x, ctaY, { size: 3.2 * u, fill: p.primary });
  if (c.handle)
    k.text(c.handle, {
      x: x + ctaW + 3 * u,
      y: ctaY + 2.3 * u,
      w: w - ctaW - 3 * u,
      size: 2.5 * u,
      color: p.soft,
      align: "right",
      weight: 600,
    });
}

/** Three photo frames and a title strip — real estate, travel, food. */
export function collage(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 5 * u;
  const g = 2 * u;
  k.bgSolid(p.bg);
  const x = m + 6 * u;
  const w = W - 2 * m - 12 * u;
  const info = c.subtitle || detailLine(k);
  const titleSize = k.fit(c.title, { w, max: k.tall ? 12 * u : 9.5 * u, lines: 2 });
  const stripH =
    6 * u +
    5 * u +
    k.heightOf(c.title, titleSize, w, "h") +
    2.5 * u +
    k.heightOf(info, 3.1 * u, w) +
    6 * u;
  const gridH = H - stripH - 2 * m - g;
  const bigW = (W - 2 * m - g) * 0.6;
  const smallW = W - 2 * m - g - bigW;
  k.frame(m, m, bigW, gridH, { r: 3 * u, color: p.bg2 });
  k.frame(m + bigW + g, m, smallW, (gridH - g) / 2, { r: 3 * u, color: p.secondary });
  k.frame(m + bigW + g, m + (gridH + g) / 2, smallW, (gridH - g) / 2, {
    r: 3 * u,
    color: p.primary,
  });
  const sy = m + gridH + g;
  k.rect(m, sy, W - 2 * m, stripH, { fill: p.primary, r: 3 * u });
  const on = k.on(p.primary);
  k.text(c.kicker, {
    x,
    y: sy + 5 * u,
    w,
    size: 2.7 * u,
    color: on,
    weight: 700,
    ls: 200,
    upper: true,
    opacity: 0.85,
  });
  const th = k.text(c.title, { x, y: sy + 10 * u, w, size: titleSize, font: "h", color: on });
  k.text(info, {
    x,
    y: sy + 12.5 * u + th,
    w,
    size: 3.1 * u,
    color: on,
    weight: 500,
    opacity: 0.9,
  });
}

/** A big icon medallion with numbers underneath. */
export function circleBadge(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  k.bgGradient([p.bg, p.bg2], 180);
  const stats = k.c.stats.slice(0, 3);
  const ctaH = c.cta ? pillH(3.1 * u) + 6 * u : 0;
  const statsH = stats.length ? 14 * u : k.heightOf(c.subtitle, 3.6 * u, w);
  // The badge keeps at least this radius; the headline gets the room that's left.
  const minR = 9 * u;
  const titleSize = k.fitBox(c.title, {
    w,
    maxH: H - 2 * m - 12 * u - statsH - ctaH - 2 * minR - 14 * u,
    max: k.tall ? 13 * u : 10 * u,
    lines: 2,
  });
  const th = k.heightOf(c.title, titleSize, w, "h");
  const textH = 6 * u + th + 6 * u + statsH + ctaH;
  const r = Math.max(minR, Math.min(W * (k.tall ? 0.26 : 0.17), (H - 2 * m - textH - 14 * u) / 2));
  const cy = m + 4 * u + r + Math.max(0, (H - 2 * m - textH - 2 * r - 14 * u) / 2);
  k.circle(W / 2, cy, r + 4 * u, {
    fill: null,
    stroke: k.alpha(p.primary, 0.35),
    sw: 0.5 * u,
    dash: [1.5 * u, 1.5 * u],
  });
  k.circle(W / 2, cy, r, {
    fill: k.grad([p.primary, p.secondary], 135),
    shadow: { color: k.alpha(p.primary, 0.4), blur: 40, y: 16 },
  });
  k.icon(k.ic(), W / 2 - r * 0.5, cy - r * 0.5, r, k.on(p.primary), { stroke: 1.6 });
  let y = cy + r + 9 * u;
  k.text(c.kicker, {
    x: m,
    y,
    w,
    size: 2.8 * u,
    align: "center",
    color: p.primary,
    weight: 700,
    ls: 220,
    upper: true,
  });
  y += 6 * u;
  y +=
    k.text(c.title, { x: m, y, w, size: titleSize, font: "h", align: "center", color: p.ink }) +
    6 * u;
  if (stats.length) {
    const cw = w / stats.length;
    stats.forEach(([value, label], i) => {
      const x = m + i * cw;
      const vs = k.fit(value, { w: cw * 0.9, max: 7.5 * u, lines: 1 });
      k.text(value, { x, y, w: cw, size: vs, font: "h", align: "center", color: p.primary, lh: 1 });
      k.text(label, {
        x,
        y: y + 9 * u,
        w: cw,
        size: 2.7 * u,
        align: "center",
        color: p.soft,
        weight: 600,
      });
      if (i > 0)
        k.rect(x, y + 1 * u, Math.max(1, 0.25 * u), 11 * u, { fill: k.alpha(p.soft, 0.35) });
    });
  } else {
    k.text(c.subtitle, { x: m, y, w, size: 3.6 * u, align: "center", color: p.soft });
  }
  if (c.cta)
    k.pill(c.cta, W / 2, H - m - pillH(3.1 * u), {
      size: 3.1 * u,
      anchor: "center",
      fill: p.ink,
      color: p.bg,
    });
}

export function minimalLine(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 9 * u;
  const w = W - 2 * m;
  k.bgSolid(p.bg);
  k.text(c.name || c.kicker, {
    x: m,
    y: m,
    w: w / 2,
    size: 2.8 * u,
    color: p.ink,
    weight: 700,
    ls: 150,
    upper: true,
  });
  k.text(c.date || c.handle, {
    x: W / 2,
    y: m,
    w: w / 2,
    size: 2.8 * u,
    color: p.soft,
    align: "right",
    weight: 500,
  });
  const subH = k.heightOf(c.subtitle, 3.3 * u, w * 0.6);
  const bottom = H - m - Math.max(subH, 8 * u) - 6 * u;
  const upright = H > W * 1.15;
  const size = k.fitBox(c.title, {
    w,
    maxH: upright ? H * 0.28 : bottom - m - 36 * u,
    max: k.tall ? 18 * u : 14 * u,
    lines: 3,
  });
  const th = k.heightOf(c.title, size, w, "h");
  const titleY = bottom - th - 2 * u;
  if (upright) {
    const fy = m + 8 * u;
    k.frame(m, fy, w, titleY - fy - 6 * u, { color: p.bg2 });
    k.circle(W - m, fy, 6 * u, { fill: p.primary });
  } else {
    k.circle(W - m - 6 * u, m + 22 * u, 6 * u, { fill: p.primary });
  }
  k.text(c.title, { x: m, y: titleY, w, size, font: "h", color: p.ink });
  k.bar(m, bottom + 1 * u, w, Math.max(1.5, 0.25 * u), p.ink);
  k.text(c.subtitle, { x: m, y: bottom + 5 * u, w: w * 0.6, size: 3.3 * u, color: p.soft });
  k.text(c.place || c.cta, {
    x: m + w * 0.62,
    y: bottom + 5 * u,
    w: w * 0.38,
    size: 3 * u,
    color: p.ink,
    align: "right",
    weight: 600,
  });
}

export const SOCIAL_BLUEPRINTS = {
  spotlight,
  splitBand,
  photoHero,
  editorial,
  bigDeal,
  confettiParty,
  listTips,
  quoteCard,
  archGlow,
  retroSun,
  waveFooter,
  ticket,
  stackedType,
  cardOnGradient,
  collage,
  circleBadge,
  minimalLine,
};
