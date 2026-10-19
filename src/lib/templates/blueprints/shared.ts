/** Building blocks shared by several blueprints. */
import type { Kit } from "../kit";

/** Date / time / place rows with small icons. Returns the height used. */
export function details(
  k: Kit,
  x: number,
  y: number,
  w: number,
  o: {
    size: number;
    color: string;
    iconColor?: string;
    align?: "left" | "center";
    gap?: number;
    max?: number;
  },
): number {
  const rows = (
    [
      ["calendar", k.c.date],
      ["clock", k.c.time],
      ["map-pin", k.c.place],
    ] as const
  )
    .filter(([, text]) => text)
    .slice(0, o.max ?? 3);
  const lineH = o.size * 1.5;
  const gap = o.gap ?? o.size * 0.7;
  let cy = y;
  for (const [icon, text] of rows) {
    if (o.align === "center") {
      k.text(text, { x, y: cy, w, size: o.size, color: o.color, align: "center", weight: 600 });
    } else {
      k.icon(
        icon,
        x,
        cy + (lineH - o.size * 1.2) / 2 - o.size * 0.1,
        o.size * 1.2,
        o.iconColor ?? o.color,
      );
      k.text(text, {
        x: x + o.size * 1.9,
        y: cy,
        w: w - o.size * 1.9,
        size: o.size,
        color: o.color,
        weight: 600,
      });
    }
    cy += lineH + gap;
  }
  return rows.length ? cy - y - gap : 0;
}

/** "Date · Time · Place" on one line (whatever exists). */
export function detailLine(k: Kit) {
  return [k.c.date, k.c.time, k.c.place].filter(Boolean).join("  ·  ");
}

/**
 * A short note beside a button: the first of `options` that fits `w` in at
 * most two lines, drawn vertically centred on a row `rowH` tall at `y`.
 */
export function sideNote(
  k: Kit,
  options: string[],
  x: number,
  y: number,
  w: number,
  rowH: number,
  o: { size: number; color: string },
) {
  const lineH = o.size * 1.4;
  const text = options.find((s) => s && k.heightOf(s, o.size, w) <= lineH * 2 + 1);
  if (!text || w < o.size * 4) return;
  const h = k.heightOf(text, o.size, w);
  k.text(text, {
    x,
    y: y + (rowH - h) / 2,
    w,
    size: o.size,
    color: o.color,
    align: "right",
    weight: 600,
  });
}

/** Items, falling back to something sensible when a theme has none. */
export function itemsOf(k: Kit, n = 4): string[] {
  const items = k.c.items.length ? k.c.items : [k.c.subtitle, k.c.body].filter(Boolean);
  return items.slice(0, n);
}

/** The headline stat ("50%", "OFF"), or null. */
export function statOf(k: Kit, i = 0): [string, string] | null {
  return k.c.stats[i] ?? null;
}
