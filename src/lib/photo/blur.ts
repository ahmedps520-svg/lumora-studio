/** Fast blurs used by filters, adjustments and brushes (three box passes ≈ Gaussian). */
import type { Img } from "./pixels";

/** Box sizes for three passes approximating a Gaussian of `sigma`. */
function boxSizes(sigma: number, n = 3): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const iarr = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let ti = row;
    let li = row;
    let ri = row + r;
    const fv = src[row]!;
    const lv = src[row + w - 1]!;
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) val += src[row + Math.min(j, w - 1)]!;
    for (let j = 0; j <= r; j++) {
      val += (ri < row + w ? src[ri++]! : lv) - fv;
      dst[ti++] = val * iarr;
    }
    for (let j = r + 1; j < w - r; j++) {
      val += src[ri++]! - src[li++]!;
      dst[ti++] = val * iarr;
    }
    for (let j = Math.max(w - r, r + 1); j < w; j++) {
      val += lv - src[li++]!;
      dst[ti++] = val * iarr;
    }
  }
}

function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const iarr = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    let ti = x;
    let li = x;
    let ri = x + r * w;
    const fv = src[x]!;
    const lv = src[x + w * (h - 1)]!;
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) val += src[x + Math.min(j, h - 1) * w]!;
    for (let j = 0; j <= r; j++) {
      val += (ri < w * h ? src[ri]! : lv) - fv;
      if (ri < w * h) ri += w;
      dst[ti] = val * iarr;
      ti += w;
    }
    for (let j = r + 1; j < h - r; j++) {
      val += src[ri]! - src[li]!;
      li += w;
      ri += w;
      dst[ti] = val * iarr;
      ti += w;
    }
    for (let j = Math.max(h - r, r + 1); j < h; j++) {
      val += lv - src[li]!;
      li += w;
      dst[ti] = val * iarr;
      ti += w;
    }
  }
}

/** Gaussian-like blur of one channel, in place. */
export function blurChannel(ch: Float32Array, w: number, h: number, sigma: number) {
  if (sigma < 0.3 || w < 2 || h < 2) return;
  const tmp = new Float32Array(ch.length);
  for (const size of boxSizes(sigma)) {
    const r = Math.min(Math.floor((size - 1) / 2), Math.floor(Math.min(w, h) / 2) - 1);
    if (r < 1) continue;
    boxH(ch, tmp, w, h, r);
    boxV(tmp, ch, w, h, r);
  }
}

/** Box blur of one channel (single pass), in place. */
export function boxBlurChannel(ch: Float32Array, w: number, h: number, radius: number) {
  const r = Math.min(Math.round(radius), Math.floor(Math.min(w, h) / 2) - 1);
  if (r < 1) return;
  const tmp = new Float32Array(ch.length);
  boxH(ch, tmp, w, h, r);
  boxV(tmp, ch, w, h, r);
}

export function splitChannels(img: Img): Float32Array[] {
  const n = img.width * img.height;
  const chs = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const d = img.data;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    // Premultiplied, so transparent pixels don't bleed their colour.
    const a = d[i + 3]! / 255;
    chs[0]![p] = d[i]! * a;
    chs[1]![p] = d[i + 1]! * a;
    chs[2]![p] = d[i + 2]! * a;
    chs[3]![p] = d[i + 3]!;
  }
  return chs;
}

export function joinChannels(img: Img, chs: Float32Array[]) {
  const d = img.data;
  const n = img.width * img.height;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const a = chs[3]![p]!;
    const k = a > 0 ? 255 / a : 0;
    d[i] = chs[0]![p]! * k;
    d[i + 1] = chs[1]![p]! * k;
    d[i + 2] = chs[2]![p]! * k;
    d[i + 3] = a;
  }
}

/** Gaussian blur of a whole image (alpha-aware), in place. */
export function gaussianBlur(img: Img, radius: number) {
  const sigma = radius / 2;
  const chs = splitChannels(img);
  for (const ch of chs) blurChannel(ch, img.width, img.height, sigma);
  joinChannels(img, chs);
}

export function boxBlur(img: Img, radius: number) {
  const chs = splitChannels(img);
  for (const ch of chs) boxBlurChannel(ch, img.width, img.height, radius);
  joinChannels(img, chs);
}

/** Luminance (0–255) of every pixel. */
export function lumaChannel(img: Img): Float32Array {
  const n = img.width * img.height;
  const out = new Float32Array(n);
  const d = img.data;
  for (let p = 0, i = 0; p < n; p++, i += 4)
    out[p] = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
  return out;
}
