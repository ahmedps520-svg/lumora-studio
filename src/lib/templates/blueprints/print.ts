/**
 * Print layouts: business cards (front + back), logos, certificates, menus
 * and résumés. People and details are made-up placeholders.
 */
import { PATHS, type Kit } from "../kit";
import type { TemplateLocale } from "../types";

interface Person {
  name: string;
  role: string;
  phone: string;
  email: string;
}

const PEOPLE: Record<TemplateLocale, Person[]> = {
  en: [
    {
      name: "Sara Ahmed",
      role: "Creative Director",
      phone: "+1 555 014 2200",
      email: "sara@studio.com",
    },
    {
      name: "Omar Khalil",
      role: "Founder & CEO",
      phone: "+1 555 019 8810",
      email: "omar@company.com",
    },
    {
      name: "Lina Haddad",
      role: "Marketing Manager",
      phone: "+1 555 017 3344",
      email: "lina@brand.com",
    },
    { name: "Adam Yousef", role: "Head Chef", phone: "+1 555 012 7766", email: "adam@kitchen.com" },
    {
      name: "Maya Ali",
      role: "Wellness Coach",
      phone: "+1 555 016 5522",
      email: "maya@studio.com",
    },
  ],
  ar: [
    {
      name: "سارة أحمد",
      role: "المديرة الإبداعية",
      phone: "+966 55 014 2200",
      email: "sara@studio.com",
    },
    {
      name: "عمر خليل",
      role: "المؤسس والرئيس التنفيذي",
      phone: "+966 55 019 8810",
      email: "omar@company.com",
    },
    {
      name: "لينا حداد",
      role: "مديرة التسويق",
      phone: "+966 55 017 3344",
      email: "lina@brand.com",
    },
    { name: "آدم يوسف", role: "رئيس الطهاة", phone: "+966 55 012 7766", email: "adam@kitchen.com" },
    { name: "مايا علي", role: "مدرّبة عافية", phone: "+966 55 016 5522", email: "maya@studio.com" },
  ],
};

function person(k: Kit): Person {
  const list = PEOPLE[k.locale];
  const i = Math.abs([...k.c.name].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7)) % list.length;
  return list[i]!;
}

/** Phone / email / website / address rows with icons. Returns height. */
function contacts(
  k: Kit,
  x: number,
  y: number,
  w: number,
  size: number,
  color: string,
  iconColor: string,
) {
  const who = person(k);
  const rows = [
    ["phone", who.phone],
    ["mail", who.email],
    ["globe", k.c.handle],
    ["map-pin", k.c.place],
  ].filter(([, t]) => t);
  rows.forEach(([icon, text], i) => {
    const ry = y + i * size * 1.9;
    k.icon(icon!, x, ry + size * 0.1, size * 1.15, iconColor);
    k.text(text!, {
      x: x + size * 1.8,
      y: ry,
      w: w - size * 1.8,
      size,
      color,
      weight: 500,
      lh: 1.3,
    });
  });
  return rows.length * size * 1.9;
}

// ─── Business cards ──────────────────────────────────────────────────────────

export function bcMinimal(page: () => Kit) {
  const k = page();
  const { W, H, u, p } = k;
  const who = person(k);
  k.bgSolid(p.surface);
  k.rect(0, H - 3 * u, W, 3 * u, { fill: p.primary });
  k.text(who.name, {
    x: 8 * u,
    y: 14 * u,
    w: W * 0.5,
    size: k.fit(who.name, { w: W * 0.48, max: 9 * u, lines: 2 }),
    font: "h",
    color: p.ink,
    upper: false,
  });
  k.text(who.role, {
    x: 8 * u,
    y: 36 * u,
    w: W * 0.5,
    size: 4.6 * u,
    color: p.primary,
    weight: 700,
  });
  k.bar(8 * u, 47 * u, 14 * u, 0.9 * u, p.primary, 0);
  contacts(k, W * 0.56, 16 * u, W * 0.4, 4.2 * u, p.ink, p.primary);
  const b = page();
  b.bgGradient([p.primary, p.secondary], 135);
  const on = b.on(p.primary);
  b.icon(b.ic(), W / 2 - 10 * u, H / 2 - 22 * u, 20 * u, on);
  b.text(b.c.name, {
    x: 8 * u,
    y: H / 2 + 2 * u,
    w: W - 16 * u,
    size: b.fit(b.c.name, { w: W - 16 * u, max: 10 * u, lines: 1 }),
    font: "h",
    align: "center",
    color: on,
  });
}

