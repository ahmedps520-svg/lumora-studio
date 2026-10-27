/**
 * Photo-led layouts. Their frames fill with photos that suit the theme (see
 * `Kit.frame`); text on photos sits on a soft dark fade so it always reads.
 * Social layouts adapt from 1:1 to 9:16; the `wide*` ones are for landscape
 * posts, thumbnails and banners.
 */
import { contrastRatio } from "@/lib/engine/paint";
import { PATHS, type Kit } from "../kit";
import { detailLine, itemsOf, sideNote, statOf } from "./shared";

/** Height of a pill/button drawn with `pill(…, { size })`. */
const pillH = (size: number) => Math.round(size * 2.4);
const WHITE = "#FFFFFF";

/** The palette's darkest colour (for fades over photos). */
const shade = (k: Kit) => (k.p.dark ? k.p.bg : k.p.ink);

/** A dark fade over part of a photo: `from` → `to` opacity, top to bottom. */
function fade(k: Kit, y: number, h: number, from: number, to: number, angle = 180) {
  const d = shade(k);
  k.rect(0, y, k.W, h, {
    fill: k.grad([k.alpha(d, from), k.alpha(d, (from + to) / 2), k.alpha(d, to)], angle),
    name: "fade",
  });
}

/** Full-bleed photo, headline and button on a fade at the bottom. */
export function photoFull(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  k.bgSolid(shade(k));
  k.frame(0, 0, W, H, { color: p.bg2 });
  fade(k, 0, 24 * u, 0.55, 0);

  const kickerH = c.kicker ? pillH(2.8 * u) + 4 * u : 0;
  const subH = k.heightOf(c.subtitle, 3.8 * u, w);
  const ctaH = c.cta ? pillH(3.2 * u) + 5 * u : 0;
  const room = H * (k.tall ? 0.42 : 0.5) - kickerH - subH - ctaH;
  const size = k.fitBox(c.title, { w, maxH: room, max: k.tall ? 15 * u : 12.5 * u, lines: 3 });
  const th = k.heightOf(c.title, size, w, "h");
  const block = kickerH + th + 3 * u + subH + ctaH;
  const fadeH = Math.min(H, block + m + 28 * u);
  fade(k, H - fadeH, fadeH, 0, 0.92);

  k.text(c.name, { x: m, y: m, w: w - 12 * u, size: 3 * u, color: WHITE, weight: 700, ls: 60 });
  k.icon(k.ic(), W - m - 6.5 * u, m - 1.2 * u, 6.5 * u, WHITE);

  let y = H - m - block;
  if (c.kicker) {
    k.pill(c.kicker, m, y, { size: 2.8 * u, fill: p.primary, upper: true, ls: 80 });
    y += kickerH;
  }
  k.text(c.title, { x: m, y, w, size, font: "h", color: WHITE });
  y += th + 3 * u;
  k.text(c.subtitle, { x: m, y, w, size: 3.8 * u, color: k.alpha(WHITE, 0.88), weight: 500 });
  y += subH + 5 * u;
  if (c.cta) {
    const cw = k.pill(c.cta, m, y, { size: 3.2 * u, fill: WHITE, color: shade(k) });
    sideNote(k, [c.handle, detailLine(k)], m + cw + 3 * u, y, w - cw - 3 * u, pillH(3.2 * u), {
      size: 2.7 * u,
      color: k.alpha(WHITE, 0.8),
    });
  }
}

