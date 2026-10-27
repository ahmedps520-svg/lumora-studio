/**
 * Pixel math for layer effects that canvas can't draw on its own
 * (bevel & emboss). Pure functions on alpha channels.
 */
import { blurChannel } from "./blur";

/**
 * Light and shade for a bevel: positive where the edge faces the light,
 * negative where it faces away, 0 on flat areas. `alpha` is 0–255 per pixel.
 */
export function bevelShading(
  alpha: Float32Array,
  width: number,
  height: number,
  opts: { size: number; angle: number; altitude: number; depth: number },
): Float32Array {
  const hgt = new Float32Array(alpha);
  if (opts.size > 0) blurChannel(hgt, width, height, Math.max(0.5, opts.size / 2));
  const a = (opts.angle * Math.PI) / 180;
  const alt = (Math.max(0, Math.min(90, opts.altitude)) * Math.PI) / 180;
  // Light direction (screen y points down, so "up" is negative y).
  const lx = Math.cos(alt) * Math.cos(a);
  const ly = -Math.cos(alt) * Math.sin(a);
  const lz = Math.sin(alt);
  const k = (opts.depth * 4) / Math.max(1, opts.size);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const l = hgt[x > 0 ? i - 1 : i]!;
      const r = hgt[x < width - 1 ? i + 1 : i]!;
      const u = hgt[y > 0 ? i - width : i]!;
      const d = hgt[y < height - 1 ? i + width : i]!;
      // Surface normal of the height field (heights in 0–1 units × depth).
      const nx = (-(r - l) / 510) * k * 64;
      const ny = (-(d - u) / 510) * k * 64;
      const len = Math.hypot(nx, ny, 1);
      out[i] = (nx * lx + ny * ly + lz) / len - lz;
    }
  return out;
}