export function bcBand(page: () => Kit) {
  const k = page();
  const { W, H, u, p } = k;
  const who = person(k);
  k.bgSolid(p.surface);
  const bw = W * 0.36;
  k.rect(0, 0, bw, H, { fill: k.grad([p.primary, p.secondary], 160) });
  const on = k.on(p.primary);
  k.icon(k.ic(), bw / 2 - 9 * u, H / 2 - 20 * u, 18 * u, on);
  k.text(k.c.name, {
    x: 4 * u,
    y: H / 2 + 3 * u,
    w: bw - 8 * u,
    size: k.fit(k.c.name, { w: bw - 8 * u, max: 6 * u, lines: 2 }),
    font: "h",
    align: "center",
    color: on,
  });
  const x = bw + 8 * u;
  const w = W - x - 7 * u;
  k.text(who.name, {
    x,
    y: 12 * u,
    w,
    size: k.fit(who.name, { w, max: 8 * u, lines: 1 }),
    font: "h",
    color: p.ink,
    upper: false,
  });
  k.text(who.role, { x, y: 23 * u, w, size: 4.2 * u, color: p.primary, weight: 700 });
  contacts(k, x, 38 * u, w, 3.9 * u, p.ink, p.primary);
  const b = page();
  b.bgSolid(p.bg2);
  b.dots(8 * u, 8 * u, 6, 4, 4 * u, 0.6 * u, b.alpha(p.primary, 0.4));
  b.circle(W - 14 * u, H - 10 * u, 26 * u, { fill: b.alpha(p.primary, 0.18) });
  b.text(b.c.handle || b.c.name, {
    x: 8 * u,
    y: H / 2 - 4 * u,
    w: W - 16 * u,
    size: 6 * u,
    align: "center",
    color: p.ink,
    weight: 700,
  });
}

export function bcDark(page: () => Kit) {
  const k = page();
  const { W, H, u, p } = k;
  const who = person(k);
  const dark = p.dark ? p.bg : p.ink;
  const gold = p.dark ? p.primary : p.secondary;
  k.bgSolid(dark);
  k.rect(5 * u, 5 * u, W - 10 * u, H - 10 * u, {
    fill: null,
    stroke: k.alpha(gold, 0.6),
    sw: 0.4 * u,
  });
  k.icon(k.ic(), W / 2 - 9 * u, H / 2 - 24 * u, 18 * u, gold, { stroke: 1.5 });
  k.text(k.c.name, {
    x: 10 * u,
    y: H / 2,
    w: W - 20 * u,
    size: k.fit(k.c.name, { w: W - 20 * u, max: 9 * u, lines: 1 }),
    font: "h",
    align: "center",
    color: "#FFFFFF",
  });
  k.text(k.c.kicker, {
    x: 10 * u,
    y: H / 2 + 13 * u,
    w: W - 20 * u,
    size: 3.4 * u,
    align: "center",
    color: gold,
    ls: 250,
    upper: true,
    weight: 600,
  });
  const b = page();
  b.bgSolid(dark);
  b.rect(0, 0, 2.2 * u, H, { fill: gold });
  b.text(who.name, {
    x: 10 * u,
    y: 12 * u,
    w: W - 20 * u,
    size: 8 * u,
    font: "h",
    color: "#FFFFFF",
    upper: false,
  });
  b.text(who.role, {
    x: 10 * u,
    y: 24 * u,
    w: W - 20 * u,
    size: 4.2 * u,
    color: gold,
    weight: 600,
  });
  contacts(b, 10 * u, 38 * u, W - 20 * u, 4 * u, "#FFFFFF", gold);
}

export function bcCorner(page: () => Kit) {
  const k = page();
  const { W, H, u, p } = k;
  const who = person(k);
  k.bgSolid(p.surface);
  k.path(PATHS.corner, 0, 0, W * 0.45, H * 0.8, { fill: k.grad([p.primary, p.secondary], 135) });
  k.path(PATHS.corner, 0, 0, W * 0.3, H * 0.55, { fill: k.alpha(p.accent, 0.8) });
  k.icon(k.ic(), 7 * u, 7 * u, 12 * u, k.on(p.primary));
  k.text(who.name, {
    x: 8 * u,
    y: H - 32 * u,
    w: W * 0.52,
    size: k.fit(who.name, { w: W * 0.5, max: 8 * u, lines: 1 }),
    font: "h",
    color: p.ink,
    upper: false,
  });
  k.text(who.role, {
    x: 8 * u,
    y: H - 20 * u,
    w: W * 0.5,
    size: 4 * u,
    color: p.primary,
    weight: 700,
  });
  contacts(k, W * 0.6, 22 * u, W * 0.37, 3.8 * u, p.ink, p.primary);
  const b = page();
  b.bgSolid(p.primary);
  const on = b.on(p.primary);
  const s = H * 0.55;
  b.qr(`https://${b.c.handle.replace(/^@/, "")}`, W * 0.62, (H - s) / 2, s, {
    fg: p.ink,
    bg: "#FFFFFF",
  });
  b.text(b.c.name, {
    x: 8 * u,
    y: H / 2 - 12 * u,
    w: W * 0.5,
    size: b.fit(b.c.name, { w: W * 0.5, max: 9 * u, lines: 2 }),
    font: "h",
    color: on,
  });
  b.text(b.c.handle, {
    x: 8 * u,
    y: H / 2 + 8 * u,
    w: W * 0.5,
    size: 4 * u,
    color: on,
    weight: 600,
  });
}

// ─── Logos ───────────────────────────────────────────────────────────────────

function tagline(k: Kit) {
  return k.c.kicker;
}

export function logoBadge(k: Kit) {
  const { W, H, u, p, c } = k;
  k.bgSolid(p.surface);
  k.circle(W / 2, H * 0.4, 24 * u, { fill: k.grad([p.primary, p.secondary], 135) });
  k.icon(k.ic(), W / 2 - 13 * u, H * 0.4 - 13 * u, 26 * u, k.on(p.primary), { stroke: 1.8 });
  k.text(c.name, {
    x: 8 * u,
    y: H * 0.7,
    w: W - 16 * u,
    size: k.fit(c.name, { w: W - 16 * u, max: 11 * u, lines: 1 }),
    font: "h",
    align: "center",
    color: p.ink,
  });
  k.text(tagline(k), {
    x: 8 * u,
    y: H * 0.7 + 14 * u,
    w: W - 16 * u,
    size: 3.4 * u,
    align: "center",
    color: p.soft,
    ls: 300,
    upper: true,
    weight: 600,
  });
}