/** Magazine cover: masthead on top, cover lines over the photo, a price badge. */
export function magazine(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 6 * u;
  const w = W - 2 * m;
  k.bgSolid(shade(k));
  k.frame(0, 0, W, H, { color: p.bg2 });
  fade(k, 0, H * 0.4, 0.75, 0);

  const mast = c.name || c.kicker;
  // One line, with room to spare (heavy display fonts run wide).
  const mastSize = k.fit(mast, { w: w * 0.85, max: k.tall ? 17 * u : 15 * u, lines: 1 });
  const mastH = k.heightOf(mast, mastSize, w, "h");
  k.text(mast, { x: m, y: m, w, size: mastSize, font: "h", color: WHITE, lh: 1.05 });
  let y = m + mastH + 1.5 * u;
  k.bar(m, y, w, Math.max(2, 0.3 * u), k.alpha(WHITE, 0.8), 0);
  y += 2 * u;
  k.text(c.date || c.kicker, {
    x: m,
    y,
    w: w / 2,
    size: 2.5 * u,
    color: WHITE,
    weight: 700,
    ls: 120,
    upper: true,
  });
  k.text(c.handle, {
    x: W / 2,
    y,
    w: w / 2,
    size: 2.5 * u,
    color: WHITE,
    weight: 700,
    align: "right",
  });

  // Cover lines at the bottom.
  const lw = w * 0.74;
  const lines = itemsOf(k, 3).filter((t) => t !== c.subtitle);
  const lineSize = 3.1 * u;
  const linesH = lines.reduce((s, t) => s + k.heightOf(t, lineSize, lw - 3 * u) + 2.2 * u, 0);
  const subH = k.heightOf(c.subtitle, 3.4 * u, lw);
  const room = H * (k.tall ? 0.3 : 0.34) - subH;
  const size = k.fitBox(c.title, { w: lw, maxH: room, max: k.tall ? 12 * u : 10 * u, lines: 3 });
  const th = k.heightOf(c.title, size, lw, "h");
  const block = th + 2 * u + subH + 4 * u + linesH;
  const fadeH = Math.min(H * 0.75, block + m + 24 * u);
  fade(k, H - fadeH, fadeH, 0, 0.9);
  y = H - m - block;
  k.text(c.title, { x: m, y, w: lw, size, font: "h", color: WHITE });
  y += th + 2 * u;
  k.text(c.subtitle, { x: m, y, w: lw, size: 3.4 * u, color: k.alpha(WHITE, 0.88), weight: 500 });
  y += subH + 4 * u;
  for (const line of lines) {
    const lh = k.heightOf(line, lineSize, lw - 3 * u);
    k.bar(m, y + 0.4 * u, 0.8 * u, lineSize * 1.1, p.accent, 0.4 * u);
    k.text(line, { x: m + 3 * u, y, w: lw - 3 * u, size: lineSize, color: WHITE, weight: 700 });
    y += lh + 2.2 * u;
  }

  // A badge under the masthead, if it fits above the cover lines.
  const stat = statOf(k);
  const r = 11 * u;
  const cy = m + mastH + 7 * u + r;
  if (stat && cy + r < H - m - block - 3 * u) {
    const cx = W - m - r;
    k.circle(cx, cy, r, {
      fill: p.accent,
      shadow: { color: k.alpha("#000000", 0.3), blur: 20, y: 6 },
    });
    const on = k.on(p.accent);
    const vs = k.fit(stat[0], { w: r * 1.5, max: 7 * u, lines: 1 });
    k.text(stat[0], {
      x: cx - r,
      y: cy - vs * 0.75,
      w: 2 * r,
      size: vs,
      font: "h",
      color: on,
      align: "center",
    });
    k.text(stat[1], {
      x: cx - r * 0.8,
      y: cy + vs * 0.4,
      w: r * 1.6,
      size: 2.3 * u,
      color: on,
      align: "center",
      weight: 700,
    });
  }
}

