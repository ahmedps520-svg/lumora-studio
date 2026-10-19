/**
 * Presentation decks (16:9): eight slides each — cover, agenda, story with a
 * photo, big numbers, a chart, a quote, the team and a closing slide.
 */
import { PATHS, type Kit } from "../kit";
import type { TemplateLocale } from "../types";

type Style = "clean" | "bold";

const WORDS: Record<TemplateLocale, Record<string, string>> = {
  en: {
    agenda: "Agenda",
    about: "Why it matters",
    numbers: "By the numbers",
    growth: "Growth over the year",
    team: "Meet the team",
    thanks: "Thank you",
    questions: "Questions? Let’s talk.",
    series1: "This year",
    series2: "Last year",
    roles: "Founder & CEO|Head of Design|Head of Growth",
    people: "Sara Ahmed|Omar Khalil|Lina Haddad",
    overview: "Overview|Our goals|The plan|Next steps",
  },
  ar: {
    agenda: "جدول الأعمال",
    about: "لماذا يهمّ هذا",
    numbers: "بالأرقام",
    growth: "النمو خلال العام",
    team: "تعرّف على الفريق",
    thanks: "شكرًا لكم",
    questions: "لديكم أسئلة؟ لنتحدث.",
    series1: "هذا العام",
    series2: "العام الماضي",
    roles: "المؤسِّسة والرئيسة التنفيذية|رئيس التصميم|رئيسة النمو",
    people: "سارة أحمد|عمر خليل|لينا حداد",
    overview: "نظرة عامة|أهدافنا|الخطة|الخطوات التالية",
  },
};

function words(k: Kit) {
  return WORDS[k.locale];
}

/** Background + small brand mark shared by the inner slides. */
function frame(k: Kit, style: Style, n: number) {
  const { W, H, u, p, c } = k;
  if (style === "bold") {
    k.bgSolid(p.bg);
    k.rect(0, 0, 2.2 * u, H, { fill: k.grad([p.primary, p.secondary], 180) });
  } else {
    k.bgSolid(p.bg);
    k.rect(8 * u, H - 9 * u, W - 16 * u, Math.max(1, 0.15 * u), { fill: k.alpha(p.soft, 0.35) });
  }
  k.text(c.name, {
    x: 8 * u,
    y: H - 7 * u,
    w: W / 2,
    size: 2.2 * u,
    color: p.soft,
    weight: 700,
    ls: 100,
    upper: true,
  });
  k.text(String(n).padStart(2, "0"), {
    x: W / 2,
    y: H - 7 * u,
    w: W / 2 - 8 * u,
    size: 2.2 * u,
    color: p.soft,
    align: "right",
    weight: 700,
  });
}

function heading(k: Kit, text: string, kicker: string) {
  const { W, u, p } = k;
  k.text(kicker, {
    x: 8 * u,
    y: 8 * u,
    w: W - 16 * u,
    size: 2.6 * u,
    color: p.primary,
    weight: 700,
    ls: 200,
    upper: true,
  });
  return (
    k.text(text, {
      x: 8 * u,
      y: 12.5 * u,
      w: W - 16 * u,
      size: k.fit(text, { w: W - 16 * u, max: 7 * u, lines: 1 }),
      font: "h",
      color: p.ink,
    }) +
    12.5 * u
  );
}

function cover(k: Kit, style: Style) {
  const { W, H, u, p, c } = k;
  if (style === "bold") {
    k.bgGradient([p.primary, p.secondary], 125);
    k.glow(W * 0.85, H * 0.2, 60 * u, p.accent, 0.5);
    k.circle(W * 0.86, H * 0.78, 34 * u, { fill: k.alpha("#FFFFFF", 0.12) });
    k.path(PATHS.blob2, W * 0.62, H * 0.12, 46 * u, 46 * u, { fill: k.alpha("#FFFFFF", 0.14) });
    const on = k.on(p.primary);
    k.text(c.kicker, {
      x: 10 * u,
      y: 20 * u,
      w: W * 0.6,
      size: 3 * u,
      color: on,
      weight: 700,
      ls: 250,
      upper: true,
    });
    const t = k.title(c.title, {
      x: 10 * u,
      y: 27 * u,
      w: W * 0.62,
      max: 15 * u,
      lines: 2,
      color: on,
    });
    k.text(c.subtitle, {
      x: 10 * u,
      y: 31 * u + t.h,
      w: W * 0.55,
      size: 3.8 * u,
      color: on,
      weight: 500,
      opacity: 0.92,
    });
    k.text(`${c.name}${c.date ? `  ·  ${c.date}` : ""}`, {
      x: 10 * u,
      y: H - 14 * u,
      w: W * 0.6,
      size: 2.6 * u,
      color: on,
      weight: 700,
    });
  } else {
    k.bgSolid(p.bg);
    const fw = W * 0.42;
    k.frame(W - fw, 0, fw, H, { color: p.bg2 });
    k.rect(W - fw - 3 * u, 18 * u, 6 * u, 6 * u, { fill: p.primary, r: 1.5 * u });
    k.icon(k.ic(), 10 * u, 14 * u, 7 * u, p.primary);
    k.text(c.kicker, {
      x: 10 * u,
      y: 27 * u,
      w: W - fw - 20 * u,
      size: 2.8 * u,
      color: p.primary,
      weight: 700,
      ls: 200,
      upper: true,
    });
    const t = k.title(c.title, {
      x: 10 * u,
      y: 33 * u,
      w: W - fw - 20 * u,
      max: 12 * u,
      lines: 3,
      color: p.ink,
    });
    k.bar(10 * u, 37 * u + t.h, 12 * u, 1 * u, p.primary, 0);
    k.text(c.subtitle, {
      x: 10 * u,
      y: 42 * u + t.h,
      w: W - fw - 22 * u,
      size: 3.4 * u,
      color: p.soft,
    });
    k.text(c.name, {
      x: 10 * u,
      y: H - 12 * u,
      w: W / 3,
      size: 2.4 * u,
      color: p.ink,
      weight: 700,
      ls: 100,
      upper: true,
    });
  }
}