export function logoMonogram(k: Kit) {
  const { W, H, u, p, c } = k;
  k.bgSolid(p.surface);
  const s = 44 * u;
  const box = k.pick(p.surface, [p.ink, p.primary, "#111111"], 3);
  const accent = k.pick(box, [p.primary, p.accent, p.secondary], 3);
  k.rect((W - s) / 2, H * 0.12, s, s, { fill: box, r: 11 * u });
  k.rect((W - s) / 2 + 3 * u, H * 0.12 + 3 * u, s - 6 * u, s - 6 * u, {
    fill: null,
    stroke: k.alpha(accent, 0.9),
    sw: 0.6 * u,
    r: 9 * u,
  });
  const letter = [...c.name.replace(/^(the|al)\s+/i, "")][0] ?? "L";
  k.text(letter, {
    x: (W - s) / 2,
    y: H * 0.12 + s / 2 - 17 * u,
    w: s,
    size: 30 * u,
    font: "h",
    align: "center",
    color: accent,
    lh: 1.1,
    upper: true,
  });
  k.text(c.name, {
    x: 8 * u,
    y: H * 0.7,
    w: W - 16 * u,
    size: k.fit(c.name, { w: W - 16 * u, max: 10 * u, lines: 1 }),
    font: "h",
    align: "center",
    color: p.ink,
  });
  k.bar(W / 2 - 6 * u, H * 0.7 + 14 * u, 12 * u, 0.7 * u, accent);
}

export function logoRing(k: Kit) {
  const { W, H, u, p, c } = k;
  k.bgSolid(p.bg);
  const cy = H * 0.42;
  k.circle(W / 2, cy, 30 * u, { fill: null, stroke: p.primary, sw: 1.2 * u });
  k.circle(W / 2, cy, 26 * u, {
    fill: null,
    stroke: k.alpha(p.primary, 0.5),
    sw: 0.4 * u,
    dash: [1.2 * u, 1.2 * u],
  });
  k.circle(W / 2, cy, 19 * u, { fill: p.primary });
  k.icon(k.ic(), W / 2 - 11 * u, cy - 11 * u, 22 * u, k.on(p.primary), { stroke: 1.8 });
  k.path(PATHS.sparkle, W / 2 - 38 * u, cy - 3 * u, 6 * u, 6 * u, { fill: p.accent });
  k.path(PATHS.sparkle, W / 2 + 32 * u, cy - 3 * u, 6 * u, 6 * u, { fill: p.accent });
  k.text(c.name, {
    x: 8 * u,
    y: H * 0.78,
    w: W - 16 * u,
    size: k.fit(c.name, { w: W - 16 * u, max: 10 * u, lines: 1 }),
    font: "h",
    align: "center",
    color: p.ink,
  });
}

export function logoWordmark(k: Kit) {
  const { W, H, u, p, c } = k;
  k.bgSolid(p.surface);
  const size = k.fit(c.name, { w: W * 0.62, max: 14 * u, lines: 1 });
  const nameW = Math.min(W * 0.62, k.measure(c.name, size, k.family("h", c.name)));
  const total = 22 * u + nameW;
  const x = (W - total) / 2;
  k.rect(x, H / 2 - 9 * u, 18 * u, 18 * u, {
    fill: k.grad([p.primary, p.secondary], 135),
    r: 5 * u,
  });
  k.icon(k.ic(), x + 4 * u, H / 2 - 5 * u, 10 * u, k.on(p.primary));
  k.text(c.name, {
    x: x + 22 * u,
    y: H / 2 - size * 0.6,
    w: W - x - 22 * u - 4 * u,
    size,
    font: "h",
    color: p.ink,
    lh: 1.2,
  });
  k.text(tagline(k), {
    x: 8 * u,
    y: H / 2 + 15 * u,
    w: W - 16 * u,
    size: 3 * u,
    align: "center",
    color: p.soft,
    ls: 250,
    upper: true,
    weight: 600,
  });
}

export function logoStamp(k: Kit) {
  const { W, H, u, p, c } = k;
  k.bgSolid(p.bg2);
  const fill = k.pick(p.bg2, [p.ink, p.primary, "#111111"], 3);
  const accent = k.pick(fill, [p.primary, p.accent, p.secondary, p.bg2], 3);
  k.shape("polygon", W / 2 - 34 * u, H / 2 - 34 * u, 68 * u, 68 * u, { fill, sides: 6 });
  k.shape("polygon", W / 2 - 30 * u, H / 2 - 30 * u, 60 * u, 60 * u, {
    fill: null,
    stroke: accent,
    sw: 0.6 * u,
    sides: 6,
  });
  k.icon(k.ic(), W / 2 - 10 * u, H / 2 - 20 * u, 20 * u, accent);
  k.text(c.name, {
    x: W / 2 - 24 * u,
    y: H / 2 + 3 * u,
    w: 48 * u,
    size: k.fit(c.name, { w: 46 * u, max: 7 * u, lines: 2 }),
    font: "h",
    align: "center",
    color: k.on(fill),
  });
}