/** Photo on top, a colour panel with a slanted edge below. */
export function photoSplit(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  const panel = p.primary;
  const ink = k.on(panel);
  const kickerColor = k.pick(panel, [p.secondary, p.accent, p.bg], 2.2);
  k.bgSolid(panel);

  const subH = k.heightOf(c.subtitle, 3.6 * u, w);
  const ctaH = c.cta ? pillH(3.1 * u) + 5 * u : 0;
  const titleMax = k.tall ? 13 * u : 10.5 * u;
  const size = k.fitBox(c.title, { w, maxH: H * 0.24, max: titleMax, lines: 3 });
  const th = k.heightOf(c.title, size, w, "h");
  // The photo takes what the words leave (within limits).
  const need = 9 * u + 6 * u + th + 3 * u + subH + ctaH + m;
  const ph = Math.max(H * 0.36, Math.min(H * (k.tall ? 0.6 : 0.52), H - need));

  k.frame(0, 0, W, ph + 6 * u, { color: p.bg2 });
  k.path(PATHS.slantTop, 0, ph - 6 * u, W, 14 * u, { fill: panel });
  const r = 8 * u;
  k.circle(W - m - r, ph - 3 * u, r, {
    fill: p.accent,
    shadow: { color: k.alpha("#000000", 0.25), blur: 18, y: 6 },
  });
  k.icon(k.ic(), W - m - r - 4.5 * u, ph - 7.5 * u, 9 * u, k.on(p.accent));

  let y = ph + 9 * u;
  k.text(c.kicker, {
    x: m,
    y,
    w: w - 2 * r,
    size: 2.9 * u,
    color: kickerColor,
    weight: 800,
    ls: 160,
    upper: true,
  });
  y += 6 * u;
  k.text(c.title, { x: m, y, w, size, font: "h", color: ink });
  y += th + 3 * u;
  k.text(c.subtitle, { x: m, y, w, size: 3.6 * u, color: k.alpha(ink, 0.85), weight: 500 });
  if (c.cta) {
    const by = H - m - pillH(3.1 * u);
    const cw = k.pill(c.cta, m, by, { size: 3.1 * u, fill: ink, color: panel });
    sideNote(k, [c.handle, detailLine(k)], m + cw + 3 * u, by, w - cw - 3 * u, pillH(3.1 * u), {
      size: 2.6 * u,
      color: k.alpha(ink, 0.8),
    });
  }
}

/** A tilted instant photo on a colour card, words above. */
export function polaroid(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  k.bgGradient([p.bg, p.bg2], 160);
  k.dots(m, H - m - 12 * u, 6, 3, 4 * u, 0.6 * u, k.alpha(p.primary, 0.45));
  k.glow(W * 0.9, H * 0.12, 30 * u, p.secondary, 0.35);

  const kickerH = c.kicker ? 6 * u : 0;
  const subH = k.heightOf(c.subtitle, 3.5 * u, w);
  const size = k.fitBox(c.title, { w, maxH: H * 0.22, max: k.tall ? 12 * u : 9.5 * u, lines: 2 });
  const th = k.heightOf(c.title, size, w, "h");
  const textH = kickerH + th + 2.5 * u + subH;
  k.text(c.kicker, {
    x: m,
    y: m,
    w,
    size: 2.9 * u,
    color: p.primary,
    weight: 800,
    ls: 160,
    upper: true,
    align: "center",
  });
  k.text(c.title, { x: m, y: m + kickerH, w, size, font: "h", color: p.ink, align: "center" });
  k.text(c.subtitle, {
    x: m,
    y: m + kickerH + th + 2.5 * u,
    w,
    size: 3.5 * u,
    color: p.soft,
    align: "center",
    weight: 500,
  });

  const caption = c.handle || c.name;
  const avail = H - m - textH - 8 * u - m;
  const cw = Math.min(W * (k.tall ? 0.8 : 0.66), avail / 1.17);
  const ch = cw * 1.17;
  const cx = W / 2;
  const cy = m + textH + 6 * u + ch / 2;
  const pad = cw * 0.06;
  k.rect(cx - cw / 2, cy - ch / 2, cw, ch, { fill: p.primary, rotation: 7, r: 1 * u });
  const tilt = -4;
  k.rect(cx - cw / 2, cy - ch / 2, cw, ch, {
    fill: WHITE,
    rotation: tilt,
    r: 0.6 * u,
    shadow: { color: k.alpha("#000000", 0.22), blur: 30, y: 10 },
  });
  // The photo and caption turn with the card around the same centre.
  const pw = cw - 2 * pad;
  const photoCy = cy - ch / 2 + pad + pw / 2;
  const rot = (tilt * Math.PI) / 180;
  const shift = (d: number) => ({ x: cx - Math.sin(rot) * d, y: cy + Math.cos(rot) * d });
  const pc = shift(photoCy - cy);
  k.frame(pc.x - pw / 2, pc.y - pw / 2, pw, pw, { color: p.bg2, rotation: tilt });
  const capH = ch - pw - 2 * pad;
  const capSize = Math.min(4.2 * u, capH * 0.42);
  const cc = shift(ch / 2 - pad - capH / 2 + pad / 2);
  k.text(caption, {
    x: cc.x - pw / 2,
    y: cc.y - capSize * 0.7,
    w: pw,
    size: capSize,
    font: "h",
    color: k.pick(WHITE, [p.ink, p.bg, p.primary, "#1A1A1A"], 4.5),
    align: "center",
    rotation: tilt,
  });
}