function agenda(k: Kit, style: Style) {
  const { W, H, u, p, c } = k;
  frame(k, style, 2);
  const items = c.items.length >= 3 ? c.items.slice(0, 4) : words(k).overview!.split("|");
  const top = heading(k, words(k).agenda!, c.name) + 10 * u;
  const cw = (W - 16 * u - (items.length - 1) * 3 * u) / items.length;
  items.forEach((item, i) => {
    const x = 8 * u + i * (cw + 3 * u);
    const fill = style === "bold" ? (i % 2 ? p.secondary : p.primary) : p.bg2;
    k.rect(x, top, cw, H - top - 18 * u, { fill, r: 2.5 * u });
    const ink = k.on(fill);
    k.text(String(i + 1).padStart(2, "0"), {
      x: x + 3.5 * u,
      y: top + 4 * u,
      w: cw - 7 * u,
      size: 8 * u,
      font: "h",
      color: style === "bold" ? ink : p.primary,
      upper: false,
      lh: 1,
    });
    k.text(item, {
      x: x + 3.5 * u,
      y: H - 18 * u - 16 * u,
      w: cw - 7 * u,
      size: 3.2 * u,
      color: ink,
      weight: 700,
    });
  });
}

function story(k: Kit, style: Style) {
  const { W, H, u, p, c } = k;
  frame(k, style, 3);
  const fw = W * 0.4;
  k.frame(W - 8 * u - fw, 8 * u, fw, H - 22 * u, { r: style === "bold" ? 3 * u : 0, color: p.bg2 });
  const w = W - 24 * u - fw;
  const top = heading(k, words(k).about!, c.kicker) + 6 * u;
  const bodyH = k.text(c.body || c.subtitle, {
    x: 8 * u,
    y: top,
    w: w * 0.95,
    size: 3.4 * u,
    color: p.soft,
    lh: 1.5,
  });
  let y = top + bodyH + 6 * u;
  for (const item of c.items.slice(0, 3)) {
    k.circle(9.5 * u, y + 1.9 * u, 1.3 * u, { fill: p.primary });
    k.text(item, { x: 13 * u, y, w: w - 6 * u, size: 3.2 * u, color: p.ink, weight: 600 });
    y += 6.5 * u;
  }
}

function numbers(k: Kit, style: Style) {
  const { W, H, u, p, c } = k;
  frame(k, style, 4);
  const stats = c.stats.length ? c.stats.slice(0, 3) : ([["3×", c.subtitle]] as [string, string][]);
  const top = heading(k, words(k).numbers!, c.name) + 12 * u;
  const cw = (W - 16 * u) / stats.length;
  stats.forEach(([value, label], i) => {
    const x = 8 * u + i * cw;
    const size = k.fit(value, { w: cw - 8 * u, max: 18 * u, lines: 1 });
    k.text(value, {
      x,
      y: top,
      w: cw - 4 * u,
      size,
      font: "h",
      color: i === 1 ? p.secondary : p.primary,
      lh: 1,
      upper: false,
    });
    k.bar(x, top + size * 1.1, 10 * u, 0.8 * u, p.accent, 0);
    k.text(label, {
      x,
      y: top + size * 1.1 + 4 * u,
      w: cw - 6 * u,
      size: 3.4 * u,
      color: p.soft,
      weight: 600,
    });
  });
  if (style === "bold") k.circle(W - 6 * u, H * 0.25, 18 * u, { fill: k.alpha(p.primary, 0.12) });
}