const CERT_FOR: Record<
  TemplateLocale,
  Record<string, [reason: string, org: string, date: string]>
> = {
  en: {
    course: [
      "for successfully completing the Learn to Code bootcamp",
      "CodeCamp Academy",
      "December 2026",
    ],
    marathon: ["for finishing the City Marathon 2026", "City Marathon", "November 8, 2026"],
    graduation: ["for graduating with honours, Class of 2026", "Cedar Academy", "June 19, 2026"],
    kidsWorkshop: [
      "for completing the Little Artists Workshop",
      "Rainbow Arts Center",
      "July 31, 2026",
    ],
    charity: ["for 100 hours of volunteering with Brighter Future", "Brighter Future", "2026"],
    scienceFair: ["for first place at the School Science Fair", "Cedar School", "May 21, 2026"],
    languageClass: ["for completing Upper-Intermediate English", "Lingua Center", "June 2026"],
    runningClub: ["for running 50 Saturday 5Ks with the club", "Sunrise Run Club", "2026"],
    fitnessChallenge: [
      "for completing the 30-Day Strength Challenge",
      "Fit With Rami",
      "July 1, 2026",
    ],
    potteryClass: ["for completing the Wheel Throwing course", "Clay House Studio", "2026"],
    techSummit: ["for attending Future Tech Summit 2026", "Future Tech Summit", "October 22, 2026"],
  },
  ar: {
    course: ["لإتمامه معسكر تعلّم البرمجة بنجاح", "أكاديمية كود كامب", "ديسمبر 2026"],
    marathon: ["لإنهائه ماراثون المدينة 2026", "ماراثون المدينة", "8 نوفمبر 2026"],
    graduation: ["لتخرّجه بمرتبة الشرف، دفعة 2026", "أكاديمية الأرز", "19 يونيو 2026"],
    kidsWorkshop: ["لإتمامه ورشة الفنانين الصغار", "مركز قوس قزح للفنون", "31 يوليو 2026"],
    charity: ["لتطوّعه 100 ساعة مع مستقبل أفضل", "مستقبل أفضل", "2026"],
    scienceFair: ["لفوزه بالمركز الأول في معرض العلوم المدرسي", "مدرسة الأرز", "21 مايو 2026"],
    languageClass: ["لإتمامه مستوى اللغة الإنجليزية فوق المتوسط", "مركز لينغوا", "يونيو 2026"],
    runningClub: ["لجريه 50 سباقًا لمسافة 5 كم مع النادي", "نادي جري الشروق", "2026"],
    fitnessChallenge: ["لإتمامه تحدّي القوة لمدة 30 يومًا", "لياقة مع رامي", "1 يوليو 2026"],
    potteryClass: ["لإتمامه دورة التشكيل على العجلة", "استوديو بيت الطين", "2026"],
    techSummit: ["لحضوره قمة تقنيات المستقبل 2026", "قمة تقنيات المستقبل", "22 أكتوبر 2026"],
  },
};

function certFacts(k: Kit): [string, string, string] {
  return (
    CERT_FOR[k.locale][k.theme] ?? [
      `${CERT[k.locale].for} ${k.c.title.replaceAll("\n", " ")}`,
      k.c.name,
      k.c.date || "2026",
    ]
  );
}

function certBody(
  k: Kit,
  x: number,
  w: number,
  top: number,
  color: string,
  soft: string,
  accent: string,
) {
  const { u } = k;
  const t = CERT[k.locale];
  const who = person(k);
  const [reason] = certFacts(k);
  let y = top;
  k.text(t.to!, { x, y, w, size: 2.8 * u, align: "center", color: soft });
  y += 6 * u;
  const nameFont = k.f.accent ?? "h";
  y +=
    k.text(who.name, {
      x,
      y,
      w,
      size: k.fit(who.name, { w, max: 8 * u, lines: 1, font: nameFont }),
      font: nameFont,
      align: "center",
      color,
      upper: false,
    }) +
    2 * u;
  k.bar(x + w * 0.25, y, w * 0.5, Math.max(1, 0.25 * u), accent, 0);
  y += 4 * u;
  k.text(reason, {
    x: x + w * 0.08,
    y,
    w: w * 0.84,
    size: 2.7 * u,
    align: "center",
    color: soft,
    lh: 1.45,
  });
}

function signatures(k: Kit, x: number, w: number, y: number, color: string, soft: string) {
  const { u } = k;
  const t = CERT[k.locale];
  const [, org, date] = certFacts(k);
  const cw = w * 0.3;
  [
    [x, date, t.date],
    [x + w - cw, org, t.sign],
  ].forEach(([sx, value, label]) => {
    k.text(value as string, {
      x: sx as number,
      y,
      w: cw,
      size: Math.min(2.6 * u, k.fit(value as string, { w: cw, max: 2.6 * u, lines: 1, font: "b" })),
      align: "center",
      color,
      weight: 600,
    });
    k.bar(sx as number, y + 4.6 * u, cw, Math.max(1, 0.2 * u), soft, 0);
    k.text(label as string, {
      x: sx as number,
      y: y + 6.2 * u,
      w: cw,
      size: 2.2 * u,
      align: "center",
      color: soft,
      ls: 100,
      upper: true,
    });
  });
}

// ─── Certificates ────────────────────────────────────────────────────────────