/** Four photos in a grid with a card of words in the middle. */
export function photoGrid(k: Kit) {
  const { W, H, u, p, c } = k;
  const g = 1.4 * u;
  k.bgSolid(p.bg);
  const cw = (W - 3 * g) / 2;
  const chh = (H - 3 * g) / 2;
  for (let i = 0; i < 4; i++)
    k.frame(g + (i % 2) * (cw + g), g + Math.floor(i / 2) * (chh + g), cw, chh, { color: p.bg2 });

  const bw = W * (k.tall ? 0.78 : 0.66);
  const iw = bw - 10 * u;
  const subH = k.heightOf(c.subtitle, 3.2 * u, iw);
  const ctaH = c.cta ? pillH(3 * u) + 4 * u : 0;
  const size = k.fitBox(c.title, { w: iw, maxH: H * 0.22, max: k.tall ? 11 * u : 9 * u, lines: 3 });
  const th = k.heightOf(c.title, size, iw, "h");
  const bh = 6 * u + 5 * u + th + 2.5 * u + subH + ctaH + 5 * u;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  k.rect(bx, by, bw, bh, {
    fill: p.surface,
    r: 3 * u,
    shadow: { color: k.alpha("#000000", 0.28), blur: 40, y: 12 },
  });
  let y = by + 6 * u;
  k.text(c.kicker, {
    x: bx + 5 * u,
    y,
    w: iw,
    size: 2.7 * u,
    color: p.primary,
    weight: 800,
    ls: 160,
    upper: true,
    align: "center",
  });
  y += 5 * u;
  k.text(c.title, { x: bx + 5 * u, y, w: iw, size, font: "h", color: p.ink, align: "center" });
  y += th + 2.5 * u;
  k.text(c.subtitle, {
    x: bx + 5 * u,
    y,
    w: iw,
    size: 3.2 * u,
    color: p.soft,
    align: "center",
    weight: 500,
  });
  y += subH + 4 * u;
  if (c.cta) k.pill(c.cta, W / 2, y, { size: 3 * u, anchor: "center", fill: p.primary });
}

/** One colour over a full photo (duotone) with a big centred headline. */
export function duotone(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  const dark = [p.ink, p.bg, p.primary, "#111111"].reduce((a, b) =>
    contrastRatio(b, WHITE) > contrastRatio(a, WHITE) ? b : a,
  );
  const light = k.pick(dark, [p.secondary, p.accent, p.primary, p.bg2], 4.5);
  k.bgSolid(dark);
  k.frame(0, 0, W, H, { color: p.bg2, filters: { duotone: [dark, light] } });
  k.rect(0, 0, W, H, { fill: k.alpha(dark, 0.35), name: "tint" });
  k.rect(m, m, W - 2 * m, H - 2 * m, {
    fill: null,
    stroke: k.alpha(WHITE, 0.75),
    sw: Math.max(2, 0.35 * u),
  });

  const w = W - 2 * m - 10 * u;
  const subH = k.heightOf(c.subtitle, 3.6 * u, w);
  const room = H - 2 * m - 30 * u - subH;
  const size = k.fitBox(c.title, { w, maxH: room, max: k.tall ? 17 * u : 14 * u, lines: 4 });
  const th = k.heightOf(c.title, size, w, "h");
  const block = th + 3 * u + subH;
  let y = (H - block) / 2;
  k.text(c.kicker, {
    x: m,
    y: m + 5 * u,
    w: W - 2 * m,
    size: 2.8 * u,
    color: WHITE,
    weight: 800,
    ls: 240,
    upper: true,
    align: "center",
  });
  k.text(c.title, {
    x: m + 5 * u,
    y,
    w,
    size,
    font: "h",
    color: WHITE,
    align: "center",
    shadow: { color: k.alpha("#000000", 0.35), blur: 18, y: 4 },
  });
  y += th + 3 * u;
  k.text(c.subtitle, {
    x: m + 5 * u,
    y,
    w,
    size: 3.6 * u,
    color: WHITE,
    align: "center",
    weight: 500,
  });
  const foot = c.cta || c.handle;
  k.text(foot, {
    x: m,
    y: H - m - 9 * u,
    w: W - 2 * m,
    size: 3 * u,
    color: light,
    weight: 800,
    ls: 160,
    upper: true,
    align: "center",
  });
}

