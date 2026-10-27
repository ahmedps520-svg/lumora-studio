/**
 * Snapping: while moving, a box's edges and centre lock onto guides and the
 * canvas edges/centre when they come within a few screen pixels.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapTargets {
  /** Vertical lines (x positions). */
  x: number[];
  /** Horizontal lines (y positions). */
  y: number[];
}

export function snapTargets(
  docW: number,
  docH: number,
  guides: { horizontal: number[]; vertical: number[] },
): SnapTargets {
  return {
    x: [0, docW / 2, docW, ...guides.vertical],
    y: [0, docH / 2, docH, ...guides.horizontal],
  };
}

function nearest(values: number[], targets: number[], threshold: number) {
  let best: { delta: number; at: number } | null = null;
  for (const v of values)
    for (const t of targets) {
      const d = t - v;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta)))
        best = { delta: d, at: t };
    }
  return best;
}

/** How far to nudge a box so it snaps, and which lines it snapped to. */
export function snapBox(box: Box, targets: SnapTargets, threshold: number) {
  const sx = nearest([box.x, box.x + box.width / 2, box.x + box.width], targets.x, threshold);
  const sy = nearest([box.y, box.y + box.height / 2, box.y + box.height], targets.y, threshold);
  return {
    dx: sx?.delta ?? 0,
    dy: sy?.delta ?? 0,
    lines: { x: sx ? [sx.at] : [], y: sy ? [sy.at] : [] },
  };
}

/** Snaps a single value (a crop edge, a guide) to the nearest target. */
export function snapValue(v: number, targets: number[], threshold: number): number {
  const s = nearest([v], targets, threshold);
  return s ? v + s.delta : v;
}