const CERT: Record<TemplateLocale, Record<string, string>> = {
  en: {
    title: "Certificate",
    of: "of Achievement",
    to: "This certificate is proudly presented to",
    for: "for outstanding commitment to",
    date: "Date",
    sign: "Director",
  },
  ar: {
    title: "شهادة",
    of: "تقدير وإنجاز",
    to: "تُمنح هذه الشهادة بكل فخر إلى",
    for: "تقديرًا لتميّزه في",
    date: "التاريخ",
    sign: "المدير",
  },
};

/** Up to `count` jobs, stopping before one would run past `bottom`. */
function cvJobs(k: Kit, x: number, y: number, w: number, count = 2, bottom = k.H - 6 * k.u) {
  const { u, p } = k;
  const t = CV[k.locale];
  for (const job of t.jobs!.split(";").slice(0, count)) {
    const [role, company, dates] = job.split("|");
    const need =
      k.heightOf(role!, 3.1 * u, w * 0.66) +
      k.heightOf(company!, 2.7 * u, w) +
      k.heightOf(t.jobText!, 2.5 * u, w, "b", 1.5) +
      2.5 * u;
    if (y + need > bottom) break;
    const rh = k.text(role!, { x, y, w: w * 0.66, size: 3.1 * u, color: p.ink, weight: 700 });
    k.text(dates!, {
      x: x + w * 0.66,
      y: y + 0.3 * u,
      w: w * 0.34,
      size: 2.5 * u,
      color: p.soft,
      align: "right",
    });
    y += rh + 1 * u;
    y += k.text(company!, { x, y, w, size: 2.7 * u, color: p.primary, weight: 600 }) + 1.5 * u;
    y += k.text(t.jobText!, { x, y, w, size: 2.5 * u, color: p.soft, lh: 1.5 }) + 5 * u;
  }
  return y;
}

export function certClassic(k: Kit) {
  const { W, H, u, p } = k;
  const t = CERT[k.locale];
  k.bgSolid(p.surface);
  k.rect(4 * u, 4 * u, W - 8 * u, H - 8 * u, { fill: null, stroke: p.primary, sw: 1.2 * u });
  k.rect(7 * u, 7 * u, W - 14 * u, H - 14 * u, {
    fill: null,
    stroke: k.alpha(p.primary, 0.6),
    sw: 0.25 * u,
  });
  for (const [cx, cy] of [
    [7, 7],
    [W / u - 7, 7],
    [7, H / u - 7],
    [W / u - 7, H / u - 7],
  ] as const) {
    k.shape("diamond", cx * u - 2.5 * u, cy * u - 2.5 * u, 5 * u, 5 * u, { fill: p.primary });
  }
  const x = 16 * u;
  const w = W - 32 * u;
  k.icon("award", W / 2 - 4.5 * u, 12 * u, 9 * u, p.primary, { stroke: 1.5 });
  k.text(t.title!, { x, y: 23 * u, w, size: 9.5 * u, font: "h", align: "center", color: p.ink });
  k.text(t.of!, {
    x,
    y: 34.5 * u,
    w,
    size: 3.3 * u,
    align: "center",
    color: p.primary,
    ls: 300,
    upper: true,
    weight: 600,
  });
  certBody(k, x, w, 43 * u, p.ink, p.soft, p.primary);
  signatures(k, x + 6 * u, w - 12 * u, H - 22 * u, p.ink, p.soft);
  const seal = k.pick(p.surface, [p.primary, p.accent], 2.2);
  k.path(PATHS.burst, W / 2 - 7 * u, H - 24 * u, 14 * u, 14 * u, { fill: seal });
  k.icon("star", W / 2 - 3 * u, H - 20 * u, 6 * u, k.on(seal));
}

export function certModern(k: Kit) {
  const { W, H, u, p } = k;
  const t = CERT[k.locale];
  const [, org] = certFacts(k);
  k.bgSolid(p.surface);
  const bw = W * 0.26;
  k.rect(0, 0, bw, H, { fill: k.grad([p.primary, p.secondary], 165) });
  k.path(PATHS.blob1, -12 * u, H - 40 * u, 50 * u, 50 * u, { fill: k.alpha("#FFFFFF", 0.14) });
  const on = k.on(p.primary);
  k.icon(k.ic(), bw / 2 - 9 * u, 16 * u, 18 * u, on, { stroke: 1.5 });
  k.text(org, {
    x: 4 * u,
    y: 40 * u,
    w: bw - 8 * u,
    size: k.fit(org, { w: bw - 8 * u, max: 5 * u, lines: 3 }),
    font: "h",
    align: "center",
    color: on,
  });
  const x = bw + 10 * u;
  const w = W - x - 10 * u;
  k.text(t.title!, { x, y: 14 * u, w, size: 9 * u, font: "h", align: "center", color: p.ink });
  k.text(t.of!, {
    x,
    y: 25 * u,
    w,
    size: 3.3 * u,
    align: "center",
    color: p.primary,
    ls: 300,
    upper: true,
    weight: 700,
  });
  certBody(k, x, w, 37 * u, p.ink, p.soft, p.primary);
  signatures(k, x, w, H - 20 * u, p.ink, p.soft);
}