/** A product-style card: photo on top, words and price below, on a gradient. */
export function photoCard(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  k.bgGradient([p.primary, p.secondary], 150);
  k.glow(W * 0.1, H * 0.1, 40 * u, WHITE, 0.25);
  k.glow(W * 0.95, H * 0.95, 50 * u, p.accent, 0.35);
  const cw = W - 2 * m;
  const pad = 4 * u;
  const iw = cw - 2 * pad;
  const subH = k.heightOf(c.subtitle, 3.3 * u, iw);
  const ctaH = c.cta ? pillH(3 * u) + 4 * u : 0;
  const size = k.fitBox(c.title, {
    w: iw,
    maxH: H * 0.18,
    max: k.tall ? 10 * u : 8.5 * u,
    lines: 2,
  });
  const th = k.heightOf(c.title, size, iw, "h");
  const textH = 5 * u + th + 2 * u + subH + ctaH + pad;
  const ch = H - 2 * m - (k.tall ? 10 * u : 0);
  const cy = (H - ch) / 2;
  const ph = ch - textH - pad;
  k.rect(m, cy, cw, ch, {
    fill: p.surface,
    r: 4 * u,
    shadow: { color: k.alpha("#000000", 0.25), blur: 40, y: 14 },
  });
  k.frame(m + pad, cy + pad, iw, ph, { r: 3 * u, color: p.bg2 });
  k.pill(c.kicker, m + pad + 2.5 * u, cy + pad + 2.5 * u, {
    size: 2.6 * u,
    fill: p.accent,
    upper: true,
    ls: 80,
  });
  const stat = statOf(k);
  if (stat) {
    const label = `${stat[0]} ${stat[1]}`.trim();
    k.pill(label, m + pad + iw - 2.5 * u, cy + pad + ph - pillH(3.2 * u) - 2.5 * u, {
      size: 3.2 * u,
      anchor: "end",
      fill: p.ink,
      color: p.surface,
      font: "h",
    });
  }
  let y = cy + pad + ph + 5 * u;
  k.text(c.title, { x: m + pad, y, w: iw, size, font: "h", color: p.ink });
  y += th + 2 * u;
  k.text(c.subtitle, { x: m + pad, y, w: iw, size: 3.3 * u, color: p.soft, weight: 500 });
  y += subH + 4 * u;
  if (c.cta) {
    const bw = k.pill(c.cta, m + pad, y, { size: 3 * u, fill: p.primary });
    sideNote(k, [c.handle], m + pad + bw + 3 * u, y, iw - bw - 3 * u, pillH(3 * u), {
      size: 2.6 * u,
      color: p.soft,
    });
  }
}