function chart(k: Kit, style: Style) {
  const { W, H, u, p, c } = k;
  frame(k, style, 5);
  const top = heading(k, words(k).growth!, c.kicker) + 4 * u;
  const wd = words(k);
  k.chart(
    style === "bold" ? "bar" : "line",
    8 * u,
    top,
    W * 0.58,
    H - top - 14 * u,
    {
      title: "",
      labels: ["Q1", "Q2", "Q3", "Q4"],
      series: [
        { name: wd.series1!, values: [24, 38, 46, 62] },
        { name: wd.series2!, values: [18, 22, 31, 40] },
      ],
    },
    { text: p.soft },
  );
  const x = W * 0.58 + 14 * u;
  const w = W - x - 8 * u;
  const stat = c.stats[0];
  if (stat) {
    k.text(stat[0], {
      x,
      y: top + 8 * u,
      w,
      size: k.fit(stat[0], { w, max: 14 * u, lines: 1 }),
      font: "h",
      color: p.primary,
      lh: 1,
      upper: false,
    });
    k.text(stat[1], { x, y: top + 24 * u, w, size: 3.2 * u, color: p.soft, weight: 600 });
  }
  k.text(c.body || c.subtitle, { x, y: top + 34 * u, w, size: 3 * u, color: p.ink, lh: 1.5 });
}

function quote(k: Kit, style: Style) {
  const { W, H, u, p, c } = k;
  const text = c.quote || c.body || c.subtitle;
  if (style === "bold") {
    k.bgGradient([p.primary, p.secondary], 135);
  } else {
    k.bgSolid(p.bg2);
  }
  const ink = style === "bold" ? k.on(p.primary) : p.ink;
  k.path(PATHS.quote, 10 * u, 12 * u, 16 * u, 16 * u, {
    fill: style === "bold" ? k.alpha(ink, 0.9) : p.primary,
  });
  const w = W - 30 * u;
  const size = k.fitBox(text, { w, maxH: H - 50 * u, max: 7 * u, lines: 4, font: "h", lh: 1.25 });
  const qh = k.text(text, { x: 10 * u, y: 34 * u, w, size, font: "h", color: ink, lh: 1.25 });
  k.text(`— ${c.author || c.name}`, {
    x: 10 * u,
    y: 40 * u + qh,
    w,
    size: 3.2 * u,
    color: ink,
    weight: 700,
    opacity: 0.85,
  });
}

function team(k: Kit, style: Style) {
  const { W, H, u, p, c } = k;
  frame(k, style, 7);
  const top = heading(k, words(k).team!, c.name) + 8 * u;
  const names = words(k).people!.split("|");
  const roles = words(k).roles!.split("|");
  const cw = (W - 16 * u) / 3;
  const r = Math.min(cw * 0.28, (H - top - 34 * u) / 2);
  names.forEach((name, i) => {
    const cx = 8 * u + cw * (i + 0.5);
    k.circle(cx, top + r + 1 * u, r + 1.2 * u, { fill: i === 1 ? p.secondary : p.primary });
    k.frame(cx - r, top + 1 * u, 2 * r, 2 * r, {
      shape: "ellipse",
      color: p.bg2,
      photo: "people",
    });
    k.text(name, {
      x: cx - cw / 2,
      y: top + 2 * r + 6 * u,
      w: cw,
      size: 3.4 * u,
      align: "center",
      color: p.ink,
      weight: 700,
    });
    k.text(roles[i] ?? "", {
      x: cx - cw / 2,
      y: top + 2 * r + 11 * u,
      w: cw,
      size: 2.6 * u,
      align: "center",
      color: p.soft,
    });
  });
}

function closing(k: Kit, style: Style) {
  const { W, H, u, p, c } = k;
  if (style === "bold") {
    k.bgGradient([p.secondary, p.primary], 135);
    k.glow(W * 0.2, H * 0.8, 50 * u, p.accent, 0.45);
  } else {
    k.bgSolid(p.bg);
    k.circle(W / 2, H / 2, 40 * u, { fill: p.bg2 });
  }
  const ink = style === "bold" ? k.on(p.primary) : p.ink;
  const w = W - 30 * u;
  k.text(words(k).thanks!, {
    x: 15 * u,
    y: 32 * u,
    w,
    size: 14 * u,
    font: "h",
    align: "center",
    color: ink,
  });
  k.text(words(k).questions!, {
    x: 15 * u,
    y: 52 * u,
    w,
    size: 3.6 * u,
    align: "center",
    color: ink,
    weight: 500,
  });
  const info = [c.handle, c.place].filter(Boolean).join("  ·  ");
  k.text(info, {
    x: 15 * u,
    y: 62 * u,
    w,
    size: 2.8 * u,
    align: "center",
    color: ink,
    weight: 700,
    opacity: 0.85,
  });
  if (c.cta)
    k.pill(c.cta, W / 2, 70 * u, {
      size: 3 * u,
      anchor: "center",
      fill: style === "bold" ? "#FFFFFF" : p.primary,
      color: style === "bold" ? p.primary : undefined,
    });
}

function deck(style: Style) {
  return (page: () => Kit) => {
    cover(page(), style);
    agenda(page(), style);
    story(page(), style);
    numbers(page(), style);
    chart(page(), style);
    quote(page(), style);
    team(page(), style);
    closing(page(), style);
  };
}

export const DECK_BLUEPRINTS = {
  deckClean: deck("clean"),
  deckBold: deck("bold"),
};