export function certRibbon(k: Kit) {
  const { W, H, u, p } = k;
  const t = CERT[k.locale];
  k.bgSolid(p.bg);
  k.rect(0, 0, W, 4 * u, { fill: p.primary });
  k.rect(0, H - 4 * u, W, 4 * u, { fill: p.primary });
  k.shape("triangle", -6 * u, -6 * u, 30 * u, 30 * u, { fill: p.secondary, rotation: 135 });
  k.shape("triangle", W - 24 * u, H - 24 * u, 30 * u, 30 * u, { fill: p.secondary, rotation: -45 });
  const x = 14 * u;
  const w = W - 28 * u;
  k.text(t.title!, { x, y: 14 * u, w, size: 11 * u, font: "h", align: "center", color: p.primary });
  k.text(t.of!, {
    x,
    y: 28 * u,
    w,
    size: 3.6 * u,
    align: "center",
    color: p.ink,
    ls: 300,
    upper: true,
    weight: 700,
  });
  certBody(k, x, w, 40 * u, p.ink, p.soft, p.accent);
  signatures(k, x + 8 * u, w - 16 * u, H - 24 * u, p.ink, p.soft);
  k.circle(W / 2, H - 19 * u, 9 * u, { fill: p.accent, stroke: p.surface, sw: 0.8 * u });
  k.icon("award", W / 2 - 5 * u, H - 24 * u, 10 * u, k.on(p.accent));
}

// ─── Menus ───────────────────────────────────────────────────────────────────

function price(k: Kit, i: number) {
  const value = [12, 9, 14, 7, 11, 8][i % 6]!;
  return k.locale === "ar" ? `${value * 4} ر.س` : `$${value}`;
}

export function menuClassic(k: Kit) {
  const { W, H, u, p, c } = k;
  k.bgSolid(p.bg);
  k.rect(5 * u, 5 * u, W - 10 * u, H - 10 * u, {
    fill: null,
    stroke: k.alpha(p.primary, 0.7),
    sw: 0.3 * u,
  });
  const x = 14 * u;
  const w = W - 28 * u;
  k.icon(k.ic(), W / 2 - 4 * u, 10 * u, 8 * u, p.primary, { stroke: 1.5 });
  k.text(c.name, {
    x,
    y: 19 * u,
    w,
    size: k.fit(c.name, { w, max: 10 * u, lines: 1 }),
    font: "h",
    align: "center",
    color: p.ink,
  });
  k.text(c.kicker, {
    x,
    y: 31 * u,
    w,
    size: 2.8 * u,
    align: "center",
    color: p.primary,
    ls: 300,
    upper: true,
    weight: 700,
  });
  k.bar(W / 2 - 15 * u, 37 * u, 30 * u, Math.max(1, 0.3 * u), p.primary, 0);
  let y = 42 * u;
  k.text(c.title, {
    x,
    y,
    w,
    size: k.fit(c.title, { w, max: 5.5 * u, lines: 1 }),
    font: "h",
    align: "center",
    color: p.ink,
  });
  y += 8 * u;
  k.text(c.subtitle, { x, y, w, size: 2.8 * u, align: "center", color: p.soft, italic: true });
  y += 10 * u;
  const items = c.items.slice(0, 6);
  const bodyH = k.heightOf(c.body, 2.8 * u, w * 0.8);
  const step = Math.min(13 * u, (H - y - 24 * u - bodyH) / Math.max(1, items.length));
  items.forEach((item, i) => {
    const iy = y + i * step;
    const nameW = Math.min(w * 0.62, k.measure(item, 4 * u, k.family("b", item)) + 2 * u);
    k.text(item, { x, y: iy, w: w * 0.66, size: 4 * u, color: p.ink, weight: 700 });
    for (let dx = nameW + 2 * u; dx < w * 0.84; dx += 2.2 * u)
      k.circle(x + dx, iy + 3.2 * u, 0.3 * u, { fill: k.alpha(p.soft, 0.7) });
    k.text(price(k, i), {
      x: x + w * 0.84,
      y: iy,
      w: w * 0.16,
      size: 4 * u,
      align: "right",
      color: p.primary,
      weight: 800,
    });
  });
  const by = y + items.length * step + 4 * u;
  k.text(c.body, {
    x: x + w * 0.1,
    y: by,
    w: w * 0.8,
    size: 2.8 * u,
    align: "center",
    color: p.soft,
    italic: true,
  });
  k.text([c.place, c.handle].filter(Boolean).join("  ·  "), {
    x,
    y: H - 16 * u,
    w,
    size: 2.8 * u,
    align: "center",
    color: p.soft,
    weight: 600,
  });
}