/** A photo inside a thick colour border, words on a card overlapping it. */
export function photoBorder(k: Kit) {
  const { W, H, u, p, c } = k;
  const b = 5 * u;
  const m = 8 * u;
  k.bgSolid(p.primary);
  const w = W - 2 * b - 2 * m;
  const subH = k.heightOf(c.subtitle, 3.3 * u, w - 8 * u);
  const ctaH = c.cta ? pillH(3 * u) + 4 * u : 0;
  const size = k.fitBox(c.title, {
    w: w - 8 * u,
    maxH: H * 0.24,
    max: k.tall ? 12 * u : 9.5 * u,
    lines: 3,
  });
  const th = k.heightOf(c.title, size, w - 8 * u, "h");
  const cardH = 5 * u + 5.5 * u + th + 2.5 * u + subH + ctaH + 4 * u;
  k.frame(b, b, W - 2 * b, H - 2 * b - (k.tall ? 0 : 0), { color: p.bg2 });
  k.text(c.name, {
    x: b + 4 * u,
    y: b + 4 * u,
    w: W / 2,
    size: 3 * u,
    color: WHITE,
    weight: 800,
    ls: 80,
    shadow: { color: k.alpha("#000000", 0.5), blur: 10 },
  });
  const cy = H - b - m - cardH;
  const cx = b + m;
  k.rect(cx, cy, w, cardH, {
    fill: p.surface,
    r: 2 * u,
    shadow: { color: k.alpha("#000000", 0.3), blur: 30, y: 10 },
  });
  k.bar(cx, cy, w, 1.2 * u, p.accent, 0);
  let y = cy + 5 * u;
  k.text(c.kicker, {
    x: cx + 4 * u,
    y,
    w: w - 8 * u,
    size: 2.7 * u,
    color: p.primary,
    weight: 800,
    ls: 160,
    upper: true,
  });
  y += 5.5 * u;
  k.text(c.title, { x: cx + 4 * u, y, w: w - 8 * u, size, font: "h", color: p.ink });
  y += th + 2.5 * u;
  k.text(c.subtitle, { x: cx + 4 * u, y, w: w - 8 * u, size: 3.3 * u, color: p.soft, weight: 500 });
  y += subH + 4 * u;
  if (c.cta) k.pill(c.cta, cx + 4 * u, y, { size: 3 * u, fill: p.primary });
}

/** Three photo strips side by side, words below. */
export function photoStrips(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  const g = 2 * u;
  const w = W - 2 * m;
  k.bgSolid(p.bg);
  const subH = k.heightOf(c.subtitle, 3.4 * u, w);
  const ctaH = c.cta ? pillH(3 * u) + 5 * u : 0;
  const size = k.fitBox(c.title, { w, maxH: H * 0.22, max: k.tall ? 13 * u : 10 * u, lines: 3 });
  const th = k.heightOf(c.title, size, w, "h");
  const textH = 6 * u + th + 2.5 * u + subH + ctaH;
  const sh = H - 2 * m - textH - 6 * u;
  const sw = (w - 2 * g) / 3;
  for (let i = 0; i < 3; i++) {
    const lift = i === 1 ? 0 : 4 * u;
    k.frame(m + i * (sw + g), m + lift, sw, sh - lift, { r: sw / 2, color: p.bg2 });
  }
  k.circle(m + sw * 1.5 + g, m + sh, 6 * u, { fill: p.primary, stroke: p.bg, sw: 1 * u });
  k.icon(k.ic(), m + sw * 1.5 + g - 3.2 * u, m + sh - 3.2 * u, 6.4 * u, k.on(p.primary));
  let y = m + sh + 9 * u;
  k.text(c.kicker, {
    x: m,
    y,
    w,
    size: 2.8 * u,
    color: p.primary,
    weight: 800,
    ls: 160,
    upper: true,
    align: "center",
  });
  y += 6 * u;
  k.text(c.title, { x: m, y, w, size, font: "h", color: p.ink, align: "center" });
  y += th + 2.5 * u;
  k.text(c.subtitle, { x: m, y, w, size: 3.4 * u, color: p.soft, align: "center", weight: 500 });
  if (c.cta)
    k.pill(c.cta, W / 2, H - m - pillH(3 * u), { size: 3 * u, anchor: "center", fill: p.primary });
}

