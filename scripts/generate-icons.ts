/**
 * `npm run icons` — renders the Lumora mark into every icon size we ship:
 * favicon (SVG), Apple touch icon, PWA icons (regular + maskable) and brand files.
 * The artwork matches src/components/brand/logo.tsx.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");

const GLYPHS = `
  <path d="M20 14h9v27h17v9H24a4 4 0 0 1-4-4z"/>
  <path d="M45 11c1.2 7.2 3.8 9.8 11 11-7.2 1.2-9.8 3.8-11 11-1.2-7.2-3.8-9.8-11-11 7.2-1.2 9.8-3.8 11-11z"/>
  <circle cx="54" cy="35" r="2" opacity="0.85"/>`;

const GRADIENT = `
  <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FF7A3D"/>
    <stop offset="1" stop-color="#F72585"/>
  </linearGradient>`;

/**
 * @param fullBleed square background with no rounded corners (iOS / maskable icons
 *                  are cropped by the OS, so art must sit inside the safe zone)
 * @param scale     how large the glyphs are relative to the tile
 */
function markSvg({ fullBleed = false, scale = 1 } = {}): string {
  const offset = 32 - 32 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>${GRADIENT}</defs>
  <rect width="64" height="64" ${fullBleed ? "" : 'rx="16"'} fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <g transform="translate(-6 1.5)" fill="#fff">${GLYPHS}</g>
  </g>
</svg>`;
}

const WORDMARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64" width="300" height="64">
  <defs>${GRADIENT}</defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <g transform="translate(-6 1.5)" fill="#fff">${GLYPHS}</g>
  <text x="80" y="43" font-family="Sora, Inter, 'Segoe UI', sans-serif" font-size="32" font-weight="600" fill="#0F172A" letter-spacing="-0.5">Lumora<tspan font-weight="400" fill="#64748B"> Studio</tspan></text>
</svg>`;

async function png(svg: string, size: number, file: string) {
  const density = Math.ceil((72 * size) / 64) * 2;
  await sharp(Buffer.from(svg), { density }).resize(size, size).png().toFile(file);
  console.log(`  ✔ ${path.relative(root, file)} (${size}×${size})`);
}

async function main() {
  const icons = path.join(root, "public", "icons");
  const brand = path.join(root, "public", "brand");
  mkdirSync(icons, { recursive: true });
  mkdirSync(brand, { recursive: true });

  console.log("\nGenerating Lumora icons…\n");

  // Favicon: Next.js serves src/app/icon.svg automatically.
  writeFileSync(path.join(root, "src", "app", "icon.svg"), markSvg());
  console.log("  ✔ src/app/icon.svg");

  writeFileSync(path.join(brand, "lumora-mark.svg"), markSvg());
  writeFileSync(path.join(brand, "lumora-wordmark.svg"), WORDMARK);
  console.log("  ✔ public/brand/lumora-mark.svg, lumora-wordmark.svg");

  await png(
    markSvg({ fullBleed: true, scale: 0.86 }),
    180,
    path.join(root, "src", "app", "apple-icon.png"),
  );
  await png(markSvg(), 192, path.join(icons, "icon-192.png"));
  await png(markSvg(), 512, path.join(icons, "icon-512.png"));
  await png(markSvg({ fullBleed: true, scale: 0.7 }), 512, path.join(icons, "maskable-512.png"));

  console.log("\nDone.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