export function menuModern(k: Kit) {
  const { W, H, u, p, c } = k;
  k.bgSolid(p.bg);
  const headH = H * 0.26;
  k.frame(0, 0, W, headH, { color: p.bg2 });
  k.rect(0, headH - 18 * u, W, 18 * u, {
    fill: k.alpha(p.ink === "#FFFFFF" ? "#000000" : p.ink, 0.6),
  });
  k.text(c.name, {
    x: 8 * u,
    y: headH - 15 * u,
    w: W - 16 * u,
    size: k.fit(c.name, { w: W - 16 * u, max: 10 * u, lines: 1 }),
    font: "h",
    color: "#FFFFFF",
  });
  let y = headH + 6 * u;
  k.pill(c.kicker, 8 * u, y, { size: 2.8 * u, fill: p.primary, upper: true, ls: 80 });
  y += 9.5 * u;
  k.text(c.title, {
    x: 8 * u,
    y,
    w: W - 16 * u,
    size: k.fit(c.title, { w: W - 16 * u, max: 6 * u, lines: 1 }),
    font: "h",
    color: p.ink,
  });
  y += 10 * u;
  const cols = 2;
  const cw = (W - 16 * u - 4 * u) / cols;
  const ch = Math.min(26 * u, (H - y - 16 * u) / 2 - 4 * u);
  c.items.slice(0, 4).forEach((item, i) => {
    const cx = 8 * u + (i % cols) * (cw + 4 * u);
    const cy = y + Math.floor(i / cols) * (ch + 4 * u);
    k.rect(cx, cy, cw, ch, {
      fill: p.surface,
      r: 3 * u,
      shadow: { color: k.alpha("#000000", 0.08), blur: 20, y: 6 },
    });
    k.icon(k.ic(i), cx + 4 * u, cy + 4 * u, 7 * u, p.primary);
    k.text(price(k, i), {
      x: cx + cw / 2,
      y: cy + 5 * u,
      w: cw / 2 - 4 * u,
      size: 4 * u,
      color: p.primary,
      weight: 800,
      align: "right",
    });
    const size = k.fit(item, { w: cw - 8 * u, max: 3.6 * u, min: 2.2 * u, lines: 1, font: "b" });
    k.text(item, {
      x: cx + 4 * u,
      y: cy + ch - 4 * u - k.heightOf(item, size, cw - 8 * u),
      w: cw - 8 * u,
      size,
      color: p.ink,
      weight: 700,
    });
  });
  k.text([c.place, c.handle].filter(Boolean).join("  ·  "), {
    x: 8 * u,
    y: H - 11 * u,
    w: W - 16 * u,
    size: 2.8 * u,
    color: p.soft,
    weight: 600,
  });
}

// ─── Résumés ─────────────────────────────────────────────────────────────────

const CV: Record<TemplateLocale, Record<string, string>> = {
  en: {
    profile: "Profile",
    profileText:
      "Product designer with 8 years of experience turning complex problems into simple, beautiful products.",
    experience: "Experience",
    jobs: "Lead Product Designer|Bright Labs|2022 – Now;Senior UX Designer|Nova Audio|2019 – 2022;UI Designer|Pixel School|2017 – 2019",
    jobText: "Led design for core features used by millions and built the design system.",
    education: "Education",
    degree: "BA in Visual Communication|American University · 2017",
    skills: "Skills",
    skillList: "Product design|Prototyping|User research|Design systems|Motion",
    languages: "Languages",
    languageList: "English|Arabic|French",
    contact: "Contact",
  },
  ar: {
    profile: "نبذة",
    profileText: "مصممة منتجات بخبرة 8 سنوات في تحويل المشكلات المعقدة إلى منتجات بسيطة وجميلة.",
    experience: "الخبرات",
    jobs: "قائدة تصميم المنتجات|برايت لابز|2022 – الآن;مصممة تجربة مستخدم أولى|نوفا للصوتيات|2019 – 2022;مصممة واجهات|مدرسة بكسل|2017 – 2019",
    jobText: "قُدت تصميم ميزات أساسية يستخدمها الملايين وبنيت نظام التصميم.",
    education: "التعليم",
    degree: "بكالوريوس الاتصال المرئي|الجامعة الأمريكية · 2017",
    skills: "المهارات",
    skillList: "تصميم المنتجات|النماذج الأولية|أبحاث المستخدم|أنظمة التصميم|الحركة",
    languages: "اللغات",
    languageList: "العربية|الإنجليزية|الفرنسية",
    contact: "التواصل",
  },
};

function cvSection(
  k: Kit,
  title: string,
  x: number,
  y: number,
  w: number,
  color: string,
  accent: string,
) {
  const { u } = k;
  k.text(title, { x, y, w, size: 3.4 * u, font: "h", color, upper: true, ls: 150 });
  k.bar(x, y + 5.5 * u, 8 * u, 0.6 * u, accent, 0);
  return 9 * u;
}