/** A round photo with a ring, the headline underneath. */
export function photoCircle(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  const w = W - 2 * m;
  k.bgSolid(p.bg);
  k.circle(W * 0.08, H * 0.06, 26 * u, { fill: k.alpha(p.secondary, 0.5) });
  k.circle(W * 0.95, H * 0.95, 34 * u, { fill: k.alpha(p.primary, 0.18) });
  const subH = k.heightOf(c.subtitle, 3.5 * u, w);
  const ctaH = c.cta ? pillH(3 * u) + 5 * u : 0;
  const size = k.fitBox(c.title, { w, maxH: H * 0.22, max: k.tall ? 13 * u : 10 * u, lines: 2 });
  const th = k.heightOf(c.title, size, w, "h");
  const textH = 6 * u + th + 2.5 * u + subH + ctaH;
  const r = Math.min(W * 0.36, (H - 2 * m - textH - 10 * u) / 2);
  const cx = W / 2;
  const cy = m + 2 * u + r;
  k.circle(cx, cy, r + 3.5 * u, {
    fill: null,
    stroke: p.primary,
    sw: Math.max(2, 0.6 * u),
    dash: [2 * u, 1.6 * u],
  });
  k.frame(cx - r, cy - r, 2 * r, 2 * r, { shape: "ellipse", color: p.bg2 });
  const stat = statOf(k);
  if (stat && stat[0].length <= 5) {
    const br = 9 * u;
    const bx = cx + r * 0.72;
    const byy = cy - r * 0.72;
    k.circle(bx, byy, br, { fill: p.accent });
    const on = k.on(p.accent);
    k.text(stat[0], {
      x: bx - br,
      y: byy - 4.6 * u,
      w: 2 * br,
      size: 5.2 * u,
      font: "h",
      color: on,
      align: "center",
    });
    k.text(stat[1], {
      x: bx - br,
      y: byy + 1.6 * u,
      w: 2 * br,
      size: 2 * u,
      color: on,
      align: "center",
      weight: 700,
    });
  }
  let y = cy + r + 8 * u;
  k.text(c.kicker, {
    x: m,
    y,
    w,
    size: 2.8 * u,
    color: p.primary,
    weight: 800,
    ls: 160,
    upper: true,
    align: "center",
  });
  y += 6 * u;
  k.text(c.title, { x: m, y, w, size, font: "h", color: p.ink, align: "center" });
  y += th + 2.5 * u;
  k.text(c.subtitle, { x: m, y, w, size: 3.5 * u, color: p.soft, align: "center", weight: 500 });
  if (c.cta)
    k.pill(c.cta, W / 2, H - m - pillH(3 * u), { size: 3 * u, anchor: "center", fill: p.primary });
}

// ─── Landscape ───────────────────────────────────────────────────────────────

/** Full photo, a fade from the left, words on the left. */
export function widePhoto(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 8 * u;
  k.bgSolid(shade(k));
  k.frame(0, 0, W, H, { color: p.bg2 });
  const d = shade(k);
  k.rect(0, 0, W * 0.75, H, {
    fill: k.grad([k.alpha(d, 0.92), k.alpha(d, 0.7), k.alpha(d, 0)], 90),
    name: "fade",
  });
  const w = W * 0.5;
  const kickerH = c.kicker ? pillH(3.4 * u) + 4 * u : 0;
  const subH = k.heightOf(c.subtitle, 4.4 * u, w);
  const ctaH = c.cta ? pillH(3.8 * u) + 5 * u : 0;
  const room = H - 2 * m - kickerH - subH - ctaH - 4 * u;
  const size = k.fitBox(c.title, { w, maxH: room, max: 17 * u, lines: 3 });
  const th = k.heightOf(c.title, size, w, "h");
  const block = kickerH + th + 3 * u + subH + ctaH;
  let y = (H - block) / 2;
  if (c.kicker) {
    k.pill(c.kicker, m, y, { size: 3.4 * u, fill: p.primary, upper: true, ls: 80 });
    y += kickerH;
  }
  k.text(c.title, { x: m, y, w, size, font: "h", color: WHITE });
  y += th + 3 * u;
  k.text(c.subtitle, { x: m, y, w, size: 4.4 * u, color: k.alpha(WHITE, 0.88), weight: 500 });
  y += subH + 5 * u;
  if (c.cta) k.pill(c.cta, m, y, { size: 3.8 * u, fill: WHITE, color: d });
  k.text(c.handle || c.name, {
    x: W / 2,
    y: H - m * 0.8 - 3 * u,
    w: W / 2 - m,
    size: 3 * u,
    color: WHITE,
    weight: 700,
    align: "right",
    shadow: { color: k.alpha("#000000", 0.5), blur: 10 },
  });
}

