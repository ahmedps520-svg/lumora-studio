"use client";
/**
 * A practice photo for the tutorial, painted on the spot (nothing to
 * download): a sunset over a lake, with a few dust spots to heal.
 */
import { ctx2d, getPixels } from "./runtime";
import { blankDoc, savePhoto } from "./storage";

export const PRACTICE_SIZE = { width: 1600, height: 1000 } as const;

function scene(g: CanvasRenderingContext2D, W: number, H: number) {
  const horizon = H * 0.62;
  // Sky.
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#26306E");
  sky.addColorStop(0.45, "#7A4C8F");
  sky.addColorStop(0.8, "#F07C6C");
  sky.addColorStop(1, "#FFD08A");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);
  // Sun and its glow.
  const sx = W * 0.7;
  const sy = horizon - 70;
  const glow = g.createRadialGradient(sx, sy, 20, sx, sy, 320);
  glow.addColorStop(0, "rgba(255,236,170,0.95)");
  glow.addColorStop(0.25, "rgba(255,200,130,0.55)");
  glow.addColorStop(1, "rgba(255,160,120,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, horizon);
  g.fillStyle = "#FFF1C2";
  g.beginPath();
  g.arc(sx, sy, 70, 0, Math.PI * 2);
  g.fill();
  // Soft clouds.
  g.fillStyle = "rgba(255,225,215,0.35)";
  for (const [cx, cy, rx, ry] of [
    [300, 180, 220, 34],
    [520, 150, 160, 26],
    [1200, 230, 260, 30],
    [980, 120, 140, 20],
  ] as const) {
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Mountains, back to front.
  const ridge = (base: number, peaks: [number, number][], color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, horizon);
    for (const [x, y] of peaks) g.lineTo(x * W, base - y);
    g.lineTo(W, horizon);
    g.closePath();
    g.fill();
  };
  ridge(
    horizon,
    [
      [0, 120],
      [0.12, 260],
      [0.25, 150],
      [0.38, 300],
      [0.52, 170],
      [0.66, 240],
      [0.8, 130],
      [0.92, 210],
      [1, 140],
    ],
    "#5A4A86",
  );
  ridge(
    horizon,
    [
      [0, 70],
      [0.1, 150],
      [0.2, 90],
      [0.33, 190],
      [0.47, 80],
      [0.6, 140],
      [0.75, 70],
      [0.88, 160],
      [1, 90],
    ],
    "#3B3768",
  );
  // Lake with the sun's reflection.
  const lake = g.createLinearGradient(0, horizon, 0, H);
  lake.addColorStop(0, "#40407A");
  lake.addColorStop(1, "#121733");
  g.fillStyle = lake;
  g.fillRect(0, horizon, W, H - horizon);
  for (let i = 0; i < 26; i++) {
    const y = horizon + 8 + i * 13;
    const w = 150 - i * 4.5 + Math.sin(i * 1.7) * 18;
    g.fillStyle = `rgba(255,210,150,${0.5 - i * 0.017})`;
    g.fillRect(sx - w / 2 + Math.sin(i * 2.3) * 14, y, Math.max(10, w), 3);
  }
  // Pine trees on the near shore.
  const pine = (x: number, base: number, h: number) => {
    g.fillStyle = "#0E1428";
    g.beginPath();
    g.moveTo(x, base - h);
    g.lineTo(x + h * 0.22, base);
    g.lineTo(x - h * 0.22, base);
    g.closePath();
    g.fill();
  };
  g.fillStyle = "#0E1428";
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(0, H * 0.78);
  g.quadraticCurveTo(W * 0.18, H * 0.72, W * 0.36, H * 0.84);
  g.lineTo(W * 0.36, H);
  g.closePath();
  g.fill();
  for (const [x, h] of [
    [60, 260],
    [150, 210],
    [230, 300],
    [320, 190],
    [410, 240],
    [490, 170],
  ] as const)
    pine(x, H * 0.82, h);
  // Birds.
  g.strokeStyle = "#1B1E3C";
  g.lineWidth = 3;
  g.lineCap = "round";
  for (const [x, y, s] of [
    [760, 300, 14],
    [800, 280, 10],
    [840, 310, 12],
  ] as const) {
    g.beginPath();
    g.moveTo(x - s, y - s * 0.4);
    g.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y);
    g.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y - s * 0.4);
    g.stroke();
  }
  // Dust spots to practise healing on.
  for (const [x, y, r] of [
    [420, 330, 7],
    [610, 410, 5],
    [1340, 160, 8],
    [1040, 330, 6],
    [250, 470, 6],
  ] as const) {
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, "rgba(20,15,30,0.85)");
    d.addColorStop(1, "rgba(20,15,30,0)");
    g.fillStyle = d;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

/** Makes and saves the practice photo; returns its id. */
export async function createPracticePhoto(name: string): Promise<string> {
  const doc = blankDoc(name, PRACTICE_SIZE.width, PRACTICE_SIZE.height, "#FFFFFF");
  const bg = doc.layers[0]!;
  scene(ctx2d(getPixels(bg.id).canvas), doc.width, doc.height);
  await savePhoto(doc);
  return doc.id;
}
