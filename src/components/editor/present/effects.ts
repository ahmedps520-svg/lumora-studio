"use client";

/**
 * Presenter "magic keys": confetti (C), bubbles (O) and a drumroll (D).
 * Small particle systems on a throwaway canvas over the slide, plus a
 * synthesised drumroll (WebAudio) — no assets, no libraries.
 */

const COLORS = ["#F72585", "#FF7A3D", "#FFD166", "#06D6A0", "#4CC9F0", "#7C6CF2", "#FFFFFF"];

function overlayCanvas(host: HTMLElement) {
  const canvas = document.createElement("canvas");
  const ratio = window.devicePixelRatio || 1;
  canvas.width = host.clientWidth * ratio;
  canvas.height = host.clientHeight * ratio;
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:30";
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ratio, ratio);
  return { canvas, ctx, width: host.clientWidth, height: host.clientHeight };
}

function run(
  host: HTMLElement,
  durationMs: number,
  /** `dt` = elapsed time in 60 fps frames, so motion is the same at any refresh rate. */
  frame: (ctx: CanvasRenderingContext2D, t: number, dt: number) => void,
) {
  const { canvas, ctx, width, height } = overlayCanvas(host);
  const start = performance.now();
  let last = start;
  const tick = (now: number) => {
    const t = (now - start) / 1000;
    const dt = Math.min(4, (now - last) / (1000 / 60));
    last = now;
    ctx.clearRect(0, 0, width, height);
    frame(ctx, t, dt);
    if (now - start < durationMs) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

export function confetti(host: HTMLElement) {
  const { clientWidth: w, clientHeight: h } = host;
  const pieces = Array.from({ length: 200 }, () => ({
    x: Math.random() * w,
    y: -20 - Math.random() * h * 0.4,
    vx: (Math.random() - 0.5) * 9,
    vy: 2 + Math.random() * 5,
    size: 6 + Math.random() * 8,
    spin: Math.random() * Math.PI,
    vs: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
  }));
  run(host, 5_000, (ctx, t, dt) => {
    for (const p of pieces) {
      p.vy = Math.min(p.vy + 0.06 * dt, 6);
      p.vx *= 0.99 ** dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += p.vs * dt;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 4));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  });
}

export function bubbles(host: HTMLElement) {
  const { clientWidth: w, clientHeight: h } = host;
  const items = Array.from({ length: 60 }, () => ({
    x: Math.random() * w,
    y: h + Math.random() * h * 0.6,
    r: 10 + Math.random() * 34,
    speed: 1.2 + Math.random() * 2.4,
    wobble: Math.random() * Math.PI * 2,
  }));
  run(host, 6_000, (ctx, t, dt) => {
    for (const b of items) {
      b.y -= b.speed * dt;
      const x = b.x + Math.sin(t * 2 + b.wobble) * 12;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(173, 216, 255, 0.18)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fill();
    }
  });
}

/** About two seconds of snare roll ending in a cymbal-ish crash. */
export function drumroll() {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const hit = (at: number, gain: number, length: number, filter: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = filter;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.001, at + length);
    src.connect(band).connect(amp).connect(ctx.destination);
    src.start(at, Math.random(), length);
  };
  const t0 = ctx.currentTime + 0.05;
  for (let i = 0; i < 44; i++) hit(t0 + i * 0.045, 0.12 + (i / 44) * 0.35, 0.06, 1800);
  hit(t0 + 2.05, 0.9, 1.4, 5200);
  window.setTimeout(() => void ctx.close(), 4_000);
}