/** Three photo cards in a row under the headline. */
export function wideCards(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 7 * u;
  k.bgGradient([p.bg, p.bg2], 135);
  const w = W - 2 * m;
  const size = k.fit(c.title, { w: w * 0.8, max: 12 * u, lines: 1 });
  const th = k.heightOf(c.title, size, w * 0.8, "h");
  k.text(c.kicker, {
    x: m,
    y: m,
    w,
    size: 3.2 * u,
    color: p.primary,
    weight: 800,
    ls: 160,
    upper: true,
  });
  k.text(c.title, { x: m, y: m + 6 * u, w: w * 0.8, size, font: "h", color: p.ink });
  const top = m + 6 * u + th + 5 * u;
  const g = 3 * u;
  const cw = (w - 2 * g) / 3;
  // Short labels only (a theme without items falls back to whole sentences).
  const labels = itemsOf(k, 3).map((l) => (l.length <= 30 ? l : ""));
  const labelSize = 3.2 * u;
  const ch = H - top - m;
  for (let i = 0; i < 3; i++) {
    const x = m + i * (cw + g);
    k.frame(x, top, cw, ch, { r: 3 * u, color: p.bg2 });
    const label = labels[i];
    if (label)
      k.pill(label, x + 3 * u, top + ch - pillH(labelSize) - 3 * u, {
        size: k.fit(label, {
          w: cw - 6 * u - 2.4 * labelSize,
          max: labelSize,
          min: 2 * u,
          lines: 1,
          font: "b",
        }),
        h: pillH(labelSize),
        fill: i === 1 ? p.primary : p.surface,
        color: i === 1 ? k.on(p.primary) : p.ink,
      });
  }
  if (c.cta) k.pill(c.cta, W - m, m + 4 * u, { size: 3.4 * u, anchor: "end", fill: p.primary });
}

/** Photo on the right fading into the colour on the left — banners and covers. */
export function bannerPhoto(k: Kit) {
  const { W, H, u, p, c } = k;
  const m = 10 * u;
  const bg = p.dark ? p.bg : p.primary;
  const ink = k.on(bg);
  k.bgSolid(bg);
  const pw = W * 0.42;
  k.frame(W - pw, 0, pw, H, { color: p.bg2 });
  k.rect(W - pw - 1, 0, pw * 0.55, H, {
    fill: k.grad([bg, k.alpha(bg, 0)], 90),
    name: "fade",
  });
  const w = W - pw - 2 * m;
  const subH = k.heightOf(c.subtitle, 7 * u, w);
  const size = k.fitBox(c.title, { w, maxH: H - 2 * m - subH - 12 * u, max: 26 * u, lines: 2 });
  const th = k.heightOf(c.title, size, w, "h");
  let y = (H - (8 * u + th + 3 * u + subH)) / 2;
  k.text(c.kicker, {
    x: m,
    y,
    w,
    size: 5 * u,
    color: k.pick(bg, [p.secondary, p.accent], 2.5),
    weight: 800,
    ls: 160,
    upper: true,
  });
  y += 8 * u;
  k.text(c.title, { x: m, y, w, size, font: "h", color: ink });
  y += th + 3 * u;
  k.text(c.subtitle, { x: m, y, w, size: 7 * u, color: k.alpha(ink, 0.85), weight: 500 });
}

export const PHOTO_BLUEPRINTS = {
  photoFull,
  magazine,
  photoSplit,
  polaroid,
  photoGrid,
  duotone,
  photoCard,
  photoBorder,
  photoStrips,
  photoCircle,
  widePhoto,
  wideCards,
  bannerPhoto,
};