export function resumeSidebar(k: Kit) {
  const { W, H, u, p } = k;
  const t = CV[k.locale];
  const who = person(k);
  k.bgSolid(p.surface);
  const sw = W * 0.37;
  const side = k.pick("#FFFFFF", [p.ink, p.primary, "#111111"], 4);
  const accent = k.pick(side, [p.primary, p.accent, p.secondary], 2.5);
  k.rect(0, 0, sw, H, { fill: side });
  const text = k.on(side);
  const r = sw * 0.26;
  k.circle(sw / 2, 10 * u + r, r + 1.2 * u, { fill: accent });
  k.frame(sw / 2 - r, 10 * u, 2 * r, 2 * r, { shape: "ellipse", color: p.bg2, photo: "people" });
  let y = 16 * u + 2 * r;
  const x = 6 * u;
  const w = sw - 12 * u;
  y += cvSection(k, t.contact!, x, y, w, text, accent);
  y += contacts(k, x, y, w, 2.3 * u, text, accent) + 5 * u;
  y += cvSection(k, t.skills!, x, y, w, text, accent);
  for (const skill of t.skillList!.split("|")) {
    k.text(skill, { x, y, w, size: 2.5 * u, color: text });
    k.rect(x, y + 4.5 * u, w, 0.6 * u, { fill: k.alpha(text, 0.2), r: 0.3 * u });
    k.rect(x, y + 4.5 * u, w * (0.6 + k.rand() * 0.35), 0.6 * u, { fill: accent, r: 0.3 * u });
    y += 7 * u;
  }
  y += 3 * u;
  y += cvSection(k, t.languages!, x, y, w, text, accent);
  k.text(t.languageList!.split("|").join("\n"), { x, y, w, size: 2.5 * u, color: text, lh: 1.6 });
  const mx = sw + 8 * u;
  const mw = W - mx - 8 * u;
  let my = 12 * u;
  my +=
    k.text(who.name, {
      x: mx,
      y: my,
      w: mw,
      size: k.fit(who.name, { w: mw, max: 9 * u, lines: 2 }),
      font: "h",
      color: p.ink,
      upper: false,
    }) +
    1.5 * u;
  my +=
    k.text(who.role, {
      x: mx,
      y: my,
      w: mw,
      size: 3.4 * u,
      color: p.primary,
      weight: 700,
      ls: 100,
      upper: true,
    }) +
    8 * u;
  my += cvSection(k, t.profile!, mx, my, mw, p.ink, p.primary);
  my +=
    k.text(t.profileText!, { x: mx, y: my, w: mw, size: 2.6 * u, color: p.soft, lh: 1.55 }) + 6 * u;
  my += cvSection(k, t.experience!, mx, my, mw, p.ink, p.primary);
  my = cvJobs(k, mx, my, mw, 2) + 1 * u;
  if (my < H - 26 * u) {
    my += cvSection(k, t.education!, mx, my, mw, p.ink, p.primary);
    const [degree, school] = t.degree!.split("|");
    my += k.text(degree!, { x: mx, y: my, w: mw, size: 3 * u, color: p.ink, weight: 700 }) + 1 * u;
    k.text(school!, { x: mx, y: my, w: mw, size: 2.6 * u, color: p.soft });
  }
}

export function resumeClassic(k: Kit) {
  const { W, H, u, p } = k;
  const t = CV[k.locale];
  const who = person(k);
  k.bgSolid(p.surface);
  k.rect(0, 0, W, 34 * u, { fill: p.bg2 });
  k.rect(0, 34 * u, W, 1 * u, { fill: p.primary });
  k.text(who.name, {
    x: 10 * u,
    y: 8 * u,
    w: W - 20 * u,
    size: k.fit(who.name, { w: W * 0.7, max: 10 * u, lines: 1 }),
    font: "h",
    color: p.ink,
    upper: false,
  });
  k.text(who.role, {
    x: 10 * u,
    y: 20 * u,
    w: W - 20 * u,
    size: 3.6 * u,
    color: p.primary,
    weight: 700,
    ls: 120,
    upper: true,
  });
  k.text([who.phone, who.email, k.c.handle].filter(Boolean).join("   ·   "), {
    x: 10 * u,
    y: 27 * u,
    w: W - 20 * u,
    size: 2.4 * u,
    color: p.soft,
  });
  const lx = 10 * u;
  const lw = W * 0.64 - 14 * u;
  let y = 44 * u;
  y += cvSection(k, t.profile!, lx, y, lw, p.ink, p.primary);
  y += k.text(t.profileText!, { x: lx, y, w: lw, size: 2.6 * u, color: p.soft, lh: 1.55 }) + 6 * u;
  y += cvSection(k, t.experience!, lx, y, lw, p.ink, p.primary);
  cvJobs(k, lx, y, lw, 2);
  const rx = W * 0.64 + 2 * u;
  const rw = W - rx - 10 * u;
  let ry = 44 * u;
  ry += cvSection(k, t.skills!, rx, ry, rw, p.ink, p.primary);
  // Skills flow side by side, wrapping to new rows.
  let sx = 0;
  for (const skill of t.skillList!.split("|")) {
    const pw = k.measure(skill, 2.3 * u, k.family("b", skill)) + 2.3 * u * 2.4;
    if (sx > 0 && sx + pw > rw) {
      sx = 0;
      ry += 7 * u;
    }
    sx +=
      k.pill(skill, rx + sx, ry, { size: 2.3 * u, fill: p.bg2, color: p.ink, h: 5.6 * u }) +
      1.5 * u;
  }
  ry += 12 * u;
  ry += cvSection(k, t.education!, rx, ry, rw, p.ink, p.primary);
  const [degree, school] = t.degree!.split("|");
  ry += k.text(degree!, { x: rx, y: ry, w: rw, size: 2.9 * u, color: p.ink, weight: 700 }) + 1 * u;
  ry += k.text(school!, { x: rx, y: ry, w: rw, size: 2.5 * u, color: p.soft }) + 8 * u;
  // Languages only when the column still has room.
  const langs = t.languageList!.split("|").join("\n");
  if (ry + 9 * u + k.heightOf(langs, 2.5 * u, rw, "b", 1.6) < H - 6 * u) {
    ry += cvSection(k, t.languages!, rx, ry, rw, p.ink, p.primary);
    k.text(langs, { x: rx, y: ry, w: rw, size: 2.5 * u, color: p.soft, lh: 1.6 });
  }
  k.rect(0, H - 3 * u, W, 3 * u, { fill: p.primary });
}

export const PRINT_SINGLE = {
  logoBadge,
  logoMonogram,
  logoRing,
  logoWordmark,
  logoStamp,
  certClassic,
  certModern,
  certRibbon,
  menuClassic,
  menuModern,
  resumeSidebar,
  resumeClassic,
};

export const PRINT_DECKS = { bcMinimal, bcBand, bcDark, bcCorner };
